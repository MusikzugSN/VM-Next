# Releases und Bugfixes

Versionen folgen SemVer und stehen als Tag `vX.Y.Z` im Repo; die `package.json` im Wurzelverzeichnis trägt die Version (Images, Druckservice, `GET /v1/status`). Jede Minor-Version bekommt einen eigenen Zweig `release/X.Y`, auf dem nur Bugfixes landen.

```
master ──●──●──●──●──●──●──●──►            Features, nächste Minor-Version
          \           ↑ Fix zuerst hier
           release/1.2 ──●─────────●──►    nur Bugfixes (Backports)
                         v1.2.0    v1.2.1
```

Bugfixes gibt es vorerst nur für die neueste Minor-Version.

## Neue Version (Minor/Major)

Actions › **Release: Start** › *Run workflow* auf `master`, `minor` oder `major` wählen (für die erste Version `1.0.0` ins Feld *version* eintragen).

Der Workflow prüft (Lint, Typecheck, Tests, Build), legt `release/X.Y` an, setzt die Version `X.Y.0`, taggt `vX.Y.0` und startet **Release: Build and publish**.

## Bugfix

1. Fix wie immer per PR auf `master`.
2. Den PR mit dem Label `backport release/X.Y` versehen (vor oder nach dem Merge). Nach dem Merge öffnet **Backport** einen PR mit dem Cherry-Pick gegen `release/X.Y`. Bei Konflikten wird er als Entwurf angelegt; dann Konflikte im Zweig des PRs lösen.
   Ohne Label von Hand: `git switch release/X.Y && git switch -c fix/… && git cherry-pick -x <sha>` und PR gegen `release/X.Y`.
3. Backport-PR mergen, sobald CI grün ist.
4. Actions › **Release: Bugfix** › *Use workflow from:* `release/X.Y` › *Run workflow*. Er nimmt die nächste freie Patch-Version `X.Y.Z+1`.

Mehrere Fixes können vor einem Bugfix-Release gesammelt werden.

### Datenbank-Migrationen in Bugfixes

Möglichst vermeiden. Drizzle wendet Migrationen nach ihrer Position an; gäbe es auf `release/1.2` eine andere `0007` als auf `master`, könnte eine Installation nicht von 1.2.x auf 1.3.0 wechseln. Deshalb:

- Eine nötige Migration landet zuerst auf `master` und wird **unverändert** zurückportiert, zusammen mit allen Migrationen, die auf `master` davor liegen.
- CI prüft auf `release/*` (`.github/scripts/check-migrations.mjs`), dass die Migrationen des Zweigs genau die ersten N von `master` sind.

## Was ein Release erzeugt

| Ergebnis | Wo |
| --- | --- |
| `ghcr.io/musikzugsn/vm-next-api` und `vm-next-web`, `linux/amd64` + `linux/arm64` | Tags `X.Y.Z`, `X.Y` und `latest` (nur wenn es die höchste Version ist; ein Bugfix für eine ältere Linie verschiebt `latest` nicht) |
| Druckservice `vm-web-print-X.Y.Z-linux-{x64,arm64}.tar.gz` | GitHub Release |
| `docker-compose.yml`, `env.example`, `SHA256SUMS` | GitHub Release |

Ist ein Lauf beim Bauen abgebrochen, **Release: Build and publish** von Hand mit derselben Version starten. Er baut den vorhandenen Tag neu und ersetzt die Dateien im Release.

## Einmalige Einrichtung auf GitHub

- **Settings › Actions › General › Workflow permissions:** „Read and write permissions“ (Tags, Zweige, Releases, Pakete).
- **Pakete:** Nach dem ersten Release unter *Packages* `vm-next-api` und `vm-next-web` öffentlich stellen, wenn Vereine ohne Anmeldung ziehen sollen, und mit dem Repo verknüpfen.
- **Branch-Regeln** (Settings › Rules) für `master` und `release/*`: PR nötig, Status-Check *Lint, typecheck, test, build* (auf `release/*` zusätzlich *Migrations match master*).
  Der Release-Workflow schreibt den Versions-Commit direkt auf `release/*`. Wenn die Regel das verhindert, eine GitHub App oder einen fine-grained PAT (Contents: write) als Secret `RELEASE_TOKEN` hinterlegen und in der Regel als Ausnahme eintragen.
- **Optional `BACKPORT_TOKEN`:** PRs, die mit dem Standard-Token geöffnet werden, starten kein CI. Ein App-Token oder PAT (Contents + Pull requests: write) behebt das; sonst den Backport-PR einmal schließen und wieder öffnen.
- **arm64-Runner** (`ubuntu-24.04-arm`) für den Druckservice: in öffentlichen Repos kostenlos. Stehen sie nicht zur Verfügung, den arm64-Eintrag in `release-build.yml` entfernen.
