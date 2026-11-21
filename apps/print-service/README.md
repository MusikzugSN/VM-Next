# VM-Web Druckservice

Druckt große Aufträge aus VM-Web (ganze Mappen, Events, mehrere Stimmen) direkt auf einen Drucker am eigenen Rechner (D-3 bis D-5). Läuft nur auf `127.0.0.1:17631`, nimmt nur Aufträge der eingetragenen VM-Web-Adresse an und druckt über CUPS. Schnittstelle: [`docs/print-service.md`](../../docs/print-service.md).

## Voraussetzungen

- Linux (x64 oder arm64, glibc) mit systemd und CUPS (`lp`, `lpstat`, `lpoptions`, `cancel`) und mindestens einem eingerichteten Drucker
- Node.js ist **nicht** nötig: Der Dienst wird als einzelne ausführbare Datei verteilt (Node SEA).

## Einrichten

1. `vm-web-print-<version>-linux-<x64|arm64>.tar.gz` aus dem Release laden und entpacken.
2. Im entpackten Ordner als normaler Benutzer (nicht root) ausführen, mit genau der Adresse, unter der VM-Web im Browser läuft:

   ```bash
   ./install.sh --origin https://noten.musikverein.de
   ```

   Das Skript legt `~/.local/bin/vm-web-print`, `~/.config/vm-web-print/config.json` und `~/.config/systemd/user/vm-web-print.service` an und startet den Benutzerdienst.
3. In VM-Web unter Drucken › Druckverlauf prüfen: „Druckservice auf diesem Computer verbunden“.

- **Aktualisieren:** neues Archiv entpacken, `./install.sh` ohne Optionen (Konfiguration bleibt).
- **Entfernen:** `./install.sh --uninstall` (Verlauf und Konfiguration bleiben).
- **Log:** `journalctl --user -u vm-web-print`
- Statt `config.json` geht auch die Umgebungsvariable `VMWEB_PRINT_ORIGIN`.

Verlauf und PDFs liegen 30 Tage in `~/.local/share/vm-web-print/` (`jobs.json`, `pdf/`).

## Bauen

```bash
pnpm nx build-sea print-service   # unter Linux: dist/apps/print-service-sea/
pnpm print:sea                    # unter Windows: dasselbe in Docker (WSL), linux/amd64
```

Ergebnis: `vm-web-print` (ausführbar) und `vm-web-print-<version>-linux-<arch>.tar.gz` mit Binärdatei, `install.sh`, Unit-Datei und dieser README. Die Version kommt aus der `package.json` im Wurzelverzeichnis und erscheint in `GET /v1/status`. Die Datei läuft nur auf der Architektur, auf der sie gebaut wurde (arm64: auf einem arm64-Rechner bauen oder `--platform linux/arm64`).

`pnpm nx build print-service` erzeugt weiterhin nur `dist/apps/print-service/main.js` für die Entwicklung.

## Entwickeln

```bash
VMWEB_PRINT_ORIGIN=http://localhost:4200 pnpm nx serve print-service
pnpm nx test print-service
```

Ohne CUPS (z. B. unter Windows) startet der Dienst, meldet bei `GET /v1/status` aber einen Fehler; die Tests laufen mit einem nachgebauten Drucker. Die Druckausgabe steckt hinter `PrinterBackend` (`src/printer-backend.ts`); eine Windows-Umsetzung kommt als zweite Klasse dazu.
