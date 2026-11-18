# Frontend-Plan (`apps/web`)

Stufenplan für das Angular-Frontend von VM-Web.

**Grundlagen:**

- [Anforderungen](requirements.md), Abschnitt „Seiten & Unterseiten“
- [API-Katalog](api.md)
- Mockups: <https://claude.ai/artifact/1WwdmV83YPmcuAconCEUAr>. 36 Screens, jeweils für Desktop, Tablet und Mobil, gegliedert in die fünf Bereiche.
- Design Guideline: <https://claude.ai/artifact/LDi95rWoEnHsFZeFaobAWS>. Enthält Tokens im shadcn-Schema, Glossar, Statusmuster und eigene Komponenten.

**Arbeitsweise wie bei der API:**

- Gebaut wird in Stufen.
- Nach jeder Stufe muss `pnpm nx run-many -t lint test build -p web shared` grün sein.
- Danach folgen eine Zusammenfassung, ein Commit-Vorschlag und ein Stopp bis zur Freigabe.
- `apps/api` bleibt unverändert. Fehlt etwas an der API, wird es vorher in `docs/api.md` und `libs/shared` nachgezogen und dir gemeldet.

## Querschnitt (gilt für alle Stufen)

| Thema | Festlegung |
| --- | --- |
| Struktur | `apps/web/src/app/{core,shared,features/<bereich>}`. `core` enthält API-Client, Sitzung, Guards und Layout. `shared/ui` enthält die Zard-Komponenten und die eigenen fachlichen Komponenten. Jeder Bereich wird per Lazy Loading geladen (`loadChildren`). |
| Zustand | Signals. Pro Seite ein kleiner Store (`signal` plus `resource`/`httpResource`), kein NgRx. |
| API-Zugriff | URLs nur über `apiUrl(API_ROUTES…)` aus `@vm-web/shared`. Typen per `z.infer` aus den Shared-Schemas. Responses werden im Dev-Build mit Zod geprüft, im Prod-Build nicht (Bundle-Größe und Laufzeit). |
| Routen | Englisch. Alle Pfade stehen als `APP_ROUTES` mit `appUrl()` in `@vm-web/shared` (`libs/shared/src/lib/app-routes.ts`), analog zu `API_ROUTES`. Das Angular-Routing, die Links und später die API (Weiterleitungen nach dem Login, Links in E-Mails o. Ä.) nutzen dieselben Konstanten. Tabelle siehe „Routen“. |
| i18n | Transloco, vorerst nur `de-DE`. Dateien unter `apps/web/public/translate/de-DE/`, ausgeliefert als `/translate/de-DE/…`. **Global** (`global.json`, beim Start geladen): Navigation, allgemeine Aktionen (Speichern, Abbrechen, Löschen …), Glossarbegriffe, Statuswörter (StatusBadge), Fehler-Codes der API (`errors.<code>`), Validierung, Seitenhülle. **Scopes** (`<scope>.scope.json`, mit dem Bereich per Lazy Loading geladen): `auth`, `me`, `library`, `print`, `system`. Ein eigener `TranslocoLoader` bildet `de-DE` auf `global.json` und `me/de-DE` auf `me.scope.json` ab. Ein Test prüft, dass alle verwendeten Schlüssel vorhanden sind. |
| Fehler | Ein Interceptor wandelt Problem Details in `ApiProblem` um. Formulare mappen `errors[].pointer` auf Felder. Die Texte kommen aus i18n unter `errors.<code>`. Der Interceptor erledigt nur, was überall gleich ist: Bei 401 geht es zu `/login?returnTo=…`, bei `account-blocked` zu `/blocked`. 403 und 404 entscheidet die aufrufende Stelle: Beim Laden einer Seite folgt „Kein Zugriff“ bzw. „Nicht gefunden“, bei einer Aktion ein Toast. |
| Rechte | `SessionStore.can(code, ensembleId?)` bildet die Logik aus `AccessContext` nach (`club` / `anyEnsemble` / Ensemble mit Vererbung, Admin). Routen-Guard: `canMatch: [permission('score.view')]`. Menüpunkte ohne Recht werden ausgeblendet. |
| Listen | Eine Hilfsfunktion `cursorList()` (Signal mit `items`, `loadMore`, `loading`). Desktop und Tablet zeigen Tabellen, Mobil zeigt Karten. „Mehr laden“ als Button, kein Endlos-Scrollen (Tastatur, Barrierefreiheit). |
| Suche & Filter | Suchfeld mit Filter-Button (`sliders-horizontal`), Zähler-Badge und Chips. Der Filter öffnet sich als Dialog (480 px), mobil als Bottom-Sheet. Der Filterzustand steht in den Query-Parametern der URL. |
| Responsiv | `BreakpointObserver` liefert ein Signal `viewport()` mit `mobile` / `tablet` / `desktop` (768 / 1280 px). Wo die Mockups abweichen, gibt es eigene Templates, sonst nur Tailwind-Klassen. |
| Barrierefreiheit | Fokusring über Token `ring`. Fokus wird bei jedem Routenwechsel auf das `h1` gesetzt. Toasts mit `aria-live`. Jede Seite hat einen Test mit `axe-core` (Vitest, jsdom). |
| Downloads | PDF, ZIP und CSV über `<a href download>` auf die API-URL (Cookie-Sitzung, kein Blob). Druck-PDFs gehen per POST, daher als Blob. |
| Tests | Vitest (`@angular/build:unit-test`): Stores, Guards, Interceptor und Rechte-Logik als Unit-Tests, Seiten als Komponententests mit gemocktem `HttpTestingController`. E2E kommt später (laut Anforderungen). |

## Routen

Die Routen weichen bewusst von den deutschen Vorschlägen in `requirements.md` ab. Die Bereiche heißen wie in der API: `library` (Notenverwaltung) und `system`.

| Seite | Route | Recht |
| --- | --- | --- |
| Anmeldung | `/login` (`?error=`, `?returnTo=`) | öffentlich |
| Konto gesperrt | `/blocked` | öffentlich |
| Kein Zugriff / Nicht gefunden | `/forbidden`, `/**` | – |
| Start | `/me` | Mitglied |
| Mappen / Mappe | `/me/folders`, `/me/folders/:folderId` | Mitglied |
| Events / Event | `/me/events` (`?tab=archive`), `/me/events/:eventId` | Mitglied |
| Tags | `/me/tags`, `/me/tags/club/:tagId`, `/me/tags/personal/:tagId` | Mitglied |
| Stück (Mein Bereich) | `/me/scores/:scoreId` | Mitglied |
| Meine Uploads | `/me/uploads` | Mitglied |
| Profil | `/me/profile` | Mitglied |
| Stücke / anlegen / Stück | `/library/scores`, `/library/scores/new`, `/library/scores/:scoreId` | `score.view` / `score.create` |
| Prüfung | `/library/review`, `/library/review/:uploadId` | `sheet.approve` |
| Mappen / bearbeiten | `/library/folders`, `/library/folders/:folderId` | `folder.view` |
| Events / bearbeiten | `/library/events`, `/library/events/:eventId` | `event.view` |
| Vereins-Tags | `/library/tags` | `tag.view` |
| Stimmen & Instrumente | `/library/voices` | `voice.view` |
| Druckverlauf | `/print` | Mitglied |
| Benutzer / Detail | `/system/users`, `/system/users/:userId` | `user.view` |
| Ensembles / Detail | `/system/ensembles`, `/system/ensembles/:ensembleId` (`?tab=lineup\|members\|print`) | `ensemble.view` |
| Rollen / Rolle | `/system/roles`, `/system/roles/:roleId` | `role.view` |
| Konfiguration | `/system/settings` (`?tab=club\|defaults\|print\|fields`) | `config.view` (Tab Eigene Felder auch für Notenwart:innen) |

Tabs, die einen Teil einer Seite zeigen, sind Query-Parameter. So bleiben Links stabil und die Zurück-Taste funktioniert.

## Stufe 0 – Fundament

**Ziel:** Leere App mit Design-Tokens, Zard UI, i18n und API-Client.

**Aufgaben:**

- Tailwind CSS v4 und Zard UI einrichten (`components.json`, Zard-CLI). In `styles.css` kommen die Tokens aus der Design Guideline (shadcn-Variablen und `brass`/`*-soft`/`*-ink`), dazu Inter über `@fontsource-variable/inter`, lokal gebündelt, kein Google-CDN.
- Basis-Komponenten von Zard holen: Button, Badge, Input, Select, Checkbox, Switch, Dialog, Alert Dialog, Sheet, Tabs, Table, Dropdown Menu, Command, Toast (Sonner), Tooltip, Toggle Group.
- Transloco mit eigenem Loader für `/translate/de-DE/global.json` und `*.scope.json`; alle Fehler-Codes aus `docs/api.md` kommen in `global.json`.
- `APP_ROUTES` und `appUrl()` in `libs/shared` mit Tests. Dazu ziehe ich die drei fest eingetragenen Frontend-Pfade der API nach: `/me`, `/login?error=` und `/gesperrt` → `/blocked`. Sonst landet ein gesperrtes Konto auf „Nicht gefunden“. Das ist die einzige Änderung an `apps/api`; `docs/api.md` wird angepasst.
- `proxy.conf.json` korrigieren: Es leitet heute `/api` weiter, richtig ist `/internal` nach `http://localhost:3000`.
- `provideHttpClient(withXsrfConfiguration({cookieName:'XSRF-TOKEN', headerName:'X-XSRF-TOKEN'}), withInterceptors([problemInterceptor]))`.
- `ApiProblem`, `cursorList()` und das `viewport()`-Signal anlegen.
- `nx-welcome.ts` entfernen. `index.html` bekommt `lang="de"` und den Titel „VM-Web“.
- Budget für das initiale Bundle: Warnung ab 700 kB, Fehler ab 1 MB. Stand Stufe 0: 600 kB roh, 145 kB übertragen (Angular etwa 250 kB, CSS 102 kB, zod 100 kB, Toasts und tailwind-merge etwa 70 kB). zod wird mit `import * as z from 'zod'` eingebunden, die benannte Form zieht alle zod-Übersetzungen mit (454 statt 85 kB).

**Prüfung:**

- lint, test und build sind grün.
- Eine Demo-Route zeigt Buttons und Badges in den Token-Farben (wird in Stufe 1 entfernt).
- Interceptor-Tests decken 400 mit `errors[]`, 401, 403 und 404 ab.

## Stufe 1 – Anmeldung, Layout, Navigation

**Mockups:** Öffentlich (Anmeldung, Konto gesperrt, Fehlerseiten) sowie die Hülle aus allen anderen Screens (Seitenleiste, Kopfzeile, untere Leiste).

**Aufgaben:**

- `SessionStore` auf Basis von `GET auth/session`, `APP_INITIALIZER` lädt die Sitzung.
- Guards: `authGuard` und `permission(...)`; `blockedGuard` leitet nach `/blocked`.
- Seiten `/login` (Logo und Banner aus `auth/login-page` und `auth/branding/logo`), `/blocked`, `/forbidden` und „Nicht gefunden“.
- Layout:
  - Desktop: feste Seitenleiste, 256 px.
  - Tablet: Sheet von links.
  - Mobil: Kopfzeile, Menü-Button und untere Leiste mit Mein Bereich, Mappen, Events und Profil.
- Kopfzeile: Brotkrumen und Seitentitel, aktive Stimme (VoiceChip-Menü, M-2, `me/voice-context`), Benutzermenü mit Abmelden (`auth/logout`).
- Navigation wird aus einer Konfiguration mit Recht je Eintrag erzeugt. Der Zähler „Prüfung 4“ kommt aus `review` (Anzahl) und erscheint nur mit `sheet.approve`.
- Kein Ensemble-Umschalter (entschieden): Mein Bereich zeigt immer alle eigenen Ensembles. Oben in der Seitenleiste stehen Vereinslogo und Vereinsname.

**Prüfung:**

- Echter Login über Pocket ID mit `PUBLIC_BASE_URL=http://localhost:4200`.
- Als „Musiker Local“ sind nur Mein Bereich und Drucken sichtbar, als Admin alles.
- Navigation per Tab-Taste durch Seitenleiste und Menü funktioniert.
- Mobil-, Tablet- und Desktop-Ansicht wurden im Browser-Pane geprüft.

## Stufe 2 – Mein Bereich

**Mockups:** Start, Stimmen wählen, Mappen, Mappe, Events, Event, Tags, Stück, Meine Uploads, Profil.

**Eigene Komponenten:** `StatusBadge`, `VoiceChip`, `ScoreRow` (mit Nummernfeld 40×40) und `PdfViewer` (pdf.js).

**Aufgaben:**

- `/me`: Start mit kommenden Events, Mappen und Upload-Status. Beim ersten Besuch ohne Stimmen öffnet sich der Dialog „Stimmen wählen“ (M-1).
- `/me/folders` und `/me/folders/:folderId`: Suche, Ersatz- und Fehlt-Hinweise, ZIP-Download. „Drucken“ ist bis Stufe 6 ein Platzhalter-Dialog.
- `/me/events` mit den Tabs Kommende und Archiv, `/me/events/:id` mit der Setlist.
- `/me/tags` und die Tag-Seiten: Vereins-Tags und persönliche Tags.
- `/me/scores/:scoreId`: PDF-Vorschau der eigenen Stimme, Download, persönliche Tags. „Fehlende Stimme hochladen“ öffnet den Upload-Dialog aus Stufe 4; bis dahin ist der Link deaktiviert.
- `/me/uploads` mit Ablehnungsgrund; `/me/profile` mit Stimmen, Ensembles und Rollen.
- `PdfViewer`: pdf.js als Worker. Bietet Blättern, Zoom und Seitenzahl, per Tastatur bedienbar. Er wird in Stufe 4 für die Prüfung wiederverwendet.

**Prüfung:**

- Komponententests je Seite.
- Ein axe-Test pro Seite.
- Manueller Durchlauf als Musiker:in mit Daten aus der Dev-Datenbank.

## Stufe 3 – Notenverwaltung: Stammdaten

**Mockups:** Stücke (mit Filter), Stück anlegen, Stück, Stimmen & Instrumente, Vereins-Tags, Mappen, Mappe bearbeiten, Events verwalten, Event bearbeiten.

**Aufgaben:**

- `/library/scores`:
  - Tabelle mit festen und eigenen Feldern als Spalten.
  - Sortierung und Filter-Dialog.
  - Vollständigkeit „18/24“.
  - CSV-Export.
  - Mobil als Karten.
- `/library/scores/new`: Formular mit eigenen Feldern; „Feld hinzufügen“ legt ein neues eigenes Feld direkt im Formular an (N-2).
- `/library/scores/:scoreId` mit den Tabs Stammdaten, Stimmen & Vollständigkeit sowie Mappen & Nummern.
- `/library/voices`: Liste nach Instrument gruppiert, mit Autovervollständigung und Ersatzstimmen.
- `/library/tags`: Tags anlegen, umbenennen und löschen; die Bestätigung erfolgt als Toast mit „Rückgängig“, wo das umkehrbar ist.
- Mappen und Events verwalten:
  - `/library/folders` und `/library/folders/:folderId` mit Nummern je Stück.
  - `/library/events` und `/library/events/:eventId` mit Setlist. Die Reihenfolge lässt sich per Drag & Drop (`@angular/cdk/drag-drop`) ändern, alternativ per Tastatur über „Nach oben“ und „Nach unten“ (N-16).
  - Schalter „in Mein Bereich anzeigen“ (N-15).

Diese Stufe ist die größte. Bei Bedarf teile ich sie in **3a** (Stücke, Stimmen, Tags) und **3b** (Mappen, Events).

**Prüfung:**

- Als Notenwart:in wird eine Mappe angelegt, Stücke werden nummeriert, und die Mappe erscheint in Mein Bereich.
- Die Setlist lässt sich allein per Tastatur sortieren.

## Stufe 4 – Hochladen & Prüfung

**Mockups:** Hochladen (Dialog), Prüfung.

**Aufgaben:**

- Upload-Dialog, aufrufbar aus jeder Liste und aus Mein Bereich:
  - Mehrfachauswahl und Drag & Drop von Dateien.
  - Stimmenvorschlag aus dem Dateinamen (API).
  - Zusammenfassung vor dem Absenden.
  - Fortschritt je Datei.
- `/library/review` und `/library/review/:uploadId`:
  - Warteschlange mit `PdfViewer`, Drehen und Zuschneiden. Zuschneiden geht per Ziehen eines Rahmens oder über Zahlenfelder als Tastatur-Alternative.
  - Zuordnung von Stück und Stimme.
  - „Annehmen & weiter“ und „Ablehnen mit Grund“; Ersetzen nur mit Löschrecht.
- Tastenkürzel A / R / ← / → (N-13) über `previousUploadId`/`nextUploadId`. Die Kürzel sind nur aktiv, wenn der Fokus nicht in einem Eingabefeld liegt.
- Auf dem Tablet lässt sich die Warteschlange einklappen.

**Prüfung:**

- Ein Upload als Musiker:in erscheint als „Ungeprüft“ und wird als Notenwart:in angenommen.
- Danach ist das Notenblatt in der Mappe sichtbar, und der Status unter Meine Uploads ist „Freigegeben“.

## Stufe 5 – Systemverwaltung

**Mockups:** Benutzer, Benutzer-Detail, Ensembles, Ensemble-Detail mit Tab Druck, Rollen, Rolle, Konfiguration.

**Aufgaben:**

- `/system/users` und `/system/users/:userId`: Rolle je Ensemble zuweisen, Stimmen vorbelegen, Konto sperren.
- `/system/ensembles` und `/system/ensembles/:ensembleId`:
  - Ensemble-Baum.
  - Stammdaten, Besetzung, Mitglieder und Druckregeln.
  - Import der Besetzungs-Vorlage.
- `/system/roles` und `/system/roles/:roleId`:
  - `PermissionMatrix` mit Einzelrechten.
  - „Auf Standard zurücksetzen“.
  - Warnbanner bei Vereinsrechten (B-1).
- `/system/settings` mit den Tabs Verein & Anmeldung (mit Logo-Upload), Standardwerte, Drucken und Eigene Felder.
- **Änderungsprotokoll (S-6) entfällt.** Es gibt dafür keinen API-Endpunkt (bewusst nicht im MVP), obwohl ein Mockup existiert. Die Route wird nicht angelegt.

**Prüfung:**

- Der Admin vergibt einer Person eine Rolle im Sub-Ensemble; danach sieht diese Person die neuen Bereiche.
- Die Rechte-Matrix ist mit dem Screenreader-Label „Stücke – Bearbeiten“ bedienbar.

## Stufe 6 – Drucken

**Mockups:** Druckdialog, Druckverlauf (die Dateien heißen `druck-warteschlange-*`).

**Aufgaben:**

- Druckdialog, aufrufbar aus Mappe, Event, Stück und Stückliste:
  - Auswahl von Umfang und Stimmen.
  - Druckregeln des Ensembles werden nur angezeigt.
  - Vorab steht fest, welcher Weg genommen wird: Browser oder Druckservice (Seitengrenze aus der Konfiguration, D-2).
- Browser-Weg: Das druckfertige PDF von der API kommt als Blob in ein verstecktes `iframe`, danach folgt `print()`.
- Druckservice-Weg: ein `PrintServiceClient` hinter einer Schnittstelle, der `http://127.0.0.1:<port>` anspricht. Ist der Druckservice nicht erreichbar, erscheinen eine Warnung mit Installationsanleitung und ein Fallback auf den Browser-Druck (D-3).
- `/print`: Verlauf vom lokalen Druckservice mit den Zuständen Wartend, Druckt, Fertig und Fehler sowie „Erneut senden“. Statuswechsel werden als Toast angekündigt.

**Abhängigkeit:**

- `apps/print-service` ist bisher nur ein Gerüst, und seine HTTP-Schnittstelle (Port, Endpunkte, Origin-Prüfung) ist nicht festgelegt.
- Vorschlag: In dieser Stufe lege ich den Vertrag als Zod-Schema in `libs/shared/src/lib/print-service` an und baue das Frontend dagegen.
- Der Druckservice selbst wäre ein eigener Auftrag nach dem Frontend.
- Bis dahin funktioniert der Browser-Weg vollständig, und `/print` zeigt die Installationsanleitung.

**Prüfung:**

- Eine Stimme mit 3 Seiten öffnet den Browser-Druckdialog.
- Eine ganze Mappe ohne Druckservice zeigt Warnung und Fallback.
- Gegen einen Mock des Druckservice (im Test) zeigt der Verlauf alle vier Zustände.

## Neue Abhängigkeiten (Freigabe nötig)

| Paket | Zweck |
| --- | --- |
| `tailwindcss` v4, `@tailwindcss/postcss` | Pflicht laut Anforderungen (Zard) |
| Zard UI 1.12 (`zard-cli`, Komponenten als Quellcode in `apps/web/src/app/shared`) samt `class-variance-authority`, `clsx`, `tailwind-merge`, `@angular/cdk`, `ngx-sonner`, `@ng-icons/core` und `@ng-icons/lucide` | UI-Bibliothek. Das ältere npm-Paket `@ngzard/ui` nutzt `lucide-angular`, das Angular 22 nicht unterstützt. |
| `pdfjs-dist` | PDF-Vorschau (Anforderung); wird erst in Stufe 2 installiert |
| `@jsverse/transloco` | i18n zur Laufzeit mit JSON-Dateien (siehe Frage 1) |
| `@fontsource-variable/inter` | Schrift lokal statt über das Google-CDN (Datenschutz) |
| `axe-core` (dev) | Barrierefreiheits-Tests |

## Entscheidungen

- **i18n:** Transloco, vorerst nur `de-DE`. Gemeinsame Texte liegen in `global.json`, die Bereiche in `/translate/de-DE/<scope>.scope.json`.
- **Routen:** Englisch, als `APP_ROUTES` in `@vm-web/shared`, damit Client und API dieselben Pfade nutzen.
- **Druckservice:** Den Vertrag lege ich in Stufe 6 in `libs/shared` fest; der Druckservice selbst ist ein eigener Auftrag danach.
- **Änderungsprotokoll (S-6):** vorerst weggelassen.
- **Reihenfolge:** wie oben. Getestet wird ohnehin am Ende im Zusammenspiel.
- **Ensemble-Umschalter (R-1):** gibt es nicht. Die Listen in Mein Bereich umfassen immer alle eigenen Ensembles, wie in der API.
- **Mein Bereich (Stufe 2), Lücken zur API:** Die Mockups zeigen einiges, das die API nicht liefert. Weggelassen sind:
  - Ersatz- und Fehlt-Zähler in der Mappenliste; die Mappe selbst zeigt „fehlt“ über `missingCount`.
  - Suche in Mappen- und Eventlisten sowie Zähler an den Tabs „Kommende/Archiv“.
  - Mappen mit Nummer, eigene Felder und Hörprobe auf der Stückseite; Tags-Spalte in der Tag-Liste.
  - Hinweis „Mehr als 10 Seiten druckt der Druckservice“ (Seitengrenze ist nur in `system` lesbar), kommt mit Stufe 6.
  - Abschnitt „Druckservice auf diesem Computer“ im Profil, kommt mit Stufe 6.
- **Hochladen und Drucken vor Stufe 4/6:** Die Buttons sind schon da und rufen `UploadLauncher` bzw. `PrintLauncher` auf; bis die Dialoge gebaut sind, erklärt ein Toast, wann die Funktion kommt.
- **Pluralformen:** eigene Pipe `tPlural` (`<key>.one` / `<key>.other`) statt eines Transloco-Plugins.
- **Notenverwaltung (Stufe 3a), Lücken zur API:** weggelassen sind
  - Filter nach Vollständigkeit (die API kann danach nur sortieren) und nach Mappe;
  - „Fehlliste exportieren“ auf der Stückseite;
  - „Besetzungs-Vorlage übernehmen“ auf der Stimmen-Seite (gehört zu den Ensembles, Stufe 5);
  - Spalte „Mitglieder“ bei den Stimmen; stattdessen Anzahl Notenblätter und Besetzungen aus `voice-list`.
- **Sortieren ohne Drag & Drop:** Instrumente, Stimmen und Ersatzstimmen werden mit „nach oben/unten“ sortiert (F-16, N-9); Drag & Drop kommt mit der Setlist in 3b.
- **Hochladen und Prüfung (Stufe 4):**
  - Der Upload-Dialog sitzt in der Seitenhülle und wird überall über `UploadLauncher.open({ scoreId, scoreTitle, voiceId })` geöffnet. Uploads ohne Stück oder Stimme sind erlaubt; die Zuordnung erfolgt dann in der Prüfung (die API lässt beides offen).
  - Zuschneiden erfolgt über Ränder in Prozent mit Vorschau als abgedunkelter Bereich; Ziehen eines Rahmens mit der Maus ist nicht gebaut.
  - Seiten lassen sich beim Annehmen weglassen („Seite übernehmen“), z. B. leere Rückseiten.
  - Die Pfeiltasten wechseln zwischen Uploads (N-13); Seiten blättert man mit den Buttons der Werkzeugleiste.
- **Toasts** sitzen in der Seitenhülle, nicht in der Root-Komponente; dadurch bleiben ngx-sonner und tailwind-merge aus dem Start-Bundle (589 statt 691 kB).
- **Systemverwaltung (Stufe 5):**
  - Kein Tab „Druck“ (Druckregeln je Ensemble) im Ensemble-Detail; D-6 hat keinen API-Endpunkt im MVP.
  - Mitglieder kommen über die Benutzer-Seite ins Ensemble; der Tab „Mitglieder“ im Ensemble zeigt sie nur an.
  - Die Besetzung wird mit Checkboxen je Instrument gewählt; ihre Reihenfolge folgt der Reihenfolge der Instrumente und Stimmen.
  - Rechte-Matrix: „Anlegen“, „Bearbeiten“ und „Löschen“ setzen „Sehen“ im selben Bereich mit; wer „Sehen“ abwählt, nimmt dem Bereich alle Rechte.
  - Den Tab „Eigene Felder“ sehen auch Notenwart:innen (`score.edit`) und alle mit `config.edit`, so wie die API die Feld-Endpunkte freigibt.
  - Die Bezeichnungen der Feldtypen liegen jetzt global unter `terms.fieldTypes` (gebraucht von Notenverwaltung und Konfiguration).
