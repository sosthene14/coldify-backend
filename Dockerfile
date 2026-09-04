# ---- Dépendances complètes (nécessaires pour type-check + build) ----
FROM oven/bun:1.1-alpine AS deps
WORKDIR /app
COPY package.json bun.lock* bun.lockb* ./
RUN bun install --frozen-lockfile

# ---- Build (type-check + bundling complet, code + deps) ----
FROM oven/bun:1.1-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

# ---- Image finale, minimale ----
# Plus besoin de node_modules : bun build a tout bundlé dans dist/index.js
FROM oven/bun:1.1-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# User non-root
RUN addgroup -S app && adduser -S app -G app

COPY --from=build /app/dist ./dist

USER app

EXPOSE 3001

# Route health désormais sous /api (groupe Elysia /api)
# docker exec somails-backend-1 bun -e "fetch('http://localhost:3001/api/health').then(r=>console.log(r.status))"
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
  CMD bun -e "fetch('http://localhost:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "dist/index.js"]