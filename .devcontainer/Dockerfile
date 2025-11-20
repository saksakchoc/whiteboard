FROM node:22-bullseye

# 作業ディレクトリ
WORKDIR /workspace

# sqlite3 の CLI も一応入れておく（なくてもいいけど便利）
RUN apt-get update && \
    apt-get install -y sqlite3 && \
    rm -rf /var/lib/apt/lists/*

# VSCode からは "node" ユーザーで入る想定
USER node
