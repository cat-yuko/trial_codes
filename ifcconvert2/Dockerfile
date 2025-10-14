FROM python:3.11-slim

WORKDIR /app
COPY backend/requirements.txt .

RUN apt-get update && apt-get install -y \
    build-essential libglib2.0-0 libsm6 libxext6 libxrender-dev \
    && pip install --no-cache-dir -r requirements.txt

COPY backend /app
