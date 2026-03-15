from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.models import User

class UserService:
    @staticmethod
    async def get_by_email(db: AsyncSession, email: str):
        r = await db.execute(select(User).where(User.email == email))
        return r.scalar_one_or_none()

    @staticmethod
    async def get_by_id(db: AsyncSession, user_id: str):
        r = await db.execute(select(User).where(User.id == user_id))
        return r.scalar_one_or_none()

    @staticmethod
    async def create_user(db: AsyncSession, email: str, hashed_password: str = None,
                          full_name: str = None, google_id: str = None, avatar_url: str = None):
        user = User(email=email, hashed_password=hashed_password, full_name=full_name,
                    google_id=google_id, avatar_url=avatar_url)
        db.add(user)
        await db.flush()
        return user

    @staticmethod
    async def get_or_create_google_user(db: AsyncSession, google_data: dict):
        google_id = google_data.get("sub")
        email = google_data.get("email")
        r = await db.execute(select(User).where(User.google_id == google_id))
        user = r.scalar_one_or_none()
        if not user:
            r = await db.execute(select(User).where(User.email == email))
            user = r.scalar_one_or_none()
            if user:
                user.google_id = google_id
                user.avatar_url = user.avatar_url or google_data.get("picture")
            else:
                user = await UserService.create_user(
                    db, email=email, full_name=google_data.get("name"),
                    google_id=google_id, avatar_url=google_data.get("picture")
                )
        await db.flush()
        return user
