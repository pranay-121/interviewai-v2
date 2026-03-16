from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from core.database import engine, Base
from core.redis_client import redis_client
from routers import auth, users, interviews, agents, social, companies

limiter = Limiter(key_func=lambda r: r.client.host)

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("✅ Database OK")
    except Exception as e:
        print(f"❌ Database FAILED: {e}")
    try:
        await redis_client.connect()
        print("✅ Redis OK")
    except Exception as e:
        print(f"❌ Redis FAILED: {e}")
    yield
    try:
        await redis_client.disconnect()
        await engine.dispose()
    except Exception:
        pass

app = FastAPI(
    title="InterviewAI API",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response

@app.get("/health")
async def health():
    return {"status": "healthy", "version": "2.0.0"}

@app.get("/debug")
async def debug():
    import os
    return {
        "database_url_set": bool(os.getenv("DATABASE_URL")),
        "database_url_prefix": os.getenv("DATABASE_URL", "")[:30],
        "redis_url_set": bool(os.getenv("REDIS_URL")),
        "secret_key_set": bool(os.getenv("SECRET_KEY")),
        "anthropic_key_set": bool(os.getenv("ANTHROPIC_API_KEY")),
        "ai_provider": os.getenv("AI_PROVIDER"),
    }

@app.post("/test-db")
async def test_db():
    try:
        from core.database import AsyncSessionLocal
        async with AsyncSessionLocal() as db:
            from sqlalchemy import text
            await db.execute(text("SELECT 1"))
            return {"db": "✅ connected"}
    except Exception as e:
        return {"db": "❌ failed", "error": str(e)}

app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(users.router, prefix="/users", tags=["Users"])
app.include_router(interviews.router, prefix="/interviews", tags=["Interviews"])
app.include_router(agents.router, prefix="/agents", tags=["Agents"])
app.include_router(social.router, prefix="/social", tags=["Social"])
app.include_router(companies.router, prefix="/companies", tags=["Companies"])

@app.exception_handler(404)
async def not_found(request: Request, exc):
    return JSONResponse(status_code=404, content={"detail": "Not found"})

@app.exception_handler(500)
async def server_error(request: Request, exc):
    import traceback
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error": str(exc)}
    )