# VM-Web

Notenverwaltung für einen Musikverein: eine Installation pro Verein, Anmeldung über einen eigenen
Identity-Server, und Musiker:innen sehen ohne Zusatzrechte die Noten ihrer eigenen Stimmen – als
Mappe, Event-Setlist oder Einzelstück, zum Herunterladen oder Drucken.

## Aufbau

Nx-Monorepo mit drei Anwendungen und zwei Bibliotheken:

| Projekt | Inhalt |
| --- | --- |
| `apps/api` | NestJS-Backend-for-Frontend: OIDC-Anmeldung, Rechte, Noten, Uploads, Druckdokumente. MySQL über Drizzle. |
| `apps/web` | Angular-Frontend (Signals, Zard UI, Tailwind, Transloco). |
| `apps/print-service` | Lokaler Druckdienst für Linux/CUPS, den sich jede:r auf dem eigenen Rechner installiert. |
| `libs/shared` | Zod-Schemas, Routen und Konstanten, die API und Frontend gemeinsam nutzen. |
| `libs/ui` | Zard-UI-Komponenten als Quellcode. |

## Entwicklung

Voraussetzungen: Node (siehe `.nvmrc`), pnpm, Docker (für MySQL und den Identity-Server).

```sh
pnpm install
pnpm dev:up                 # MySQL (Port 3307) und Pocket ID (Port 1411)
pnpm db:migrate             # Migrationen einspielen
npx nx serve api
npx nx serve web
```

`pnpm dev:down` stoppt die Dienste wieder, `pnpm dev:logs` zeigt ihre Logs. Die Einrichtung des
Identity-Servers und die nötigen Umgebungsvariablen stehen in [apps/api/README.md](apps/api/README.md),
die des Druckdienstes in [apps/print-service/README.md](apps/print-service/README.md).

## Prüfen

Dieselben Schritte wie in der CI:

```sh
npx nx run-many -t lint typecheck
npx nx run-many -t test
npx nx run-many -t build --configuration=production
```

Die Integrationstests der API legen eigene Datenbanken an und laufen nur mit gesetzter
`TEST_DATABASE_URL`; ohne sie überspringen sie sich und melden das im Testlauf:

```sh
TEST_DATABASE_URL='mysql://root:vmweb@127.0.0.1:3307/vmweb' npx nx run-many -t test
```

## Dokumentation

| Datei | Inhalt |
| --- | --- |
| [docs/requirements.md](docs/requirements.md) | Anforderungen mit IDs (R-2, N-15, …), die in Code, Issues und Pull Requests referenziert werden |
| [docs/api.md](docs/api.md) | Endpunkte, Rechte und Fehlercodes |
| [docs/db-schema.md](docs/db-schema.md) | Tabellen, Schlüssel und Entscheidungen zum Schema |
| [docs/frontend-plan.md](docs/frontend-plan.md) | Aufbau des Frontends, Routen, Stufenplan |
| [docs/design-system.md](docs/design-system.md) | Tokens, Komponenten und Gestaltungsregeln |
| [docs/print-service.md](docs/print-service.md) | Schnittstelle und Sicherheitsmodell des Druckdienstes |
| [docs/release.md](docs/release.md) | Versionen, Release-Zweige und Backports |

## Lizenz

VM-Web steht unter der [GNU General Public License v3.0](https://www.gnu.org/licenses/gpl-3.0.html) (`GPL-3.0-only`), siehe [LICENSE](LICENSE). Quellcode: <https://github.com/MusikzugSN/VM-Next>
Die verwendeten Open-Source-Abhängigkeiten mit Version und Lizenz listet die Seite **Abhängigkeiten** (`/dependencies`) in der App auf.
