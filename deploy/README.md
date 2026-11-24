# Betrieb mit Docker Compose

Ein Verein pro Installation: `web` (Angular auf nginx), `api` (NestJS) und MySQL. TLS übernimmt der vorhandene Reverse Proxy des Vereins; er leitet auf den `web`-Container weiter (Standard `127.0.0.1:8080`). `web` reicht `/internal` und `/health` an die API weiter.

| Image | Inhalt | Port |
| --- | --- | --- |
| `vm-next-web` | Angular-Build auf `nginx-unprivileged` | 8080 |
| `vm-next-api` | NestJS, Migrationen beim Start | 3000 (nur intern) |

## Einrichten

```bash
cp .env.example .env     # ausfüllen: PUBLIC_BASE_URL, MYSQL_PASSWORD, OIDC_*, Images
docker compose up -d
docker compose logs -f api
```

Beim Identity-Server (z. B. Pocket ID) als Redirect-URI `<PUBLIC_BASE_URL>/internal/v1/auth/callback` eintragen.

Der Reverse Proxy muss `X-Forwarded-Proto` setzen und Uploads bis `CLIENT_MAX_BODY_SIZE` (Standard 60 MB) durchlassen.

## Aktualisieren

`VM_NEXT_VERSION` in `.env` setzen, dann `docker compose pull && docker compose up -d`. Migrationen laufen beim Start der API.

## Sichern

Datenbank und Datei-Volume gehören zusammen:

```bash
docker compose exec -T mysql sh -c 'exec mysqldump -u vmnext -p"$MYSQL_PASSWORD" vmnext' > vmnext.sql
docker run --rm -v vm-next_storage:/data -v "$PWD":/backup alpine tar czf /backup/storage.tgz -C /data .
```

## Images lokal bauen

Aus dem Wurzelverzeichnis des Repos (unter Windows über WSL):

```bash
pnpm docker:api   # vm-next-api:dev
pnpm docker:web   # vm-next-web:dev
```

In `.env` dann `VM_NEXT_API_IMAGE=vm-next-api`, `VM_NEXT_WEB_IMAGE=vm-next-web`, `VM_NEXT_VERSION=dev`.

Der Druckservice läuft nicht hier, sondern auf den Rechnern der Mitglieder: siehe [`apps/print-service/README.md`](../apps/print-service/README.md).
