# Werkzeuge des KI-Testlaufs: Fixture-Generator und Orakel (Node, liest DB, Keycloak, PDFs und ZIPs).
FROM node:24-bookworm-slim
WORKDIR /e2e/tools
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY src ./src
ENTRYPOINT ["node"]
CMD ["src/oracle.mjs", "--help"]
