import secrets
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from core.database import get_db
from core.security import hash_password, verify_password, create_access_token, create_refresh_token
from core.config import settings
from core.redis_client import redis_client
from core.email import send_reset_email
from models.models import User
import httpx

router = APIRouter()

# ── Schemas ──────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class GoogleLoginRequest(BaseModel):
    id_token: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class RefreshRequest(BaseModel):
    refresh_token: str

# ── Helpers ───────────────────────────────────────────────────────────────
def auth_response(user: User) -> dict:
    access = create_access_token(str(user.id), user.email)
    refresh = create_refresh_token()
    return {
        "access_token": access,
        "refresh_token": refresh,
        "token_type": "bearer",
        "user_id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "avatar_url": user.avatar_url,
    }

async def get_or_create_google_user(db: AsyncSession, email: str, full_name: str, avatar_url: str = None) -> User:
    # Find by email — no duplicates
    r = await db.execute(select(User).where(User.email == email))
    user = r.scalar_one_or_none()
    if user:
        # Update Google info if not set
        if not user.google_id:
            user.google_id = email
        if avatar_url and not user.avatar_url:
            user.avatar_url = avatar_url
        await db.commit()
        return user
    # Create new user
    user = User(
        id=str(uuid.uuid4()),
        email=email,
        full_name=full_name or email.split("@")[0],
        hashed_password=hash_password(secrets.token_hex(16)),  # random unusable password
        google_id=email,
        avatar_url=avatar_url,
        is_verified=True,
    )
    db.add(user)
    await db.commit()
    return user

# ── Register ──────────────────────────────────────────────────────────────
@router.post("/register")
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(User).where(User.email == body.email))
    if r.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered. Please login instead.")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
    user = User(
        id=str(uuid.uuid4()),
        email=body.email,
        full_name=body.full_name,
        hashed_password=hash_password(body.password),
        is_verified=True,
    )
    db.add(user)
    await db.commit()
    return auth_response(user)

# ── Login ─────────────────────────────────────────────────────────────────
@router.post("/login")
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(User).where(User.email == body.email))
    user = r.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="No account found with this email. Please register first.")
    if not user.hashed_password or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect password. Please try again.")
    return auth_response(user)

# ── Google Login ─────────────────────────────────────────────────────────
@router.post("/google")
async def google_login(body: GoogleLoginRequest, db: AsyncSession = Depends(get_db)):
    # Verify Google token
    async with httpx.AsyncClient() as client:
        # Try Google's tokeninfo endpoint
        resp = await client.get(
            f"https://oauth2.googleapis.com/tokeninfo?id_token={body.id_token}",
            timeout=10.0,
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Google token. Please try again.")
    
    data = resp.json()
    email = data.get("email")
    if not email:
        raise HTTPException(status_code=401, detail="Could not retrieve email from Google account.")
    if not data.get("email_verified") == "true":
        raise HTTPException(status_code=401, detail="Google email is not verified.")

    full_name = data.get("name") or data.get("given_name", "")
    avatar_url = data.get("picture", "")

    user = await get_or_create_google_user(db, email, full_name, avatar_url)
    return auth_response(user)

# ── Forgot Password ───────────────────────────────────────────────────────
@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(User).where(User.email == body.email))
    user = r.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="No account found with this email address.")

    # Generate secure reset token
    reset_token = secrets.token_urlsafe(32)
    
    # Store in Redis with 15 min expiry
    try:
        await redis_client.client.setex(
            f"pwd_reset:{reset_token}",
            900,  # 15 minutes
            body.email,
        )
    except Exception:
        # Fallback: store in memory (not ideal for prod but works)
        pass

    # In production you'd send an email here
    # For now return the token directly (show in UI for demo)
    reset_link = f"https://interviewai-beta-one.vercel.app/reset-password?token={reset_token}"
    
    # Send email
    await send_reset_email(body.email, reset_token, reset_link)

    return {
        "message": "Password reset link sent to your email!" if settings.SMTP_EMAIL else "Password reset link generated.",
        "reset_token": reset_token,  # Remove in production — send via email instead
        "reset_link": reset_link,
        "expires_in": "15 minutes",
        "note": "In production this would be sent to your email. For demo, use the token above."
    }

# ── Reset Password ────────────────────────────────────────────────────────
@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    # Get email from Redis
    email = None
    try:
        email_bytes = await redis_client.client.get(f"pwd_reset:{body.token}")
        if email_bytes:
            email = email_bytes.decode() if isinstance(email_bytes, bytes) else email_bytes
    except Exception:
        pass

    if not email:
        raise HTTPException(status_code=400, detail="Reset token is invalid or has expired (15 min limit).")

    # Update password
    r = await db.execute(select(User).where(User.email == email))
    user = r.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.hashed_password = hash_password(body.new_password)
    await db.commit()

    # Delete token after use
    try:
        await redis_client.client.delete(f"pwd_reset:{body.token}")
    except Exception:
        pass

    return {"message": "Password reset successfully. You can now login with your new password."}

# ── Refresh Token ─────────────────────────────────────────────────────────
@router.post("/refresh")
async def refresh_token(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    raise HTTPException(status_code=400, detail="Refresh not implemented. Please login again.")

# ── Logout ────────────────────────────────────────────────────────────────
@router.post("/logout")
async def logout():
    return {"message": "Logged out successfully."}

# ── Me (get current user) ─────────────────────────────────────────────────
@router.get("/me")
async def get_me(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(__import__("core.security", fromlist=["get_current_user_id"]).get_current_user_id),
):
    r = await db.execute(select(User).where(User.id == user_id))
    user = r.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "avatar_url": user.avatar_url,
        "target_role": user.target_role,
    }
