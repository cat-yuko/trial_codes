FROM node:20-alpine

WORKDIR /app

# 依存関係インストール
COPY package*.json ./
RUN npm ci

# ソースコピー
COPY . .

# 環境変数が必要ならここで設定（デフォルト値でも可）
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# ビルド（ビルドは production 固定でOK）
RUN npm run build

# 本番起動（docker-compose で `command` 上書き可能）
CMD ["npm", "run", "start"]
