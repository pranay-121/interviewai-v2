from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from pydantic import BaseModel
from typing import Optional, List
from core.database import get_db
from core.security import get_current_user_id
from models.models import User, InterviewSession
from services.user_service import UserService

router = APIRouter()

class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    target_role: Optional[str] = None
    experience_level: Optional[str] = None
    favorite_companies: Optional[List[str]] = None

@router.get("/me")
async def get_profile(db: AsyncSession = Depends(get_db), user_id: str = Depends(get_current_user_id)):
    user = await UserService.get_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    stats_r = await db.execute(
        select(func.count(InterviewSession.id).label("total"),
               func.avg(InterviewSession.overall_score).label("avg_score"))
        .where(InterviewSession.user_id == user_id, InterviewSession.status == "completed")
    )
    stats = stats_r.one()
    return {
        "id": user.id, "email": user.email, "full_name": user.full_name,
        "avatar_url": user.avatar_url, "target_role": user.target_role,
        "experience_level": user.experience_level,
        "favorite_companies": user.favorite_companies or [],
        "subscription_tier": user.subscription_tier,
        "created_at": user.created_at.isoformat(),
        "stats": {
            "total_interviews": stats.total or 0,
            "avg_score": round(float(stats.avg_score), 1) if stats.avg_score else None,
        },
    }

@router.put("/me")
async def update_profile(body: UpdateProfileRequest, db: AsyncSession = Depends(get_db),
                          user_id: str = Depends(get_current_user_id)):
    user = await UserService.get_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    await db.commit()
    return {"detail": "Updated"}

@router.get("/me/performance")
async def get_performance(db: AsyncSession = Depends(get_db), user_id: str = Depends(get_current_user_id)):
    r = await db.execute(
        select(InterviewSession)
        .where(InterviewSession.user_id == user_id, InterviewSession.status == "completed")
        .order_by(desc(InterviewSession.completed_at)).limit(50)
    )
    sessions = r.scalars().all()
    by_agent = {}
    for s in sessions:
        by_agent.setdefault(s.agent_type, []).append({
            "date": s.completed_at.isoformat() if s.completed_at else None,
            "score": s.overall_score, "job_role": s.job_role,
        })
    return {"performance_by_agent": by_agent}
