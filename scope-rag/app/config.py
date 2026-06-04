"""Configuration from environment variables."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Scope AI model routing. "auto" uses Gemini when a key exists, otherwise Ollama.
    scope_ai_provider: str = "auto"

    # Gemini (hosted free-tier friendly primary when GEMINI_API_KEY is set)
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    gemini_fallback_models: str = "gemini-2.5-flash-lite,gemini-2.0-flash"
    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta"
    gemini_timeout_seconds: int = 30
    gemini_max_output_tokens: int = 1536

    # Ollama (local LLM - free, no API key needed)
    ollama_base_url: str = "http://ollama:11434"
    ollama_model: str = "llama3.2:3b"
    embedding_model: str = "nomic-embed-text"  # Ollama embedding model
    ollama_num_ctx: int = 1024
    ollama_num_predict: int = 96
    ollama_num_thread: int = 4
    ollama_timeout_seconds: int = 45

    # ChromaDB
    chroma_persist_dir: str = "/app/data/chroma"
    chroma_collection_name: str = "scope-reviews"

    # Service URLs
    content_service_url: str = "http://content:8000/api/content"
    elasticsearch_url: str = "http://elasticsearch:9200"

    # JWT
    core_jwt_secret: str = ""
    core_jwt_issuer: str = "scope-core"
    core_jwt_audience: str = "scope-frontend"

    # HTTP security
    environment: str = "development"
    frontend_origin: str = ""
    development_frontend_origin: str = "http://localhost:5173"

    # App-level rate limiting. The Nginx edge also limits /api/rag, but this
    # protects the service when reached directly inside the private network.
    rag_rate_limit_enabled: bool = True
    rag_rate_limit_per_minute: int = 60
    rag_generation_rate_limit_per_minute: int = 10
    rag_ingest_rate_limit_per_minute: int = 5
    rag_rate_limit_redis_url: str = "redis://redis:6379/5"
    rag_ingest_required_role: str = "admin"

    # Kafka
    kafka_bootstrap_servers: str = "kafka:9092"
    kafka_enabled: bool = True

    # RAG
    retriever_top_k: int = 10
    app_catalog_top_k: int = 8
    max_context_tokens: int = 1200
    temperature: float = 0.3

settings = Settings()
