from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ENV: str = "development"
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "https://interviewai-beta-one.vercel.app"]

    DATABASE_URL: str = "postgresql+asyncpg://interviewai:secret123@localhost:5432/interviewai"
    REDIS_URL: str = "redis://localhost:6379/0"

    SECRET_KEY: str = "change-me-in-production-use-256-bit-random-string-here"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # AI Provider: "ollama" or "claude"
    AI_PROVIDER: str = "claude"
    ANTHROPIC_API_KEY: str = ""

    OLLAMA_BASE_URL: str = "http://localhost:11434"
    DEFAULT_LLM_MODEL: str = "llama3:8b"
    CODING_LLM_MODEL: str = "codellama:7b"
    HR_LLM_MODEL: str = "mistral:7b"
    RESUME_LLM_MODEL: str = "gemma:7b"

    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin123"
    MINIO_BUCKET: str = "interviewai"
    MINIO_SECURE: bool = False


settings = Settings()
