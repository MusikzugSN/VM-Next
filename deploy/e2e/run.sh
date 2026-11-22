#!/usr/bin/env bash
# KI-Testlauf von VM-Web (docs/e2e-acceptance.md). Läuft unter Linux oder WSL aus diesem Ordner.
#
#   ./run.sh up [--realm-import]   Images bauen, Stack leer starten, Infrastruktur prüfen
#   ./run.sh fixtures              PDFs und expected.json aus fixtures/spec.json erzeugen
#   ./run.sh phase <name>          eine Phase: 1 | 2a | 2b | 3 | 4 | 5 | 6a | 6b | 6c (Agent + Orakel)
#   ./run.sh all                   alles von leer bis zum Abschlussbericht
#   ./run.sh oracle <check>        nur das Orakel (infra, phase1, gate1, phase2a, phase2, phase3 … final)
#   ./run.sh report                Abschlussbericht aus run/findings
#   ./run.sh down                  Stack samt Volumes entfernen
#
# Agenten: AGENT_<PERSONA> = claude | opencode (Persona mit _ statt -, z. B. AGENT_musiker_a).
# Standard: Claude Code für alle; OpenCode (Qwen) z. B. mit AGENT_musiker_a=opencode.
# OpenCode braucht OPENCODE_MODEL (z. B. "openrouter/qwen/qwen3-coder" oder ein lokales Modell).
set -euo pipefail
cd "$(dirname "$0")"

COMPOSE=(docker compose -f compose.yml)
RUN=run
declare -A PORT=([admin]=8931 [notenwart]=8932 [musiker-a]=8933 [musiker-b]=8934 [musiker-c]=8935)
DEFAULT_AGENT_admin=claude
DEFAULT_AGENT_notenwart=claude
DEFAULT_AGENT_musiker=claude

log() { printf '\n== %s ==\n' "$*"; }
die() { printf 'FEHLER: %s\n' "$*" >&2; exit 1; }

agent_for() {
  local persona=$1 var="AGENT_${1//-/_}" fallback
  case $persona in
    admin) fallback=$DEFAULT_AGENT_admin ;;
    notenwart) fallback=$DEFAULT_AGENT_notenwart ;;
    *) fallback=$DEFAULT_AGENT_musiker ;;
  esac
  echo "${!var:-$fallback}"
}

oracle() {
  local check=$1
  "${COMPOSE[@]}" --profile tools run --rm -T tools src/oracle.mjs "$check" | tee "$RUN/logs/oracle-$check.log"
  return "${PIPESTATUS[0]}"
}

# Startet einen Agenten mit Persona-Auftrag; der Browser kommt über den MCP-Server der Persona.
run_agent() {
  local task=$1 persona=$2 agent prompt url
  agent=$(agent_for "$persona")
  url="http://localhost:${PORT[$persona]}/mcp"
  prompt="$(cat agents/rules.md)

---

$(cat "agents/tasks/$task.md")

Dein Arbeitsordner ist $(pwd). Schreibe die Ergebnisdatei relativ dazu."
  log "Agent $task ($persona, $agent)"
  case $agent in
    claude)
      local mcp="$RUN/mcp/$persona.claude.json"
      printf '{"mcpServers":{"playwright":{"type":"http","url":"%s"}}}\n' "$url" > "$mcp"
      claude -p "$prompt" \
        --mcp-config "$mcp" --strict-mcp-config \
        --allowedTools "mcp__playwright" "Write" \
        --disallowedTools "Bash" "Read" "Grep" "Glob" "Edit" "WebFetch" "WebSearch" "Task" \
        --output-format stream-json --verbose \
        < /dev/null > "$RUN/logs/agent-$task.jsonl" 2> "$RUN/logs/agent-$task.err" || echo "Agent $task: Exit $?"
      ;;
    opencode)
      [ -n "${OPENCODE_MODEL:-}" ] || die "OPENCODE_MODEL ist nicht gesetzt"
      local cfg="$RUN/mcp/$persona.opencode.json"
      cat > "$cfg" <<JSON
{
  "\$schema": "https://opencode.ai/config.json",
  "mcp": { "playwright": { "type": "remote", "url": "$url", "enabled": true } },
  "permission": { "bash": "deny", "webfetch": "deny", "edit": "allow" }
}
JSON
      OPENCODE_CONFIG="$cfg" opencode run --model "$OPENCODE_MODEL" "$prompt" < /dev/null \
        > "$RUN/logs/agent-$task.log" 2>&1 || echo "Agent $task: Exit $?"
      ;;
    *) die "Unbekannter Agent $agent für $persona" ;;
  esac
  [ -f "$RUN/findings/agent-$task.json" ] || {
    printf '{"persona":"%s","phase":"%s","findings":[{"step":"%s","category":"fehler","description":"Agent hat keine Ergebnisdatei geschrieben"}]}\n' \
      "$persona" "$task" "$task" > "$RUN/findings/agent-$task.json"
  }
}

phase() {
  case $1 in
    1)  run_agent 1-admin admin;            oracle phase1 ;;
    2a) oracle gate1 || die "Standardwerte fehlen (E2E-1.4) – keine weitere Anmeldung"
        run_agent 2a-notenwart notenwart;   oracle phase2a ;;
    2b) run_agent 2b-admin admin;           oracle phase2 ;;
    3)  run_agent 3-notenwart notenwart;    oracle phase3 ;;
    4)  run_agent 4-musiker-a musiker-a & a=$!
        run_agent 4-musiker-b musiker-b & b=$!
        run_agent 4-musiker-c musiker-c & c=$!
        wait $a $b $c;                      oracle phase4 ;;
    5)  run_agent 5-notenwart notenwart;    oracle phase5 ;;
    6a) run_agent 6a-musiker-c musiker-c ;;
    6b) run_agent 6b-notenwart notenwart ;;
    6c) run_agent 6c-musiker-c musiker-c;   oracle phase6 ;;
    *)  die "Unbekannte Phase $1" ;;
  esac
}

report() {
  "${COMPOSE[@]}" logs --no-color traefik > "$RUN/logs/traefik.log" 2>&1 || true
  "${COMPOSE[@]}" logs --no-color api > "$RUN/logs/api.log" 2>&1 || true
  "${COMPOSE[@]}" logs --no-color print-service > "$RUN/logs/print-service.log" 2>&1 || true
  local status=0
  oracle final || status=1
  log "Ergebnis"
  if [ $status -eq 0 ] && ! grep -l '"step"' "$RUN"/findings/*.json >/dev/null 2>&1; then
    echo "GRÜN – kein Befund"
  else
    echo "ROT – Befunde in $RUN/findings/:"
    grep -h -o '"step": *"[^"]*"\|"description": *"[^"]*"' "$RUN"/findings/*.json | paste - - | sed 's/"step": //; s/"description": / – /'
    status=1
  fi
  return $status
}

up() {
  local files=(-f compose.yml)
  [ "${1:-}" = --realm-import ] && files+=(-f compose.realm-import.yml)
  COMPOSE=(docker compose "${files[@]}")
  "${COMPOSE[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
  rm -rf "$RUN"
  mkdir -p "$RUN"/{out,findings,logs,mcp}
  [ -f fixtures/expected.json ] && [ -d fixtures/generated ] || fixtures
  log "Images bauen und Stack starten"
  "${COMPOSE[@]}" --profile tools build
  "${COMPOSE[@]}" up -d --wait
  # Keycloak meldet sich als bereit, bevor es über Traefik antwortet: bis zu 2 Minuten warten
  for _ in $(seq 1 60); do
    "${COMPOSE[@]}" exec -T browser curl -sf -o /dev/null https://auth.vm.test/realms/master/.well-known/openid-configuration && break
    sleep 2
  done
  log "Infrastruktur prüfen (E2E-0.1)"
  "${COMPOSE[@]}" exec -T browser lpstat -d
  "${COMPOSE[@]}" exec -T browser curl -s -o /dev/null -w 'Druckservice: HTTP %{http_code}\n' http://127.0.0.1:17631/v1/status || true
  oracle infra
}

fixtures() {
  mkdir -p "$RUN/logs"
  "${COMPOSE[@]}" --profile tools build tools
  "${COMPOSE[@]}" --profile tools run --rm -T --no-deps tools src/generate-fixtures.mjs /e2e/fixtures
}

cmd=${1:-}
shift || true
mkdir -p "$RUN"/{out,findings,logs,mcp}
case $cmd in
  up) up "$@" ;;
  fixtures) fixtures ;;
  phase) phase "${1:?Phase fehlt}" ;;
  oracle) oracle "${1:?Check fehlt}" ;;
  report) report ;;
  all)
    up "$@"
    for p in 1 2a 2b 3 4 5 6a 6b 6c; do phase "$p" || echo "Phase $p mit Befunden"; done
    report
    ;;
  down) "${COMPOSE[@]}" down -v --remove-orphans ;;
  *) sed -n '2,13p' "$0"; exit 2 ;;
esac
