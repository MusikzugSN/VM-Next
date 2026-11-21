# Browser der Agenten: Chromium (aus Playwright) unter Xvfb, CUPS mit CUPS-PDF als Standarddrucker
# und je Persona ein Playwright-MCP-Server über HTTP.
FROM node:24-bookworm

ARG PLAYWRIGHT_MCP_VERSION=0.0.84
ARG PLAYWRIGHT_VERSION=1.65.0-alpha-2026-10-30
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    DISPLAY=:99 \
    LANG=de_DE.UTF-8 \
    LC_ALL=de_DE.UTF-8

RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      cups cups-client cups-bsd printer-driver-cups-pdf \
      xvfb x11vnc libnss3-tools curl locales fonts-dejavu-core fonts-liberation \
 && sed -i 's/^# *de_DE.UTF-8/de_DE.UTF-8/' /etc/locale.gen && locale-gen \
 && rm -rf /var/lib/apt/lists/*

RUN npm install -g @playwright/mcp@${PLAYWRIGHT_MCP_VERSION} \
 && npx -y playwright@${PLAYWRIGHT_VERSION} install --with-deps chromium

# CUPS: nur lokal, ohne Freigabe; CUPS-PDF schreibt nach /out/cups-pdf (Volume für das Orakel)
COPY cups-pdf.conf /etc/cups/cups-pdf.conf
COPY mcp/ /etc/vm-e2e/mcp/
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8931 8932 8933 8934 8935 5900
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
