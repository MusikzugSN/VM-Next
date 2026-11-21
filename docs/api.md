# VM-Web API-Katalog (MVP)

Stand: 2026-11-15 · Status: **Entwurf zur Freigabe** · Grundlage: [requirements.md](requirements.md)

Dieser Katalog beschreibt alle Endpunkte von `apps/api` für die erste Version (alles „Muss“, nicht „Später“). Die Zod-Schemas liegen in `libs/shared/src/lib/<feature>/`, die Pfade als Konstanten in `libs/shared/src/lib/routes.ts` (`API_ROUTES`, `apiUrl()`).

## Inhalt

1. [Konventionen](#1-konventionen)
2. [Rechtemodell](#2-rechtemodell)
3. [Standardfehler](#3-standardfehler)
4. [auth – Anmeldung & Sitzung](#4-auth--anmeldung--sitzung)
5. [me – Mein Bereich](#5-me--mein-bereich)
6. [uploads – Hochladen](#6-uploads--hochladen)
7. [review – Prüfung](#7-review--prüfung)
8. [scores – Stücke & eigene Felder](#8-scores--stücke--eigene-felder)
9. [voices – Stimmen & Instrumente](#9-voices--stimmen--instrumente)
10. [folders – Mappen](#10-folders--mappen)
11. [events – Events](#11-events--events)
12. [tags – Vereins-Tags](#12-tags--vereins-tags)
13. [print – Drucken](#13-print--drucken)
14. [system – Systemverwaltung](#14-system--systemverwaltung)
15. [Übersicht](#15-übersicht)
16. [Offene Fragen & Annahmen](#16-offene-fragen--annahmen)

---

## 1. Konventionen

### Pfade

| Art | Muster | Beispiel |
| --- | --- | --- |
| Lesen (ein UI-Baustein) | `GET /internal/v1/{feature}/{baustein}` | `GET /internal/v1/me/upcoming-events` |
| Lesen (Baustein zu einem Element) | `GET /internal/v1/{feature}/{ressource}/{id}/{baustein}` | `GET /internal/v1/me/folders/{folderId}/scores` |
| Aktion auf Element | `POST /internal/v1/{feature}/{ressource}/{id}/{aktion}` | `POST /internal/v1/review/uploads/{uploadId}/approve` |
| Aktion ohne Element (Anlegen, Sammelaktion) | `POST /internal/v1/{feature}/{ressource}/{aktion}` | `POST /internal/v1/folders/folders/create` |

- Ein NestJS-Modul (ein Controller) pro Feature: `auth`, `me`, `uploads`, `review`, `scores`, `voices`, `folders`, `events`, `tags`, `print`, `system`.
- Die Ressource steht immer ausdrücklich im Pfad, auch wenn sie wie das Feature heißt (`/scores/scores/{scoreId}/update-details`). So kollidieren feste Segmente nie mit IDs.
- Jeder GET liefert genau einen UI-Baustein, fertig gefiltert (Rechte, Ensembles, Stimmen) und sortiert. Es gibt kein PUT, PATCH oder DELETE; Änderungen sind benannte POST-Aktionen.
- Englisch für Pfade, Felder und Codes. Der Server liefert keine UI-Texte, nur Codes (`status: "pending"`, `code: "sheet-exists"`); Ausnahmen sind von Personen eingegebene Inhalte (Namen, Ablehnungsgrund).

### Kennzeichnung

| Marke | Bedeutung |
| --- | --- |
| 📄 **Binär** | Antwort ist ein Stream (`application/pdf`, `application/zip`, `text/csv`, Bild) mit `Content-Disposition` |
| 📤 **Multipart** | Request ist `multipart/form-data` |
| 🌐 **Öffentlich** | ohne Sitzung erreichbar |

### Datentypen

- **IDs** sind UUIDs (v7, vom Server erzeugt). In den Beispielen unten abgekürzt (`"ens-1"`, `"score-7"`).
- **Datum** `YYYY-MM-DD` (`isoDateSchema`), **Zeitpunkt** ISO 8601 mit Offset (`isoDateTimeSchema`).
- Leere optionale Werte sind `null`, nie weggelassen (Responses). In Requests sind optionale Felder mit Standardwert weglassbar.
- Mehrfach-Query-Parameter werden wiederholt: `?voiceId=v-1&voiceId=v-2`.

### Listen & Pagination

- Query `cursor` (opak) und `limit` (Standard 50, max. 200). Antwort `{ "items": [...], "nextCursor": "…" | null }`.
- Manche Listen ergänzen Zusatzfelder neben `items` (z. B. `totalPending`). 
- **Nicht paginiert** sind nur begrenzte Stammdaten-/Auswahllisten; sie sind im Katalog mit „nicht paginiert“ markiert und antworten mit `{ "items": [...] }` bzw. `{ "groups": [...] }`.

### Ensemble-Auswahl

Auswahllisten von Ensembles (`folders/ensemble-options`, `events/ensemble-options`, `scores/ensemble-options`, `system/user-assignment-options`, `system/config/default-options`) kommen in **Baum-Reihenfolge** (F-3): übergeordnetes Ensemble vor seinen Unter-Ensembles, Geschwister nach Name. Jeder Eintrag hat `depth` = Anzahl der ebenfalls enthaltenen Vorfahren (0 = oberste Ebene dieser Liste); das Frontend rückt danach ein. Schema: `ensembleOptionSchema`.

### Stimmen-Kontext (M-2, M-3)

Alle Listen und Downloads unter `me` und `print` filtern serverseitig auf die **aktiven Stimmen**:

- Standard: die Profilstimmen (M-1).
- `?voiceId=…` (wiederholbar, max. 20) ersetzt sie vorübergehend, z. B. als Aushilfe. Das Profil bleibt unverändert (M-2).
- Zu jeder aktiven Stimme kommen ihre Ersatzstimmen (N-9) in Reihenfolge dazu, immer nachrangig und als `kind: "substitute"` mit `substituteFor` markiert (M-3).
- Pro Stück ergibt sich `availability`: `available` (mind. ein eigenes Blatt), `substitute-only`, `missing` („Stimme fehlt“, M-3).

Gemeinsamer Zeilentyp `MemberScoreRow` (`common/sheet.schema.ts`):

```json
{
  "scoreId": "score-7",
  "number": "12",
  "title": "Böhmischer Traum",
  "composer": "Norbert Gälle",
  "availability": "available",
  "sheets": [
    { "sheetId": "sheet-31", "voice": { "id": "v-tp1", "name": "Trompete 1 in B", "instrumentId": "i-tp" }, "pageCount": 2, "kind": "own", "substituteFor": null },
    { "sheetId": "sheet-40", "voice": { "id": "v-flh", "name": "Flügelhorn 1 in B", "instrumentId": "i-flh" }, "pageCount": 2, "kind": "substitute", "substituteFor": { "id": "v-tp1", "name": "Trompete 1 in B", "instrumentId": "i-tp" } }
  ]
}
```

### Anmeldung, Sitzung, CSRF

- BFF: Die API führt OIDC (Authorization Code + PKCE) serverseitig aus. Der Browser erhält nur das Cookie `vmweb_session` (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`). Tokens bleiben in der Sitzung auf dem Server (`ICacheService`).
- CSRF: Synchronizer-Token pro Sitzung, ausgeliefert im lesbaren Cookie `XSRF-TOKEN`, zurückgeschickt im Header `X-XSRF-TOKEN` (Angular-Standard). Pflicht für **alle** POST außer `auth/callback` (ist GET). Fehlt oder passt er nicht: `403 csrf-invalid`.
- Gesperrte Konten (A-5): Login endet auf `/blocked`; bestehende Sitzungen werden beim nächsten Aufruf beendet → `403 account-blocked`.

### Downloads

- `Content-Disposition: attachment; filename="<ascii>"; filename*=UTF-8''<utf8>` (RFC 6266), bei Vorschau `inline`.
- Dateinamen (M-6): `Nr – Titel – Stimme.pdf` mit Halbgeviertstrich und Leerzeichen; ohne Mappen-/Event-Kontext `Titel – Stimme.pdf`. Verbotene Zeichen `\ / : * ? " < > |` und Steuerzeichen werden zu `_`, Länge max. 150 Zeichen ohne Endung, Doppelte im ZIP erhalten ` (2)`, ` (3)` …

---

## 2. Rechtemodell

### Geltungsbereiche

| Geltungsbereich | Bedeutung | Prüfung |
| --- | --- | --- |
| **Öffentlich** | ohne Sitzung | – |
| **Angemeldet** | gültige Sitzung, Konto nicht gesperrt | Session-Guard |
| **Mitglied** | Mitglied in ≥ 1 Ensemble; Inhalte nur aus eigenen Ensembles (R-2) | Session + Daten-Filter |
| **Ensemble** | Recht im Ensemble des Elements **oder einem übergeordneten Ensemble** (Mappen, Events, Mitglieder) (R-4, F-3) | `@RequirePermission(p, { scope: 'ensemble', ensembleFrom: … })` |
| **Ensemble (mind. eines)** | Element ohne Ensemble (Stücke, Stimmen, Vereins-Tags, Hochladen, Prüfung): Recht in mind. einem Ensemble (R-4) | `scope: 'any-ensemble'` |
| **Verein** | Systemrecht in einer Rolle irgendeiner Mitgliedschaft, egal in welchem Ensemble (R-4, F-1) | `scope: 'club'` |
| **Admin** | Admin-Kennzeichen; darf immer alles (R-6) | – |

**Ensemble-Hierarchie (F-3):** Ensembles bilden einen Baum. Die oberste Ebene (Wurzel) wird beim ersten Start automatisch angelegt und kann weder gelöscht, archiviert noch verschoben werden. Rechte ergänzen sich nach unten: Eine Rolle in einem Ensemble gilt auch in allen Unter-Ensembles. Die effektiven Rechte in Ensemble X sind die Vereinigung der Rollen in X und allen Vorfahren.

**Rollen haben keinen eigenen Geltungsbereich (F-1):** Jede Rolle wird pro Mitgliedschaft vergeben und darf beliebige Rechte enthalten. Enthaltene Systemrechte (`user.*`, `role.*`, `ensemble.*`, `config.*`) gelten vereinsweit, unabhängig vom Ensemble der Mitgliedschaft.

Das Admin-Kennzeichen besteht jede Prüfung. Sichtbarkeit ohne Recht: Elemente, die eine Person gar nicht sehen darf, antworten mit `404 not-found` (keine Existenz-Leaks); sichtbare Elemente ohne das nötige Schreibrecht mit `403 forbidden`.

### Rechte-Codes (`common/permissions.schema.ts`)

| Bereich (Zeile der Matrix, R-7) | `view` | `create` | `edit` | `delete` | Geltung |
| --- | --- | --- | --- | --- | --- |
| `score` Stücke (inkl. eigene Felder) | ✓ | ✓ | ✓ | ✓ | Ensemble (mind. eines) |
| `voice` Stimmen & Instrumente | ✓ | ✓ | ✓ | ✓ | Ensemble (mind. eines) |
| `tag` Vereins-Tags | ✓ | ✓ | ✓ | ✓ | Ensemble (mind. eines) |
| `folder` Mappen | ✓ | ✓ | ✓ | ✓ | Ensemble |
| `event` Events | ✓ | ✓ | ✓ | ✓ | Ensemble |
| `user` Benutzer | ✓ | ✓ | ✓ | ✓ | Verein |
| `role` Rollen | ✓ | ✓ | ✓ | ✓ | Verein |
| `ensemble` Ensembles | ✓ | ✓ | ✓ | ✓ | Verein |

| Einzelrecht (R-3) | Bedeutung | Geltung |
| --- | --- | --- |
| `sheet.upload` | „Noten hochladen“: Upload-Dialog, fehlende Stimme hochladen (F-2) | Ensemble (mind. eines) |
| `sheet.approve` | „Noten freigeben“: Prüfung, eigene Uploads sofort sichtbar (N-10) | Ensemble (mind. eines) |
| `member.view` | „Mitglieder sehen“ | Ensemble |
| `config.view`, `config.edit` | Konfiguration | Verein |

`user.create` ist im MVP ohne Endpunkt (Konten entstehen beim ersten Login, A-3), bleibt aber in der Matrix für Vollständigkeit. Ohne eigenes Recht, nur über Mitgliedschaft: Mein Bereich, persönliche Tags (M-8, F-2), Drucken (D-7). Hochladen braucht `sheet.upload` (F-2, abweichend vom Wortlaut von N-10).

Standardrollen für `defaults/roles.default.json` (Feinabstimmung noch offen laut Anforderungen):

| Rolle | Rechte |
| --- | --- |
| `admin` Administrator:in (beim ersten Start automatisch angelegt, F-3) | alle Rechte |
| `musician` Musiker:in | `sheet.upload` |
| `librarian` Notenwart:in | `score.*`, `voice.*`, `folder.*`, `event.*`, `tag.*`, `sheet.upload`, `sheet.approve`, `member.view` |
| `board` Vorstand | `member.view`, `event.*` |

---

## 3. Standardfehler

Alle Fehler als `application/problem+json` (RFC 9457). `type` = `urn:vm-web:problem:<code>`, `code` wiederholt den Code für i18n, `title` ist ein englischer Kurztext für Logs (nicht für die UI).

```json
{
  "type": "urn:vm-web:problem:validation-failed",
  "title": "Validation failed",
  "status": 400,
  "detail": "Request does not match schema",
  "instance": "/internal/v1/folders/folders/create",
  "code": "validation-failed",
  "errors": [
    { "path": "/body/name", "code": "too_small" },
    { "path": "/query/limit", "code": "too_big" }
  ]
}
```

| Status | `code` | Wann | gilt für |
| --- | --- | --- | --- |
| 400 | `validation-failed` | Params, Query oder Body passen nicht zum Schema (`errors[]` mit JSON-Pointer und Zod-Code) | alle |
| 401 | `unauthenticated` | keine oder abgelaufene Sitzung | alle außer 🌐 |
| 403 | `account-blocked` | Konto gesperrt (A-5) | alle außer 🌐 |
| 403 | `csrf-invalid` | CSRF-Token fehlt/falsch | alle POST |
| 403 | `forbidden` | Recht fehlt | mit Recht |
| 404 | `not-found` | Element existiert nicht oder ist unsichtbar | mit Pfad-ID |
| 413 | `payload-too-large` | Upload zu groß | 📤 |
| 415 | `unsupported-media-type` | Dateityp nicht erlaubt | 📤 |
| 500 | `internal-error` | unerwarteter Fehler (ohne Details) | alle |

Weitere fachliche Codes: `409 conflict` (allgemein, z. B. veraltete Reihenfolge), `409 name-taken`, `409 in-use`, `409 sheet-exists`, `409 last-admin`, `409 not-default-role`, `409 upload-not-pending`.

In den Endpunkten unten steht unter **Fehler** nur, was über die Standardfehler hinausgeht.

**Codes in `errors[].code`:** Zod-Codes (`invalid_type`, `invalid_format`, `too_small`, `too_big`, `invalid_value` …) und diese fachlichen Codes:

| Code | Bedeutung |
| --- | --- |
| `invalid_cursor` | `cursor` ist ungültig oder passt nicht zur Liste |
| `unknown_voice` | Stimme existiert nicht (`voiceId`, `voiceIds`, Ersatzstimmen) |
| `unknown_field` | eigenes Feld existiert nicht (Werte, Filter, Sortierung) |
| `required` | Pflichtfeld ohne Wert (N-2) |
| `invalid_option` | Auswahlwert gehört nicht zum Feld |
| `options_not_allowed` | Optionen bei einem Feldtyp ohne Auswahl |
| `unknown_option` | Options-ID beim Ändern eines Felds unbekannt |
| `unsupported_operator` | Filter-Operator passt nicht zum Spaltentyp (N-3) |
| `self_reference` | Stimme als eigene Ersatzstimme |
| `duplicate` | Eintrag doppelt in einer Liste (Setlist, Ersatzstimmen) |
| `archived` | Ensemble ist archiviert |
| `not_pdf`, `encrypted`, `damaged`, `empty` | Upload: Datei ist kein PDF, verschlüsselt, nicht lesbar oder ohne Seiten (415, Pfad `/files/<i>`) |
| `count_mismatch`, `invalid_json` | Upload: `meta` passt nicht zur Zahl der Dateien bzw. ist kein JSON |
| `not_image` | Logo ist kein PNG, JPEG, WebP oder SVG (415, Pfad `/file`) |

---

## 4. auth – Anmeldung & Sitzung

Modul `AuthModule`, Schemas `libs/shared/src/lib/auth/`.

### `GET /internal/v1/auth/login` 🌐

Startet den OIDC-Login (Authorization Code mit PKCE). · A-1, A-2

- **Recht:** Öffentlich
- **Query:** `returnTo` (optional, relativer App-Pfad, Standard `/me`; absolute URLs werden abgelehnt)
- **Response:** `302 Found`, `Location: <issuer>/authorize?…` (state, nonce, code_challenge S256). Legt eine Vor-Sitzung mit `state`, `nonce`, `code_verifier`, `returnTo` an (TTL 10 min).
- **Fehler:** `400 validation-failed` (ungültiges `returnTo`)

### `GET /internal/v1/auth/callback` 🌐

Redirect-Ziel des Identity-Servers; legt Konto an bzw. aktualisiert es und startet die Sitzung. · A-1, A-3, A-4, A-5, S-5, R-5

- **Recht:** Öffentlich
- **Query:** `code`, `state` bzw. `error`, `error_description`
- **Ablauf:** Token-Tausch → ID-Token prüfen → Benutzer über `sub` suchen (A-4). Neu: Konto anlegen und Mitglied im Standard-Ensemble mit Standardrolle (A-3); ab Werk sind das Wurzel-Ensemble und `admin` (F-3, H-3). Erste Person überhaupt: zusätzlich Admin-Kennzeichen (S-5, H-2). `name`, `email`, `picture` bei jedem Login übernehmen, `lastLoginAt` setzen. Sitzungs-ID rotieren, Cookies `vmweb_session` und `XSRF-TOKEN` setzen.
- **Response:** `302 Found` nach `returnTo` (Standard `DEFAULT_APP_PATH` = `/me`; alle Frontend-Pfade stehen als `APP_ROUTES` in `libs/shared/src/lib/app-routes.ts`); gesperrt → `302 /blocked` ohne Sitzung (A-5); Fehler → `302 /login?error=login-failed|state-mismatch|idp-error`
- **Fehler:** keine JSON-Fehler, alles über Redirect

### `POST /internal/v1/auth/logout`

Beendet die Sitzung in VM-Web. · A-6 (RP-Logout ist „Soll“ und folgt später)

- **Recht:** Angemeldet
- **Body:** keiner
- **Response:** `204 No Content`, löscht beide Cookies

### `GET /internal/v1/auth/session` 🌐

Liefert den Anmeldestatus, das Benutzerkopf-Profil und die effektiven Rechte für die Navigation. · A-4, R-1, R-4, R-6

- **Recht:** Öffentlich (ohne Sitzung `authenticated: false`)
- **Response 200:**

```json
{
  "authenticated": true,
  "user": { "id": "u-1", "name": "Alex Beispiel", "email": "alex@example.org", "pictureUrl": "https://id.example.org/pic/1.png", "isAdmin": false },
  "permissions": {
    "club": [],
    "anyEnsemble": ["score.view", "score.edit", "sheet.upload", "sheet.approve", "folder.view"],
    "memberships": [
      { "ensemble": { "id": "ens-1", "name": "Hauptorchester" }, "role": { "id": "role-lib", "name": "Notenwart:in" } },
      { "ensemble": { "id": "ens-2", "name": "Jugendorchester" }, "role": { "id": "role-mus", "name": "Musiker:in" } }
    ],
    "ensembles": [
      { "ensemble": { "id": "ens-1", "name": "Hauptorchester" }, "permissions": ["score.view", "score.edit", "sheet.upload", "sheet.approve", "folder.view"] },
      { "ensemble": { "id": "ens-1a", "name": "Hauptorchester – Bläserklasse" }, "permissions": ["score.view", "score.edit", "sheet.upload", "sheet.approve", "folder.view"] },
      { "ensemble": { "id": "ens-2", "name": "Jugendorchester" }, "permissions": ["sheet.upload"] }
    ]
  }
}
```

- **Fehler:** `403 account-blocked` (Sitzung wird beendet)

### `GET /internal/v1/auth/login-page` 🌐

Vereinsdaten für die Anmeldeseite. · A-2, S-4

- **Recht:** Öffentlich
- **Response 200:**

```json
{
  "clubName": "Musikzug Beispielstadt",
  "logoUrl": "/internal/v1/auth/branding/logo",
  "loginBanner": "Willkommen beim Musikzug! Zugang bekommst du bei der Notenwartin.",
  "imprintUrl": "https://musikzug.example.org/impressum",
  "privacyUrl": "https://musikzug.example.org/datenschutz",
  "autoRedirect": false
}
```

### `GET /internal/v1/auth/branding/logo` 🌐 📄

Vereinslogo als Bild (das Anmelde-Banner ist Text, F-12). · A-2, S-4

- **Recht:** Öffentlich
- **Response 200:** `image/png` | `image/jpeg` | `image/svg+xml` | `image/webp`, `Content-Disposition: inline; filename="logo.png"`, `Cache-Control: public, max-age=300`, `ETag`
- **Fehler:** `404 not-found` (kein Bild hinterlegt)

---

## 5. me – Mein Bereich

Modul `MeModule`, Schemas `libs/shared/src/lib/me/`. **Recht für alle Endpunkte: Mitglied** (R-2) – kein Fachrecht nötig. Inhalte stammen aus den Ensembles mit Mitgliedschaft **und allen ihren Unter-Ensembles** (H-1); Mappen und Events nur mit „in Mein Bereich anzeigen“ (N-15). Sichtbar sind nur Stücke aus diesen Mappen und Events; Vereins- und persönliche Tags sind reine Filter darauf (F-6). Personen ohne Mitgliedschaft (z. B. nach Entfernen aller Mitgliedschaften) erhalten leere Listen statt 403, damit Profil und Stimmenwahl funktionieren.

### `GET /internal/v1/me/voice-context`

Kopfzeile: aktive Stimmen, Ersatzstimmen und ob die Stimmenwahl beim ersten Besuch nötig ist. · M-1, M-2, M-3

- **Recht:** Angemeldet
- **Query:** `voiceId` (wiederholbar, optional)
- **Response 200:**

```json
{
  "profileVoices": [{ "id": "v-tp1", "name": "Trompete 1 in B", "instrumentId": "i-tp" }],
  "activeVoices": [{ "id": "v-tp2", "name": "Trompete 2 in B", "instrumentId": "i-tp" }],
  "isOverride": true,
  "substituteVoices": [{ "id": "v-flh2", "name": "Flügelhorn 2 in B", "instrumentId": "i-flh" }],
  "needsVoiceSelection": false
}
```

- **Fehler:** `400 validation-failed` (unbekannte `voiceId` → Pfad `/query/voiceId/0`)

### `GET /internal/v1/me/voice-options`

Alle Stimmen gruppiert nach Instrument, für Umschalter, „Stimmen wählen“, Profil, Upload-Dialog und Prüfansicht (nicht paginiert). · M-1, M-2, N-6, N-11, N-12

- **Recht:** Angemeldet
- **Response 200:**

```json
{
  "groups": [
    { "instrument": { "id": "i-tp", "name": "Trompete" }, "voices": [{ "id": "v-tp1", "name": "Trompete 1 in B" }, { "id": "v-tp2", "name": "Trompete 2 in B" }] },
    { "instrument": { "id": "i-hn", "name": "Horn" }, "voices": [{ "id": "v-hnf1", "name": "Horn 1 in F" }] }
  ]
}
```

### `GET /internal/v1/me/upcoming-events`

Kommende Events (Datum ≥ heute, aufsteigend) für Start und Tab „Kommende“. · M-5, R-2

- **Recht:** Mitglied
- **Query:** `cursor`, `limit`
- **Response 200:**

```json
{ "items": [{ "id": "evt-3", "name": "Frühjahrskonzert", "date": "2027-03-20", "ensemble": { "id": "ens-1", "name": "Hauptorchester" }, "scoreCount": 14 }], "nextCursor": null }
```

### `GET /internal/v1/me/archived-events`

Vergangene Events (absteigend) für Tab „Archiv“. · M-5, R-2

- **Recht:** Mitglied
- **Query:** `cursor`, `limit`
- **Response 200:** wie `upcoming-events`

### `GET /internal/v1/me/folders`

Freigegebene Mappen der eigenen Ensembles (Start und Seite „Mappen“), sortiert nach Ensemble und Name. · R-2, M-4, N-15

- **Recht:** Mitglied
- **Query:** `cursor`, `limit`
- **Response 200:**

```json
{ "items": [{ "id": "fld-1", "name": "Marschbuch", "ensemble": { "id": "ens-1", "name": "Hauptorchester" }, "scoreCount": 48 }], "nextCursor": null }
```

### `GET /internal/v1/me/upload-summary`

Kachel „Status eigener Uploads“ auf der Startseite. · N-14

- **Recht:** Mitglied
- **Response 200:** `{ "pending": 2, "recentlyRejected": 1, "recentlyApproved": 5 }` (rejected/approved: letzte 30 Tage)

### `GET /internal/v1/me/my-uploads`

Eigene Uploads mit Status und Ablehnungsgrund, neueste zuerst. · N-14, M-9

- **Recht:** Mitglied
- **Query:** `cursor`, `limit`, `status` (`pending` | `approved` | `rejected`, optional)
- **Response 200:**

```json
{
  "items": [{
    "id": "up-9", "fileName": "Böhmischer Traum - Trompete 2.pdf", "uploadedAt": "2026-11-12T19:04:00Z",
    "status": "rejected", "score": { "id": "score-7", "name": "Böhmischer Traum" }, "voice": { "id": "v-tp2", "name": "Trompete 2 in B" },
    "rejectionReason": "Seite 2 fehlt", "decidedAt": "2026-11-13T08:15:00Z"
  }],
  "nextCursor": null
}
```

### `GET /internal/v1/me/folders/{folderId}/overview`

Kopf der Mappen-Seite mit Zählern für ZIP/Drucken. · M-4, M-3, D-2

- **Recht:** Mitglied (Mappe in eigenem Ensemble und freigegeben)
- **Path:** `folderId` · **Query:** `voiceId` (wiederholbar)
- **Response 200:**

```json
{ "id": "fld-1", "name": "Marschbuch", "ensemble": { "id": "ens-1", "name": "Hauptorchester" }, "scoreCount": 48, "missingCount": 3, "totalPages": 61 }
```

- **Fehler:** `404 not-found`

### `GET /internal/v1/me/folders/{folderId}/scores`

Stücke der Mappe nach Nummer, gefiltert auf aktive Stimmen, mit Suche und Tag-Filter. · M-2, M-3, M-4, M-8, N-5

- **Recht:** Mitglied
- **Path:** `folderId` · **Query:** `cursor`, `limit`, `voiceId`, `q` (Titel/Komponist), `clubTagId`, `personalTagId`
- **Response 200:** `{ "items": [MemberScoreRow…], "nextCursor": "…" }` (siehe [Konventionen](#stimmen-kontext-m-2-m-3))
- **Fehler:** `404 not-found`

### `GET /internal/v1/me/events/{eventId}/overview`

Kopf der Event-Seite. · M-5

- **Recht:** Mitglied
- **Path:** `eventId` · **Query:** `voiceId`
- **Response 200:**

```json
{ "id": "evt-3", "name": "Frühjahrskonzert", "date": "2027-03-20", "ensemble": { "id": "ens-1", "name": "Hauptorchester" }, "isPast": false, "scoreCount": 14, "missingCount": 0, "totalPages": 22 }
```

- **Fehler:** `404 not-found`

### `GET /internal/v1/me/events/{eventId}/setlist`

Setlist in Spielreihenfolge, gefiltert auf aktive Stimmen. · M-5, M-2, M-3

- **Recht:** Mitglied
- **Path:** `eventId` · **Query:** `cursor`, `limit`, `voiceId`
- **Response 200:** `{ "items": [{ "position": 1, …MemberScoreRow }], "nextCursor": null }` (`number` = Nummer in einer Mappe ist hier `null`)
- **Fehler:** `404 not-found`

### `GET /internal/v1/me/tags`

Vereins-Tags und eigene persönliche Tags als Filter (nicht paginiert). · M-8, R-2

- **Recht:** Mitglied
- **Response 200:**

```json
{
  "clubTags": [{ "id": "tag-1", "name": "Weihnachten", "scoreCount": 12 }],
  "personalTags": [{ "id": "ptag-1", "name": "Üben", "scoreCount": 3 }]
}
```

### `GET /internal/v1/me/club-tags/{tagId}/scores`

Sichtbare Stücke (aus freigegebenen Mappen/Events) mit einem Vereins-Tag, in den eigenen Stimmen, nach Titel. Tags filtern nur (F-6). · M-8, R-2

- **Recht:** Mitglied
- **Path:** `tagId` · **Query:** `cursor`, `limit`, `voiceId`, `q`
- **Response 200:** `{ "items": [MemberScoreRow…], "nextCursor": null }`
- **Fehler:** `404 not-found`

### `GET /internal/v1/me/personal-tags/{tagId}/scores`

Stücke mit einem eigenen persönlichen Tag. · M-8

- **Recht:** Mitglied (nur eigene Tags; fremde → 404)
- **Path/Query/Response:** wie `club-tags/{tagId}/scores`

### `GET /internal/v1/me/scores/{scoreId}/overview`

Stück-Seite: Blätter der aktiven Stimmen, fehlende Stimmen, Tags. · M-3, M-6, M-8, M-9

- **Recht:** Mitglied (Stück in einer freigegebenen Mappe oder einem freigegebenen Event, R-2, F-6)
- **Path:** `scoreId` · **Query:** `voiceId`
- **Response 200:**

```json
{
  "id": "score-7", "title": "Böhmischer Traum", "composer": "Norbert Gälle", "arranger": null,
  "availability": "substitute-only",
  "sheets": [{ "sheetId": "sheet-40", "voice": { "id": "v-flh2", "name": "Flügelhorn 2 in B", "instrumentId": "i-flh" }, "pageCount": 2, "kind": "substitute", "substituteFor": { "id": "v-tp2", "name": "Trompete 2 in B", "instrumentId": "i-tp" } }],
  "missingVoices": [{ "id": "v-tp2", "name": "Trompete 2 in B" }],
  "clubTags": [{ "id": "tag-2", "name": "Polka" }],
  "personalTags": []
}
```

- **Fehler:** `404 not-found`

### `GET /internal/v1/me/profile`

Profilseite: Daten aus dem Identity-Server (nur lesen), Stimmen, Ensembles & Rollen. · M-1, A-4, R-1

- **Recht:** Angemeldet
- **Response 200:**

```json
{
  "id": "u-1", "name": "Alex Beispiel", "email": "alex@example.org", "pictureUrl": null,
  "voices": [{ "id": "v-tp1", "name": "Trompete 1 in B", "instrumentId": "i-tp" }],
  "memberships": [{ "ensemble": { "id": "ens-1", "name": "Hauptorchester" }, "role": { "id": "role-mus", "name": "Musiker:in" } }],
  "isAdmin": false
}
```

### `GET /internal/v1/me/sheets/{sheetId}/pdf` 📄

Ein Notenblatt als PDF für Vorschau (pdf.js) oder Download. · M-6, M-3

- **Recht:** Mitglied (Blatt gehört zu einem sichtbaren Stück; jede Stimme erlaubt, nicht nur die aktive – für M-2-Umschalten)
- **Path:** `sheetId` · **Query:** `folderId` (optional, Nummer im Dateinamen), `disposition` (`attachment` Standard | `inline`)
- **Response 200:** `application/pdf`, `Content-Disposition: attachment; filename*=UTF-8''12%20%E2%80%93%20B%C3%B6hmischer%20Traum%20%E2%80%93%20Trompete%201%20in%20B.pdf` → „12 – Böhmischer Traum – Trompete 1 in B.pdf“, `Content-Length`
- **Fehler:** `404 not-found`

### `GET /internal/v1/me/folders/{folderId}/zip` 📄

Ganze Mappe als ZIP, ein PDF pro Stück. · M-6, M-3

- **Recht:** Mitglied
- **Path:** `folderId` · **Query:** `voiceId`, `substitutes` (`fallback` Standard: Ersatz nur wenn eigenes Blatt fehlt | `all` | `none`)
- **Response 200:** `application/zip`, gestreamt (archiver), `Content-Disposition: attachment; filename="Marschbuch – Trompete 1 in B.zip"`. Inhalt: `01 – Alte Kameraden – Trompete 1 in B.pdf` … (Nummer der Mappe; bei mehreren aktiven Stimmen ein PDF pro Stück und Stimme)
- **Fehler:** `404 not-found`

### `GET /internal/v1/me/events/{eventId}/zip` 📄

Event-Setlist als ZIP; Nummer = Position in der Setlist (zweistellig). · M-6, M-5

- **Recht:** Mitglied
- **Path/Query:** wie Mappen-ZIP mit `eventId`
- **Response 200:** `application/zip`, `filename="2027-03-20 Frühjahrskonzert – Trompete 1 in B.zip"`, Einträge `01 – Titel – Stimme.pdf`
- **Fehler:** `404 not-found`

### `POST /internal/v1/me/downloads/selection-zip` 📄

Auswahl aus einer Liste als ZIP (POST wegen langer ID-Liste; ändert nichts). · M-6

- **Recht:** Mitglied (nur sichtbare Stücke; unsichtbare IDs → 404)
- **Body:**

```json
{ "scoreIds": ["score-7", "score-9"], "folderId": "fld-1", "voiceIds": [], "substitutes": "fallback" }
```

- **Response 200:** `application/zip`, `filename="Auswahl – Trompete 1 in B.zip"`
- **Fehler:** `404 not-found`

### `POST /internal/v1/me/profile/set-voices`

Profilstimmen setzen (auch Dialog „Stimmen wählen“). · M-1

- **Recht:** Angemeldet
- **Body:** `{ "voiceIds": ["v-tp1", "v-flh1"] }` (1–20)
- **Response:** `204 No Content`
- **Fehler:** `400 validation-failed` (unbekannte Stimme)

### `POST /internal/v1/me/personal-tags/create`

Persönlichen Tag anlegen. · M-8

- **Recht:** Mitglied
- **Body:** `{ "name": "Üben" }`
- **Response 201:** `{ "id": "ptag-2" }`
- **Fehler:** `409 name-taken` (eigener Tag gleichen Namens)

### `POST /internal/v1/me/personal-tags/{tagId}/rename`

- **Zweck:** Persönlichen Tag umbenennen. · M-8
- **Recht:** Mitglied (eigener Tag) · **Path:** `tagId` · **Body:** `{ "name": "Auswendig" }`
- **Response:** `204` · **Fehler:** `404 not-found`, `409 name-taken`

### `POST /internal/v1/me/personal-tags/{tagId}/delete`

- **Zweck:** Persönlichen Tag löschen (Zuordnungen entfallen). · M-8
- **Recht:** Mitglied (eigener Tag) · **Path:** `tagId` · **Body:** keiner
- **Response:** `204` · **Fehler:** `404 not-found`

### `POST /internal/v1/me/scores/{scoreId}/add-personal-tag`

- **Zweck:** Eigenen Tag an ein sichtbares Stück hängen (idempotent). · M-8
- **Recht:** Mitglied · **Path:** `scoreId` · **Body:** `{ "tagId": "ptag-1" }`
- **Response:** `204` · **Fehler:** `404 not-found` (Stück oder Tag)

### `POST /internal/v1/me/scores/{scoreId}/remove-personal-tag`

- **Zweck:** Eigenen Tag von einem Stück entfernen (idempotent). · M-8
- **Recht:** Mitglied · **Path:** `scoreId` · **Body:** `{ "tagId": "ptag-1" }`
- **Response:** `204` · **Fehler:** `404 not-found`

---

## 6. uploads – Hochladen

Modul `UploadsModule`, Schemas `libs/shared/src/lib/uploads/`. Der Upload-Dialog ist aus Notenverwaltung, Stück und Mein Bereich erreichbar (N-11).

### `GET /internal/v1/uploads/voice-suggestions`

Stimmenvorschlag aus Dateinamen für die Bestätigung im Dialog. · N-11

- **Recht:** `sheet.upload` · Ensemble (mind. eines) (F-2)
- **Query:** `fileName` (wiederholbar, 1–50)
- **Response 200:**

```json
{ "items": [
  { "fileName": "Boehmischer Traum - Trp 1.pdf", "voice": { "id": "v-tp1", "name": "Trompete 1 in B", "instrumentId": "i-tp" } },
  { "fileName": "scan_0042.pdf", "voice": null }
] }
```

### `GET /internal/v1/uploads/score-search`

Stücksuche für Upload-Dialog und Prüfansicht. · N-11, N-12

- **Recht:** `sheet.upload` oder `sheet.approve` · Ensemble (mind. eines); Treffer: mit `score.view` oder `sheet.approve` alle Stücke, sonst nur in Mein Bereich sichtbare (R-2)
- **Query:** `q` (Pflicht), `cursor`, `limit`
- **Response 200:** `{ "items": [{ "id": "score-7", "title": "Böhmischer Traum", "composer": "Norbert Gälle", "arranger": null }], "nextCursor": null }`

### `POST /internal/v1/uploads/sheets/upload` 📤

Mehrfach-Upload von PDFs; je nach Recht sofort freigegeben oder „Ungeprüft“. · N-10, N-11, M-9, F-2

- **Recht:** `sheet.upload` · Ensemble (mind. eines) (F-2); `scoreId` muss für die Person sichtbar sein, siehe `score-search`
- **Content-Type:** `multipart/form-data`
  - `files`: 1–50 Dateien, je max. 50 MB (`UPLOAD_MAX_FILE_MB`), nur PDF (Magic Bytes `%PDF-` und lesbar mit pdf-lib)
  - `meta`: JSON-String, gleiche Reihenfolge wie `files`:

```json
{ "items": [
  { "fileName": "Boehmischer Traum - Trp 1.pdf", "scoreId": "score-7", "voiceId": "v-tp1" },
  { "fileName": "scan_0042.pdf", "scoreId": null, "voiceId": null }
] }
```

- **Regel (N-10, F-11):** Pro Stück und Stimme gibt es genau ein Dokument, unabhängig von der Seitenzahl. Hat die Person `sheet.approve`, sind Stück und Stimme gesetzt und gibt es noch kein Blatt, wird sofort eins erzeugt (`approved`). Sonst `pending`; über das Ersetzen entscheidet die Prüfung.
- **Response 201:**

```json
{ "items": [
  { "uploadId": "up-10", "fileName": "Boehmischer Traum - Trp 1.pdf", "status": "approved", "sheetId": "sheet-55", "pageCount": 2 },
  { "uploadId": "up-11", "fileName": "scan_0042.pdf", "status": "pending", "sheetId": null, "pageCount": 4 }
] }
```

- **Fehler:** `400 validation-failed` (`meta` passt nicht zu `files`), `404 not-found` (Stück/Stimme), `413 payload-too-large`, `415 unsupported-media-type` (kein/kaputtes PDF; `errors[].path` = `/files/<index>`)

---

## 7. review – Prüfung

Modul `ReviewModule`, Schemas `libs/shared/src/lib/review/`. **Recht für alle Endpunkte: `sheet.approve`, Ensemble (mind. eines)** (R-4, N-12).

### `GET /internal/v1/review/queue`

Warteschlange ungeprüfter Uploads, älteste zuerst. · N-12, N-10

- **Query:** `cursor`, `limit`
- **Response 200:**

```json
{
  "items": [{ "uploadId": "up-11", "fileName": "scan_0042.pdf", "uploadedAt": "2026-11-14T17:20:00Z", "uploadedBy": { "id": "u-5", "name": "Sam Muster" }, "pageCount": 4, "score": null, "voice": null }],
  "nextCursor": null,
  "totalPending": 1
}
```

### `GET /internal/v1/review/uploads/{uploadId}/details`

Daten der Prüfansicht für einen Upload inkl. Nachbarn für „Annehmen & weiter“. · N-12, N-13

- **Path:** `uploadId`
- **Response 200:**

```json
{
  "uploadId": "up-11", "fileName": "scan_0042.pdf", "status": "pending", "uploadedAt": "2026-11-14T17:20:00Z",
  "uploadedBy": { "id": "u-5", "name": "Sam Muster" }, "pageCount": 4,
  "score": null, "voice": null, "existingSheetId": null,
  "previousUploadId": null, "nextUploadId": "up-12"
}
```

- **Fehler:** `404 not-found`

### `GET /internal/v1/review/uploads/{uploadId}/pdf` 📄

Original-PDF des Uploads für die Vorschau (Drehen/Zuschneiden zeigt das Frontend an, angewendet wird beim Annehmen). · N-12

- **Path:** `uploadId`
- **Response 200:** `application/pdf`, `Content-Disposition: inline; filename="scan_0042.pdf"`
- **Fehler:** `404 not-found`

### `POST /internal/v1/review/uploads/{uploadId}/approve`

Upload annehmen: Seiten auswählen, drehen, zuschneiden, Stück und Stimme zuordnen; erzeugt das Blatt mit pdf-lib. · N-12, N-10

- **Path:** `uploadId`
- **Body:**

```json
{
  "scoreId": "score-7",
  "voiceId": "v-tp2",
  "pages": [
    { "sourcePage": 1, "rotation": 0, "crop": null },
    { "sourcePage": 2, "rotation": 90, "crop": { "x": 0.03, "y": 0.02, "width": 0.94, "height": 0.95 } }
  ],
  "replaceExisting": false
}
```

  `crop` relativ zur (gedrehten) Seite, 0..1, Ursprung oben links. Nicht aufgeführte Seiten entfallen.
- **Response 200:** `{ "sheetId": "sheet-56", "nextUploadId": "up-12" }`
- **Ersetzen (F-11):** Existiert schon ein Blatt für Stück und Stimme, ersetzt `replaceExisting: true` es. Dafür braucht die Person zusätzlich `score.delete`.
- **Fehler:** `404 not-found` (Upload, Stück, Stimme), `409 upload-not-pending`, `409 sheet-exists` (Blatt existiert, `replaceExisting` false), `403 forbidden` (`replaceExisting` ohne `score.delete`), `400 validation-failed` (`sourcePage` > Seitenzahl)

### `POST /internal/v1/review/uploads/{uploadId}/reject`

Upload mit Begründung ablehnen; die hochladende Person sieht den Grund. · N-12, N-14

- **Path:** `uploadId`
- **Body:** `{ "reason": "Seite 2 fehlt" }`
- **Response 200:** `{ "nextUploadId": "up-12" }`
- **Fehler:** `404 not-found`, `409 upload-not-pending`

---

## 8. scores – Stücke & eigene Felder

Modul `ScoresModule`, Schemas `libs/shared/src/lib/scores/`. Stücke haben kein Ensemble → alle `score.*`-Rechte gelten **Ensemble (mind. eines)** (R-4).

### `GET /internal/v1/scores/score-table`

Stücke-Tabelle mit festen und eigenen Feldern, Suche, Filter, Sortierung und Vollständigkeit. · N-1, N-3, N-4

- **Recht:** `score.view` · Ensemble (mind. eines)
- **Query:** `cursor`, `limit`, `q` (Volltext über Titel, Komponist, Arrangeur, Verlag, Text-Felder), `sort` (`title` Standard | `composer` | `arranger` | `publisher` | `publisherNumber` | `durationSeconds` | `completeness` | `field:<fieldId>`), `dir` (`asc`|`desc`), `filter` (URL-kodiertes JSON-Array), `ensembleId` (Basis der Vollständigkeit, Standard: Standard-Ensemble), `tagId`
  - Beispiel `filter`: `[{"column":"composer","op":"contains","value":"Gälle"},{"column":"field:f-diff","op":"between","value":[2,4]}]`
- **Response 200:**

```json
{
  "items": [{
    "id": "score-7", "title": "Böhmischer Traum", "composer": "Norbert Gälle", "arranger": null,
    "publisher": "Rundel", "publisherNumber": "R-1234", "durationSeconds": 210,
    "customFields": { "f-diff": 3, "f-archive": "A-117", "f-audio": "https://example.org/hoerprobe" },
    "tags": [{ "id": "tag-2", "name": "Polka" }],
    "completeness": { "present": 18, "substituted": 2, "total": 24 }
  }],
  "nextCursor": "eyJ0IjoiQsO2aG0uLi4ifQ",
  "completenessEnsemble": { "id": "ens-1", "name": "Hauptorchester" },
  "totalCount": 412
}
```

- **Fehler:** `400 validation-failed` (z. B. Filter-Operator passt nicht zum Feldtyp), `404 not-found` (`ensembleId`)

### `GET /internal/v1/scores/score-table/export` 📄

Export der gefilterten Tabelle inkl. eigener Felder. · N-3

- **Recht:** `score.view` · Ensemble (mind. eines)
- **Query:** wie `score-table` ohne `cursor`/`limit`
- **Response 200:** `text/csv; charset=utf-8` (mit BOM für Excel, Trennzeichen `;`), `Content-Disposition: attachment; filename="stuecke-2026-11-15.csv"`. Spalten: feste Felder, eigene Felder in Reihenfolge, Tags, Vollständigkeit `18/24`.

### `GET /internal/v1/scores/field-definitions`

Eigene Felder in Reihenfolge – für Tabelle, Formular und Konfigurations-Tab (nicht paginiert). · N-2, N-3

- **Recht:** `score.view` · Ensemble (mind. eines), oder `config.view` · Verein
- **Response 200:**

```json
{ "items": [
  { "id": "f-diff", "name": "Schwierigkeitsgrad", "type": "select", "required": false, "position": 1, "options": [{ "id": "o-1", "label": "1" }, { "id": "o-2", "label": "2" }] },
  { "id": "f-archive", "name": "Archivnummer", "type": "text", "required": true, "position": 2, "options": [] }
] }
```

### `GET /internal/v1/scores/ensemble-options`

Ensembles mit Besetzung für die Auswahl der Vollständigkeits-Basis (nicht paginiert). · N-4

- **Recht:** `score.view` · Ensemble (mind. eines)
- **Response 200:** `{ "items": [{ "id": "ens-1", "name": "Hauptorchester", "depth": 0 }], "defaultEnsembleId": "ens-1" }` (Baum-Reihenfolge, siehe [Ensemble-Auswahl](#ensemble-auswahl))

### `GET /internal/v1/scores/tag-options`

Vereins-Tags für das Stück-Formular (nicht paginiert). · N-17

- **Recht:** `score.view` · Ensemble (mind. eines)
- **Response 200:** `{ "items": [{ "id": "tag-1", "name": "Weihnachten" }] }`

### `GET /internal/v1/scores/scores/{scoreId}/details`

Tab „Stammdaten“. · N-1, N-2

- **Recht:** `score.view` · Ensemble (mind. eines)
- **Path:** `scoreId`
- **Response 200:**

```json
{
  "id": "score-7", "title": "Böhmischer Traum", "composer": "Norbert Gälle", "arranger": null,
  "publisher": "Rundel", "publisherNumber": "R-1234", "durationSeconds": 210,
  "customFields": { "f-diff": "o-2", "f-archive": "A-117" },
  "tags": [{ "id": "tag-2", "name": "Polka" }],
  "createdAt": "2026-11-01T10:00:00Z", "updatedAt": "2026-11-10T12:30:00Z"
}
```

- **Fehler:** `404 not-found`

### `GET /internal/v1/scores/scores/{scoreId}/completeness`

Tab „Stimmen & Vollständigkeit“: Besetzung des Ensembles gegen vorhandene Blätter, Ersatz berücksichtigt. · N-4, N-9

- **Recht:** `score.view` · Ensemble (mind. eines)
- **Path:** `scoreId` · **Query:** `ensembleId` (optional, Standard-Ensemble)
- **Response 200:**

```json
{
  "ensemble": { "id": "ens-1", "name": "Hauptorchester" },
  "summary": { "present": 18, "substituted": 2, "total": 24 },
  "voices": [
    { "voice": { "id": "v-hnf1", "name": "Horn 1 in F", "instrumentId": "i-hn" }, "status": "substituted", "sheetId": null, "substitute": { "id": "v-hnes1", "name": "Horn 1 in Es", "instrumentId": "i-hn" } },
    { "voice": { "id": "v-tp2", "name": "Trompete 2 in B", "instrumentId": "i-tp" }, "status": "missing", "sheetId": null, "substitute": null }
  ]
}
```

- **Fehler:** `404 not-found`

### `GET /internal/v1/scores/scores/{scoreId}/sheets`

Alle freigegebenen Blätter eines Stücks, gruppiert nach Instrument (nicht paginiert). · N-6, N-12

- **Recht:** `score.view` · Ensemble (mind. eines)
- **Path:** `scoreId`
- **Response 200:**

```json
{ "items": [{ "sheetId": "sheet-31", "voice": { "id": "v-tp1", "name": "Trompete 1 in B", "instrumentId": "i-tp" }, "pageCount": 2, "approvedAt": "2026-11-02T09:00:00Z", "uploadedBy": { "id": "u-1", "name": "Alex Beispiel" } }], "pendingUploadCount": 1 }
```

### `GET /internal/v1/scores/scores/{scoreId}/folders`

Tab „Mappen & Nummern“ – nur Mappen in Ensembles mit `folder.view` (nicht paginiert). · N-5

- **Recht:** `score.view` · Ensemble (mind. eines)
- **Path:** `scoreId`
- **Response 200:** `{ "items": [{ "folder": { "id": "fld-1", "name": "Marschbuch" }, "ensemble": { "id": "ens-1", "name": "Hauptorchester" }, "number": "12" }] }`

### `GET /internal/v1/scores/sheets/{sheetId}/pdf` 📄

Blatt-Vorschau in der Notenverwaltung. · N-4, N-12

- **Recht:** `score.view` · Ensemble (mind. eines)
- **Path:** `sheetId` · **Query:** `disposition` (`inline` Standard | `attachment`)
- **Response 200:** `application/pdf`, Dateiname `Titel – Stimme.pdf`
- **Fehler:** `404 not-found`

### `POST /internal/v1/scores/scores/create`

Stück anlegen mit festen und eigenen Feldern und Vereins-Tags. · N-1, N-2

- **Recht:** `score.create` · Ensemble (mind. eines)
- **Body:**

```json
{
  "title": "Böhmischer Traum", "composer": "Norbert Gälle", "arranger": null,
  "publisher": "Rundel", "publisherNumber": "R-1234", "durationSeconds": 210,
  "customFields": { "f-diff": "o-2", "f-archive": "A-117" },
  "tagIds": ["tag-2"]
}
```

- **Response 201:** `{ "id": "score-7" }`
- **Fehler:** `400 validation-failed` (Pflichtfeld fehlt → `/body/customFields/f-archive` `required`; Wert passt nicht zum Typ → `invalid_type`), `404 not-found` (Tag)

### `POST /internal/v1/scores/scores/{scoreId}/update-details`

Stammdaten, eigene Felder und Vereins-Tags ersetzen. · N-1, N-2, N-17

- **Recht:** `score.edit` · Ensemble (mind. eines)
- **Path:** `scoreId` · **Body:** wie `create`, alle Felder Pflicht
- **Response:** `204` · **Fehler:** wie `create`, zusätzlich `404 not-found`

### `POST /internal/v1/scores/scores/{scoreId}/delete`

Stück löschen inkl. Blätter, Mappen-/Setlist-Einträgen, Tags; offene Uploads verlieren die Zuordnung. · N-1

- **Recht:** `score.delete` · Ensemble (mind. eines)
- **Path:** `scoreId` · **Body:** keiner
- **Response:** `204` · **Fehler:** `404 not-found`

### `POST /internal/v1/scores/sheets/{sheetId}/delete`

Ein Blatt entfernen (z. B. falsch zugeordnet). · N-4, N-12

- **Recht:** `score.edit` · Ensemble (mind. eines)
- **Path:** `sheetId` · **Body:** keiner
- **Response:** `204` · **Fehler:** `404 not-found`

### `POST /internal/v1/scores/field-definitions/create`

Eigenes Feld anlegen – aus der Konfiguration oder direkt im Stück-Formular („Feld hinzufügen“). · N-2

- **Recht:** `score.edit` · Ensemble (mind. eines), oder `config.edit` · Verein
- **Body:**

```json
{ "name": "Schwierigkeitsgrad", "type": "select", "required": false, "options": [{ "label": "1" }, { "label": "2" }, { "label": "3" }] }
```

- **Response 201:** `{ "id": "f-diff" }`
- **Fehler:** `409 name-taken`, `400 validation-failed` (`options` bei anderem Typ als `select`/`multiselect`)

### `POST /internal/v1/scores/field-definitions/{fieldId}/update-definition`

Name, Pflicht und Optionen ändern; Typ ist fest. Entfernte Optionen werden aus Werten gelöscht. · N-2

- **Recht:** wie `create`
- **Path:** `fieldId` · **Body:** `{ "name": "Schwierigkeit", "required": true, "options": [{ "id": "o-1", "label": "leicht" }, { "label": "schwer" }] }`
- **Response:** `204` · **Fehler:** `404 not-found`, `409 name-taken`

### `POST /internal/v1/scores/field-definitions/{fieldId}/delete`

Eigenes Feld samt Werten löschen. · N-2

- **Recht:** `score.delete` · Ensemble (mind. eines), oder `config.edit` · Verein
- **Path:** `fieldId` · **Response:** `204` · **Fehler:** `404 not-found`

### `POST /internal/v1/scores/field-definitions/reorder`

Reihenfolge der eigenen Felder setzen. · N-2

- **Recht:** wie `create`
- **Body:** `{ "fieldIds": ["f-archive", "f-diff", "f-audio"] }` (jede ID genau einmal)
- **Response:** `204` · **Fehler:** `409 conflict` (Liste unvollständig/veraltet)

---

## 9. voices – Stimmen & Instrumente

Modul `VoicesModule`, Schemas `libs/shared/src/lib/voices/`. Rechte `voice.*` · Ensemble (mind. eines) (R-4).

### `GET /internal/v1/voices/voice-list`

Eine Liste aller Stimmen, gruppiert nach Instrument, mit Ersatzstimmen, in manuell festgelegter Reihenfolge (nicht paginiert). · N-6, N-9, F-16

- **Recht:** `voice.view`
- **Response 200:**

```json
{ "groups": [{
  "instrument": { "id": "i-hn", "name": "Horn", "voiceCount": 4 },
  "voices": [{ "id": "v-hnf1", "name": "Horn 1 in F", "substitutes": [{ "id": "v-hnes1", "name": "Horn 1 in Es", "instrumentId": "i-hn" }], "sheetCount": 210, "lineupCount": 1 }]
}] }
```

### `GET /internal/v1/voices/instrument-suggestions`

Autovervollständigung für das Instrument-Feld (max. 20, Präfix-Treffer zuerst). · N-7

- **Recht:** `voice.create` oder `voice.edit`
- **Query:** `q`
- **Response 200:** `{ "items": [{ "id": "i-tp", "name": "Trompete" }] }`

### `POST /internal/v1/voices/voices/create`

Stimme anlegen; unbekanntes Instrument wird automatisch angelegt. · N-6, N-7

- **Recht:** `voice.create`
- **Body:** `{ "instrumentName": "Trompete", "name": "Trompete 3 in B" }`
- **Response 201:** `{ "id": "v-tp3", "instrumentId": "i-tp", "instrumentCreated": false }`
- **Fehler:** `409 name-taken`

### `POST /internal/v1/voices/voices/{voiceId}/update-details`

Name und Instrument ändern (gleiche Instrument-Regel). · N-6, N-7

- **Recht:** `voice.edit` · **Path:** `voiceId` · **Body:** wie `create`
- **Response:** `204` · **Fehler:** `404 not-found`, `409 name-taken`

### `POST /internal/v1/voices/voices/{voiceId}/set-substitutes`

Geordnete Ersatzstimmen setzen. · N-9

- **Recht:** `voice.edit` · **Path:** `voiceId`
- **Body:** `{ "substituteVoiceIds": ["v-hnes1"] }` (max. 10, ohne die Stimme selbst, ohne Doppelte)
- **Response:** `204` · **Fehler:** `404 not-found`, `400 validation-failed`

### `POST /internal/v1/voices/voices/{voiceId}/delete`

Stimme löschen, nur wenn ungenutzt. · N-6

- **Recht:** `voice.delete` · **Path:** `voiceId`
- **Response:** `204` · **Fehler:** `404 not-found`, `409 in-use` (Blätter, Besetzungen, Profile oder offene Uploads verweisen darauf)

### `POST /internal/v1/voices/instruments/{instrumentId}/rename`

Instrument umbenennen. · N-6

- **Recht:** `voice.edit` · **Path:** `instrumentId` · **Body:** `{ "name": "Tenorhorn" }`
- **Response:** `204` · **Fehler:** `404 not-found`, `409 name-taken`

### `POST /internal/v1/voices/instruments/reorder`

Reihenfolge der Instrumente festlegen. · N-6, F-16

- **Recht:** `voice.edit`
- **Body:** `{ "instrumentIds": ["i-fl", "i-ob", "i-cl", "i-tp", "i-hn"] }` (jede ID genau einmal)
- **Response:** `204` · **Fehler:** `409 conflict` (Liste unvollständig/veraltet)

### `POST /internal/v1/voices/instruments/{instrumentId}/reorder-voices`

Reihenfolge der Stimmen eines Instruments festlegen. · N-6, F-16

- **Recht:** `voice.edit` · **Path:** `instrumentId`
- **Body:** `{ "voiceIds": ["v-tp1", "v-tp2", "v-tp3"] }` (jede Stimme des Instruments genau einmal)
- **Response:** `204` · **Fehler:** `404 not-found`, `409 conflict`

Neue Instrumente und Stimmen werden hinten angehängt. Instrumente ohne Stimmen werden beim Löschen der letzten Stimme automatisch entfernt (kein eigener Endpunkt).

---

## 10. folders – Mappen

Modul `FoldersModule`, Schemas `libs/shared/src/lib/folders/`. Rechte `folder.*` · **Ensemble der Mappe** (R-4).

### `GET /internal/v1/folders/ensemble-options`

Ensembles, in denen die Person Mappen anlegen darf (nicht paginiert). · N-15, R-4

- **Recht:** `folder.create` in mind. einem Ensemble
- **Response 200:** `{ "items": [{ "id": "ens-1", "name": "Hauptorchester", "depth": 0 }] }` (Baum-Reihenfolge, siehe [Ensemble-Auswahl](#ensemble-auswahl))

### `GET /internal/v1/folders/folder-list`

Mappen aller Ensembles mit `folder.view`, mit Schalter „in Mein Bereich anzeigen“. · N-15

- **Recht:** `folder.view` · Ensemble (Liste gefiltert auf diese Ensembles)
- **Query:** `cursor`, `limit`, `ensembleId`, `q`
- **Response 200:** `{ "items": [{ "id": "fld-1", "name": "Marschbuch", "ensemble": { "id": "ens-1", "name": "Hauptorchester" }, "showInMyArea": true, "scoreCount": 48 }], "nextCursor": null }`

### `GET /internal/v1/folders/folders/{folderId}/details`

Kopf „Mappe bearbeiten“. · N-15

- **Recht:** `folder.view` · Ensemble der Mappe · **Path:** `folderId`
- **Response 200:** `{ "id": "fld-1", "name": "Marschbuch", "ensemble": { "id": "ens-1", "name": "Hauptorchester" }, "showInMyArea": true, "scoreCount": 48, "updatedAt": "2026-11-10T12:00:00Z" }`
- **Fehler:** `404 not-found`

### `GET /internal/v1/folders/folders/{folderId}/entries`

Stücke der Mappe mit Nummer, natürlich sortiert (`2` < `10` < `10a`). · N-5

- **Recht:** `folder.view` · Ensemble der Mappe · **Path:** `folderId` · **Query:** `cursor`, `limit`, `q`
- **Response 200:** `{ "items": [{ "scoreId": "score-7", "number": "12", "title": "Böhmischer Traum", "composer": "Norbert Gälle" }], "nextCursor": null }`

### `GET /internal/v1/folders/folders/{folderId}/score-candidates`

Stücksuche zum Hinzufügen, mit Vorschlag für die nächste Nummer. · N-5

- **Recht:** `folder.edit` · Ensemble der Mappe · **Path:** `folderId` · **Query:** `q` (Pflicht), `cursor`, `limit`
- **Response 200:** `{ "items": [{ "id": "score-9", "title": "Alte Kameraden", "composer": "Carl Teike", "alreadyContained": false }], "nextCursor": null, "suggestedNumber": "49" }`

### `POST /internal/v1/folders/folders/create`

- **Zweck:** Mappe in einem Ensemble anlegen. · N-15
- **Recht:** `folder.create` · Ensemble aus `body.ensembleId`
- **Body:** `{ "ensembleId": "ens-1", "name": "Konzertmappe 2027", "showInMyArea": false }`
- **Response 201:** `{ "id": "fld-2" }` · **Fehler:** `404 not-found` (Ensemble), `409 name-taken` (gleicher Name im Ensemble)

### `POST /internal/v1/folders/folders/{folderId}/rename`

- **Zweck:** Mappe umbenennen. · N-15
- **Recht:** `folder.edit` · Ensemble der Mappe · **Body:** `{ "name": "Konzertmappe Frühjahr" }`
- **Response:** `204` · **Fehler:** `404 not-found`, `409 name-taken`

### `POST /internal/v1/folders/folders/{folderId}/set-visibility`

- **Zweck:** Schalter „in Mein Bereich anzeigen“. · N-15, R-2
- **Recht:** `folder.edit` · Ensemble der Mappe · **Body:** `{ "showInMyArea": true }`
- **Response:** `204` · **Fehler:** `404 not-found`

### `POST /internal/v1/folders/folders/{folderId}/add-score`

- **Zweck:** Stück mit Nummer in die Mappe aufnehmen. · N-5
- **Recht:** `folder.edit` · Ensemble der Mappe · **Body:** `{ "scoreId": "score-9", "number": "49" }`
- **Response:** `204` · **Fehler:** `404 not-found`, `409 conflict` (Stück schon enthalten), `409 name-taken` (Nummer vergeben)

### `POST /internal/v1/folders/folders/{folderId}/set-score-number`

- **Zweck:** Nummer eines Stücks in der Mappe ändern. · N-5
- **Recht:** `folder.edit` · Ensemble der Mappe · **Body:** `{ "scoreId": "score-9", "number": "12a" }`
- **Response:** `204` · **Fehler:** `404 not-found`, `409 name-taken`

### `POST /internal/v1/folders/folders/{folderId}/remove-score`

- **Zweck:** Stück aus der Mappe nehmen. · N-5
- **Recht:** `folder.edit` · Ensemble der Mappe · **Body:** `{ "scoreId": "score-9" }`
- **Response:** `204` · **Fehler:** `404 not-found`

### `POST /internal/v1/folders/folders/{folderId}/delete`

- **Zweck:** Mappe löschen (Stücke bleiben). · N-15
- **Recht:** `folder.delete` · Ensemble der Mappe · **Body:** keiner
- **Response:** `204` · **Fehler:** `404 not-found`

---

## 11. events – Events

Modul `EventsModule`, Schemas `libs/shared/src/lib/events/`. Rechte `event.*` · **Ensemble des Events** (R-4; Vorstand und Notenwart:in).

### `GET /internal/v1/events/ensemble-options`

- **Zweck:** Ensembles, in denen die Person Events anlegen darf (nicht paginiert). · N-15
- **Recht:** `event.create` in mind. einem Ensemble
- **Response 200:** `{ "items": [{ "id": "ens-1", "name": "Hauptorchester", "depth": 0 }] }`

### `GET /internal/v1/events/event-list`

Events je Ensemble, Tab Kommende/Vergangene. · N-15, N-16

- **Recht:** `event.view` · Ensemble (gefiltert)
- **Query:** `cursor`, `limit`, `period` (`upcoming` Standard | `past`), `ensembleId`, `q`
- **Response 200:** `{ "items": [{ "id": "evt-3", "name": "Frühjahrskonzert", "date": "2027-03-20", "ensemble": { "id": "ens-1", "name": "Hauptorchester" }, "showInMyArea": true, "scoreCount": 14 }], "nextCursor": null }`

### `GET /internal/v1/events/events/{eventId}/details`

- **Zweck:** Kopf „Event bearbeiten“. · N-15, N-16
- **Recht:** `event.view` · Ensemble des Events · **Path:** `eventId`
- **Response 200:** `{ "id": "evt-3", "name": "Frühjahrskonzert", "date": "2027-03-20", "ensemble": { "id": "ens-1", "name": "Hauptorchester" }, "showInMyArea": true, "updatedAt": "2026-11-10T12:00:00Z" }`
- **Fehler:** `404 not-found`

### `GET /internal/v1/events/events/{eventId}/setlist`

- **Zweck:** Setlist in Spielreihenfolge. · N-16
- **Recht:** `event.view` · Ensemble des Events · **Query:** `cursor`, `limit`
- **Response 200:** `{ "items": [{ "position": 1, "scoreId": "score-9", "title": "Alte Kameraden", "composer": "Carl Teike" }], "nextCursor": null }`

### `GET /internal/v1/events/events/{eventId}/score-candidates`

- **Zweck:** Stücksuche zum Hinzufügen zur Setlist. · N-16
- **Recht:** `event.edit` · Ensemble des Events · **Query:** `q` (Pflicht), `cursor`, `limit`
- **Response 200:** `{ "items": [{ "id": "score-7", "title": "Böhmischer Traum", "composer": "Norbert Gälle", "alreadyContained": true }], "nextCursor": null }`

### `POST /internal/v1/events/events/create`

- **Zweck:** Event anlegen. · N-15, N-16
- **Recht:** `event.create` · Ensemble aus `body.ensembleId`
- **Body:** `{ "ensembleId": "ens-1", "name": "Frühjahrskonzert", "date": "2027-03-20", "showInMyArea": false }`
- **Response 201:** `{ "id": "evt-3" }` · **Fehler:** `404 not-found`

### `POST /internal/v1/events/events/{eventId}/update-details`

- **Zweck:** Name und Datum ändern. · N-16
- **Recht:** `event.edit` · Ensemble des Events · **Body:** `{ "name": "Frühjahrskonzert 2027", "date": "2027-03-21" }`
- **Response:** `204` · **Fehler:** `404 not-found`

### `POST /internal/v1/events/events/{eventId}/set-visibility`

- **Zweck:** Schalter „in Mein Bereich anzeigen“. · N-15
- **Recht:** `event.edit` · Ensemble des Events · **Body:** `{ "showInMyArea": true }`
- **Response:** `204` · **Fehler:** `404 not-found`

### `POST /internal/v1/events/events/{eventId}/set-setlist`

Gesamte Setlist in neuer Reihenfolge setzen (Ergebnis von Drag & Drop oder Tastatur-Alternative). · N-16

- **Recht:** `event.edit` · Ensemble des Events
- **Body:** `{ "scoreIds": ["score-9", "score-7", "score-12"] }` (max. 200, jedes Stück einmal)
- **Response:** `204` · **Fehler:** `404 not-found` (Stück), `400 validation-failed` (Doppelte)

### `POST /internal/v1/events/events/{eventId}/delete`

- **Zweck:** Event löschen. · N-15
- **Recht:** `event.delete` · Ensemble des Events
- **Response:** `204` · **Fehler:** `404 not-found`

---

## 12. tags – Vereins-Tags

Modul `TagsModule`, Schemas `libs/shared/src/lib/tags/`. Rechte `tag.*` · Ensemble (mind. eines) (R-4). Die Zuordnung zu Stücken läuft über `scores/…/update-details` (`tagIds`).

### `GET /internal/v1/tags/club-tag-list`

- **Zweck:** Vereins-Tags nach Name mit Anzahl Stücke. · N-17
- **Recht:** `tag.view` · **Query:** `cursor`, `limit`, `q`
- **Response 200:** `{ "items": [{ "id": "tag-1", "name": "Weihnachten", "scoreCount": 12 }], "nextCursor": null }`

### `POST /internal/v1/tags/club-tags/create`

- **Zweck:** Vereins-Tag anlegen. · N-17
- **Recht:** `tag.create` · **Body:** `{ "name": "Kirche" }`
- **Response 201:** `{ "id": "tag-3" }` · **Fehler:** `409 name-taken`

### `POST /internal/v1/tags/club-tags/{tagId}/rename`

- **Zweck:** Vereins-Tag umbenennen. · N-17
- **Recht:** `tag.edit` · **Body:** `{ "name": "Kirchenmusik" }`
- **Response:** `204` · **Fehler:** `404 not-found`, `409 name-taken`

### `POST /internal/v1/tags/club-tags/{tagId}/delete`

- **Zweck:** Vereins-Tag samt Zuordnungen löschen. · N-17
- **Recht:** `tag.delete`
- **Response:** `204` · **Fehler:** `404 not-found`

---

## 13. print – Drucken

Modul `PrintModule`, Schemas `libs/shared/src/lib/print/`. **Recht: Mitglied, kein eigenes Recht** (D-7). Druckbar ist alles aus Mein Bereich (R-2) und zusätzlich jedes Stück mit `score.view`, jede Mappe mit `folder.view` und jedes Event mit `event.view` in dessen Ensemble, auch wenn es nicht für Mein Bereich freigegeben ist (F-9). Der lokale Druckservice ist nicht Teil der API (D-4): Der Browser holt das PDF und druckt es selbst (D-2) oder schickt es an `localhost` (D-3).

Gemeinsame Query (`printQuerySchema`):

| Parameter | Bedeutung |
| --- | --- |
| `scope` | `score` \| `folder` \| `event` \| `selection` (Pflicht) |
| `scoreId` / `folderId` / `eventId` | Pflicht passend zu `scope`; bei `selection` optional als Kontext für Nummern/Reihenfolge |
| `scoreIds` | wiederholbar, Pflicht bei `selection` (max. 200) |
| `voiceId` | wiederholbar, Stimmen-Kontext (M-2) |
| `substitutes` | `fallback` (Standard) \| `all` \| `none` (M-3) |

### `GET /internal/v1/print/print-plan`

Inhalt des Druckdialogs: Seitenzahl, Weg (Browser oder Druckservice), angewandte Druckregeln, Dokumente, Fehlendes. · D-1, D-2, D-3, D-6, M-7

Einseitig oder beidseitig fragt VM-Web nicht je Auftrag ab: Es gelten die Druckregeln des Ensembles der Mappe bzw. des Events, sonst die des Hauptensembles (siehe [Druckregeln](#druckregeln-s-2-d-6)). Sobald ein Stück beidseitig gedruckt wird, ist der ganze Auftrag `duplex`; einseitige Stücke bekommen dann eine leere Rückseite, beidseitige mit ungerader Seitenzahl eine Leerseite am Ende, damit jedes Stück auf einem neuen Blatt beginnt.

- **Recht:** Mitglied
- **Query:** siehe oben
- **Response 200:**

```json
{
  "totalPages": 62,
  "pageLimit": 10,
  "route": "print-service",
  "duplex": true,
  "rules": { "source": { "id": "ens-1", "name": "Hauptorchester" }, "items": [{ "fromPages": 1, "mode": "simplex" }, { "fromPages": 2, "mode": "duplex" }] },
  "documents": [
    { "scoreId": "score-9", "number": "1", "title": "Alte Kameraden", "voice": { "id": "v-tp1", "name": "Trompete 1 in B", "instrumentId": "i-tp" }, "kind": "own", "pages": 1, "mode": "simplex", "sheets": 1, "blankPagesAfter": 1 }
  ],
  "missing": [{ "id": "score-12", "name": "Florentiner Marsch" }]
}
```

- **Fehler:** `404 not-found` (Mappe/Event/Stück unsichtbar)

### `GET /internal/v1/print/document` 📄

Druckfertiges PDF: A4 hoch, Seiten in die Ränder eingepasst, Reihenfolge wie im Plan, Leerseiten für Duplex. · D-1, D-2, D-3

- **Recht:** Mitglied
- **Query:** siehe oben (identisch zum Plan, damit Plan und PDF übereinstimmen)
- **Response 200:** `application/pdf`, `Content-Disposition: inline; filename="Druck – Marschbuch – Trompete 1 in B.pdf"`
- **Fehler:** `404 not-found`

---

## 14. system – Systemverwaltung

Modul `SystemModule`, Schemas `libs/shared/src/lib/system/`. Systemrechte gelten **vereinsweit** (R-4).

### Benutzer (S-1, A-5, R-1, R-6)

#### `GET /internal/v1/system/user-table`

Benutzerliste mit Ensembles & Rollen, Stimmen, Status, letzter Anmeldung. · S-1

- **Recht:** `user.view` · Verein
- **Query:** `cursor`, `limit`, `q` (Name/E-Mail), `status` (`active`|`blocked`), `ensembleId`
- **Response 200:**

```json
{ "items": [{
  "id": "u-5", "name": "Sam Muster", "email": "sam@example.org", "pictureUrl": null,
  "memberships": [{ "ensemble": { "id": "ens-1", "name": "Hauptorchester" }, "role": { "id": "role-mus", "name": "Musiker:in" } }],
  "voices": [{ "id": "v-cl1", "name": "Klarinette 1 in B", "instrumentId": "i-cl" }],
  "status": "active", "isAdmin": false, "lastLoginAt": "2026-11-14T17:00:00Z"
}], "nextCursor": null }
```

#### `GET /internal/v1/system/user-assignment-options`

- **Zweck:** Auswahlwerte der Benutzerseite: Ensembles (Baum-Reihenfolge) und Rollen (nicht paginiert). · S-1, R-1
- **Recht:** `user.edit` · Verein
- **Response 200:** `{ "ensembles": [{ "id": "ens-root", "name": "Verein", "depth": 0 }, { "id": "ens-1", "name": "Hauptorchester", "depth": 1 }], "roles": [{ "id": "role-mus", "name": "Musiker:in" }, { "id": "role-admin", "name": "Administrator:in" }] }`

#### `GET /internal/v1/system/users/{userId}/details`

- **Zweck:** Benutzerseite. · S-1, A-5
- **Recht:** `user.view` · Verein · **Path:** `userId`
- **Response 200:** wie Tabellenzeile plus `"createdAt": "2026-11-01T10:00:00Z", "canBeDemoted": true`
- **Fehler:** `404 not-found`

#### `POST /internal/v1/system/users/{userId}/set-membership`

- **Zweck:** Rolle in einem Ensemble zuweisen bzw. Mitgliedschaft anlegen. · S-1, R-1
- **Recht:** `user.edit` · Verein · **Body:** `{ "ensembleId": "ens-2", "roleId": "role-lib" }`
- **Response:** `204` · **Fehler:** `404 not-found`

#### `POST /internal/v1/system/users/{userId}/remove-membership`

- **Zweck:** Mitgliedschaft in einem Ensemble beenden. · R-1
- **Recht:** `user.edit` · Verein · **Body:** `{ "ensembleId": "ens-2" }`
- **Response:** `204` · **Fehler:** `404 not-found`

#### `POST /internal/v1/system/users/{userId}/set-voices`

- **Zweck:** Profilstimmen vorbelegen. · S-1, M-1
- **Recht:** `user.edit` · Verein · **Body:** `{ "voiceIds": ["v-cl1"] }`
- **Response:** `204` · **Fehler:** `404 not-found`

#### `POST /internal/v1/system/users/{userId}/block`

- **Zweck:** Konto sperren, laufende Sitzungen enden. · A-5
- **Recht:** `user.edit` · Verein · **Body:** keiner
- **Response:** `204` · **Fehler:** `404 not-found`, `409 last-admin` (letzter aktiver Admin oder man selbst)

#### `POST /internal/v1/system/users/{userId}/unblock`

- **Zweck:** Sperre aufheben. · A-5
- **Recht:** `user.edit` · Verein
- **Response:** `204` · **Fehler:** `404 not-found`

#### `POST /internal/v1/system/users/{userId}/set-admin`

- **Zweck:** Admin-Kennzeichen setzen/entfernen. · R-6
- **Recht:** **Admin**
- **Body:** `{ "isAdmin": true }`
- **Response:** `204` · **Fehler:** `404 not-found`, `409 last-admin`

#### `POST /internal/v1/system/users/{userId}/delete`

- **Zweck:** Konto löschen inkl. persönlicher Daten (Profilstimmen, persönliche Tags). Uploads und Blätter bleiben ohne Namen: Verweise wie `uploadedBy` werden `null`, das Frontend zeigt dafür „Gelöschte:r Benutzer:in“ (i18n). · NFA Datenschutz, F-15
- **Recht:** `user.delete` · Verein
- **Response:** `204` · **Fehler:** `404 not-found`, `409 last-admin`

### Ensembles (S-2, N-4, N-8)

#### `GET /internal/v1/system/ensemble-list`

- **Zweck:** Ensemble-Baum in Vorordnung (Eltern vor Kindern, Geschwister nach Name) mit Mitglieder- und Besetzungszahl. Der Cursor ist hier die Position im Baum (die Liste ist klein und wird je Anfrage ganz berechnet). · S-2, F-3
- **Recht:** `ensemble.view` · Verein · **Query:** `cursor`, `limit`, `includeArchived` (`false`)
- **Response 200:** `{ "items": [
  { "id": "ens-root", "name": "Musikzug Beispielstadt", "parentId": null, "depth": 0, "isRoot": true, "archived": false, "isDefault": false, "memberCount": 2, "lineupSize": 0 },
  { "id": "ens-1", "name": "Hauptorchester", "parentId": "ens-root", "depth": 1, "isRoot": false, "archived": false, "isDefault": true, "memberCount": 54, "lineupSize": 24 }
], "nextCursor": null }`

#### `GET /internal/v1/system/ensembles/{ensembleId}/details`

- **Zweck:** Stammdaten des Ensembles. · S-2
- **Recht:** `ensemble.view` · Verein, oder `member.view` · dieses Ensemble
- **Response 200:** wie Listeneintrag plus `"createdAt": "…", "archivedAt": null`
- **Fehler:** `404 not-found`

#### `GET /internal/v1/system/ensembles/{ensembleId}/lineup`

- **Zweck:** Besetzung (Stimmenliste) in Reihenfolge, nicht paginiert. · S-2, N-4
- **Recht:** `ensemble.view` · Verein
- **Response 200:** `{ "voices": [{ "id": "v-fl1", "name": "Flöte 1", "instrumentId": "i-fl" }] }`

#### `GET /internal/v1/system/ensembles/{ensembleId}/members`

- **Zweck:** Mitglieder mit Rolle und Stimmen. · S-2, R-3, R-4
- **Recht:** `ensemble.view` · Verein, oder `member.view` · dieses Ensemble
- **Query:** `cursor`, `limit`, `q`
- **Response 200:** `{ "items": [{ "userId": "u-5", "name": "Sam Muster", "pictureUrl": null, "role": { "id": "role-mus", "name": "Musiker:in" }, "voices": [{ "id": "v-cl1", "name": "Klarinette 1 in B", "instrumentId": "i-cl" }] }], "nextCursor": null }`

#### `POST /internal/v1/system/ensembles/create`

- **Zweck:** Unter-Ensemble anlegen, optional mit Besetzung aus der Vorlage. · S-2, N-8, F-3
- **Recht:** `ensemble.create` · Verein · **Body:** `{ "name": "Jugendorchester", "parentId": "ens-root", "applyLineupTemplate": true }`
- **Response 201:** `{ "id": "ens-2" }` · **Fehler:** `404 not-found` (Eltern), `409 name-taken` (gleicher Name unter demselben Eltern-Ensemble)

#### `POST /internal/v1/system/ensembles/{ensembleId}/rename`

- **Zweck:** Ensemble umbenennen. · S-2
- **Recht:** `ensemble.edit` · Verein · **Body:** `{ "name": "Jugendblasorchester" }`
- **Response:** `204` · **Fehler:** `404 not-found`, `409 name-taken`

#### `POST /internal/v1/system/ensembles/{ensembleId}/set-parent`

- **Zweck:** Ensemble im Baum verschieben. · F-3
- **Recht:** `ensemble.edit` · Verein · **Body:** `{ "parentId": "ens-1" }`
- **Response:** `204` · **Fehler:** `404 not-found`, `409 root-ensemble` (Wurzel), `409 invalid-hierarchy` (Ziel ist das Ensemble selbst oder ein Nachfahre)

#### `POST /internal/v1/system/ensembles/{ensembleId}/archive`

- **Zweck:** Ensemble archivieren (Inhalte verschwinden aus Mein Bereich und Auswahllisten, bleiben erhalten). · S-2
- **Recht:** `ensemble.edit` · Verein
- **Response:** `204` · **Fehler:** `404 not-found`, `409 root-ensemble`, `409 in-use` (ist Standard-Ensemble oder hat nicht archivierte Unter-Ensembles)

#### `POST /internal/v1/system/ensembles/{ensembleId}/unarchive`

- **Zweck:** Archivierung aufheben. · S-2
- **Recht:** `ensemble.edit` · Verein
- **Response:** `204` · **Fehler:** `404 not-found`

#### `POST /internal/v1/system/ensembles/{ensembleId}/set-lineup`

- **Zweck:** Besetzung setzen (geordnet). · S-2, N-4
- **Recht:** `ensemble.edit` · Verein · **Body:** `{ "voiceIds": ["v-fl1", "v-fl2", "v-ob"] }`
- **Response:** `204` · **Fehler:** `404 not-found`, `400 validation-failed` (Doppelte)

#### `POST /internal/v1/system/ensembles/{ensembleId}/apply-lineup-template`

- **Zweck:** Besetzungs-Vorlage erneut übernehmen: fehlende Instrumente/Stimmen anlegen, Besetzung ersetzen. · N-8
- **Recht:** `ensemble.edit` · Verein · **Body:** keiner
- **Response 200:** `{ "createdInstruments": 0, "createdVoices": 2, "lineupSize": 24 }` · **Fehler:** `404 not-found`

#### Druckregeln (S-2, D-6)

Je Ensemble eine geordnete Liste „ab `fromPages` Seiten → `simplex` (einseitig) | `duplex` (beidseitig, lange Kante)“; eine Regel gilt bis zur nächsten. Die erste Regel beginnt bei 1 Seite. Ensembles ohne eigene Regeln erben die des nächsten übergeordneten Ensembles mit Regeln (F-3), sonst gilt der mitgelieferte Standard `[{ "fromPages": 1, "mode": "simplex" }, { "fromPages": 2, "mode": "duplex" }]`. Papier ist immer A4 (D-1). Schemas: `printRulesSchema`, `DEFAULT_PRINT_RULES`.

#### `GET /internal/v1/system/ensembles/{ensembleId}/print-rules`

- **Zweck:** Geltende Regeln, eigene oder geerbte. · S-2, D-6
- **Recht:** `ensemble.view` · Verein
- **Response 200:** `{ "rules": [{ "fromPages": 1, "mode": "simplex" }, { "fromPages": 2, "mode": "duplex" }], "own": false, "inheritedFrom": { "id": "ens-root", "name": "Verein" } }` (`inheritedFrom: null` = Standard) · **Fehler:** `404 not-found`

#### `POST /internal/v1/system/ensembles/{ensembleId}/set-print-rules`

- **Zweck:** Eigene Regeln setzen (ersetzt alle). · S-2, D-6
- **Recht:** `ensemble.edit` · Verein · **Body:** `{ "rules": [{ "fromPages": 1, "mode": "simplex" }, { "fromPages": 4, "mode": "duplex" }] }` (1–20 Regeln, Beginn bei 1, aufsteigend)
- **Response:** `204` · **Fehler:** `400 validation-failed`, `404 not-found`

#### `POST /internal/v1/system/ensembles/{ensembleId}/reset-print-rules`

- **Zweck:** Eigene Regeln entfernen; das Ensemble erbt wieder. · S-2, D-6
- **Recht:** `ensemble.edit` · Verein · **Body:** keiner
- **Response:** `204` · **Fehler:** `404 not-found`

### Rollen (S-3, R-3, R-5, R-7)

#### `GET /internal/v1/system/role-list`

- **Zweck:** Rollenliste mit Standardrollen. · S-3, R-5
- **Recht:** `role.view` · Verein · **Query:** `cursor`, `limit`
- **Response 200:** `{ "items": [{ "id": "role-lib", "defaultKey": "librarian", "name": "Notenwart:in", "hasClubPermissions": false, "modifiedFromDefault": false, "assignmentCount": 3 }], "nextCursor": null }`

#### `GET /internal/v1/system/permission-catalog`

- **Zweck:** Aufbau der Rechte-Matrix (Bereiche × Aktionen + Einzelrechte), nur Codes. · R-3, R-7
- **Recht:** `role.view` · Verein
- **Response 200:**

```json
{
  "actions": ["view", "create", "edit", "delete"],
  "areas": [{ "area": "score", "scope": "any-ensemble", "permissions": ["score.view", "score.create", "score.edit", "score.delete"] }],
  "singles": [{ "permission": "sheet.approve", "scope": "any-ensemble" }, { "permission": "member.view", "scope": "ensemble" }]
}
```

#### `GET /internal/v1/system/roles/{roleId}/details`

- **Zweck:** Rolle mit gesetzten Rechten für die Matrix. · S-3, R-7
- **Recht:** `role.view` · Verein
- **Response 200:** Listeneintrag plus `"permissions": ["score.view", "score.edit", "sheet.approve"]` · **Fehler:** `404 not-found`

#### `POST /internal/v1/system/roles/create`

- **Zweck:** Eigene Rolle anlegen. · R-3, S-3
- **Recht:** `role.create` · Verein
- **Body:** `{ "name": "Registerführung", "permissions": ["member.view"] }`
- **Response 201:** `{ "id": "role-5" }` · **Fehler:** `409 name-taken`

#### `POST /internal/v1/system/roles/{roleId}/rename`

- **Zweck:** Rolle umbenennen. · S-3
- **Recht:** `role.edit` · Verein · **Body:** `{ "name": "Notenarchiv" }`
- **Response:** `204` · **Fehler:** `404 not-found`, `409 name-taken`

#### `POST /internal/v1/system/roles/{roleId}/set-permissions`

- **Zweck:** Rechte der Rolle aus der Matrix setzen. · R-7, R-3
- **Recht:** `role.edit` · Verein · **Body:** `{ "permissions": ["score.view", "folder.view", "folder.edit"] }`
- **Response:** `204` · **Fehler:** `404 not-found`. Kein Aussperr-Schutz über Rollen: der Notfallzugang ist das Admin-Kennzeichen (R-6), das für die letzte aktive Person nicht entzogen werden kann.

#### `POST /internal/v1/system/roles/{roleId}/delete`

- **Zweck:** Rolle löschen, nur wenn nicht zugewiesen, nicht Standardrolle für neue Konten und nicht die Rolle `admin` (F-3). · S-3
- **Recht:** `role.delete` · Verein
- **Response:** `204` · **Fehler:** `404 not-found`, `409 in-use`

#### `POST /internal/v1/system/roles/{roleId}/reset-to-default`

- **Zweck:** Standardrolle auf Name und Rechte aus `roles.default.json` zurücksetzen. · R-5, S-3
- **Recht:** `role.edit` · Verein
- **Response:** `204` · **Fehler:** `404 not-found`, `409 not-default-role`

#### `POST /internal/v1/system/roles/reset-defaults`

- **Zweck:** Alle Standardrollen zurücksetzen und gelöschte neu anlegen; eigene Rollen bleiben. · R-5
- **Recht:** `role.edit` · Verein
- **Response 200:** `{ "reset": 4, "recreated": 0 }`

### Konfiguration (S-4, D-2, D-4)

#### `GET /internal/v1/system/config`

- **Zweck:** Alle Tabs der Konfigurationsseite außer „Eigene Felder“ (→ `scores/field-definitions`). OIDC-Daten kommen nur aus Umgebungsvariablen. · S-4
- **Recht:** `config.view` · Verein
- **Response 200:**

```json
{
  "club": { "clubName": "Musikzug Beispielstadt", "imprintUrl": "https://musikzug.example.org/impressum", "privacyUrl": null, "loginAutoRedirect": false, "logoUrl": "/internal/v1/auth/branding/logo", "loginBanner": null },
  "defaults": { "defaultEnsemble": { "id": "ens-1", "name": "Hauptorchester" }, "defaultRole": { "id": "role-mus", "name": "Musiker:in" } },
  "print": { "browserPrintPageLimit": 10, "publicBaseUrl": "https://noten.musikzug.example.org" },
  "warnings": ["default-role-has-club-permissions"]
}
```

`warnings` (B-1): `default-role-has-club-permissions`, solange die Standardrolle für neue Konten Vereinsrechte enthält (ab Werk `admin`). Das Frontend zeigt dafür einen Warn-Banner. Rollen mit Vereinsrechten sind in Rollenliste, Rollendetails und `default-options` über `hasClubPermissions` markiert.

#### `GET /internal/v1/system/config/default-options`

- **Zweck:** Auswahl für Standard-Ensemble und Standardrolle (nicht paginiert). · S-4, A-3
- **Recht:** `config.edit` · Verein
- **Response 200:** `{ "ensembles": [{ "id": "ens-1", "name": "Hauptorchester", "depth": 0 }], "roles": [{ "id": "role-mus", "name": "Musiker:in" }] }` (Ensembles in Baum-Reihenfolge)

#### `POST /internal/v1/system/config/update-club`

- **Zweck:** Tab „Verein & Anmeldung“. · S-4, A-2
- **Recht:** `config.edit` · Verein
- **Body:** `{ "clubName": "Musikzug Beispielstadt", "imprintUrl": "https://…/impressum", "privacyUrl": "https://…/datenschutz", "loginBanner": "Willkommen!", "loginAutoRedirect": true }` (`loginBanner`: Klartext, max. 2000 Zeichen, F-12)
- **Response:** `204`

#### `POST /internal/v1/system/config/update-defaults`

- **Zweck:** Tab „Standardwerte“ für neue Konten. · S-4, A-3
- **Recht:** `config.edit` · Verein · **Body:** `{ "defaultEnsembleId": "ens-1", "defaultRoleId": "role-mus" }`
- **Response:** `204` · **Fehler:** `404 not-found`, `400 validation-failed` (archiviertes Ensemble)

#### `POST /internal/v1/system/config/update-print`

- **Zweck:** Tab „Drucken“: Seitengrenze und VM-Web-Adresse für die Origin-Prüfung des Druckservice. · S-4, D-2, D-4
- **Recht:** `config.edit` · Verein · **Body:** `{ "browserPrintPageLimit": 10, "publicBaseUrl": "https://noten.musikzug.example.org" }`
- **Response:** `204`

#### `POST /internal/v1/system/config/upload-logo` 📤

- **Zweck:** Vereinslogo hochladen (ersetzt vorhandenes). · S-4, A-2
- **Recht:** `config.edit` · Verein
- **Content-Type:** `multipart/form-data`, Feld `file` (PNG, JPEG, SVG, WebP – am Inhalt erkannt, nicht an der Endung; max. 2 MB). SVG wird nicht umgeschrieben, sondern `auth/branding/logo` liefert jedes Logo mit `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox` und `X-Content-Type-Options: nosniff` aus, damit Skripte in einem SVG nie laufen.
- **Response:** `204` · **Fehler:** `413 payload-too-large`, `415 unsupported-media-type`

#### `POST /internal/v1/system/config/remove-logo`

- **Zweck:** Vereinslogo entfernen. · S-4
- **Recht:** `config.edit` · Verein · **Body:** keiner
- **Response:** `204`

### Betrieb (ohne Katalog-Präfix)

`GET /health` 🌐 – Liveness/Readiness für Docker (DB erreichbar), `200 { "status": "ok" }` bzw. `503`. Kein UI-Baustein, daher außerhalb von `/internal/v1`.

---

## 15. Übersicht

| Feature | GET | POST | gesamt | davon 📄 / 📤 |
| --- | --- | --- | --- | --- |
| `auth` | 5 | 1 | 6 | 1 / 0 |
| `me` | 19 | 7 | 26 | 4 / 0 |
| `uploads` | 2 | 1 | 3 | 0 / 1 |
| `review` | 3 | 2 | 5 | 1 / 0 |
| `scores` | 10 | 8 | 18 | 2 / 0 |
| `voices` | 2 | 7 | 9 | 0 / 0 |
| `folders` | 5 | 7 | 12 | 0 / 0 |
| `events` | 5 | 5 | 10 | 0 / 0 |
| `tags` | 1 | 3 | 4 | 0 / 0 |
| `print` | 2 | 0 | 2 | 1 / 0 |
| `system` | 12 | 25 | 37 | 0 / 1 |
| **Summe** | **66** | **66** | **132** | **9 / 2** |

Plus `GET /health`. `POST me/downloads/selection-zip` zählt als POST und als 📄.

Abdeckung der Muss-Anforderungen: R-1 bis R-7, A-1 bis A-5, M-1 bis M-9, N-1 bis N-12, N-14 bis N-17, D-1 bis D-3, D-7, S-1 bis S-5. Ohne API-Anteil: D-4, D-5 (lokaler Druckservice), N-13 (Tastenkürzel, nur Frontend, nutzt `previousUploadId`/`nextUploadId`). D-6 (Druckregeln) ist inzwischen enthalten. Bewusst nicht enthalten: A-6, A-7, M-10, S-6.

---

## 16. Offene Fragen & Annahmen

### Entschieden (2026-11-15)

| # | Frage | Entscheidung |
| --- | --- | --- |
| F-1 | Wie bekommt jemand Systemrechte? | Rollen haben keinen Geltungsbereich. Enthält eine Rolle ein Vereinsrecht, gilt es vereinsweit, egal in welchem Ensemble die Rolle vergeben ist. Keine separaten Vereinsrollen. |
| F-2 | Hochladen und persönliche Tags | Hochladen nur mit Recht `sheet.upload` (weicht von N-10 „alle Mitglieder“ ab). Persönliche Tags darf jede:r. |
| F-3 | Erster Start / Standard-Ensemble | Ensembles bilden eine Hierarchie, Rechte ergänzen sich nach unten. Die oberste Ebene (Wurzel) und die Rolle `admin` werden beim ersten Start automatisch angelegt. Standard-Ensemble und Standardrolle für neue Konten sind ab Werk Wurzel-Ensemble und `admin` und werden in der Konfiguration geändert. |
| F-4 | Geltung von `sheet.approve` | Ensemble (mind. eines). |
| F-5 | Basis der Vollständigkeit | Wählbares Ensemble, Ersatz zählt separat. |
| F-7 | Ersatz bei ZIP/Druck | `substitutes`, Standard `fallback`. |
| F-8 | Druck-PDF-Format | A4 hoch, 5 mm Rand, einpassen, Duplex-Leerseiten per `duplex`. |
| H-1 | Mein Bereich und Hierarchie | Mitglieder sehen freigegebene Mappen/Events ihrer Ensembles **und aller Unter-Ensembles**. |
| H-2 | Erste Person | Rolle `admin` im Wurzel-Ensemble **und** Admin-Kennzeichen. |
| H-3 | Standardwerte für neue Konten | Ab Werk Wurzel-Ensemble + Rolle `admin`; in der Konfiguration änderbar. |
| H-4 | Wurzel-Ensemble | Name anfangs „Verein“, umbenennbar. Zu Beginn ohne Besetzung; eine Besetzung kann wie bei jedem Ensemble gesetzt werden (`set-lineup`, `apply-lineup-template`). |
| F-6 | Vereins-Tags in Mein Bereich | Tags sind nur zusätzliche Filter; sichtbar sind nur Stücke aus freigegebenen Mappen/Events. |
| F-9 | Drucken aus der Notenverwaltung | Auch beliebige Stücke, Mappen und Events mit dem jeweiligen Sehen-Recht. |
| F-10 | Export-Format | CSV (UTF-8 mit BOM, `;`). |
| F-11 | Doppelte Blätter | Pro Stück und Stimme genau ein Dokument, egal wie viele Seiten. Ersetzen in der Prüfung braucht zusätzlich `score.delete`. |
| F-12 | Anmelde-Banner | Text. |
| F-13 | Eigene Felder verwalten | `score.edit` oder `config.edit`; Löschen `score.delete` oder `config.edit`. |
| F-14 | Sitzungsdauer | Gleitend 14 Tage, absolut 90 Tage, per Umgebungsvariable. |
| F-15 | Kontolöschung | Im MVP; Uploads/Blätter bleiben ohne Namen („Gelöschte:r Benutzer:in“). |
| F-16 | Reihenfolge Instrumente/Stimmen | Manuell umsortierbar (`instruments/reorder`, `instruments/{id}/reorder-voices`). |
| B-1 | Standardrolle `admin` ab Werk | Warn-Banner, solange die Standardrolle Vereinsrechte hat; Rollen mit Vereinsrechten sind markiert (`hasClubPermissions`). |
| B-2 | Vollständigkeit „0/0“ bei Wurzel ohne Besetzung | So lassen. |
| D-a/b/c | Datenbank | siehe [db-schema.md](db-schema.md#entscheidungen-zum-schema) |

### Offen

Keine offenen Fragen. Laut Anforderungen bleibt nur die Feinabstimmung der Standardrollen (R-5).

### Annahmen

1. **Begriffe/Code:** Stück = `score`, Notenblatt (PDF einer Stimme) = `sheet`, Mappe = `folder`, Stimme = `voice`, Besetzung = `lineup`, Ersatzstimme = `substitute`, Vereins-Tag = `club tag`, persönlicher Tag = `personal tag`, Ensemble-Hierarchie = Baum über `parentId`.
2. **Stimmen-Name:** Eine Stimme speichert den vollen Anzeigenamen („Trompete 1 in B“) und verweist auf ihr Instrument; der Name wird nicht zusammengesetzt (Schwachstelle 3).
3. **Mappen-Nummern** sind Text (`12`, `12a`, `A3`), eindeutig je Mappe, natürlich sortiert.
4. **Event-Datum** ist ein reines Datum ohne Uhrzeit; „vergangen“ ab dem Folgetag (Zeitzone des Servers, `TZ`, Standard `Europe/Berlin`).
5. **Setlist:** jedes Stück höchstens einmal pro Event; Reihenfolge wird immer komplett gesetzt (`set-setlist`).
6. **Sichtbarkeit ohne Recht → 404**, sichtbar aber ohne Schreibrecht → 403.
7. **Uploads:** max. 50 Dateien, je 50 MB (Umgebungsvariable), nur PDF; alle Dateien werden vor dem Speichern geprüft (ein 415 für alle Fehler). Der angezeigte Dateiname kommt aus `meta.items[].fileName` (UTF-8), nicht aus dem Multipart-Header. Originale bleiben gespeichert; das Aufräumen 30 Tage nach der Entscheidung ist **noch nicht umgesetzt** (geplant mit einem Wartungsjob, `uploads.file_key` wird dann `null`, die Vorschau antwortet 404).
8. **Blatt-Erzeugung:** Annehmen schreibt ein neues PDF (pdf-lib: Seiten auswählen, `setRotation`, Crop-/Media-Box); das Original wird nicht verändert.
9. **Mitglieder ohne Ensemble** (alle Mitgliedschaften entfernt) sind angemeldet, sehen aber leere Listen (kein 403), damit Profil und Stimmenwahl funktionieren.
10. **Archivierte Ensembles** tauchen nicht in Mein Bereich, Auswahllisten und Druck auf; Mappen/Events bleiben in der Verwaltung mit `ensembleId`-Filter sichtbar.
11. **Gesperrte Konten** behalten ihre Daten; Sperren beendet alle Sitzungen (Sitzungsindex pro Benutzer im `ICacheService`).
12. **Seitenzahlen** werden beim Erzeugen eines Blatts gespeichert, nicht bei jedem Aufruf gelesen.
13. **RP-initiated Logout** (A-6, Soll) ist vorbereitet (ID-Token bleibt in der Sitzung), aber nicht im MVP.
14. Workspace-Hinweis für Scheibe 1: `nx build shared` scheitert derzeit am Nx-Sync-Generator, weil im Root kein `tsconfig.json` liegt. Das wird im Grundgerüst behoben.
