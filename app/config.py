from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:123@localhost:5432/rag_eval"
    DATABASE_URL_SYNC: str = "postgresql://postgres:123@localhost:5432/rag_eval"
    TEST_DATABASE_URL: str = "postgresql+asyncpg://postgres:123@localhost:5432/rag_eval_test"
    REDIS_URL: str = "redis://localhost:6379/1"
    GROQ_API_KEY: str = ""
    SECRET_KEY: str = "dev-secret-key"
    
    model_config = SettingsConfigDict(env_file=".env")

@lru_cache()
def get_settings():
    return Settings()

settings = get_settings()