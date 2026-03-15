import uuid, enum
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import String, Text, Boolean, Integer, Float, DateTime, ForeignKey, Enum, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.database import Base

def now_utc(): return datetime.now(timezone.utc)
def new_uuid(): return str(uuid.uuid4())

class ExperienceLevel(str, enum.Enum):
    FRESHER = "fresher"; JUNIOR = "junior"; MID = "mid"; SENIOR = "senior"

class AgentType(str, enum.Enum):
    HR = "hr"; TECHNICAL = "technical"; CODING = "coding"
    SYSTEM_DESIGN = "system_design"; RESUME = "resume"

class InterviewStatus(str, enum.Enum):
    IN_PROGRESS = "in_progress"; COMPLETED = "completed"; ABANDONED = "abandoned"

class FriendshipStatus(str, enum.Enum):
    PENDING = "pending"; ACCEPTED = "accepted"; BLOCKED = "blocked"

class SubscriptionTier(str, enum.Enum):
    FREE = "free"; PREMIUM = "premium"

class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[Optional[str]] = mapped_column(String(255))
    full_name: Mapped[Optional[str]] = mapped_column(String(255))
    avatar_url: Mapped[Optional[str]] = mapped_column(String(512))
    google_id: Mapped[Optional[str]] = mapped_column(String(128), unique=True, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    subscription_tier: Mapped[SubscriptionTier] = mapped_column(Enum(SubscriptionTier), default=SubscriptionTier.FREE)
    resume_url: Mapped[Optional[str]] = mapped_column(String(512))
    target_role: Mapped[Optional[str]] = mapped_column(String(128))
    experience_level: Mapped[Optional[ExperienceLevel]] = mapped_column(Enum(ExperienceLevel))
    favorite_companies: Mapped[Optional[List]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)
    interviews: Mapped[List["InterviewSession"]] = relationship(back_populates="user")

class InterviewSession(Base):
    __tablename__ = "interview_sessions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    agent_type: Mapped[str] = mapped_column(String(30))
    job_role: Mapped[str] = mapped_column(String(128))
    company: Mapped[Optional[str]] = mapped_column(String(128))
    experience_level: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="in_progress")
    overall_score: Mapped[Optional[float]] = mapped_column(Float)
    total_questions: Mapped[int] = mapped_column(Integer, default=0)
    answered_questions: Mapped[int] = mapped_column(Integer, default=0)
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    user: Mapped["User"] = relationship(back_populates="interviews")
    messages: Mapped[List["InterviewMessage"]] = relationship(back_populates="session", cascade="all, delete-orphan", order_by="InterviewMessage.created_at")

class InterviewMessage(Base):
    __tablename__ = "interview_messages"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    session_id: Mapped[str] = mapped_column(ForeignKey("interview_sessions.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(20))
    content: Mapped[str] = mapped_column(Text)
    question_number: Mapped[Optional[int]] = mapped_column(Integer)
    score: Mapped[Optional[float]] = mapped_column(Float)
    feedback: Mapped[Optional[str]] = mapped_column(Text)
    suggested_answer: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    session: Mapped["InterviewSession"] = relationship(back_populates="messages")

class Friendship(Base):
    __tablename__ = "friendships"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    requester_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    addressee_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

class InterviewGroup(Base):
    __tablename__ = "interview_groups"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(128))
    description: Mapped[Optional[str]] = mapped_column(Text)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)
    member_ids: Mapped[List] = mapped_column(JSON, default=list)
    topic: Mapped[Optional[str]] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
