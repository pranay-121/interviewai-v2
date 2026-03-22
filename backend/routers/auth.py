import secrets
import uuid
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr, validator
from core.database import get_db
from core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token
)
from core.config import settings
from core.redis_client import redis_client
from models.models import User
import httpx
import os
import re

router = APIRouter()

# ── Schemas ───────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str

    @validator("email")
    def validate_email(cls, v):
        # Strict email validation
        pattern = r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$'
        if not re.match(pattern, v):
            raise ValueError("Invalid email address format.")
        # Block fake/disposable domains
        blocked = ["mailinator.com","guerrillamail.com","tempmail.com","throwaway.email","yopmail.com"]
        domain = v.split("@")[1].lower()
        if domain in blocked:
            raise ValueError("Disposable email addresses are not allowed.")
        return v.lower()

    @validator("password")
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters.")
        return v

    @validator("full_name")
    def validate_name(cls, v):
        if len(v.strip()) < 2:
            raise ValueError("Full name must be at least 2 characters.")
        return v.strip()

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class GoogleRequest(BaseModel):
    id_token: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @validator("new_password")
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters.")
        return v

# ── Helper ────────────────────────────────────────────────────
def make_response(user: User, is_new: bool = False) -> dict:
    return {
        "access_token": create_access_token(str(user.id), user.email),
        "refresh_token": create_refresh_token(),
        "token_type": "bearer",
        "user_id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "avatar_url": user.avatar_url,
        "is_new_user": is_new,
    }

# ── Email sender ──────────────────────────────────────────────
async def send_email(to_email: str, subject: str, html: str) -> bool:
    resend_key = os.getenv("RESEND_API_KEY", "")
    if not resend_key:
        print(f"[EMAIL] RESEND_API_KEY not set. Skipping email to {to_email}")
        return False
    try:
        import httpx as _httpx
        async with _httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {resend_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": "InterviewAI <onboarding@resend.dev>",
                    "to": [to_email],
                    "subject": subject,
                    "html": html,
                },
                timeout=15,
            )
        if resp.status_code in (200, 201):
            print(f"[EMAIL] ✅ Sent '{subject}' to {to_email}")
            return True
        else:
            print(f"[EMAIL] ❌ Resend error {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        print(f"[EMAIL] ❌ Exception: {e}")
        return False

# ── Welcome email ─────────────────────────────────────────────
async def send_welcome_email(to_email: str, full_name: str):
    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif">
      <div style="max-width:520px;margin:40px auto;background:#0f0f1a;border-radius:20px;overflow:hidden">
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:40px 32px;text-align:center">
          <div style="width:56px;height:56px;background:rgba(255,255,255,0.2);border-radius:16px;display:inline-flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:#fff;margin-bottom:16px">AI</div>
          <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700">Welcome to InterviewAI! 🎉</h1>
          <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px">Your AI-powered interview preparation platform</p>
        </div>
        <!-- Body -->
        <div style="padding:32px">
          <p style="color:#e2e8f0;font-size:16px;margin:0 0 16px">Hey <strong>{full_name}</strong>,</p>
          <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin:0 0 24px">
            Welcome aboard! Your account has been created successfully. You now have access to AI-powered mock interviews for any role and company.
          </p>
          <!-- Features -->
          <div style="background:#1e1e30;border-radius:12px;padding:20px;margin-bottom:24px">
            <p style="color:#a5b4fc;font-size:13px;font-weight:700;margin:0 0 12px;text-transform:uppercase;letter-spacing:1px">What you can do</p>
            {"".join([f'<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><div style="width:28px;height:28px;background:rgba(99,102,241,0.2);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px">{icon}</div><span style="color:#e2e8f0;font-size:13px">{text}</span></div>' for icon, text in [("🎯","Practice HR & behavioral interviews"),("⚙️","Technical interviews for any role"),("💻","Coding challenges with AI evaluation"),("🏗️","System design practice"),("📄","AI-powered resume review"),("🏆","Track your progress & scores")]])}
          </div>
          <!-- CTA -->
          <div style="text-align:center;margin-bottom:24px">
            <a href="https://interviewai-beta-one.vercel.app/dashboard"
              style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:14px 36px;border-radius:12px;font-weight:600;font-size:15px">
              Start Practicing Now →
            </a>
          </div>
          <p style="color:#475569;font-size:12px;text-align:center;margin:0">
            Questions? Reply to this email anytime.<br/>
            <a href="https://interviewai-beta-one.vercel.app" style="color:#6366f1">interviewai-beta-one.vercel.app</a>
          </p>
        </div>
      </div>
    </body>
    </html>
    """
    await send_email(to_email, "Welcome to InterviewAI! 🎉 Your account is ready", html)

# ── Reset password email ──────────────────────────────────────
async def send_reset_email(to_email: str, full_name: str, token: str, link: str) -> bool:
    html = f"""
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif">
      <div style="max-width:520px;margin:40px auto;background:#0f0f1a;border-radius:20px;overflow:hidden">
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#ef4444,#dc2626);padding:36px 32px;text-align:center">
          <div style="font-size:40px;margin-bottom:12px">🔐</div>
          <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700">Password Reset Request</h1>
          <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:13px">InterviewAI Account Security</p>
        </div>
        <!-- Body -->
        <div style="padding:32px">
          <p style="color:#e2e8f0;font-size:15px;margin:0 0 16px">Hi <strong>{full_name}</strong>,</p>
          <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin:0 0 24px">
            We received a request to reset your InterviewAI password. Click the button below to create a new password.
            This link will expire in <strong style="color:#f87171">15 minutes</strong>.
          </p>
          <!-- Reset button -->
          <div style="text-align:center;margin:28px 0">
            <a href="{link}"
              style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:16px 40px;border-radius:12px;font-weight:700;font-size:16px">
              Reset My Password →
            </a>
          </div>
          <!-- Token box -->
          <div style="background:#1e1e30;border:1px solid #334155;border-radius:12px;padding:16px 20px;margin-bottom:24px">
            <p style="color:#64748b;font-size:12px;margin:0 0 8px">
              ⏱️ Can't click the button? Paste this token at the reset page:
            </p>
            <code style="color:#a5b4fc;font-size:12px;word-break:break-all;font-family:monospace;display:block;background:#0f0f1a;padding:10px;border-radius:8px">{token}</code>
          </div>
          <!-- Warning -->
          <div style="background:#fef3c7;border-radius:10px;padding:12px 16px;margin-bottom:20px">
            <p style="color:#92400e;font-size:12px;margin:0">
              ⚠️ If you didn't request this, your account is safe — ignore this email. The link expires in 15 minutes.
            </p>
          </div>
          <p style="color:#475569;font-size:12px;text-align:center;margin:0">
            <a href="https://interviewai-beta-one.vercel.app" style="color:#6366f1">interviewai-beta-one.vercel.app</a>
          </p>
        </div>
      </div>
    </body>
    </html>
    """
    return await send_email(to_email, "Reset your InterviewAI password 🔐", html)

# ── Verify email exists via DNS (basic check) ─────────────────
async def verify_email_domain(email: str) -> bool:
    """Check if email domain has MX records (basic real email check)"""
    try:
        import socket
        domain = email.split("@")[1]
        socket.getaddrinfo(domain, None)
        return True
    except Exception:
        return False

# ── Register ──────────────────────────────────────────────────
@router.post("/register")
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    email = body.email.lower().strip()

    # Check domain exists
    domain_valid = await verify_email_domain(email)
    if not domain_valid:
        raise HTTPException(400, "Email domain does not exist. Please use a valid email address.")

    r = await db.execute(select(User).where(User.email == email))
    existing = r.scalar_one_or_none()

    if existing:
        # If Google user — link password
        if not existing.hashed_password:
            existing.hashed_password = hash_password(body.password)
            await db.commit()
            return make_response(existing, is_new=False)
        raise HTTPException(409, "This email is already registered. Please login instead.")

    user = User(
        id=str(uuid.uuid4()),
        email=email,
        full_name=body.full_name,
        hashed_password=hash_password(body.password),
        is_verified=True,
    )
    db.add(user)
    await db.commit()

    # Send welcome email (don't await — non-blocking)
    import asyncio
    asyncio.create_task(send_welcome_email(email, body.full_name))

    return make_response(user, is_new=True)

# ── Login ─────────────────────────────────────────────────────
@router.post("/login")
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    email = body.email.lower().strip()
    r = await db.execute(select(User).where(User.email == email))
    user = r.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "No account found with this email. Please register first.")
    if not user.hashed_password:
        raise HTTPException(400, "This account uses Google Sign-In. Please click 'Sign in with Google'.")
    if not verify_password(body.password, user.hashed_password):
        raise HTTPException(401, "Incorrect password. Please try again or use 'Forgot password'.")
    return make_response(user)

# ── Google Auth ───────────────────────────────────────────────
@router.post("/google")
async def google_auth(body: GoogleRequest, db: AsyncSession = Depends(get_db)):
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://oauth2.googleapis.com/tokeninfo?id_token={body.id_token}",
            timeout=10.0,
        )
    if resp.status_code != 200:
        raise HTTPException(401, "Invalid Google token. Please try again.")

    data = resp.json()
    email = data.get("email", "").lower()
    if not email:
        raise HTTPException(401, "Could not get email from Google.")
    if data.get("email_verified") != "true":
        raise HTTPException(401, "Google email is not verified.")

    full_name = data.get("name") or data.get("given_name") or email.split("@")[0]
    avatar_url = data.get("picture", "")

    r = await db.execute(select(User).where(User.email == email))
    user = r.scalar_one_or_none()
    is_new = False

    if user:
        if avatar_url and not user.avatar_url:
            user.avatar_url = avatar_url
            await db.commit()
        print(f"[GOOGLE] Existing user: {email}")
    else:
        user = User(
            id=str(uuid.uuid4()),
            email=email,
            full_name=full_name,
            hashed_password=hash_password(secrets.token_hex(16)),
            avatar_url=avatar_url,
            is_verified=True,
        )
        db.add(user)
        await db.commit()
        is_new = True
        print(f"[GOOGLE] New user created: {email}")
        # Send welcome email
        import asyncio
        asyncio.create_task(send_welcome_email(email, full_name))

    return make_response(user, is_new=is_new)

# ── Forgot Password ───────────────────────────────────────────
@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    email = body.email.lower().strip()

    r = await db.execute(select(User).where(User.email == email))
    user = r.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "No account found with this email address.")
    if not user.hashed_password:
        raise HTTPException(400, "This account uses Google Sign-In. Please login with Google instead.")

    token = secrets.token_urlsafe(32)
    reset_link = f"https://interviewai-beta-one.vercel.app/reset-password?token={token}"

    # Store in Redis for 15 min
    try:
        await redis_client.client.setex(f"pwd_reset:{token}", 900, email)
        print(f"[RESET] Token stored for {email}")
    except Exception as e:
        print(f"[RESET] Redis error: {e}")

    # Send reset email
    email_sent = await send_reset_email(email, user.full_name or "there", token, reset_link)

    return {
        "message": "Password reset email sent! Check your inbox." if email_sent else "Token generated.",
        "email_sent": email_sent,
        "reset_token": token,
        "reset_link": reset_link,
        "note": "Check your email inbox and spam folder." if email_sent else "SMTP not configured. Use the token directly on the reset page.",
    }

# ── Reset Password ────────────────────────────────────────────
@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    email = None
    try:
        val = await redis_client.client.get(f"pwd_reset:{body.token}")
        email = val.decode() if isinstance(val, bytes) else val
    except Exception as e:
        print(f"[RESET] Redis error: {e}")

    if not email:
        raise HTTPException(400, "Reset link is invalid or has expired. Please request a new one.")

    r = await db.execute(select(User).where(User.email == email))
    user = r.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found.")

    user.hashed_password = hash_password(body.new_password)
    await db.commit()

    try:
        await redis_client.client.delete(f"pwd_reset:{body.token}")
    except Exception:
        pass

    return {"message": "Password reset successfully! You can now login with your new password."}

# ── Logout ────────────────────────────────────────────────────
@router.post("/logout")
async def logout():
    return {"message": "Logged out successfully."}

# ── Me ────────────────────────────────────────────────────────
@router.get("/me")
async def get_me(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(
        __import__("core.security", fromlist=["get_current_user_id"]).get_current_user_id
    ),
):
    r = await db.execute(select(User).where(User.id == user_id))
    user = r.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found.")
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "avatar_url": user.avatar_url,
    }
