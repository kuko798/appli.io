FROM python:3.12-slim-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# CPU-only PyTorch (~hundreds of MB). Default pip torch pulls multi-GB CUDA stacks and fills small disks.
COPY requirements.docker.txt .
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu "torch>=2.1.0" \
    && pip install --no-cache-dir -r requirements.docker.txt

COPY server.py .

ENV APPLI_PYTORCH_HOST=0.0.0.0

EXPOSE 8000

# First model load can take several minutes; extend on slow hosts if health checks fail.
HEALTHCHECK --interval=30s --timeout=15s --start-period=600s --retries=5 \
    CMD curl -fsS http://127.0.0.1:8000/health || exit 1

CMD ["python", "server.py"]
