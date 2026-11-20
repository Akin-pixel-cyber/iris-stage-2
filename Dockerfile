# Iris: single container (Node 22 + SQLite). HTTPS (Caddy) is added in Stage 6.
FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app

# Install dependencies first so Docker can cache this layer
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
COPY scripts ./scripts
COPY public ./public

# Database and uploaded profile pictures live in /app/data (a Docker volume, so they survive restarts and rebuilds)
RUN mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
