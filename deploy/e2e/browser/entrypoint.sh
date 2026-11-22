#!/bin/bash
# Startet CUPS (Standarddrucker „PDF“), Xvfb, VNC und je Persona einen Playwright-MCP-Server.
set -euo pipefail

mkdir -p /out/cups-pdf /out/downloads /out/mcp /var/lib/vm-e2e/profiles
chmod 777 /out/cups-pdf

# Test-CA für Chromium (NSS-Datenbank des Benutzers) – Browser vertraut vm.test wie im Betrieb
mkdir -p "$HOME/.pki/nssdb"
[ -f "$HOME/.pki/nssdb/cert9.db" ] || certutil -d "sql:$HOME/.pki/nssdb" -N --empty-password
certutil -d "sql:$HOME/.pki/nssdb" -D -n vm-e2e-ca 2>/dev/null || true
certutil -d "sql:$HOME/.pki/nssdb" -A -t "C,," -n vm-e2e-ca -i /certs/ca.crt
cp /certs/ca.crt /usr/local/share/ca-certificates/vm-e2e-ca.crt && update-ca-certificates >/dev/null

# CUPS auf localhost (Druckservice im selben Netzwerk-Namespace) und auf dem Socket (Chromium);
# Drucker „PDF“ (CUPS-PDF) als Standard
sed -i 's/^Listen localhost:631/Listen 127.0.0.1:631/' /etc/cups/cupsd.conf
grep -q '^Listen /run/cups/cups.sock' /etc/cups/cupsd.conf || echo 'Listen /run/cups/cups.sock' >> /etc/cups/cupsd.conf
rm -f /run/cups/cupsd.pid
/usr/sbin/cupsd
for _ in $(seq 1 30); do lpstat -r >/dev/null 2>&1 && break; sleep 0.5; done
if ! lpstat -p PDF >/dev/null 2>&1; then
  lpadmin -p PDF -E -v cups-pdf:/ -m lsb/usr/cups-pdf/CUPS-PDF_opt.ppd 2>/dev/null \
    || lpadmin -p PDF -E -v cups-pdf:/ -m everywhere 2>/dev/null \
    || lpadmin -p PDF -E -v cups-pdf:/
fi
lpadmin -d PDF
cupsenable PDF && cupsaccept PDF

# Bildschirm für Chromium (headful, damit Kiosk-Druck funktioniert) und VNC zum Zuschauen.
# Nach einem Neustart des Containers liegen Sperrdateien vom letzten Lauf noch da.
rm -f /tmp/.X99-lock /tmp/.X11-unix/X99
Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp &
sleep 1
x11vnc -display :99 -forever -shared -nopw -rfbport 5900 -quiet &

# Je Persona ein MCP-Server mit eigener Konfiguration (Viewport, Download-Ordner)
pids=()
for config in /etc/vm-e2e/mcp/*.json; do
  name=$(basename "$config" .json)
  mkdir -p "/out/downloads/$name" "/out/mcp/$name"
  playwright-mcp --config "$config" > "/out/mcp/$name/server.log" 2>&1 &
  pids+=($!)
  echo "mcp: $name gestartet"
done

# Endet ein Dienst, endet der Container (restart: unless-stopped startet neu)
wait -n "${pids[@]}"
