# VM-Web Druckservice

Druckt große Aufträge aus VM-Web (ganze Mappen, Events, mehrere Stimmen) direkt auf einen Drucker am eigenen Rechner (D-3 bis D-5). Läuft nur auf `127.0.0.1:17631`, nimmt nur Aufträge der eingetragenen VM-Web-Adresse an und druckt über CUPS. Schnittstelle: [`docs/print-service.md`](../../docs/print-service.md).

## Voraussetzungen

- Linux mit CUPS (`lp`, `lpstat`, `lpoptions`, `cancel`) und mindestens einem eingerichteten Drucker
- Node.js 22 oder neuer

## Bauen

```bash
pnpm nx build print-service
```

Ergebnis: `dist/apps/print-service/main.js` mit `package.json` (einzige Laufzeitabhängigkeit: `zod`).

## Einrichten

1. Dateien nach `~/.local/lib/vm-web-print/` kopieren und dort `npm install --omit=dev` ausführen.
2. VM-Web-Adresse eintragen, die drucken darf (genau die Adresse, unter der VM-Web im Browser läuft):

   ```bash
   mkdir -p ~/.config/vm-web-print
   echo '{ "allowedOrigin": "https://noten.musikverein.de" }' > ~/.config/vm-web-print/config.json
   ```

   Alternativ per Umgebungsvariable `VMWEB_PRINT_ORIGIN`.
3. Als Benutzerdienst starten:

   ```bash
   cp deploy/vm-web-print.service ~/.config/systemd/user/
   systemctl --user daemon-reload
   systemctl --user enable --now vm-web-print
   ```

4. In VM-Web unter Drucken › Druckverlauf prüfen: „Druckservice auf diesem Computer verbunden“.

Verlauf und PDFs liegen 30 Tage in `~/.local/share/vm-web-print/` (`jobs.json`, `pdf/`).

## Entwickeln

```bash
VMWEB_PRINT_ORIGIN=http://localhost:4200 pnpm nx serve print-service
pnpm nx test print-service
```

Ohne CUPS (z. B. unter Windows) startet der Dienst, meldet bei `GET /v1/status` aber einen Fehler; die Tests laufen mit einem nachgebauten Drucker. Die Druckausgabe steckt hinter `PrinterBackend` (`src/printer-backend.ts`); eine Windows-Umsetzung kommt als zweite Klasse dazu.
