from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_
from pydantic import BaseModel
from typing import Optional
from core.database import get_db
from core.security import get_current_user_id
from models.models import User, Friendship, InterviewGroup

router = APIRouter()

class GroupRequest(BaseModel):
    name: str
    description: Optional[str] = None
    topic: Optional[str] = None
    is_public: bool = True

# ── Search users ───────────────────────────────────────────────
@router.get("/users/search")
async def search_users(
    email: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    r = await db.execute(
        select(User.id, User.full_name, User.email, User.avatar_url, User.target_role)
        .where(User.email.ilike(f"%{email}%"), User.id != user_id)
        .limit(10)
    )
    users = r.all()
    return [
        {"id": u.id, "full_name": u.full_name, "email": u.email,
         "avatar_url": u.avatar_url, "target_role": u.target_role}
        for u in users
    ]

# ── Friends ────────────────────────────────────────────────────
@router.get("/friends")
async def list_friends(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    r = await db.execute(
        select(Friendship).where(
            and_(
                Friendship.status == "accepted",
                or_(Friendship.requester_id == user_id,
                    Friendship.addressee_id == user_id)
            )
        )
    )
    friendships = r.scalars().all()
    friend_ids = [
        f.addressee_id if f.requester_id == user_id else f.requester_id
        for f in friendships
    ]
    if not friend_ids:
        return []
    r = await db.execute(
        select(User.id, User.full_name, User.avatar_url, User.target_role)
        .where(User.id.in_(friend_ids))
    )
    return [{"id": row.id, "full_name": row.full_name,
             "avatar_url": row.avatar_url, "target_role": row.target_role}
            for row in r]

@router.get("/friends/pending")
async def pending_requests(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    r = await db.execute(
        select(Friendship).where(
            Friendship.addressee_id == user_id,
            Friendship.status == "pending"
        )
    )
    requests = r.scalars().all()
    result = []
    for req in requests:
        u = await db.execute(
            select(User.id, User.full_name, User.email)
            .where(User.id == req.requester_id)
        )
        user = u.one_or_none()
        if user:
            result.append({
                "friendship_id": req.id,
                "user_id": user.id,
                "full_name": user.full_name,
                "email": user.email
            })
    return result

@router.post("/friends/{target_id}")
async def send_friend_request(
    target_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    if target_id == user_id:
        raise HTTPException(status_code=400, detail="Cannot add yourself")
    # Check if already exists
    r = await db.execute(
        select(Friendship).where(
            or_(
                and_(Friendship.requester_id == user_id,
                     Friendship.addressee_id == target_id),
                and_(Friendship.requester_id == target_id,
                     Friendship.addressee_id == user_id)
            )
        )
    )
    if r.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Request already exists")
    db.add(Friendship(requester_id=user_id, addressee_id=target_id))
    await db.commit()
    return {"detail": "Friend request sent"}

@router.post("/friends/{friendship_id}/accept")
async def accept_friend(
    friendship_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    r = await db.execute(
        select(Friendship).where(
            Friendship.id == friendship_id,
            Friendship.addressee_id == user_id,
            Friendship.status == "pending"
        )
    )
    friendship = r.scalar_one_or_none()
    if not friendship:
        raise HTTPException(status_code=404, detail="Request not found")
    friendship.status = "accepted"
    await db.commit()
    return {"detail": "Friend request accepted"}

# ── Groups ─────────────────────────────────────────────────────
@router.get("/groups")
async def list_groups(
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    r = await db.execute(
        select(InterviewGroup).where(
            or_(InterviewGroup.owner_id == user_id,
                InterviewGroup.is_public == True)
        ).limit(50)
    )
    groups = r.scalars().all()
    return [{"id": g.id, "name": g.name, "description": g.description,
             "topic": g.topic, "member_count": len(g.member_ids or []),
             "is_public": g.is_public, "owner_id": g.owner_id}
            for g in groups]

@router.post("/groups", status_code=201)
async def create_group(
    body: GroupRequest,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    group = InterviewGroup(
        name=body.name, description=body.description,
        topic=body.topic, is_public=body.is_public,
        owner_id=user_id, member_ids=[user_id]
    )
    db.add(group)
    await db.commit()
    return {"id": group.id, "name": group.name}

@router.post("/groups/{group_id}/join")
async def join_group(
    group_id: str,
    db: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):
    r = await db.execute(
        select(InterviewGroup).where(InterviewGroup.id == group_id)
    )
    group = r.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    members = group.member_ids or []
    if user_id not in members:
        group.member_ids = members + [user_id]
        await db.commit()
    return {"detail": "Joined"}
