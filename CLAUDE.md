# Regeln für KI-Agenten (Claude Code und andere)

Diese Datei gilt für alle Agenten, die in diesem Repo arbeiten; `AGENTS.md` verweist hierher. Die fachlichen Festlegungen stehen in `docs/` (Frontend: `docs/frontend-plan.md`, API: `docs/api.md`). Bei Widerspruch gilt `docs/`; dann diese Datei mit anpassen.

## Frontend (`apps/web`)

### Templates: jede Komponente hat eine eigene `.html`

- Jede Komponente bekommt ihr Template als eigene Datei neben der `.ts`: `print-dialog.ts` → `print-dialog.html`, eingebunden mit `templateUrl: './print-dialog.html'`.
- **Kein Inline-Template** (`template: \`…\``), auch nicht für kleine Komponenten oder Dialoge.
- Styles über Tailwind-Klassen im Template; `styleUrl`/`styles` nur, wenn Tailwind es nicht abdeckt.
- Stehen mehrere Komponenten in einer `.ts`, heißt die `.html` nach dem Selektor ohne `vm-` (z. B. `error-pages.ts` → `forbidden-page.html`, `not-found-page.html`).

### Übersetzungen: `global.json` nur für das, was überall gebraucht wird

Transloco, vorerst nur `de-DE`, Dateien unter `apps/web/public/translate/de-DE/` (Loader: `apps/web/src/app/core/i18n/i18n.ts`).

- **`global.json`** (beim Start geladen) enthält nur:
  - Seitenhülle und Navigation (`shell.*`, `nav.*`),
  - allgemeine Aktionen und Wörter (`common.*`: Speichern, Abbrechen, Schließen, Erneut versuchen …),
  - Fehlercodes der API (`errors.<code>`), Validierung, Statuswörter, Glossarbegriffe,
  - Texte von Komponenten, die in der App-Shell sitzen und **sofort** da sein müssen (z. B. Druckdialog, Update-Dialog des Druckservice).
- **Alles andere gehört in den Scope seines Bereichs:** `<scope>.scope.json` (`auth`, `me`, `library`, `system`, `print`, `legal`). Der Scope wird mit der Lazy Route geladen (`providers: [provideTranslocoScope('<scope>')]`), die Schlüssel haben den Scope als Präfix: `'me.start.title'`.
- Neuer Bereich → neue `<scope>.scope.json` plus `provideTranslocoScope` in seiner Route. Seiten, die nur in einem Bereich vorkommen (z. B. der Druckverlauf), kommen nicht in `global.json`.
- Ein Scope darf wie ein globaler Namespace heißen (`print`, `legal`): Transloco führt beide zusammen. Beispiel: Der Druckdialog sitzt in der Shell und nutzt global `print.*` und `print.serviceGuide.*`; der Druckverlauf nutzt `print.history.*` aus `print.scope.json`.
- Seitentitel und Breadcrumbs (`pages.*`, `nav.*`) bleiben global, weil die Shell sie rendert, bevor der Scope geladen ist.
- Specs, die eine Komponente mit Scope-Texten rendern, laden den Scope mit: `langs: { 'de-DE': global, 'print/de-DE': print }`.
- Vor dem Anlegen eines Schlüssels prüfen, ob es ihn schon gibt (`common.*`!), statt Texte zu doppeln.
- Keine sichtbaren Texte fest im Template oder Code; immer über einen Schlüssel.
- Texte auf Deutsch, Anrede „du“, kurz und ohne Fachjargon.
- `apps/web/src/app/core/i18n/i18n.spec.ts` prüft, dass jeder verwendete Schlüssel existiert. Nach Änderungen ausführen: `pnpm nx test web`.

## API (`apps/api`)

### Vertrag: Pfade und Schemas liegen in `libs/shared`

Der Vertrag zwischen Frontend und API steht genau einmal, maschinenlesbar, in `libs/shared`. Nichts davon wird auf einer Seite von Hand wiederholt.

- **Pfade** nur in `libs/shared/src/lib/routes.ts` (`API_ROUTES`). Controller: `@Controller(API_ROUTES.<feature>.base)`, Endpunkt: `@Get(R.<name>.path)`. Frontend: `apiUrl('<feature>', '<name>', { … })`. Kein Pfad-String irgendwo sonst.
- **Nur `GET` und `POST`**, auch für Ändern und Löschen (`post('scores/:scoreId/delete')`). Kein `PUT`, `PATCH`, `DELETE`.
- **Schemas** in `libs/shared/src/lib/<feature>/*.schema.ts`, Zod. Eingaben mit `ZodValidationPipe` (`@Query(new Zod(…))`, `@Body(new Zod(…))`, `@Param(new Zod(…))`).
- **Jede Antwort mit Körper bekommt `@ResponseSchema(…)`.** Der `ZodResponseInterceptor` parst sie und antwortet bei Abweichung 500 – eine Antwort ohne Schema ist unbemerkt frei erfunden. Ausnahme: `StreamableFile` (`binary: true` in `API_ROUTES`).
- Frontend ruft ausschließlich über `ApiClient` (`apps/web/src/app/core/api/api-client.ts`) mit dem Schema aus `@vm-web/shared`, nie `HttpClient` direkt.
- Grenzwerte (Längen, Mengen) stehen im Schema; Formulare lesen sie von dort, statt sie zu kopieren.
- Endpunkte ohne Antwortkörper werden im Vertrag markiert: `binary: true` (Datei), `redirect: true` (302) – oder sie antworten mit `@HttpCode(204)`. Alles andere braucht ein `@ResponseSchema`.

### Fehler: `ProblemException` mit bekanntem Code

- Fachliche Fehler immer als `ProblemException` (`apps/api/src/common/problem-details/problem.exception.ts`), nie `HttpException` oder `throw new Error`.
- Der `code` muss in `problemCodeSchema` stehen (`libs/shared/src/lib/common/problem-details.schema.ts`). Neuer Fall → Code dort ergänzen **und** `errors.<code>` in `global.json`.
- `detail` ist Englisch, für Logs und Entwickler. **Die API schickt nie einen UI-Text.** Der Text entsteht im Frontend aus `errors.<code>`.
- Für Formularfehler `ProblemException.validation([...])` mit JSON-Pointern (`/body/name`); das Frontend verteilt sie über `ApiProblem.fieldErrors()`.

### Rechte: `@RequirePermission` an jedem Handler

- **Jeder Handler trägt genau einen von vier Dekoratoren**, am Handler oder an seiner Klasse:
  - `@Public()` – ohne Sitzung erreichbar (nur Anmeldeablauf, Logo, Impressum/Datenschutz),
  - `@RequirePermission(...)` – ein Recht aus dem Rechtemodell,
  - `@RequireAdmin()` – nur das Admin-Kennzeichen (R-6),
  - `@RequireMember()` – jede angemeldete Person eines Ensembles darf aufrufen, **der Service schränkt das Ergebnis auf ihren Zugriff ein** (Mein Bereich R-2, Downloads, Drucken, Auswahllisten wie `folder-list`).
- **Ohne Dekorator ist der Endpunkt für jede angemeldete Person offen** – der `PermissionGuard` lässt ihn durch. `@RequireMember()` hat zur Laufzeit dieselbe Wirkung; es steht da, damit ein *vergessener* Dekorator von einem *gewollten* unterscheidbar ist. `apps/api/src/app/api-contract.spec.ts` erzwingt das.
- Rechte und ihr Geltungsbereich stehen in `libs/shared/src/lib/common/permissions.schema.ts` (`PERMISSION_AREAS`, `SINGLE_PERMISSIONS`). Neues Recht nur dort ergänzen.
- Rechte mit Bereich `ensemble` brauchen `ensembleFrom` (`'param:folderId'` oder `{ from, resolver }`); der Resolver steht in `apps/api/src/access/ensemble-resolvers.ts`.
- Wer ein Element gar nicht sehen darf, bekommt **404, nicht 403**. Das macht der Guard; Services sollen es nicht umgehen.
- Prüfungen, die vom Inhalt abhängen (Mappenrechte beim Import), gehören zusätzlich in den Service – der Dekorator deckt nur das grobe Recht ab.

### Datenzugriff: Abfragen gehören in ein Repository

- Drizzle-Abfragen stehen in `*.repository.ts`. **Ein Service injiziert nicht `DATABASE`**, sondern das Repository seines Features; er enthält die Fachlogik, das Repository die Abfragen.
- Ausgenommen ist Infrastruktur, die selbst die Datenbank ist oder sie einmalig füllt: `cache/sql-cache.service.ts`, `seed/seed.service.ts`, `legal/legal.store.ts`, `health.controller.ts`.
- Eine Datei enthält eine Art Klasse: `*.controller.ts`, `*.service.ts`, `*.repository.ts`, `*.module.ts`. Kein Controller und kein Service in einer `*.module.ts`.

### Datenbank und Migrationen

- Schema in `apps/api/src/db/schema/*.ts`, Drizzle, MySQL. Ids sind UUIDv7 aus `uuidv7()` (`apps/api/src/common/ids/`), nie `AUTO_INCREMENT` und nie `randomUUID`.
- Nach einer Schemaänderung `pnpm db:generate`. **Erzeugte SQL-Dateien unter `apps/api/src/db/migrations/` nicht von Hand ändern** und nie eine bereits veröffentlichte Migration umschreiben – `.github/scripts/check-migrations.mjs` vergleicht Release-Branches gegen `master`.
- Mehrere Schreibvorgänge, die zusammengehören, laufen in einer Transaktion (`Tx`); Hilfen dafür: `replaceRows`, `nextPosition`, `assertPermutation`, `withNameTaken`, `isUniqueViolation` in `apps/api/src/db/`.

## Für beide Seiten

### Keine Kommentare im Code

Der Code trägt **keine Kommentare**: keine Zeilenkommentare, kein JSDoc, keine Kommentare an Funktionen, Klassen oder in Templates und Styles. Was ein Kommentar erklären würde, gehört in einen sprechenden Namen, in eine kleinere Funktion oder nach `docs/`.

- Auch `/** … */` über einer Klasse, einem Controller oder einer exportierten Hilfe entfällt.
- Ebenso auskommentierter Code und `TODO`-Kommentare; Offenes gehört in ein Issue.
- Ausgenommen ist, was ein Werkzeug auswertet, nicht ein Mensch: `@ts-expect-error` mit Begründung, `eslint-disable-next-line`, Lizenzköpfe.

### Anforderungs-IDs

Die Anforderungen in `docs/requirements.md` tragen IDs (`R-4`, `N-19`, `D-3`, `A-1`, `M-9`, `F-2`, `S-5`). Da im Code keine Kommentare stehen, wird die Spur außerhalb gehalten: **jeder Commit und jede PR-Beschreibung nennt die IDs**, die sie umsetzt. Wo eine Regel ohne ihre ID nicht verständlich ist, wird sie in `docs/` beschrieben, nicht im Code kommentiert.

### Tests

- `*.spec.ts` sind Unit-Tests und laufen ohne Datenbank.
- `*.integration.spec.ts` brauchen MySQL über `TEST_DATABASE_URL` und legen sich ihre eigene Datenbank an. Ohne die Variable überspringen sie sich.
- Nest-Tests bauen die App mit `createTestApp()` (`apps/api/src/testing/test-app.ts`) – mit echten Guards, Filter und Interceptor, damit Rechte und Fehlercodes mitgeprüft werden. `loginAs()` liefert Cookie und CSRF-Header.
- **Jedes Feature-Modul der API hat mindestens einen Integrationstest**, der seine Endpunkte mit und ohne Recht aufruft.
- `apps/api/src/app/api-contract.spec.ts` hält `API_ROUTES` gegen die gebauten Controller: jede Route hat einen Handler, jeder Handler steht im Vertrag, jede Antwort mit Körper hat ein Schema, jeder Handler hat einen der vier Rechte-Dekoratoren. Der Test braucht keine Datenbank und läuft in Millisekunden – er ersetzt kein Review, verhindert aber das Vergessen.
- Neue Logik mit Verzweigungen, Sortierung, Rechten oder Geld bekommt mindestens einen Test. Reine Verdrahtung nicht.

### Commits

Conventional Commits mit deutschem Betreff: `feat(api): …`, `fix(print-service): …`, `refactor(web): …`, `chore: …`, `ci(release): …`. Der Betreff sagt, was sich für Nutzende ändert, nicht welche Datei angefasst wurde.

## Bekannte Abweichungen

Die Regeln oben gelten ab sofort für neuen Code. Diese Stellen erfüllen sie noch nicht und werden in eigenen Folge-PRs nachgezogen; wer eine davon ohnehin anfasst, zieht sie gleich mit. Erledigte Zeile hier löschen.

- **Kommentare:** 405 von 551 Dateien enthalten Doc- oder Zeilenkommentare (~3200 Zeilen). Entfernen, Inhalt wo nötig nach `docs/`.
- **Repository-Schicht fehlt** in: `voices`, `folders`, `events`, `print-rules`, `uploads` (`uploads.service`, `review.service`), `downloads` (`downloads.service`, `output.service`) und `system` (`ensembles`, `roles`, `users`, `config`). Vorhanden und als Vorbild geeignet: `scores`, `me`, `access`, `auth`, `settings`.
- **`tags/tags.module.ts`** enthält Service, Controller und Modul in einer Datei; auf `tags.service.ts`, `tags.controller.ts`, `tags.module.ts` aufteilen (Repository siehe oben).
- **Ohne Integrationstest:** `folders`, `events`, `voices`, `tags`, `print-rules`, `settings`.
- **`libs/ui`** hat einen einzigen Test für 8.300 Zeilen. Mindestens Dialog (Fokusfalle, Escape), Dropdown (Tastatur) und ein `axe-core`-Durchlauf je Primitive.

## Prüfen vor dem Abschluss

```bash
pnpm nx run-many -t build lint test -p <betroffene Projekte>
```
