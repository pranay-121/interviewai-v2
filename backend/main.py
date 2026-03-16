# from contextlib import asynccontextmanager
# from fastapi import FastAPI, Request
# from fastapi.middleware.cors import CORSMiddleware
# from fastapi.responses import JSONResponse
# from slowapi import Limiter, _rate_limit_exceeded_handler
# from slowapi.errors import RateLimitExceeded
# from slowapi.util import get_remote_address
# from core.config import settings
# from core.database import engine, Base
# from core.redis_client import redis_client
# from routers import auth, users, interviews, agents, social, companies

# limiter = Limiter(key_func=get_remote_address)

# @asynccontextmanager
# async def lifespan(app: FastAPI):
#     # Run database migrations automatically on startup
#     import subprocess
#     subprocess.run(["alembic", "upgrade", "head"], check=False)
    
#     # Create tables if they don't exist
#     async with engine.begin() as conn:
#         await conn.run_sync(Base.metadata.create_all)
    
#     await redis_client.connect()
#     yield
#     await redis_client.disconnect()
#     await engine.dispose()


# app = FastAPI(
#     title="InterviewAI API", version="2.0.0",
#     description="AI-powered interview preparation platform",
#     lifespan=lifespan,
#     docs_url="/docs", redoc_url="/redoc",
# )

# app.state.limiter = limiter
# app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=settings.get_allowed_origins(),
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# @app.middleware("http")
# async def security_headers(request: Request, call_next):
#     response = await call_next(request)
#     response.headers["X-Content-Type-Options"] = "nosniff"
#     response.headers["X-Frame-Options"] = "DENY"
#     response.headers["X-XSS-Protection"] = "1; mode=block"
#     return response

# app.include_router(auth.router, prefix="/auth", tags=["Auth"])
# app.include_router(users.router, prefix="/users", tags=["Users"])
# app.include_router(interviews.router, prefix="/interviews", tags=["Interviews"])
# app.include_router(agents.router, prefix="/agents", tags=["Agents"])
# app.include_router(social.router, prefix="/social", tags=["Social"])
# app.include_router(companies.router, prefix="/companies", tags=["Companies"])

# @app.get("/health")
# async def health():
#     return {"status": "healthy", "version": "2.0.0"}

# @app.exception_handler(404)
# async def not_found(request: Request, exc):
#     return JSONResponse(status_code=404, content={"detail": "Not found"})
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from core.config import settings
from core.database import engine, Base
from core.redis_client import redis_client
from routers import auth, users, interviews, agents, social, companies

limiter = Limiter(key_func=get_remote_address)

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await redis_client.connect()
    yield
    await redis_client.disconnect()
    await engine.dispose()

app = FastAPI(
    title="InterviewAI API", version="2.0.0",
    description="AI-powered interview preparation platform",
    lifespan=lifespan,
    docs_url="/docs", redoc_url="/redoc",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS fix ──────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://interviewai-pranay-kumbhares-projects.vercel.app",
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,
)

@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response

app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(users.router, prefix="/users", tags=["Users"])
app.include_router(interviews.router, prefix="/interviews", tags=["Interviews"])
app.include_router(agents.router, prefix="/agents", tags=["Agents"])
app.include_router(social.router, prefix="/social", tags=["Social"])
app.include_router(companies.router, prefix="/companies", tags=["Companies"])

@app.get("/health")
async def health():
    return {"status": "healthy", "version": "2.0.0"}

@app.exception_handler(404)
async def not_found(request: Request, exc):
    return JSONResponse(status_code=404, content={"detail": "Not found"})