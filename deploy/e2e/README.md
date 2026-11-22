# KI-Testlauf

Produktionsnahe Umgebung für den vollautomatischen Testlauf aus [docs/e2e-acceptance.md](../../docs/e2e-acceptance.md): VM-Web aus lokal gebauten Images hinter Traefik mit TLS, Keycloak als Identity-Server und ein Browser-Container, in dem KI-Agenten als Admin, Notenwart:in und drei Musiker:innen arbeiten. Ein deterministisches Orakel prüft nach jeder Phase Datenbank, Keycloak, Downloads und Druckausgaben.

Alle Passwörter und Schlüssel hier sind feste Testwerte. Nichts davon gehört in eine echte Installation.

## Aufbau

| Dienst | Aufgabe |
| --- | --- |
| `certs` | Erzeugt einmalig eine Test-CA und ein Zertifikat für `vm.test` und `auth.vm.test` |
| `traefik` | TLS-Endpunkt wie der Reverse Proxy eines Vereins; Netzwerk-Aliase `vm.test`, `auth.vm.test` |
| `keycloak`, `keycloak-db` | Identity-Server; Realm und Client legt der Admin-Agent in Phase 1 an |
| `postgres`, `api`, `web` | VM-Web, gebaut aus `apps/api/Dockerfile` und `apps/web/Dockerfile` (`NODE_ENV=production`) |
| `browser` | Chromium unter Xvfb, CUPS mit CUPS-PDF als Standarddrucker, je Persona ein Playwright-MCP-Server |
| `print-service` | Der echte Druckservice (Node SEA) im Netzwerk des Browsers, druckt auf CUPS-PDF |
| `tools` | Fixture-Generator und Orakel (nur über `run.sh`) |

Der Browser läuft im Compose-Netz. Hosts-Einträge oder Zertifikate auf dem eigenen Rechner sind deshalb nicht nötig. Zum Zuschauen gibt es VNC auf `localhost:5900` und VM-Web im eigenen Browser unter `https://vm.test`, wenn die Hosts-Datei `127.0.0.1 vm.test auth.vm.test` enthält (Zertifikatswarnung, da Test-CA).

| Persona | MCP-Server | Viewport | Agent (Standard) |
| --- | --- | --- | --- |
| admin | `http://localhost:8931/mcp` | 1440 × 900 | Claude Code |
| notenwart | `http://localhost:8932/mcp` | 1440 × 900 | Claude Code |
| musiker-a | `http://localhost:8933/mcp` | 1280 × 800 | OpenCode (Qwen) |
| musiker-b | `http://localhost:8934/mcp` | 390 × 844, mobil | OpenCode (Qwen) |
| musiker-c | `http://localhost:8935/mcp` | 820 × 1180, Touch | OpenCode (Qwen) |

Jede Persona hat ein eigenes Browserprofil. Die Anmeldung bleibt deshalb von Phase zu Phase erhalten (wichtig für E2E-2.2: Rechte greifen ohne neue Anmeldung).

## Voraussetzungen

- Linux oder WSL 2 mit Docker und Compose v2
- `claude` (Claude Code) und `opencode` im selben System, angemeldet bzw. mit API-Schlüssel
- `OPENCODE_MODEL`, z. B. `export OPENCODE_MODEL=openrouter/qwen/qwen3-coder` oder ein lokales Qwen-Modell
- `fixtures/konzertmappe.csv` und `fixtures/gruen.csv` (Altdaten-Export)

## Ablauf

```bash
cd deploy/e2e
./run.sh fixtures        # PDFs + expected.json; expected.json danach gegenlesen (E-5)
./run.sh all             # leer starten, Phasen 1–6c, Abschlussbericht
```

Einzeln:

```bash
./run.sh up                  # Stack leer starten (Rückfallebene: ./run.sh up --realm-import)
./run.sh phase 1             # Admin richtet Keycloak und VM-Web ein, danach Orakel
./run.sh phase 2a            # nur wenn gate1 grün: Notenwart:in meldet sich an …
./run.sh oracle phase3       # Orakel ohne Agent
./run.sh report              # Logs einsammeln, Abschluss-Orakel, Ergebnis
./run.sh down
```

Welcher Agent welche Persona spielt, steuern Umgebungsvariablen, z. B. `AGENT_musiker_b=claude ./run.sh phase 4`.

## Ergebnisse

| Pfad | Inhalt |
| --- | --- |
| `run/findings/agent-*.json` | Befunde der Agenten (Format E-4) |
| `run/findings/oracle-*.json` | Befunde des Orakels |
| `run/logs/` | Agenten-Protokolle, Orakel-Ausgaben, Logs von API, Traefik, Druckservice |
| `run/out/downloads/<persona>/` | Downloads und Screenshots je Persona |
| `run/out/cups-pdf/` | Alles, was gedruckt wurde |

Der Lauf ist nur grün, wenn keine dieser Dateien einen Befund enthält (E-1).

## Rauchtests ohne Agenten

Bei laufendem Stack (`./run.sh up`, für den Login-Test `./run.sh up --realm-import`):

```bash
docker compose --profile tools run --rm -T --no-deps -v ./tools/src:/e2e/tools/src:ro tools src/probe-browser.mjs  # TLS, Download, Kiosk-Druck
docker compose --profile tools run --rm -T --no-deps -v ./tools/src:/e2e/tools/src:ro tools src/probe-login.mjs    # Login über Keycloak
```

Der Login-Test legt das erste Konto an. Danach den Stack mit `./run.sh up` leer neu starten.

## Offene Punkte

- **Browser-Druck (D-2):** Chromium (und Chrome) mit `--kiosk-printing` fragt den CUPS-Drucker ab, schickt unter Playwright aber keinen Auftrag. Bis das gelöst ist, schlagen die Orakel-Checks für die Einzeldrucke (A.4, B.5, C.5) fehl. Der Mappendruck über den Druckservice ist davon nicht betroffen.
- **CSV-Fixtures:** `fixtures/konzertmappe.csv` und `fixtures/gruen.csv` fehlen; ohne sie bleiben die Import-Erwartungen in `expected.json` leer und das Orakel meldet das als Befund (E-5).

## Testdaten ändern

`fixtures/spec.json` ist die einzige Quelle für Stimmen-PDFs, Sammel-PDF, Event, Uploads und Drucke. Nach einer Änderung `./run.sh fixtures` ausführen und das neue `expected.json` gegenlesen. Die PDFs tragen auf jeder Seite „Titel · Stimme · Seite n/m“; daran erkennt das Orakel Seiten in Downloads und Drucken.
