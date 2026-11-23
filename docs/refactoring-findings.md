# Refactoring: Übersicht aller Findings

Stand: 23.11.2026, Basis `feat/api-mvp` (`1a28bf6`). Dieser Lauf behandelt nur Code-Qualität. CSS, Tailwind-Klassen, visuelles Template-Markup und Theming bleiben unverändert, sie gehören zum Design-Lauf (`docs/design-findings.md`).

## So ist die Datei zu lesen

- **Nummerierung:** Die Themen-Nummer ist zugleich die PR-Nummer im Titel. `Refactoring 00` ist dieser Findings-PR, `Refactoring 01` das erste Umbau-Thema. Die Reihenfolge ist die Abarbeitungs- und empfohlene Merge-Reihenfolge.
- **Priorität:** hoch, mittel oder niedrig, nach Nutzen und Risiko.
- **Aufwand:** S (unter 1 h), M (halber Tag), L (ab einem Tag).
- **Pfade:** Kurzformen beziehen sich auf `apps/api/src/` (API), `apps/web/src/app/` (WEB), `libs/shared/src/lib/` (SHARED) und `apps/print-service/src/` (PRINT).
- **Zeilen:** Sie gelten für den Stand `1a28bf6`.

## Ausgangslage der Prüfungen

| Prüfung | Ergebnis auf `feat/api-mvp` |
|---|---|
| Typecheck | grün |
| Tests (mit `TEST_DATABASE_URL`) | grün, 520 Tests |
| Production-Build | grün |
| Lint | **rot**: 2 Fehler in `vm-e2e-tools`, siehe Thema 01 |
| GitHub-CI | **läuft für diese PRs nicht**, weil `ci.yml` nur PRs auf `master` und `release/**` auslöst |

Die Umbau-PRs werden deshalb lokal mit denselben Schritten wie der CI-Job `checks` geprüft. Die Docker-Image-Jobs der CI laufen nur bei Themen, die Abhängigkeiten oder Build-Konfiguration ändern, lokal mit.

Die PRs zweigen alle von `feat/api-mvp` ab und sind einzeln reviewbar. Bis Thema 01 gemergt ist, bleibt der bekannte Lint-Fehler in `vm-e2e-tools` auf den anderen Branches bestehen. Dort gilt: keine neuen Lint-Fehler. Themen, die dieselben Dateien berühren (vor allem 05 bis 10), können beim Mergen kleine Konflikte erzeugen, wenn sie nicht in Nummernreihenfolge gemergt werden.

## Übersicht

| Nr. | Titel | Priorität | Kategorie | Aufwand | Lib |
|---|---|---|---|---|---|
| 01 | Lint-Baseline der E2E-Tools | hoch | Komplexität | S | nein |
| 02 | Unique-Violation-Mapping zusammenführen | hoch | Duplikat | S | nein |
| 03 | `Tx`-Typ zentralisieren, toten Code entfernen | hoch | Duplikat | S | nein |
| 04 | SQL-Helfer aus `me.repository` lösen | hoch | Duplikat | S | nein |
| 05 | Server-Validierung auf Formularfehler abbilden | hoch | Duplikat | S | nein |
| 06 | Lokale Fehler-Wrapper durch `ActionRunner` ersetzen | hoch | Duplikat | S | nein |
| 07 | Busy-Flags in `ActionRunner` | hoch | Duplikat | S | nein |
| 08 | Mutations-Helfer `post`/`postVoid` | hoch | Komplexität | M | nein |
| 09 | Bestätigtes Löschen vereinheitlichen | hoch | Duplikat | M | nein |
| 10 | Resource-Wert mit Fallback | hoch | Duplikat | M | nein |
| 11 | Limits aus `libs/shared` statt hart codiert | hoch | Duplikat | S | nein |
| 12 | Gruppieren per Map (API) | mittel | Duplikat | M | nein |
| 13 | Lookup- und Assert-Helfer (API) | mittel | Duplikat | M | nein |
| 14 | Kind-Zeilen ersetzen, nächste Position | mittel | Duplikat | M | nein |
| 15 | Fehlerbausteine für ID-Listen | mittel | Duplikat | M | nein |
| 16 | Zod-Parameter-Decorators | mittel | Komplexität | M | nein |
| 17 | Keyset-Pagination-Helfer | mittel | Duplikat | M | nein |
| 18 | Set-Umschalten und Set-Vergleich (Web) | mittel | Duplikat | S | nein |
| 19 | Dialog-Reset beim Öffnen | mittel | Duplikat | S | nein |
| 20 | Sicherer Web-Storage-Zugriff | mittel | Duplikat | S | nein |
| 21 | Kleine Web-Utilities zusammenführen | mittel | Duplikat | S | nein |
| 22 | Route-Factories | mittel | Duplikat | S | nein |
| 23 | Verwaltung Termine und Mappen | mittel | Duplikat | M | nein |
| 24 | Bearbeiten Termin und Mappe | mittel | Duplikat | M | nein |
| 25 | PDF-Laden und -Rendern | mittel | Duplikat | M | nein |
| 26 | `planRow` im Notenimport zerlegen | mittel | Komplexität | L | nein |
| 27 | Upload- und Storage-Abläufe | mittel | Komplexität | M | nein |
| 28 | Kleine API-Zusammenführungen | niedrig | Duplikat | M | nein |
| 29 | Kleine Web-Vereinfachungen | niedrig | Komplexität | S | nein |
| 30 | `chunk`, `countBy`, `uniqBy` über lodash | niedrig | Lib-Ersatz | S | lodash |
| 31 | Draft-Signale mit `linkedSignal` | niedrig | Komplexität | M | nein |
| 32 | Launcher-Dialog-Brücke | niedrig | Duplikat | S | nein |
| 33 | Aktuelle URL zentral | niedrig | Duplikat | S | nein |

## Themen

### 01 – Lint-Baseline der E2E-Tools
- **Priorität / Kategorie / Aufwand:** hoch / Komplexität / S
- **Dateien:** `deploy/e2e/tools/src/lib.mjs:58`, `deploy/e2e/tools/src/probe-own-voice.mjs:25`
- **Begründung:** Diese zwei Fehler halten `nx lint` und damit den CI-Schritt rot.
- **Umbau:** Das BOM in der Regex als `﻿` schreiben. Das wirkungslose `\s` im Template-String durch das gleichwertige `s` ersetzen.
- **Hinweis:** Die zweite Stelle ist vermutlich ein Bug, siehe B-01. Der Umbau erhält das aktuelle Verhalten.
- **Lib:** keine

### 02 – Unique-Violation-Mapping zusammenführen
- **Priorität / Kategorie / Aufwand:** hoch / Duplikat / S
- **Dateien (API):** `system/ensembles.service.ts:228-235`, `system/roles.service.ts:187-194`, `folders/folders.service.ts:209-216`, `voices/voices.service.ts:184-191`, `tags/tags.module.ts:70-77`, `scores/fields.service.ts:113-120`, `me/personal-tags.service.ts:51-58`
- **Begründung:** Sieben identische Kopien derselben Fehlerabbildung.
- **Umbau:** `withNameTaken(write)` in `db/db-errors.ts`. Kollisionen der Mappennummer liefern weiterhin bewusst `name-taken`. `uploads/uploads.service.ts:162-165` bleibt außen vor, weil es Kontrollfluss ist.
- **Lib:** keine

### 03 – `Tx`-Typ zentralisieren, toten Code entfernen
- **Priorität / Kategorie / Aufwand:** hoch / Duplikat / S
- **Dateien (API):** `auth/users.repository.ts:84`, `seed/lineup-template.ts:39`, `seed/seed.service.ts:88`, `system/ensembles.service.ts:24`, `system/roles.service.ts:26`, `uploads/review.service.ts:24`, `voices/voices.service.ts:11`; toter Code in `uploads/uploads.service.ts:39`, `folders/folders.service.ts:191-196`, `scores/scores.repository.ts:197-198`, `scores/scores.service.ts:261-264`, `me/me.repository.ts:89-91`
- **Begründung:** Derselbe Typ ist siebenmal deklariert, dazu kommen ungenutzte Variablen, ein doppelter Kommentar und ein falscher Kommentar.
- **Umbau:** `Tx` aus `db/database.ts` exportieren und die Reste entfernen.
- **Lib:** keine

### 04 – SQL-Helfer aus `me.repository` lösen
- **Priorität / Kategorie / Aufwand:** hoch / Duplikat / S
- **Dateien (API):** `me/me.repository.ts:30,230-237,256-263,307-312,335-341,526`, `voices/voices.service.ts:54`, `scores/scores.service.ts:197`, `uploads/review.service.ts:43-50,77-85`
- **Begründung:** Neun Module importieren `likePattern` aus dem fachfremden `me`-Modul. Mehrere Select-Formen sind identisch.
- **Umbau:** `likePattern` und `escapeLike` nach `common/sql.ts`, identische Select-Formen als Konstanten. Suchspalten bleiben je Endpunkt unterschiedlich.
- **Lib:** keine

### 05 – Server-Validierung auf Formularfehler abbilden
- **Priorität / Kategorie / Aufwand:** hoch / Duplikat / S
- **Dateien (WEB):** `features/library/scores/new-score-page.ts:67-74`, `features/library/scores/score-page.ts:223-230`, `features/library/voices/voice-dialog.ts:138-145`
- **Begründung:** Derselbe Handler steht dreimal im Code.
- **Umbau:** `fieldProblemHandler(errors, focusInvalid)`. `club-settings` und `print-settings` bleiben unverändert, sonst würde aus einem Toast ein Feldfehler.
- **Lib:** keine

### 06 – Lokale Fehler-Wrapper durch `ActionRunner` ersetzen
- **Priorität / Kategorie / Aufwand:** hoch / Duplikat / S
- **Dateien (WEB):** `features/me/score-page.ts:147-154`, `features/me/tags-page.ts:124-131`, `features/me/ui/voice-selection-dialog.ts:134-147`, `features/me/ui/member-score-list.ts:122-141`, `core/actions/action-runner.ts:30-40`
- **Begründung:** Vier lokale Nachbauten des vorhandenen Runners.
- **Umbau:** Zuerst Charakterisierungstests für `ActionRunner`, dann umstellen. Der abweichende Fehlerschlüssel `common.selection.zipFailed` und die Reload-Reihenfolgen bleiben erhalten.
- **Lib:** keine

### 07 – Busy-Flags in `ActionRunner`
- **Priorität / Kategorie / Aufwand:** hoch / Duplikat / S
- **Dateien (WEB):** `features/library/scores/new-score-page.ts:64,76`, `features/library/scores/score-page.ts:218,233`, `features/library/voices/voice-dialog.ts:136,161`, `features/system/roles/role-page.ts:87,92`, `features/system/settings/club-settings.ts:190,194,207,211`, `shared/ui/score-search-select.ts:108,113`
- **Begründung:** Das Setzen und Zurücksetzen des Busy-Signals wiederholt sich.
- **Umbau:** Option `run(action, { busy })`. `review-page` (Navigation bei aktivem Busy) und `score-import-page` (dreiwertiger Status) bleiben unverändert.
- **Lib:** keine

### 08 – Mutations-Helfer `post`/`postVoid`
- **Priorität / Kategorie / Aufwand:** hoch / Komplexität / M
- **Dateien (WEB):** 64 Aufrufe von `actions.run(`, davon 53 mit `firstValueFrom(this.api.postVoid`, zum Beispiel `features/library/events/edit-event-page.ts:168-189`, `features/system/users/user-page.ts:90-156`, `features/system/roles/role-page.ts:88-118`
- **Begründung:** Jeder Aufruf wiederholt dieselbe RxJS-Brücke.
- **Umbau:** `actions.postVoid(url, body, options)` und `actions.post(url, body, schema, options)`. Mehrschritt-Abläufe behalten `run`. Stille und getoastete Varianten bleiben wie bisher.
- **Lib:** keine (rxjs vorhanden)

### 09 – Bestätigtes Löschen vereinheitlichen
- **Priorität / Kategorie / Aufwand:** hoch / Duplikat / M
- **Dateien (WEB):** `features/library/events/edit-event-page.ts:194`, `features/library/events/manage-events-page.ts:127`, `features/library/folders/edit-folder-page.ts:176`, `features/library/folders/manage-folders-page.ts:118`, `features/library/scores/score-page.ts:199,239`, `features/library/scores/scores-page.ts:259`, `features/library/tags/club-tags-page.ts:127`, `features/library/voices/voices-page.ts:77`, `features/system/roles/role-page.ts:116`, `features/system/users/user-page.ts:153`, `features/system/settings/fields-settings.ts:128`
- **Begründung:** Zwölfmal derselbe Ablauf aus Bestätigen, Löschen und Toast.
- **Umbau:** `actions.confirmedDelete(...)` liefert ein Boolean, Reload und Navigation bleiben beim Aufrufer. Parameternamen der Übersetzungen bleiben je Aufruf erhalten.
- **Lib:** keine

### 10 – Resource-Wert mit Fallback
- **Priorität / Kategorie / Aufwand:** hoch / Duplikat / M
- **Dateien (WEB):** 50 Stellen, zum Beispiel `core/voices/voice-context.store.ts:36-37`, `features/library/library-options.ts:32-37`, `features/system/users/user-page.ts:59,63`
- **Begründung:** Das Muster `hasValue() ? value() : fallback` ist nötig, weil `value()` im Fehlerzustand wirft, aber überall ausgeschrieben.
- **Umbau:** `resourceValue(resource, fallback)`, das erst beim Aufruf auswertet, weil manche Seiten darauf vor der Initialisierung verweisen.
- **Lib:** keine

### 11 – Limits aus `libs/shared` statt hart codiert
- **Priorität / Kategorie / Aufwand:** hoch / Duplikat / S
- **Dateien:** WEB `features/library/events/edit-event-page.ts:34`, `features/library/voices/voice-dialog.ts:32`, `features/me/ui/voice-selection-dialog.ts:22`, `features/system/users/user-page.ts:121`, `shared/ui/score-search-select.ts:106`; SHARED `events/event-actions.schema.ts:27`, `voices/voice-actions.schema.ts:28`, `me/profile.schema.ts:19`, `system/user-actions.schema.ts:16`, `scores/score-fields.schema.ts:6`
- **Begründung:** Frontend und Schema können auseinanderlaufen.
- **Umbau:** Benannte Konstanten in `libs/shared` exportieren, Werte unverändert.
- **Lib:** keine

### 12 – Gruppieren per Map (API)
- **Priorität / Kategorie / Aufwand:** mittel / Duplikat / M
- **Dateien (API):** `common/ensemble-tree.ts:20`, `me/me.repository.ts:164,209`, `scores/scores.repository.ts:45,87`, `scores/score-import.service.ts:187,318,354`, `system/ensembles.service.ts:99,198`, `system/roles.service.ts:166`, `print-rules/print-rules.service.ts:73`, `access/access-context.ts:52`
- **Begründung:** Zehn Stellen hängen per Kopie an, mehrere filtern in einer Schleife (quadratische Laufzeit).
- **Umbau:** Kleiner Helfer `groupToMap`. lodash `groupBy` passt nicht, weil es den Schlüssel `null` zu `'null'` macht.
- **Lib:** keine

### 13 – Lookup- und Assert-Helfer (API)
- **Priorität / Kategorie / Aufwand:** mittel / Duplikat / M
- **Dateien (API):** `library/library-helpers.ts:18-22`, `system/users.service.ts:59,67-71`, `system/config.service.ts:73,92-98`, `folders/folders.service.ts:204-207`, `events/events.service.ts:158-161`, `scores/scores.service.ts:120,126,134,144,159`, `scores/scores.repository.ts:188-195`, `system/ensembles.service.ts:50-55`
- **Begründung:** Gleiche Existenzprüfungen und Abfragen in mehreren Services.
- **Umbau:** Kleine Helfer mit Pfad und Fehlertext als Parameter, damit Fehlerantworten gleich bleiben.
- **Lib:** keine

### 14 – Kind-Zeilen ersetzen, nächste Position
- **Priorität / Kategorie / Aufwand:** mittel / Duplikat / M
- **Dateien (API):** `me/me.repository.ts:192-199`, `system/users.service.ts:95-98`, `system/ensembles.service.ts:238-241`, `voices/voices.service.ts:106-109,165,196,206-209`, `events/events.service.ts:146-149`, `system/roles.service.ts:197-201`, `scores/scores.repository.ts:107-108`, `print-rules/print-rules.service.ts:45-48`, `scores/fields.service.ts:28,57-59,96-97`, `scores/score-import.service.ts:364,375`, `seed/lineup-template.ts:55,66-67`
- **Begründung:** Das Muster „löschen und bedingt einfügen“ steht neunmal im Code.
- **Umbau:** `replaceRows`, `nextPosition`, Permutationsprüfung mit parametrisiertem Fehlertext. Die Setlist bleibt 1-basiert.
- **Lib:** keine

### 15 – Fehlerbausteine für ID-Listen
- **Priorität / Kategorie / Aufwand:** mittel / Duplikat / M
- **Dateien (API):** `me/me.service.ts:52-57,85-90`, `system/users.service.ts:89-94`, `system/ensembles.service.ts:161-167`, `voices/voices.service.ts:96-105`, `events/events.service.ts:139-144`, `scores/fields.service.ts:47-50`
- **Begründung:** Gleiche Prüfungen auf Duplikate und unbekannte IDs.
- **Umbau:** Nur kleine Bausteine `duplicateErrors` und `unknownErrors`. Kein gemeinsamer Validator, weil Reihenfolge, Indizes und Statuscodes je Endpunkt abweichen.
- **Lib:** keine

### 16 – Zod-Parameter-Decorators
- **Priorität / Kategorie / Aufwand:** mittel / Komplexität / M
- **Dateien (API):** 126 Vorkommen von `new Zod(...)` in 10 Controllern, `access/decorators.ts:72-90`, PDF-Antworten in `scores/scores.controller.ts:131`, `downloads/downloads.controller.ts:43,94`, `uploads/review.controller.ts:47`
- **Begründung:** Viel Boilerplate und handgeschriebene Parametertypen.
- **Umbau:** `ZParam`, `ZQuery`, `ZBody` mit abgeleiteten Typen. Bewusst kein generischer CRUD-Controller.
- **Lib:** keine

### 17 – Keyset-Pagination-Helfer
- **Priorität / Kategorie / Aufwand:** mittel / Duplikat / M
- **Dateien (API):** `me/me.repository.ts:123-126,224-228,249,287-288,323-328,370-373,445-448`, `folders/folders.service.ts:66-69,114-117`, `events/events.service.ts:70-77,105-106`, `system/users.service.ts:36,39`, `system/roles.service.ts:41-42`, `tags/tags.module.ts:46,49`, `uploads/uploads.service.ts:81,84`, `library/library-helpers.ts:48,51`, `uploads/review.service.ts:59-72`
- **Begründung:** Prädikat und Sortierung werden von Hand wiederholt.
- **Umbau:** Zuerst Zwei-Seiten-Tests, dann `keysetAfter(columns, cursor, dir)` mit expliziten Casts. Die Notentabelle und die Offset-Liste der Ensembles bleiben außen vor.
- **Lib:** keine

### 18 – Set-Umschalten und Set-Vergleich (Web)
- **Priorität / Kategorie / Aufwand:** mittel / Duplikat / S
- **Dateien (WEB):** `features/library/scores/scores-page.ts:188-193`, `features/me/ui/member-score-list.ts:99-104`, `features/print/print-dialog.ts:165-170`, `features/system/ensembles/ensemble-page.ts:100-104,150-155`, `features/me/ui/voice-selection-dialog.ts:121-126`, `features/system/users/user-page.ts:71-75,118-123`, `features/system/roles/role-page.ts:57-61`
- **Umbau:** `toggled(set, id, max?)` und `sameMembers(a, b)`. Einfügereihenfolge und Obergrenzen bleiben erhalten.
- **Begründung:** Gleiche Logik an bis zu sechs Stellen.
- **Lib:** keine

### 19 – Dialog-Reset beim Öffnen
- **Priorität / Kategorie / Aufwand:** mittel / Duplikat / S
- **Dateien (WEB):** `shared/ui/name-dialog.ts:53-55`, `core/layout/stand-in-dialog.ts:92-94`, `features/library/voices/voice-dialog.ts:92-103`, `features/me/ui/voice-selection-dialog.ts:111-117`
- **Begründung:** Gleicher Effekt mit `untracked` in jedem Dialog.
- **Umbau:** `onOpened(open, reset)`. `field-dialog` bleibt separat, weil es sein Input bewusst trackt.
- **Lib:** keine

### 20 – Sicherer Web-Storage-Zugriff
- **Priorität / Kategorie / Aufwand:** mittel / Duplikat / S
- **Dateien (WEB):** `core/voices/voice-context.store.ts:69-86`, `features/library/scores/scores-page.ts:272-288`
- **Begründung:** Wiederholte `try/catch`-Blöcke um den Storage.
- **Umbau:** `readStored(storage, key, parse, fallback)` mit eigener Parse-Funktion je Aufrufer.
- **Lib:** keine

### 21 – Kleine Web-Utilities zusammenführen
- **Priorität / Kategorie / Aufwand:** mittel / Duplikat / S
- **Dateien (WEB):** `core/print/browser-print.ts:80`, `features/me/ui/member-score-list.ts:135`, `core/voices/voice-groups.ts:6-16`, `features/library/voices/voices-page.ts:25-32`, `features/library/voices/voice-dialog.ts:35-41`, `features/system/settings/fields-settings.ts:118-125`
- **Umbau:** `safeFileName`, generische Gruppensuche, `moveItem` nach `core/util`. Die Grenzprüfung in `fields-settings` bleibt erhalten.
- **Begründung:** Gleiche Regex und Hilfslogik mehrfach.
- **Lib:** keine

### 22 – Route-Factories
- **Priorität / Kategorie / Aufwand:** mittel / Duplikat / S
- **Dateien (WEB):** `features/library/library.routes.ts:21-24`, `features/system/system.routes.ts:17-20`, `features/me/me.routes.ts:17-20`
- **Begründung:** Identische lokale Hilfsfunktionen.
- **Umbau:** `featurePage(root, section, parents)`. Die Variante in `me` behält ihre abweichenden Daten.
- **Lib:** keine

### 23 – Verwaltung Termine und Mappen
- **Priorität / Kategorie / Aufwand:** mittel / Duplikat / M
- **Dateien (WEB):** `features/library/events/manage-events-page.ts:54-133`, `features/library/folders/manage-folders-page.ts:52-124`
- **Begründung:** Fast identische Seitenlogik.
- **Umbau:** Helfer im Injection-Kontext. Klassen und geschützte Membernamen bleiben, damit Templates unberührt sind.
- **Lib:** keine

### 24 – Bearbeiten Termin und Mappe
- **Priorität / Kategorie / Aufwand:** mittel / Duplikat / M
- **Dateien (WEB):** `features/library/events/edit-event-page.ts:76-82,185-199`, `features/library/folders/edit-folder-page.ts:78-84,116-121,174-181`
- **Begründung:** Details, Berechtigungen, Sichtbarkeit und Löschen sind gleich.
- **Umbau:** Nur diese Teile extrahieren. Setlist und Mappeneinträge haben verschiedene Speichermodelle und bleiben getrennt.
- **Lib:** keine

### 25 – PDF-Laden und -Rendern
- **Priorität / Kategorie / Aufwand:** mittel / Duplikat / M
- **Dateien (WEB):** `shared/ui/pdf-viewer.ts:149-203`, `features/library/review/review-preview.ts:101-155`, `features/uploads/upload-split.ts:334-339`
- **Begründung:** Lade- und Renderlogik ist weitgehend doppelt.
- **Umbau:** `pdf-document`-Utility mit `renderPageToCanvas`. Skalierungsgrenzen und Rotation bleiben Parameter. Braucht eine manuelle PDF-Prüfung.
- **Lib:** keine

### 26 – `planRow` im Notenimport zerlegen
- **Priorität / Kategorie / Aufwand:** mittel / Komplexität / L
- **Dateien (API):** `scores/score-import.service.ts:112-233`
- **Begründung:** Rund 120 Zeilen und 6 Parameter mischen Parsen, Abgleich, Mutation und Mappenplanung.
- **Umbau:** Zuerst Charakterisierungstests, dann `parseRow`, `matchRow`, `applyToState`, `planFolderEntry`. Reihenfolge der Issues und Mutationen bleibt erhalten.
- **Lib:** keine

### 27 – Upload- und Storage-Abläufe
- **Priorität / Kategorie / Aufwand:** mittel / Komplexität / M
- **Dateien (API):** `uploads/uploads.service.ts:111-186`, `scores/scores.service.ts:167-170,245`, `uploads/review.service.ts:104-107,165,168`, `downloads/downloads.service.ts:144-148`, `system/config.service.ts:118,127`
- **Begründung:** Dreiwertiger Rückgabewert, doppelte Inserts, wiederholtes „Lesen oder 404“.
- **Umbau:** Nur `deleteQuietly` und Lese-Helfer. Die beiden Inserts bleiben getrennt, bis B-04 entschieden ist.
- **Lib:** keine

### 28 – Kleine API-Zusammenführungen
- **Priorität / Kategorie / Aufwand:** niedrig / Duplikat / M
- **Dateien (API):** `folders/folders.service.ts:127-136`, `events/events.service.ts:111-120`, `downloads/downloads.service.ts:131-141`, `common/url.ts:5-13`, `uploads/review.service.ts:205-222`; PRINT `server.ts:42-43`
- **Begründung:** Kleine Duplikate und umständliche Stellen.
- **Umbau:** Gemeinsame Kandidatenabfrage, `isHttpUrl`, vereinfachte Nachbarsuche. Fehlercodes bleiben je Aufrufer.
- **Lib:** keine

### 29 – Kleine Web-Vereinfachungen
- **Priorität / Kategorie / Aufwand:** niedrig / Komplexität / S
- **Dateien (WEB):** `core/api/problem.interceptor.ts:11`, `features/uploads/upload-dialog.ts:149-152`, `features/system/ensembles/ensemble-page.ts:127`, `features/system/users/user-page.ts:84`, `features/system/users/users-page.ts:51`, `features/system/roles/permission-labels.ts:32-36`
- **Begründung:** Überflüssige Wrapper und redundante Bedingungen.
- **Umbau:** Direkt vereinfachen.
- **Lib:** keine

### 30 – `chunk`, `countBy`, `uniqBy` über lodash
- **Priorität / Kategorie / Aufwand:** niedrig / Lib-Ersatz / S
- **Dateien:** API `scores/score-import.service.ts:99-102,388,401`; WEB `features/uploads/upload-model.ts:75-79`, `features/print/print-model.ts:32-41`
- **Begründung:** Handgeschriebene Standardoperationen.
- **Umbau:** `lodash` in der API, `lodash-es` im Web, jeweils mit Typen. Die Lib-Ausnahme des Auftrags deckt das ab.
- **Lib:** lodash, weil freigegeben und passend für genau diese Operationen

### 31 – Draft-Signale mit `linkedSignal`
- **Priorität / Kategorie / Aufwand:** niedrig / Komplexität / M
- **Dateien (WEB):** `features/system/roles/role-page.ts:67-70` als Pilot, danach `features/system/users/user-page.ts:78-81`, `features/system/ensembles/ensemble-page.ts:116-120`
- **Begründung:** Effekte kopieren Serverwerte in Entwürfe.
- **Umbau:** Pilot mit Tests. Das Timing ändert sich von „nach dem Rendern“ zu synchron, deshalb wird verworfen, falls `dirty`-Zustände abweichen.
- **Lib:** keine

### 32 – Launcher-Dialog-Brücke
- **Priorität / Kategorie / Aufwand:** niedrig / Duplikat / S
- **Dateien (WEB):** `core/actions/pending-features.ts:29-62`, `features/uploads/upload-dialog.ts:73-86`, `features/print/print-dialog.ts:115-123`
- **Begründung:** Gleiches Muster dreimal, Dateiname irreführend.
- **Umbau:** Kleine generische Launcher-Basis.
- **Lib:** keine

### 33 – Aktuelle URL zentral
- **Priorität / Kategorie / Aufwand:** niedrig / Duplikat / S
- **Dateien (WEB):** `core/layout/app-shell.ts:65,72-80`, `core/layout/nav-list.ts:103-109`
- **Begründung:** Die URL wird doppelt verfolgt.
- **Umbau:** Gemeinsames Signal, beide bisherigen Formen (mit und ohne Query) bleiben verfügbar.
- **Lib:** keine

## Breaking: Vorschläge, die nicht umgesetzt werden

Diese Punkte sind vermutete Fehler. Ihre Behebung ändert das Verhalten, deshalb bleiben sie in diesem Lauf unverändert und brauchen eine eigene Entscheidung.

| Nr. | Stelle | Verhalten | Vorschlag |
|---|---|---|---|
| B-01 | `deploy/e2e/tools/src/probe-own-voice.mjs:25` | `\s` wird im Template-String zu `s`, die Regex ersetzt also den Buchstaben s | `\\s` schreiben |
| B-02 | WEB `features/library/events/edit-event-page.ts:206-219` | Schlägt eine spätere Seite fehl, gilt die Teil-Setlist als gespeichert. Das nächste Speichern kann Einträge löschen | Bei Fehler nicht übernehmen |
| B-03 | WEB `features/library/events/edit-event-page.ts` (`loadSetlist`) | Eine langsame Antwort zum vorherigen Termin kann den aktuellen überschreiben | Veraltete Antworten verwerfen |
| B-04 | API `uploads/uploads.service.ts:169-178` | Nur dieser Pfad speichert Mikrosekunden, ein Eintrag kann in der Prüfliste doppelt erscheinen | `createdAt` setzen |
| B-05 | API `uploads/uploads.service.ts:180-183` | Scheitert das Löschen der Temp-Datei nach dem Commit, wird auch das Original gelöscht | Löschen als Best-Effort |
| B-06 | API `access/permission.guard.ts:50` | Für Admins liefern nicht vorhandene Mappen oder Termine teils 204, leere 200 oder 500 | Existenz immer prüfen |
| B-07 | API `common/pagination/cursor.ts:19-25` | Ein wohlgeformter Cursor mit Nicht-UUID führt vermutlich zu 500 statt 400 | Inhalt validieren |
| B-08 | API `system/ensembles.service.ts:35` | Der Offset-Cursor akzeptiert ungültige Werte | Zahl validieren |
| B-09 | API `uploads/review.service.ts:104-107,123` | Fehlende Datei: 500 in `approve`, 404 in `originalFile` | Vereinheitlichen |
| B-10 | API `scores/score-import.service.ts:198-201` | Beim Überschreiben eines Titels bleibt der Abgleichsindex alt | Index aktualisieren |
| B-11 | API `scores/score-import.service.ts:330` | 403, sobald eine neue Mappe gewünscht ist, auch ohne betroffene Zeile | Nur genutzte Mappen prüfen |
| B-12 | API `access/cookies.ts:15` | Cookies mit Namen wie `constructor` gehen verloren | `Object.create(null)` oder Lib |
| B-13 | WEB `features/me/score-page.ts:125-133,143-144` | Reload nach Fehler, `createTag` meldet Erfolg trotz Fehler beim Zuweisen | Klären |
| B-14 | WEB `features/uploads/upload-split.ts:232-236` | Der laufende PDF-Task wird beim Zerstören nicht beendet | Task speichern und beenden |
| B-15 | WEB `shared/ui/pdf-viewer.ts:182-197`, `features/library/review/review-preview.ts:132-149` | Render-Race bei schnellen Wechseln | Erst abbrechen, dann Größe setzen |
| B-16 | WEB `features/library/scores/import/score-import-page.ts:144-158` | Vorschau-Reset setzt `rowActions` nur teilweise zurück | Absicht klären |

## Lib-Vorschläge, die nicht umgesetzt werden

| Lib | Stellen | Warum | Einschätzung |
|---|---|---|---|
| `cookie` | API `access/cookies.ts:8-25` | Getesteter Parser, behebt B-12 | empfohlen, verhaltensrelevant |
| `uuid` ab Version 10 | API `common/ids/uuid-v7.ts` | Ersetzt eigene UUIDv7 | sinnvoll, Monotonie vorher prüfen |
| `es-toolkit` | wie Thema 30 | Kleiner und typisiert, alternative zu lodash | optional |

Geprüft und bewusst **nicht** empfohlen: `content-disposition`, `csv-stringify`, `file-type`, Natural-Sort-Libs (der Schlüssel ist persistiert) und PapaParse (die Zeilenzuordnung des Imports ginge verloren). Der Print-Service bleibt ohne Laufzeitabhängigkeiten.

## Zurückgestellt

- **`shared/components`:** Dialog, Sheet und Drawer sind fast gleich, werden aber vom Design-Lauf zu `vm-*`-Komponenten umgebaut. Ein Umbau jetzt würde kollidieren.
- **Ensemble-Baum:** `tree()` und `inTreeOrder` wirken gleich, behandeln archivierte Knoten und Waisen aber verschieden.
- **Print-Service und API:** PDF-Prüfung und atomares Schreiben unterscheiden sich bewusst.
- **Mehrfach geladene Optionen:** Ein gemeinsamer Store würde das Aktualisierungsverhalten ändern.
