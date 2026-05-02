# MARCALL — Fly.io production image.
# Multi-stage to keep the runtime image small. better-sqlite3 is a native
# module so we build inside the same Linux/glibc base we run on.

FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install build deps for better-sqlite3.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install all deps (incl. dev) for the build step.
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build (Vite + esbuild).
COPY . .
RUN npm run build

# Prune to production deps so we ship the smallest possible runtime.
RUN npm prune --omit=dev

# ──────────────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
# Render injects PORT=10000 by default; we accept whatever it sets.
ENV PORT=10000
# data.db lives on the persistent Render disk mounted at /data.
ENV SQLITE_PATH=/data/data.db

# Runtime libs only (no compiler chain).
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --system --create-home --uid 1001 marcall

# Copy built artifacts and pruned deps.
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
# Seed/migration assets the server reads at startup.
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/server/lib/email-templates ./server/lib/email-templates
# Static legal markdown served by /api/legal/:doc.
COPY --from=builder /app/legal ./legal

# Volume root must exist + be writable on first boot.
RUN mkdir -p /data && chown -R marcall:marcall /data /app

USER marcall

EXPOSE 10000

# better-sqlite3 sometimes loads its native binary lazily; running once with
# --version is a cheap smoke test that catches a broken native build at boot.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||10000)+'/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/index.cjs"]
