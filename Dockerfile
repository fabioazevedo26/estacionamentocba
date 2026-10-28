# ---- Etapa de build: instala dependências (inclui ferramentas p/ módulos nativos) ----
FROM node:22-slim AS build
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- Imagem final ----
FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node . .
RUN mkdir -p /app/data/backups && chown -R node:node /app/data
USER node
EXPOSE 3001
CMD ["node", "src/server.js"]
