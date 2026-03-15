import re
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi import Limiter
from slowapi.util import get_remote_address
from pydantic import BaseModel, EmailStr, field_validator
from core.database import get_db
from core.security import (hash_password, verify_password, create_access_token,
                            create_refresh_token, get_current_user_id, verify_google_token)
from core.redis_client import redis_client
from services.user_service import UserService

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str

    @field_validator("password")
    @classmethod
    def strong_password(cls, v):
        if len(v) < 8: raise ValueError("At least 8 characters")
        if not re.search(r"[A-Z]", v): raise ValueError("Need uppercase letter")
        if not re.search(r"\d", v): raise ValueError("Need a digit")
        return v

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class GoogleLoginRequest(BaseModel):
    id_token: str

class RefreshRequest(BaseModel):
    user_id: str
    refresh_token: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    full_name: str | None = None

@router.post("/register", response_model=TokenResponse, status_code=201)
@limiter.limit("5/minute")
async def register(request: Request, body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    if await UserService.get_by_email(db, body.email):
        raise HTTPException(status_code=409, detail="Email already registered")
    user = await UserService.create_user(db, email=body.email,
                                          hashed_password=hash_password(body.password),
                                          full_name=body.full_name)
    access = create_access_token(user.id, user.email)
    refresh = create_refresh_token()
    await redis_client.setex(f"refresh:{user.id}", 30 * 86400, refresh)
    return TokenResponse(access_token=access, refresh_token=refresh,
                         user_id=user.id, email=user.email, full_name=user.full_name)

@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(request: Request, body: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await UserService.get_by_email(db, body.email)
    if not user or not user.hashed_password or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabled")
    access = create_access_token(user.id, user.email)
    refresh = create_refresh_token()
    await redis_client.setex(f"refresh:{user.id}", 30 * 86400, refresh)
    return TokenResponse(access_token=access, refresh_token=refresh,
                         user_id=user.id, email=user.email, full_name=user.full_name)

@router.post("/google", response_model=TokenResponse)
@limiter.limit("10/minute")
async def google_login(request: Request, body: GoogleLoginRequest, db: AsyncSession = Depends(get_db)):
    google_data = await verify_google_token(body.id_token)
    user = await UserService.get_or_create_google_user(db, google_data)
    access = create_access_token(user.id, user.email)
    refresh = create_refresh_token()
    await redis_client.setex(f"refresh:{user.id}", 30 * 86400, refresh)
    return TokenResponse(access_token=access, refresh_token=refresh,
                         user_id=user.id, email=user.email, full_name=user.full_name)

@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    stored = await redis_client.get(f"refresh:{body.user_id}")
    if not stored or stored != body.refresh_token:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    user = await UserService.get_by_id(db, body.user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    access = create_access_token(user.id, user.email)
    new_refresh = create_refresh_token()
    await redis_client.setex(f"refresh:{user.id}", 30 * 86400, new_refresh)
    return TokenResponse(access_token=access, refresh_token=new_refresh,
                         user_id=user.id, email=user.email, full_name=user.full_name)

@router.post("/logout")
async def logout(user_id: str = Depends(get_current_user_id)):
    await redis_client.delete(f"refresh:{user_id}")
    return {"detail": "Logged out"}
