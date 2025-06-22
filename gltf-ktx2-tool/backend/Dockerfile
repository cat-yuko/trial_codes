FROM node:22-bookworm-slim

# Install dependencies for glTF-Transform and toktx
RUN apt-get update && apt-get install -y --no-install-recommends \
    cmake \
    build-essential \
    curl \
    wget \
    ca-certificates \
    git  && \
    mkdir -p /app/uploads /app/converted

# Install gltf-transform
RUN npm install -g @gltf-transform/cli

# Install toktx
RUN wget https://github.com/KhronosGroup/KTX-Software/releases/download/v4.4.0/KTX-Software-4.4.0-Linux-x86_64.tar.bz2 \
    && tar -xjf KTX-Software-4.4.0-Linux-x86_64.tar.bz2 \
    && mv KTX-Software-4.4.0-Linux-x86_64/bin/toktx /usr/local/bin/ \
    && chmod +x /usr/local/bin/toktx \
    && rm -rf KTX-Software-4.4.0-Linux-x86_64*

WORKDIR /app

COPY . .

RUN npm install

EXPOSE 8000

CMD ["node", "app.js"]
