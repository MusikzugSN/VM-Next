# Druckservice – Schnittstelle (Vertrag 1)

Der Druckservice (`apps/print-service`) läuft auf dem Rechner der Person und druckt große Aufträge direkt auf einen lokalen Drucker (D-3, D-4). VM-Web im Browser spricht ihn über `http://127.0.0.1:17631/v1` an. Die API von VM-Web ist nicht beteiligt: Der Browser holt das druckfertige PDF von `GET print/document` und schickt es an den Druckservice.

Die Schemas liegen in `libs/shared/src/lib/print-service/print-service.schema.ts` (`PRINT_SERVICE_*`, `printJobMetaSchema`, `printJobSchema` …). Dieses Dokument beschreibt das Verhalten, das der Druckservice dazu einhalten muss. Umgesetzt in `apps/print-service` (Einrichtung: `apps/print-service/README.md`).

## Netzwerk und Sicherheit

- Lauscht **nur auf `127.0.0.1:17631`** (nicht `0.0.0.0`, kein IPv6-Wildcard). Kein TLS: `http://127.0.0.1` gilt in Browsern als sicherer Kontext, Aufrufe aus einer HTTPS-Seite sind erlaubt.
- **Origin-Prüfung (D-4):** Erlaubt ist genau die eingetragene VM-Web-Adresse (Konfiguration › Drucken › „Öffentliche Adresse von VM-Web“, `publicBaseUrl`). Der Druckservice liest sie aus seiner lokalen Konfigurationsdatei. Anfragen mit anderem oder fehlendem `Origin` → `403 { "code": "origin-not-allowed" }`.
- **CORS:** Für die erlaubte Origin `Access-Control-Allow-Origin: <origin>`, `Vary: Origin`, `Access-Control-Allow-Methods: GET, POST`, `Access-Control-Allow-Headers: Content-Type`. Preflight (`OPTIONS`) beantwortet er mit `204`.
- **Private Network Access (Chrome):** Auf Preflights mit `Access-Control-Request-Private-Network: true` antwortet er zusätzlich mit `Access-Control-Allow-Private-Network: true`.
- Keine Cookies, keine Anmeldung: Wer die erlaubte VM-Web-Seite offen hat, darf drucken (D-7).
- Größe eines PDFs höchstens 200 MB, sonst `413`.

## Endpunkte

Alle Antworten sind JSON. Fehler haben den Body `printServiceErrorSchema` (`code`, `message`).

| Methode und Pfad | Zweck | Antwort |
| --- | --- | --- |
| `GET /v1/status` | Erreichbarkeit, Version, Drucker | `200 printServiceStatusSchema` |
| `GET /v1/jobs` | Verlauf der letzten 30 Tage, neueste zuerst (D-5) | `200 printJobListSchema` |
| `POST /v1/jobs` | Neuer Auftrag, `multipart/form-data` mit `file` (PDF) und `meta` (JSON, `printJobMetaSchema`) | `201 printJobSchema` |
| `POST /v1/jobs/{id}/cancel` | Wartenden oder druckenden Auftrag abbrechen | `200 printJobSchema` |
| `POST /v1/jobs/{id}/retry` | Fertigen oder fehlgeschlagenen Auftrag erneut drucken (gleiches PDF) | `201 printJobSchema` (neuer Auftrag) |
| `POST /v1/update` | Sich selbst auf ein neueres Release aktualisieren, JSON `printServiceUpdateRequestSchema` (`{ "version": "1.2.3" }`) | `200 printServiceUpdateResultSchema`, danach Neustart |

- `contracts` in `/status` listet die verstandenen Vertragsversionen. VM-Web schickt `meta.contract = 1`; kennt der Dienst sie nicht → `400 contract-unsupported`.
- `meta.printerId = null` druckt auf den Standarddrucker; ein unbekannter Drucker → `400 printer-not-found`.
- Das PDF enthält bereits Ränder, Reihenfolge und Leerseiten (D-1). `duplex` setzt nur die Druckeroption (CUPS `sides=two-sided-long-edge`).

## Zustände (D-5)

`waiting` → `printing` → `done`, bei Problemen `failed` mit `error` als Klartext für die Anzeige. `cancelled` nach `cancel`. Während `printing` meldet `printedPages` den Fortschritt, wenn CUPS ihn liefert, sonst `null`. Der Verlauf und die PDFs bleiben 30 Tage lokal gespeichert, damit „Erneut senden“ ohne VM-Web funktioniert.

## Update

VM-Web und Druckservice haben dieselbe Release-Version (Root-`package.json`, `.github/scripts/set-version.mjs`).

- **Prüfung beim Start:** Die App-Shell fragt einmal `GET /v1/status` ab und vergleicht `version` mit der eigenen Version. Das passiert nur, wenn der Druckservice in diesem Browser schon einmal erreichbar war (`localStorage`), damit Browser nicht alle Personen nach Zugriff aufs lokale Netzwerk fragen. Entwicklungsstände (`0.0.0`, `0.0.0-dev`) werden nicht geprüft.
- **Älterer Druckservice** (oder `contracts` ohne den aktuellen Vertrag): Dialog mit „Jetzt aktualisieren“. VM-Web schickt `POST /v1/update { version: <VM-Web-Version> }` und fragt danach `/status` ab, bis die neue Version gemeldet wird (höchstens 60 s), dann „Druckservice aktualisiert“.
- **Neuerer Druckservice:** nur ein Hinweis, der Druckservice installiert keine älteren Versionen.
- **Ablauf im Druckservice:** nur `X.Y.Z` und nur neuer als die laufende Version (`400 update-invalid-version`), nur als installierte Binärdatei unter Linux (sonst `400 update-unsupported`), ein Update gleichzeitig (`409 update-running`). Er lädt `SHA256SUMS` und `vm-web-print-<version>-linux-<arch>.tar.gz` aus dem GitHub-Release `v<version>`, prüft die Prüfsumme, ersetzt `~/.local/bin/vm-web-print` atomar, antwortet `200` und beendet sich mit Exit-Code 75. systemd startet ihn wegen `Restart=on-failure` nach 5 s neu. Fehler beim Laden oder Prüfen → `502 update-failed`, die alte Version läuft weiter. Konfiguration, Unit-Datei und Verlauf bleiben unverändert.
- **Druckservices vor diesem Endpunkt** antworten `404`. VM-Web zeigt dann die Anleitung für ein einmaliges Update von Hand (Archiv aus dem Release, `./install.sh`).

## Umsetzung

- `apps/print-service`: Node ohne weitere Abhängigkeiten außer `zod` (HTTP mit `node:http`, Multipart über die eingebaute Fetch-API, Druck über `child_process`).
- Druckausgabe hinter `PrinterBackend`; MVP: `CupsBackend` mit `lpstat`, `lpoptions`, `lp` (`sides=…`, `fit-to-page=false`) und `cancel`. CUPS meldet keinen Seitenfortschritt, `printedPages` bleibt `null`. Windows kommt als zweite Umsetzung dazu (D-4).
- Konfiguration in `~/.config/vm-web-print/config.json` (`allowedOrigin`) oder `VMWEB_PRINT_ORIGIN`; Verlauf und PDFs in `~/.local/share/vm-web-print/`.
- VM-Web fragt den Status beim Öffnen des Druckdialogs und im Druckverlauf ab (alle 2 s, solange die Seite sichtbar ist). Ist er nicht erreichbar (Timeout 1,5 s), zeigt VM-Web Warnung, Installationsanleitung und den Browser-Druck als Ausweg (D-3).
