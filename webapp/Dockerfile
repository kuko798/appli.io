FROM python:3.12-slim-bookworm

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py storage.py sync_runner.py classify_engine.py rules.py gmail_mime.py gmail_filters.py ./
COPY static ./static

RUN mkdir -p data

ENV APPLI_WEBAPP_HOST=0.0.0.0

EXPOSE 8766

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8766/api/health', timeout=5)"

CMD ["python", "main.py"]
