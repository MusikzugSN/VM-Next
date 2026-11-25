# syntax=docker/dockerfile:1.7
# VM-Next API image (NestJS). Build from the repository root:
#   docker build -f apps/api/Dockerfile -t vm-next-api:dev .
ARG NODE_VERSION=24
ARG PNPM_VERSION=12.21.0

# --- build: install the workspace, build the API and prune its dependencies -----------------------
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-bookworm-slim AS build
ARG PNPM_VERSION
ENV NX_DAEMON=false NX_NO_CLOUD=true NX_SKIP_NX_CACHE=true CI=true
RUN npm install -g pnpm@${PNPM_VERSION}
WORKDIR /src
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm config set store-dir /pnpm-store && pnpm install --frozen-lockfile
COPY . .
# prune = build + package.json/pnpm-lock.yaml with only the API's runtime dependencies
RUN NODE_ENV=production pnpm nx run api:prune

# --- deps: production node_modules for the built API -----------------------------------------------
FROM node:${NODE_VERSION}-alpine AS deps
ARG PNPM_VERSION
RUN npm install -g pnpm@${PNPM_VERSION}
WORKDIR /app
COPY --from=build /src/dist/apps/api/ ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm config set store-dir /pnpm-store && pnpm install --prod --frozen-lockfile

# --- runtime ---------------------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS runtime
ARG VERSION=dev
ARG REVISION=unknown
LABEL org.opencontainers.image.title="vm-next-api" \
      org.opencontainers.image.description="VM-Next API (NestJS)" \
      org.opencontainers.image.licenses="GPL-3.0-only" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}"
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    FILE_STORAGE_PATH=/data \
    APP_VERSION=${VERSION} \
    APP_REVISION=${REVISION}
WORKDIR /app
COPY --from=deps --chown=root:root /app ./
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=180s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
# main.js handles SIGTERM itself (app.enableShutdownHooks)
CMD ["node", "main.js"]
