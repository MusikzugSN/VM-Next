# VM-Web API (`apps/api`)

NestJS-Server für VM-Web. Endpunkte: [docs/api.md](../../docs/api.md), Datenbank: [docs/db-schema.md](../../docs/db-schema.md).

## Voraussetzungen

- Node 24 LTS und pnpm (siehe `.nvmrc`, `packageManager` in `package.json`)
- Docker Engine in WSL 2 (für PostgreSQL und Pocket ID)

### Einmalig: WSL und Docker installieren

In einer **PowerShell als Administrator**:

```powershell
wsl --install -d Ubuntu-24.04
```

Falls Windows danach einen Neustart verlangt, neu starten. Beim ersten Start von Ubuntu Benutzername und Passwort anlegen. Dann **in Ubuntu**:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

Zurück in PowerShell WSL einmal neu starten und prüfen:

```powershell
wsl --shutdown
wsl docker run --rm hello-world
```

**Wichtig:** WSL 2 fährt die Linux-VM herunter, sobald kein WSL-Prozess mehr läuft – Docker und die Container stoppen dann mit (Symptom: `ECONNREFUSED` auf 5433 oder `500`er mitten in Tests). Abhilfe, eine von beiden:

- während der Entwicklung ein Terminal mit `wsl -e sleep infinity` offen lassen, oder
- in `%UserProfile%\.wslconfig` unter `[wsl2]` die Zeile `vmIdleTimeout=-1` eintragen und einmal `wsl --shutdown` ausführen.

Die Ports aus WSL sind unter Windows automatisch über `localhost` erreichbar: PostgreSQL auf **5433** (5432 ist oft von einem lokal installierten PostgreSQL belegt), Pocket ID auf 1411.

## Lokale Entwicklung

Alle Befehle aus dem Workspace-Root in PowerShell.

### 1. Dienste starten

```powershell
pnpm install
pnpm dev:up          # PostgreSQL :5433, Pocket ID :1411 (wsl docker compose)
```

`pnpm dev:logs` zeigt die Logs, `pnpm dev:down` stoppt beide (Daten bleiben in Docker-Volumes).

### 2. Pocket ID einrichten und Testkonto anlegen

1. <http://localhost:1411/setup> öffnen und das Admin-Konto von Pocket ID mit einem Passkey anlegen.
2. **OIDC Clients → Add OIDC Client**:
   - Name `VM-Web (dev)`
   - Callback URLs: `http://localhost:4200/internal/v1/auth/callback` (über den Angular-Dev-Proxy) und `http://localhost:3000/internal/v1/auth/callback` (API direkt)
   - Logout Callback URL: `http://localhost:4200/login`
   - **Public Client** aktivieren und **PKCE** aktivieren
   - Tab **Access**: **All Users** wählen und speichern. Neue Clients sind sonst auf „Selected user groups“ ohne Gruppen gestellt, und Pocket ID meldet „You are not allowed to access this service“.
   - Client-ID kopieren
3. **Users → Add User** für weitere Testkonten (Name und E-Mail setzen). Über „Login Code“ bzw. „One-time access link“ kann man sich ohne Passkey anmelden.

Hinweis: Die erste Person, die sich bei VM-Web anmeldet, wird Admin. Ab Werk erhält außerdem **jedes** neue Konto die Rolle `admin` im Wurzel-Ensemble (Standardrolle). In der Konfiguration von VM-Web deshalb früh eine andere Standardrolle setzen.

### 3. Umgebung konfigurieren

```powershell
Copy-Item apps/api/.env.example apps/api/.env
```

In `apps/api/.env` mindestens `OIDC_CLIENT_ID` eintragen (bei einem vertraulichen Client zusätzlich `OIDC_CLIENT_SECRET`). Alle Variablen werden beim Start geprüft; fehlt etwas, bricht der Start mit einer Liste der Fehler ab.

### 4. Migrationen

Beim Start wendet die API ausstehende Migrationen selbst an (`DB_MIGRATE_ON_START=true`). Manuell:

```powershell
pnpm db:migrate      # ausstehende Migrationen anwenden
pnpm db:generate     # nach Änderungen unter src/db/schema/ eine neue Migration erzeugen
pnpm db:studio       # Datenbank im Browser ansehen
```

Migrationen liegen in `apps/api/drizzle/` und werden eingecheckt; der Build kopiert sie nach `dist/apps/api/drizzle`. Die `db:*`-Skripte laufen im Ordner `apps/api`, weil drizzle-kit Pfad-Aliasse wie `@vm-web/shared` nur über das `tsconfig.json` des Arbeitsverzeichnisses auflöst.

Beim **ersten Start** legt die API automatisch an (S-5): die Standardrollen aus `apps/api/defaults/roles.default.json`, das Wurzel-Ensemble „Verein“ und die Konfiguration mit Wurzel-Ensemble + Rolle `admin` als Standard für neue Konten. Außerdem importiert sie einmalig die Besetzungs-Vorlage `apps/api/defaults/lineup.default.json` (Standard-Blasorchester, N-8): Instrumente, Stimmen und Ersatzstimmen; vorhandene Stimmen gleichen Namens werden wiederverwendet, nichts wird überschrieben.

### 5. API starten

```powershell
pnpm nx serve api
```

- API: <http://localhost:3000/internal/v1/…>
- Health: <http://localhost:3000/health> (`200 {"status":"ok"}`, ohne Datenbank `503`)

### Anmeldung ausprobieren

Ohne Frontend lässt sich der Login direkt gegen die API testen: in `apps/api/.env` `PUBLIC_BASE_URL=http://localhost:3000` setzen, API starten und <http://localhost:3000/internal/v1/auth/login> im Browser öffnen. Nach der Anmeldung bei Pocket ID landet man auf `http://localhost:3000/me` (404, es gibt noch kein Frontend); <http://localhost:3000/internal/v1/auth/session> zeigt dann Konto und Rechte. Mit Frontend bleibt `PUBLIC_BASE_URL=http://localhost:4200`, der Angular-Dev-Server leitet `/internal` an die API weiter.

### Prüfen

```powershell
pnpm nx run-many -t lint test build -p api shared
```

Die Datenbank-Integrationstests (`*.integration.spec.ts`) laufen nur, wenn `TEST_DATABASE_URL` gesetzt ist. Jede Testdatei legt daneben ihre eigene, frische Datenbank `<name>_<suffix>` an (z. B. `vmweb_test_me`), damit Dateien parallel laufen können; der Datenbank-Benutzer braucht dafür das Recht `CREATEDB` (im Dev-Container gegeben):

```powershell
wsl docker compose -f docker-compose.dev.yml exec -T postgres psql -U vmweb -d vmweb -c "create database vmweb_test owner vmweb"
$env:TEST_DATABASE_URL = 'postgres://vmweb:vmweb@localhost:5433/vmweb_test'
pnpm nx test api
```

## Aufbau

| Pfad | Inhalt |
| --- | --- |
| `src/config/` | Umgebungsvariablen: Zod-Schema (`env.schema.ts`), typisierter Zugriff `AppConfig` |
| `src/db/` | Drizzle-Anbindung (`DATABASE`-Token), Schema `schema/`, Migrationen beim Start |
| `src/cache/` | `ICacheService` (`CACHE_SERVICE`-Token) mit In-Memory-Implementierung |
| `src/storage/` | `IFileStorage` (`FILE_STORAGE`-Token) auf einem Verzeichnis (`FILE_STORAGE_PATH`) |
| `src/common/problem-details/` | `ProblemException` und globaler Filter für RFC 9457 |
| `src/common/validation/` | `ZodValidationPipe` (Requests) und `@ResponseSchema` (Responses) mit Schemas aus `@vm-web/shared` |
| `src/common/ids/` | UUID-v7-Erzeugung für Primärschlüssel |
| `src/health/` | `GET /health` |
| `src/access/` | Sitzungen (`SessionStore`), Cookies, `SessionGuard` (Sitzung, Sperre, CSRF), `PermissionGuard` mit `@RequirePermission`, `@Public`, `AccessContext` (effektive Rechte) |
| `src/auth/` | BFF-Login über OIDC (`openid-client`), Konto beim ersten Login, `/internal/v1/auth/*` |
| `src/settings/` | Lesezugriff auf `club_settings` |
| `src/me/` | Mein Bereich: Stimmen-Kontext und Ersatzstimmen (`sheet-resolution.ts`), Mappen, Events, Tags, Profil, persönliche Tags |
| `src/common/pagination/` | Cursor-Pagination (`encodeCursor`, `decodeCursor`, `toPage`) |
| `src/common/files/` | Dateinamen nach M-6, `Content-Disposition`, CSV mit Schutz vor Formel-Injektion |
| `src/scores/` | Stücke-Tabelle mit Filter/Sortierung über eigene Felder (`score-query.ts`), eigene Felder, Vollständigkeit, CSV-Export |
| `src/voices/`, `src/folders/`, `src/events/`, `src/tags/` | Stimmen & Instrumente, Mappen, Events, Vereins-Tags |
| `src/library/` | Gemeinsame Bausteine der Notenverwaltung (Ensemble-Auswahl, Stück-Suche) |
| `src/uploads/` | Upload-Dialog (Mehrfach-Upload, Stimmenvorschlag) und Prüfung (Drehen, Zuschneiden, Ersetzen) |
| `src/downloads/` | Einzel-PDF, ZIP, Druckplan und druckfertiges PDF (`print-layout.ts`) |
| `src/system/` | Systemverwaltung: Benutzer, Ensemble-Baum und Besetzung, Rollen mit Rechte-Matrix, Konfiguration und Logo |
| `src/seed/` | Erster Start, Standardrollen, Besetzungs-Vorlage; `defaults.ts` findet `apps/api/defaults` im Build und in Tests |
| `src/testing/` | Test-Fixtures (Ensemble-Baum, Personen mit Rollen), `createTestApp`, `createTestDatabase`, `LibraryBuilder` für Testdaten |

### Konventionen

- Abhängigkeiten immer mit `@Inject(...)` injizieren (Tokens oder Klassen). Vitest erzeugt keine Decorator-Metadaten, implizite Typ-Injektion funktioniert in Tests daher nicht.
- Controller bleiben dünn: Validierung über Pipes und `@ResponseSchema`, Logik in Services.
- Fehler als `ProblemException` werfen (`ProblemException.notFound()`, `.conflict('name-taken')` …), nie mit UI-Texten.
- Jeder Endpunkt braucht eine Sitzung, außer er ist mit `@Public()` markiert. Rechte mit `@RequirePermission('folder.edit', { ensembleFrom: { resolver: 'folder', from: 'param:folderId' } })`; Resolver registrieren Feature-Module in `EnsembleResolvers`. Für Elemente eines Ensembles, das man nicht sehen darf, antwortet der Guard mit 404, sonst mit 403.
