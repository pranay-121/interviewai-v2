from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ENV: str = "development"
    ALLOWED_ORIGINS_STR: str = "http://localhost:3000,https://interviewai-pranay-kumbhares-projects.vercel.app"

    DATABASE_URL: str = "postgresql+asyncpg://interviewai:secret123@localhost:5432/interviewai"
    REDIS_URL: str = "redis://localhost:6379/0"

    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # AI Provider: "groq" (free) or "claude" or "ollama"
    AI_PROVIDER: str = "groq"
    GROQ_API_KEY: str = ""
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

    @property
    def ALLOWED_ORIGINS(self):
        return [i.strip() for i in self.ALLOWED_ORIGINS_STR.split(",") if i.strip()]


settings = Settings()
