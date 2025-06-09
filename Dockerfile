# === ビルドステージ ===
FROM python:3.13-slim-bullseye AS build

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# 作業ディレクトリ
WORKDIR /app

# 非rootユーザー（UID固定でproductionと合わせる）
RUN useradd -u 1000 -m appuser

# 開発・ビルドに必要なパッケージ
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libmysqlclient-dev \
    && apt-get -y clean \
    && rm -rf /var/lib/apt/lists/*

# 要求ライブラリをコピーして wheel 化し、実行ステージでは ビルドツール（build-essentialなど）を含めない
COPY requirements.txt ./
RUN pip install --upgrade pip && \
    pip wheel --no-cache-dir --wheel-dir /wheels -r requirements.txt

# コードを全コピー
COPY . .
RUN python manage.py collectstatic --noinput \
    && chown -R appuser:appuser /app/static


# === 実行ステージ ===
FROM python:3.13-slim-bullseye AS production

# 非rootユーザー（UID固定でbuildと一致）
RUN useradd -u 1000 -m appuser

# 作業ディレクトリ
WORKDIR /app

# wheel + requirements をコピーして最小限のインストール
COPY --from=build /wheels /wheels
COPY --from=build /requirements.txt .

RUN apt-get update && apt-get install -y --no-install-recommends \
    libmysqlclient21 \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache /wheels/* \
    && rm -rf /wheels

# アプリケーションコードと collectstatic 済みファイルをコピー
COPY --from=build /app /app

# 権限調整
RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

CMD ["gunicorn", "your_project_dir.wsgi:application", "--bind", "0.0.0.0:8000", "--workers=2", "--timeout=60"]
