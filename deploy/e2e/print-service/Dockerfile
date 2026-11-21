# Druckservice für den KI-Testlauf: dieselbe Einzeldatei (Node SEA) wie bei den Mitgliedern, dazu der
# CUPS-Client. Läuft im Netzwerk-Namespace des Browser-Containers und druckt auf dessen CUPS.
# Build aus der Repo-Wurzel (macht compose.yml):  docker build -f deploy/e2e/print-service/Dockerfile .
ARG NODE_VERSION=24
ARG PNPM_VERSION=12.21.0

FROM node:${NODE_VERSION}-bookworm-slim AS build
ARG PNPM_VERSION
RUN npm install -g pnpm@${PNPM_VERSION}
WORKDIR /src
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm config set store-dir /pnpm-store && pnpm install --frozen-lockfile
COPY . .
RUN node apps/print-service/scripts/build-sea.mjs

FROM debian:bookworm-slim AS runtime
RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends cups-client ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --create-home --uid 1000 node
COPY --from=build /src/dist/apps/print-service-sea/vm-web-print /usr/local/bin/vm-web-print
RUN mkdir -p /home/node/.local/share/vm-web-print && chown -R node:node /home/node
USER node
ENV HOME=/home/node
CMD ["/usr/local/bin/vm-web-print"]
