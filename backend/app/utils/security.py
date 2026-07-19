import hashlib
import secrets

def hash_api_key(api_key: str) -> str:
    return hashlib.sha256(api_key.encode()).hexdigest()

def generate_api_key() -> str:
    return "rag_" + secrets.token_urlsafe(32)