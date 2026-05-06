FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV RAG_WORKERS=2
WORKDIR /app

COPY requirements.txt .
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir -r requirements.txt

COPY . /app

RUN addgroup --system --gid 10004 rag && \
    adduser --system --uid 10004 --ingroup rag rag && \
    mkdir -p /app/data/chroma && \
    chown -R rag:rag /app

USER rag
EXPOSE 8100

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=20s \
    CMD curl -fsS http://localhost:8100/api/rag/health || exit 1

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port 8100 --workers ${RAG_WORKERS}"]
