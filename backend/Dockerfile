# ============================================================================
# Synapse Backend — Dockerfile
# Multi-stage build: lightweight production image
# ============================================================================

FROM python:3.11-slim AS base

# Prevent Python from writing .pyc files and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies required by bcrypt
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libffi-dev && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY app/ ./app/

# Render injects PORT dynamically; default to 8000 for local Docker builds
ENV PORT=8000
EXPOSE ${PORT}

# Health check (uses PORT env var)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen(f'http://localhost:{__import__(\"os\").environ.get(\"PORT\",8000)}/health')" || exit 1

# Run with Gunicorn + Uvicorn workers for production stability
# - Workers: 2 (fits Render free-tier 512MB RAM)
# - Timeout: 120s (AI responses can be slow)
# - Shell form so $PORT is expanded at runtime
CMD gunicorn -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --workers 2 --timeout 120 app.main:app
