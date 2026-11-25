# AGENTS.md

Die Regeln für KI-Agenten in diesem Repo stehen in **[`CLAUDE.md`](CLAUDE.md)**. Sie gelten für alle Agenten (Claude Code, Codex, Copilot, Cursor …), nicht nur für Claude.

Kurz:

- **Templates:** Jede Angular-Komponente hat eine eigene `.html` (`templateUrl`), keine Inline-Templates.
- **Übersetzungen:** `global.json` nur für Shell, `common.*`, Fehlercodes und Texte, die sofort gebraucht werden; alles andere in den Scope des Bereichs (`<scope>.scope.json`).

Fachliche Festlegungen: `docs/` (Frontend: `docs/frontend-plan.md`).
