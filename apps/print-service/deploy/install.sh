#!/bin/sh
# Installs (or updates) the VM-Web Druckservice for the current user as a systemd user service.
#
#   ./install.sh --origin https://noten.example.org   # install or update
#   ./install.sh                                      # update, keeps the existing configuration
#   ./install.sh --uninstall                          # remove service and binary (keeps history)
set -eu

NAME=vm-web-print
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
BIN_DIR="$HOME/.local/bin"
CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
CONFIG_DIR="$CONFIG_HOME/$NAME"
UNIT_DIR="$CONFIG_HOME/systemd/user"
DATA_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/$NAME"

ORIGIN=""
UNINSTALL=0

usage() {
  sed -n '2,7p' "$0" | sed 's/^# \{0,1\}//'
}

while [ $# -gt 0 ]; do
  case "$1" in
    --origin) [ $# -ge 2 ] || { echo "--origin braucht eine Adresse" >&2; exit 2; }; ORIGIN="$2"; shift 2 ;;
    --origin=*) ORIGIN="${1#--origin=}"; shift ;;
    --uninstall) UNINSTALL=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unbekannte Option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [ "$(id -u)" -eq 0 ]; then
  echo "Bitte nicht als root ausführen: Der Druckservice läuft als Dienst des angemeldeten Benutzers." >&2
  exit 1
fi
command -v systemctl >/dev/null 2>&1 || { echo "systemctl nicht gefunden (systemd wird benötigt)." >&2; exit 1; }

if [ "$UNINSTALL" -eq 1 ]; then
  systemctl --user disable --now "$NAME" 2>/dev/null || true
  rm -f "$UNIT_DIR/$NAME.service" "$BIN_DIR/$NAME"
  systemctl --user daemon-reload
  echo "Druckservice entfernt. Konfiguration ($CONFIG_DIR) und Verlauf ($DATA_DIR) bleiben erhalten."
  exit 0
fi

[ -x "$SCRIPT_DIR/$NAME" ] || { echo "$SCRIPT_DIR/$NAME fehlt – install.sh im entpackten Archiv ausführen." >&2; exit 1; }
command -v lp >/dev/null 2>&1 || echo "Hinweis: CUPS (lp, lpstat) nicht gefunden – ohne CUPS kann nicht gedruckt werden." >&2

# Ask for the address on a first install in a terminal
if [ -z "$ORIGIN" ] && [ ! -f "$CONFIG_DIR/config.json" ]; then
  if [ -t 0 ]; then
    printf 'Adresse von VM-Web, die drucken darf (z. B. https://noten.example.org): '
    read -r ORIGIN
  else
    echo "Keine Konfiguration vorhanden: --origin https://deine-vm-web-adresse angeben." >&2
    exit 2
  fi
fi

if [ -n "$ORIGIN" ]; then
  case "$ORIGIN" in
    http://*|https://*) ;;
    *) echo "Adresse muss mit http:// oder https:// beginnen: $ORIGIN" >&2; exit 2 ;;
  esac
  case "$ORIGIN" in
    *'"'*|*'\'*|*' '*) echo "Ungültige Adresse: $ORIGIN" >&2; exit 2 ;;
  esac
  mkdir -p "$CONFIG_DIR"
  printf '{ "allowedOrigin": "%s" }\n' "$ORIGIN" > "$CONFIG_DIR/config.json"
fi

mkdir -p "$BIN_DIR" "$UNIT_DIR"
# Replace atomically, so a running service keeps its old file until the restart
cp "$SCRIPT_DIR/$NAME" "$BIN_DIR/.$NAME.new"
chmod 755 "$BIN_DIR/.$NAME.new"
mv -f "$BIN_DIR/.$NAME.new" "$BIN_DIR/$NAME"
cp "$SCRIPT_DIR/$NAME.service" "$UNIT_DIR/$NAME.service"

systemctl --user daemon-reload
systemctl --user enable "$NAME" >/dev/null 2>&1
systemctl --user restart "$NAME"

sleep 1
if systemctl --user is-active --quiet "$NAME"; then
  echo "Druckservice läuft ($BIN_DIR/$NAME). Erlaubte Adresse: $(cat "$CONFIG_DIR/config.json")"
  echo "In VM-Web unter Drucken › Druckverlauf prüfen: „Druckservice auf diesem Computer verbunden“."
else
  echo "Druckservice startet nicht. Log: journalctl --user -u $NAME -n 50" >&2
  exit 1
fi
