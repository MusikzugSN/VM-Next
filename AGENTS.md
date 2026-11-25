# AGENTS.md

Die Regeln für KI-Agenten in diesem Repo stehen in **[`CLAUDE.md`](CLAUDE.md)**. Sie gelten für alle Agenten (Claude Code, Codex, Copilot, Cursor …), nicht nur für Claude.

Kurz:

- **Keine Kommentare im Code.** Kein JSDoc, keine Zeilenkommentare, kein auskommentierter Code. Anforderungs-IDs aus `docs/requirements.md` stehen im Commit und in der PR-Beschreibung.
- **Vertrag:** Pfade nur in `libs/shared/src/lib/routes.ts`, Schemas nur in `libs/shared/src/lib/<feature>/`. Jede Antwort mit Körper bekommt `@ResponseSchema(…)`, nur `GET` und `POST`.
- **Rechte:** Jeder Handler trägt genau einen von `@Public()`, `@RequirePermission(...)`, `@RequireAdmin()`, `@RequireMember()` – ohne Dekorator ist er für alle Angemeldeten offen. `api-contract.spec.ts` erzwingt das.
- **Fehler:** `ProblemException` mit einem Code aus `problemCodeSchema`; die API schickt nie einen UI-Text.
- **Datenzugriff:** Drizzle-Abfragen in `*.repository.ts`, nicht im Service. Eine Art Klasse je Datei.
- **Templates:** Jede Angular-Komponente hat eine eigene `.html` (`templateUrl`), keine Inline-Templates.
- **Übersetzungen:** `global.json` nur für Shell, `common.*`, Fehlercodes und Texte, die sofort gebraucht werden; alles andere in den Scope des Bereichs (`<scope>.scope.json`).
- **Migrationen:** nach einer Schemaänderung `pnpm db:generate`; erzeugtes SQL nicht von Hand ändern.

Wo der Code eine Regel noch nicht erfüllt, steht das unter „Bekannte Abweichungen“ in `CLAUDE.md` – die Regel gilt trotzdem für neuen Code.

Fachliche Festlegungen: `docs/` (Frontend: `docs/frontend-plan.md`, API: `docs/api.md`).
