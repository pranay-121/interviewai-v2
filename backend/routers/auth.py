import secrets
import uuid
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
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

router = APIRouter()

# ── Schemas ───────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str

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

# ── Send reset email ──────────────────────────────────────────
async def send_reset_email(to_email: str, token: str, link: str) -> bool:
    smtp_email = os.getenv("SMTP_EMAIL", "")
    smtp_password = os.getenv("SMTP_PASSWORD", "")
    if not smtp_email or not smtp_password:
        print(f"[EMAIL] SMTP not configured. Token: {token}")
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Reset your InterviewAI password"
        msg["From"] = f"InterviewAI <{smtp_email}>"
        msg["To"] = to_email
        html = f"""
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:32px;background:#0f0f1a;border-radius:16px">
          <div style="text-align:center;margin-bottom:24px">
            <div style="width:48px;height:48px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:12px;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:18px">AI</div>
            <h2 style="color:#fff;margin:12px 0 4px">Reset your password</h2>
          </div>
          <p style="color:#94a3b8;font-size:14px;line-height:1.7">
            Click the button below to reset your InterviewAI password. Expires in <strong style="color:#fff">15 minutes</strong>.
          </p>
          <div style="text-align:center;margin:28px 0">
            <a href="{link}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:600;font-size:15px">
              Reset Password
            </a>
          </div>
          <div style="background:#1e1e30;border-radius:10px;padding:14px 18px;margin-bottom:20px">
            <p style="color:#64748b;font-size:12px;margin:0 0 6px">Or paste this token manually:</p>
            <code style="color:#a5b4fc;font-size:13px;word-break:break-all">{token}</code>
          </div>
          <p style="color:#475569;font-size:12px;text-align:center">If you didn't request this, ignore this email.</p>
        </div>
        """
        msg.attach(MIMEText(html, "html"))
        await aiosmtplib.send(
            msg, hostname="smtp.gmail.com", port=465,
            use_tls=True, username=smtp_email, password=smtp_password, timeout=30,
        )
        print(f"[EMAIL] ✅ Sent to {to_email}")
        return True
    except Exception as e:
        print(f"[EMAIL] ❌ {e}")
        return False

# ── Register (email/password) ─────────────────────────────────
@router.post("/register")
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(User).where(User.email == body.email))
    existing = r.scalar_one_or_none()
    if existing:
        # If registered via Google before, link password
        if not existing.hashed_password or existing.hashed_password == "":
            existing.hashed_password = hash_password(body.password)
            if body.full_name:
                existing.full_name = body.full_name
            await db.commit()
            return make_response(existing, is_new=False)
        raise HTTPException(409, "Email already registered. Please login instead.")
    if len(body.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters.")
    user = User(
        id=str(uuid.uuid4()),
        email=body.email,
        full_name=body.full_name,
        hashed_password=hash_password(body.password),
        is_verified=True,
    )
    db.add(user)
    await db.commit()
    return make_response(user, is_new=True)

# ── Login (email/password) ────────────────────────────────────
@router.post("/login")
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(User).where(User.email == body.email))
    user = r.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "No account found with this email. Please register first.")
    # User registered via Google — no password set
    if not user.hashed_password:
        raise HTTPException(400, "This account uses Google Sign-In. Please click 'Sign in with Google'.")
    if not verify_password(body.password, user.hashed_password):
        raise HTTPException(401, "Incorrect password. Please try again.")
    return make_response(user)

# ── Google Login / Register ───────────────────────────────────
@router.post("/google")
async def google_auth(body: GoogleRequest, db: AsyncSession = Depends(get_db)):
    # Verify token with Google
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://oauth2.googleapis.com/tokeninfo?id_token={body.id_token}",
            timeout=10.0,
        )
    if resp.status_code != 200:
        raise HTTPException(401, "Invalid Google token. Please try again.")

    data = resp.json()
    email = data.get("email")
    if not email:
        raise HTTPException(401, "Could not get email from Google.")
    if data.get("email_verified") != "true":
        raise HTTPException(401, "Google email not verified.")

    full_name = data.get("name") or data.get("given_name") or email.split("@")[0]
    avatar_url = data.get("picture", "")

    # Find existing user by email
    r = await db.execute(select(User).where(User.email == email))
    user = r.scalar_one_or_none()
    is_new = False

    if user:
        # Existing user — update Google info if missing
        updated = False
        if avatar_url and not user.avatar_url:
            user.avatar_url = avatar_url
            updated = True
        if updated:
            await db.commit()
        print(f"[GOOGLE] Existing user logged in: {email}")
    else:
        # New user — create account automatically
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

    return make_response(user, is_new=is_new)

# ── Forgot Password ───────────────────────────────────────────
@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(User).where(User.email == body.email))
    user = r.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "No account found with this email.")
    # Google-only account
    if not user.hashed_password:
        raise HTTPException(400, "This account uses Google Sign-In. Please login with Google.")

    token = secrets.token_urlsafe(32)
    reset_link = f"https://interviewai-beta-one.vercel.app/reset-password?token={token}"

    try:
        await redis_client.client.setex(f"pwd_reset:{token}", 900, body.email)
    except Exception as e:
        print(f"[RESET] Redis error: {e}")

    email_sent = await send_reset_email(body.email, token, reset_link)

    return {
        "message": "Reset email sent!" if email_sent else "Token generated.",
        "email_sent": email_sent,
        "reset_token": token,
        "reset_link": reset_link,
        "note": "Check your inbox." if email_sent else "SMTP not configured. Use the token directly.",
    }

# ── Reset Password ────────────────────────────────────────────
@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    if len(body.new_password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters.")
    email = None
    try:
        val = await redis_client.client.get(f"pwd_reset:{body.token}")
        email = val.decode() if isinstance(val, bytes) else val
    except Exception as e:
        print(f"[RESET] Redis error: {e}")
    if not email:
        raise HTTPException(400, "Token is invalid or expired (15 min limit).")
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
    return {"message": "Password reset successfully. You can now login."}

# ── Logout ────────────────────────────────────────────────────
@router.post("/logout")
async def logout():
    return {"message": "Logged out."}

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
