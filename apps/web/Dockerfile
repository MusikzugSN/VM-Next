# syntax=docker/dockerfile:1.7
# VM-Next web image: the Angular app on nginx, which also forwards /internal and /health to the API.
# Build from the repository root:
#   docker build -f apps/web/Dockerfile -t vm-next-web:dev .
ARG NODE_VERSION=24
ARG PNPM_VERSION=12.21.0

# --- build -----------------------------------------------------------------------------------------
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-bookworm-slim AS build
ARG PNPM_VERSION
ENV NX_DAEMON=false NX_NO_CLOUD=true NX_SKIP_NX_CACHE=true CI=true
RUN npm install -g pnpm@${PNPM_VERSION}
WORKDIR /src
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm config set store-dir /pnpm-store && pnpm install --frozen-lockfile
COPY . .
RUN pnpm nx build web --configuration=production

# --- runtime: unprivileged nginx on port 8080 ------------------------------------------------------
FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime
ARG VERSION=dev
ARG REVISION=unknown
LABEL org.opencontainers.image.title="vm-next-web" \
      org.opencontainers.image.description="VM-Next web frontend (Angular on nginx)" \
      org.opencontainers.image.licenses="GPL-3.0-only" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}"
# Rendered into /etc/nginx/conf.d/default.conf by the image's envsubst entrypoint
ENV API_UPSTREAM=http://api:3000 \
    CLIENT_MAX_BODY_SIZE=60m
COPY apps/web/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /src/dist/apps/web/browser/ /usr/share/nginx/html/
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8080/index.html"]
