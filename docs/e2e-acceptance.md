# KI-Testlauf – Akzeptanzkriterien

Ein vollautomatischer Testlauf baut VM-Web als Docker-Images, startet es produktionsnah mit Traefik und Keycloak und lässt KI-Agenten als Admin, Notenwart:in und drei Musiker:innen durch die Oberfläche gehen. Dieses Dokument legt **vor** dem Bau fest, was in jedem Schritt passieren muss und wie ein deterministisches Orakel das prüft.

## Grundregeln

1. **E-1** Der Lauf ist nur grün, wenn **jeder** Schritt ohne Befund durchläuft. Jeder Befund ist rot, auch reine UX-Befunde.
2. **E-2** Als Befund zählt:
   - ein Orakel-Check schlägt fehl (API, Datenbank oder Datei weicht vom Erwarteten ab),
   - ein Fehler in der Browser-Konsole, eine Fehlermeldung der Oberfläche oder eine Antwort 5xx,
   - der Agent findet eine Funktion nicht über die Navigation und muss eine URL eintippen, raten oder mehr als zweimal neu ansetzen,
   - eine Meldung oder Beschriftung, die den Agenten nachweislich in die Irre führt (mit Screenshot belegt),
   - ein Layoutfehler im jeweiligen Viewport (abgeschnittene Bedienelemente, horizontales Scrollen der Seite).
3. **E-3** Agenten lesen weder Quellcode noch `docs/` noch Datenbank. Sie bekommen nur ihre Persona, ihre Ziele und die Zugangsdaten. Das Orakel darf alles lesen.
4. **E-4** Jeder Befund wird als JSON gemeldet: Schritt-ID, Kategorie (`orakel`, `fehler`, `ux`, `layout`), Beschreibung, erwartetes und tatsächliches Verhalten, Screenshot, URL.
5. **E-5** Jeder Lauf startet leer (`docker compose down -v`). Erwartete Werte, die sich aus den Fixtures ergeben (z. B. Anzahl Stücke nach CSV-Import), stehen vorab in `deploy/e2e/fixtures/expected.json` und werden nicht während des Laufs berechnet.

## Umgebung

| Teil | Festlegung |
| --- | --- |
| Adressen | VM-Web `https://vm.test`, Keycloak `https://auth.vm.test`, Realm `verein` |
| TLS | Traefik mit mkcert-CA; API vertraut ihr über `NODE_EXTRA_CA_CERTS`, Browser-Container über den System-Truststore |
| VM-Web | Lokal gebaute Images `vm-next-api:e2e`, `vm-next-web:e2e`, `NODE_ENV=production` |
| Browser | Chromium unter Xvfb im Container im Compose-Netz. Je Persona ein Playwright-MCP-Server (Ports 8931–8935) mit eigenem Profil, Viewport und Download-Ordner; die Anmeldung bleibt über Phasen hinweg erhalten. Qwen/OpenCode und Claude Code nutzen dieselben Server |
| Drucken | CUPS mit CUPS-PDF als Standarddrucker im Browser-Container; Chromium mit `--kiosk-printing`; Druckservice als Sidecar mit `network_mode: service:browser` |
| Volumes für das Orakel | Downloads des Browsers, CUPS-PDF-Ausgabe, Datei-Volume der API |
| Keycloak-Benutzer | Ohne Pflichtaktionen (kein „Passwort ändern“, kein „E-Mail bestätigen“) |

## Personas und Testdaten

| Persona | Keycloak-Benutzer | Rolle in VM-Web | Stimme | Viewport |
| --- | --- | --- | --- | --- |
| Admin | `admin` | erste Person → Admin | – | Desktop 1440 px |
| Notenwart:in | `notenwart` | Notenwart:in im Hauptorchester | – | Desktop 1440 px |
| Musiker A | `musiker-a` | Musiker:in (Standardrolle) | Trompete 1 in B | Desktop 1280 px |
| Musiker B | `musiker-b` | Musiker:in | Horn 1 in F (Ersatz: Horn 1 in Es) | Mobil 390 px |
| Musiker C | `musiker-c` | Musiker:in | Klarinette 1 in B | Tablet 820 px |

Fixtures in `deploy/e2e/fixtures/`:

- `konzertmappe.csv` und `gruen.csv` (Altdaten-Export).
- `spec.json`: Quelle für alle übrigen Fixtures und Erwartungen; `tools/src/generate-fixtures.mjs` erzeugt daraus `generated/` und `expected.json`.
- Einzelne Stimmen-PDFs, erzeugt von einem Skript mit pdf-lib. Jede Seite trägt als Text „Titel · Stimme · Seite n/m“, damit das Orakel gedruckte und heruntergeladene PDFs inhaltlich prüfen kann. Dateinamen so gewählt, dass die Stimme erkannt wird (N-11).
- `sammel.pdf`: Deckblatt + drei Stücke mit je zwei Stimmen, bekannte Seitengrenzen.
- `expected.json`: alle erwarteten Zahlen, Namen und Seitenzahlen.

Die Mappe „Konzertmappe“ enthält nach Phase 3 mindestens ein Stück mit über 10 Seiten in Trompete 1 in B (Mappendruck über den Druckservice), ein Stück **nur** mit Horn 1 in Es (Ersatzstimme für B) und ein Stück **ohne** Klarinette 1 in B (Upload durch C).

## Phase 0 – Infrastruktur (Skript, kein Agent)

**E2E-0.1** Images bauen, Compose starten. *Then* `https://vm.test/health` antwortet 200, Keycloak-Discovery unter `https://auth.vm.test/realms/master/.well-known/openid-configuration` antwortet 200, `lpstat -d` im Browser-Container zeigt CUPS-PDF, der Druckservice antwortet auf `127.0.0.1:17631` im Browser-Container.

## Phase 1 – Admin

**E2E-1.1 Keycloak einrichten** · *When* der Admin in der Keycloak-Admin-Oberfläche Realm `verein`, Client `vm-web` (Authorization Code + PKCE, Redirect-URI `https://vm.test/internal/v1/auth/callback`) und die fünf Benutzer anlegt · *Then* Discovery des Realms antwortet 200; alle fünf Benutzer existieren, aktiviert, ohne Pflichtaktionen · *Orakel* Keycloak-Admin-API.

**E2E-1.2 Erste Anmeldung** (S-5, A-2, A-3) · *When* der Admin `https://vm.test` öffnet und „Mit Vereinskonto anmelden“ nutzt · *Then* er landet in Mein Bereich, ist Admin (Kennzeichen + Rolle `admin` im Wurzel-Ensemble), Name und E-Mail stammen aus Keycloak · *Orakel* `users`, `memberships`.

**E2E-1.3 Ensemble und Besetzung** (S-2, N-8) · *When* er das Ensemble „Hauptorchester“ anlegt und die Besetzung Standard-Blasorchester übernimmt · *Then* das Ensemble existiert mit allen Stimmen der Vorlage als Besetzung.

**E2E-1.4 Standardwerte umstellen** (S-4, A-3) · *When* er Standard-Ensemble „Hauptorchester“ und Standardrolle „Musiker:in“ setzt sowie die VM-Web-Adresse `https://vm.test` für den Druckservice einträgt · *Then* `club_settings` enthält genau diese Werte. **Muss vor jeder weiteren Anmeldung abgeschlossen sein**; das Skript gibt Phase 2 erst danach frei.

## Phase 2 – Übergabe Notenwart:in ↔ Admin

**E2E-2.1 Erste Anmeldung Notenwart:in** · *When* `notenwart` sich anmeldet · *Then* landet in Mein Bereich; Mitglied im Hauptorchester mit Rolle Musiker:in; kein Menüpunkt Notenverwaltung; `GET` auf eine Notenverwaltungs-API antwortet 403. Der Agent meldet sich über `state.json` beim Admin.

**E2E-2.2 Rechte vergeben** (S-1) · *When* der Admin unter Benutzer die Rolle im Hauptorchester auf Notenwart:in ändert · *Then* nach Neuladen sieht `notenwart` die Notenverwaltung, ohne sich neu anzumelden.

## Phase 3 – Notenwart:in

**E2E-3.1 CSV-Import Konzertmappe** (N-19) · *When* `konzertmappe.csv` mit Zuordnung Titel, Komponist, Arrangeur, Verlag als feste Felder, „Genre“ als neues eigenes Auswahlfeld, Mappe aus Spalte „Notenbücher“, Nummer aus „_Nummer“, Rest „nicht importieren“ · *Then* Vorschau zeigt alle Zeilen als neu bzw. dateiintern zusammengeführt; nach dem Import entsprechen Stückzahl, Mappe „Konzertmappe“ im Hauptorchester, Nummern und Auswahloptionen von „Genre“ `expected.json`.

**E2E-3.2 CSV-Import Grünes Marschbuch** (N-19, Verknüpfen) · *When* `gruen.csv` mit Mappe aus „Notenbücher“ und Nummer aus „Grün“; Zuordnung wird für bekannte Spaltennamen vorbelegt · *Then* Vorschau markiert bereits vorhandene Stücke als „existiert“ mit Standard „verknüpfen“; nach dem Import haben diese Stücke einen zusätzlichen Mappen-Eintrag, vorher gefüllte Felder sind unverändert, leere sind gefüllt; Gesamtzahl laut `expected.json`.

**E2E-3.3 Einzel-Upload** (N-10, N-11) · *When* mehrere Stimmen-PDFs auf einmal hochgeladen werden · *Then* die Stimme ist aus dem Dateinamen vorgeschlagen; nach Bestätigung sind alle Blätter sofort freigegeben (Status `approved`), ohne Umweg über „Ungeprüft“.

**E2E-3.4 Sammel-PDF aufteilen** (N-18) · *When* `sammel.pdf` im Upload-Dialog über „Aufteilen …“ geöffnet, das Deckblatt übersprungen und an den Seitengrenzen Stück und Stimme gesetzt werden; ein Stück fehlt noch und wird im Viewer angelegt · *Then* sechs Blätter mit den Seitenzahlen aus `expected.json`, alle freigegeben; das neue Stück existiert.

**E2E-3.5 Mappe und Event** (N-15, N-16, N-5) · *When* „Konzertmappe“ auf „in Mein Bereich anzeigen“ gestellt und ein Event „Frühlingskonzert“ (Datum in der Zukunft) mit fünf Stücken angelegt und per Drag & Drop sortiert wird · *Then* Event mit Setlist in genau dieser Reihenfolge, beide in Mein Bereich sichtbar.

**E2E-3.6 Vollständigkeit** (N-4) · *Then* das Stück ohne Klarinette 1 in B zeigt diese als fehlend; die Zahl vorhandener/benötigter Stimmen entspricht `expected.json`.

**E2E-3.7 Mappendruck** (D-1, D-3, D-5, D-6) · *When* die Konzertmappe für Trompete 1 in B gedruckt wird · *Then* der Auftrag geht an den Druckservice (über der Seitengrenze), der Druckdialog zeigt wartend → druckt → fertig, der Druckverlauf listet ihn; in der CUPS-PDF-Ausgabe liegt ein PDF mit den Stücken in Mappen-Reihenfolge und Leerseiten nach den Standard-Druckregeln · *Orakel* Seitentexte und Seitenzahl gegen `expected.json`.

## Phase 4 – Musiker:innen (parallel, je ein Browser-Kontext)

**E2E-4.0 Erste Anmeldung** (A-3, M-1) · für A, B, C · *Then* automatisch Mitglied im Hauptorchester mit Rolle Musiker:in, nicht Admin; beim ersten Besuch fragt VM-Web nach der Stimme, die Person setzt ihre Stimme aus der Tabelle oben.

**E2E-4.A Musiker A – ZIP und Einzeldruck**
1. **A.1** (M-4) Konzertmappe öffnen, nach einem Titel suchen · *Then* Treffer mit hervorgehobener Mappennummer und Seitenzahl.
2. **A.2** (M-6) Ganze Mappe als ZIP laden · *Then* ZIP enthält ein PDF pro Stück mit Trompete 1 in B, benannt `Nr – Titel – Stimme.pdf`, kein Eintrag für Stücke ohne diese Stimme · *Orakel* entpacken, Namen und Seitentexte gegen `expected.json`.
3. **A.3** (M-6) Event „Frühlingskonzert“ als ZIP · *Then* wie A.2, Inhalt entspricht der Setlist.
4. **A.4** (D-2) Ein Stück mit ≤ 10 Seiten drucken · *Then* Browser-Druck, kein Auftrag an den Druckservice; ein PDF in der CUPS-PDF-Ausgabe mit den Seiten dieses Stücks.

**E2E-4.B Musiker B – Einzel-Downloads, Ersatz- und Fremdstimme (mobil)**
1. **B.1** (M-3) Stück nur mit Horn 1 in Es · *Then* erscheint markiert als „Ersatz: Horn 1 in Es“, nachrangig.
2. **B.2** (M-6) Zwei Stücke einzeln als PDF laden · *Then* Dateien entsprechen der eigenen Stimme.
3. **B.3** (M-2) In der Kopfzeile auf Trompete 2 in B umschalten, ein Stück laden, zurückschalten · *Then* Download in Trompete 2 in B; Profilstimme danach unverändert Horn 1 in F.
4. **B.4** (M-8) Persönlichen Tag „Lieblingsstück“ an ein Stück hängen und danach filtern · *Then* Filter zeigt genau dieses Stück; für A und C ist der Tag nicht sichtbar.
5. **B.5** (D-2) Ein Stück drucken · *Then* wie A.4.
6. **B.6** (NFR Responsiv) Gesamte Phase im Mobil-Viewport · *Then* Karten statt Tabellen, Tippflächen ≥ 44 px, kein horizontales Scrollen.

**E2E-4.C Musiker C – Upload fehlender Stimmen**
1. **C.1** (M-3, M-9) Stück ohne Klarinette 1 in B · *Then* „Stimme fehlt“ mit Upload-Möglichkeit.
2. **C.2** (N-10, M-9) Passende PDF hochladen · *Then* Status `pending` („Ungeprüft“), für A und B nicht sichtbar.
3. **C.3** Für ein zweites Stück eine falsche PDF (anderes Stück im Inhalt) hochladen · *Then* ebenfalls `pending`.
4. **C.4** (N-14) Eigene Uploads ansehen · *Then* beide mit Status „in Prüfung“.
5. **C.5** (D-2) Ein vorhandenes Stück drucken · *Then* wie A.4.
6. **C.6** (R-2, R-4) Notenverwaltung per Navigation nicht erreichbar; direkter API-Aufruf antwortet 403 (prüft das Orakel, nicht der Agent).

## Phase 5 – Prüfung durch Notenwart:in

**E2E-5.1 Annehmen** (N-12) · *When* in der Prüfansicht der passende Upload von C geöffnet, durchgeblättert, Stück und Stimme bestätigt und „Annehmen & weiter“ gewählt wird · *Then* Status `approved`; die nächste Prüfung öffnet sich.

**E2E-5.2 Ablehnen** (N-12) · *When* der falsche Upload mit Begründung „Falsches Stück im PDF“ abgelehnt wird · *Then* Status `rejected` mit genau dieser Begründung.

**E2E-5.3 Tastenkürzel** (N-13) · mindestens eine Aktion per Tastatur (A, R oder Pfeiltasten) · *Then* gleiche Wirkung wie per Klick.

## Phase 6 – Nachbesserung durch Musiker C

**E2E-6.1** (N-14) · *Then* C sieht einen Upload angenommen und einen abgelehnt mit Begründung.

**E2E-6.2** · *When* C die richtige PDF für das abgelehnte Stück hochlädt · *Then* neuer Upload `pending`.

**E2E-6.3** · *When* die Notenwart:in ihn annimmt · *Then* C sieht beide Stücke in Mein Bereich mit Klarinette 1 in B; die Vollständigkeit beider Stücke ist gestiegen (N-4).

## Phase 7 – Abschluss-Orakel (Skript)

**E2E-7.1** Keine 5xx-Antworten in den API-Logs, keine Fehler in den Browser-Konsolen aller fünf Kontexte.

**E2E-7.2** Datenbank-Endstand entspricht `expected.json`: Benutzer, Mitgliedschaften und Rollen, Stückzahl, Mappen-Einträge, Blätter je Status, Event-Setlist.

**E2E-7.3** Alle Downloads und alle Dateien in der CUPS-PDF-Ausgabe sind geprüft; es liegt keine unerwartete Datei vor.

**E2E-7.4** Kein Befund aus E-2 in einem Agenten-Bericht. Sonst rot.

## Bewusst nicht abgedeckt

- Abmelden beim Identity-Server (A-6, später). Deshalb hat jede Persona einen eigenen Browser-Kontext.
- Konto sperren (A-5), Rollen-Matrix bearbeiten (S-3) und Vorstand-Rolle. Kandidaten für einen zweiten Lauf.
- Benachrichtigungen und Offline-Nutzung (M-10).
