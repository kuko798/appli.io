FROM python:3.12-slim-bookworm

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server.py pipeline.py chat_client.py search_web.py .

ENV APPLI_COMPANY_INTEL_HOST=0.0.0.0

EXPOSE 8780

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8780/health', timeout=5)"

CMD ["python", "server.py"]
