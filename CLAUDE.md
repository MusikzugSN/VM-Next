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

## Prüfen vor dem Abschluss

```bash
pnpm nx run-many -t build lint test -p <betroffene Projekte>
```
