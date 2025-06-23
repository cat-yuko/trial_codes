FROM node:20-slim

WORKDIR /app

# glTF-Transform & toktx 必要パッケージ
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install KTX-Software (toktx)
RUN wget https://github.com/KhronosGroup/KTX-Software/releases/download/v4.0.0/ktx-4.0.0-linux-x86_64.zip \
    && unzip ktx-4.0.0-linux-x86_64.zip -d /opt/ktx \
    && chmod +x /opt/ktx/bin/toktx \
    && ln -s /opt/ktx/bin/toktx /usr/local/bin/toktx

COPY package.json ./
RUN npm install

COPY . .

EXPOSE 3000
CMD ["node", "app.js"]
