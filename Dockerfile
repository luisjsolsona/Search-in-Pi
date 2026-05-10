# ═══════════════════════════════════════════════════════════
#  Search-in-Pi — Dockerfile
#  Multi-stage: instala deps en builder, imagen final mínima
# ═══════════════════════════════════════════════════════════

# ── Stage 1: dependencias ──────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ── Stage 2: imagen final ──────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Metadatos OCI
LABEL org.opencontainers.image.title="Search in Pi"
LABEL org.opencontainers.image.description="Buscador de secuencias numéricas en los decimales de π"
LABEL org.opencontainers.image.url="https://github.com/luisjsolsona/Search-in-Pi"
LABEL org.opencontainers.image.source="https://github.com/luisjsolsona/Search-in-Pi"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.authors="luisjsolsona"

# Usuario no-root por seguridad
RUN addgroup -S pigroup && adduser -S piuser -G pigroup

# Copiar dependencias y código
COPY --from=deps /app/node_modules ./node_modules
COPY --chown=piuser:pigroup src/ ./src/
COPY --chown=piuser:pigroup public/ ./public/
COPY --chown=piuser:pigroup package.json ./

# Variables de entorno configurables
ENV PORT=3141
ENV MAX_DIGITS=100000
ENV NODE_ENV=production

# Puerto expuesto
EXPOSE 3141

# Health check — espera a que π esté calculado
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
  CMD wget -qO- http://localhost:${PORT}/api/status | grep '"ready":true' || exit 1

USER piuser

CMD ["node", "src/server.js"]
