import os
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:123@localhost:5432/rag_eval"
    DATABASE_URL_SYNC: str = "postgresql+psycopg2://postgres:123@localhost:5432/rag_eval"
    TEST_DATABASE_URL: str = "postgresql+asyncpg://postgres:123@localhost:5432/rag_eval_test"
    
    # Cache & Queue
    REDIS_URL: str = "redis://localhost:6379/1"
    CELERY_BROKER_URL: str = "redis://localhost:6379/2"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/3"
    
    # API
    GROQ_API_KEY: str = ""
    CORS_ORIGINS: str = "*"
    ALLOWED_HOSTS: str = "*"
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"  # json or text
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )
    
    @model_validator(mode="after")
    def validate_production(self):
        if self.ENVIRONMENT.lower() == "production":
            if "123" in self.DATABASE_URL or "localhost" in self.DATABASE_URL:
                raise ValueError("Production must use non-default database credentials")
        return self
    
    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"
    
    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT.lower() == "development"
    
    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()