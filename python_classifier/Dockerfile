FROM python:3.12-slim-bookworm

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY service.py classifier_models.py rules.py hf_classify.py .

ENV APPLI_CLASSIFIER_HOST=0.0.0.0

EXPOSE 8765

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8765/docs', timeout=5)"

CMD ["python", "service.py"]
