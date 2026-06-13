FROM python:3.12-slim

# ffmpeg for audio conversion
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY proxy.py .

RUN useradd -m cyborg && chown -R cyborg /app
USER cyborg

EXPOSE 8007

CMD ["uvicorn", "proxy:app", "--host", "0.0.0.0", "--port", "8007", "--workers", "2"]
