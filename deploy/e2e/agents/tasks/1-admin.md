# Auftrag Phase 1 – Admin

**Persona:** Du bist Alex, die Systemadministration des Musikvereins. Du richtest VM-Web für den Verein ein. Du kennst dich mit Keycloak aus, VM-Web siehst du heute zum ersten Mal.

**Viewport:** Desktop. **Ergebnisdatei:** `run/findings/agent-1-admin.json`

## Zugänge
- Keycloak-Admin-Oberfläche: `https://auth.vm.test/admin/` – Benutzer `kcadmin`, Passwort `kcadmin-e2e`
- Dein späteres VM-Web-Konto: Benutzer `admin`, Passwort `Admin-e2e-1`

## Ziele

**E2E-1.1 Keycloak einrichten.** Lege in Keycloak an:
- Realm `verein`.
- Client `vm-web` für VM-Web: OpenID Connect, Anmeldung über Authorization Code mit PKCE, **ohne** Client-Secret (öffentlicher Client, „Client authentication“ aus). Gültige Redirect-URI `https://vm.test/internal/v1/auth/callback`, Web-Origin `https://vm.test`.
- Diese fünf Benutzer, jeweils aktiviert, E-Mail als bestätigt markiert, festes Passwort (nicht temporär), **keine** Pflichtaktionen:

| Benutzer | Vorname | Nachname | E-Mail | Passwort |
| --- | --- | --- | --- | --- |
| admin | Alex | Admin | admin@vm.test | Admin-e2e-1 |
| notenwart | Nora | Notenwart | notenwart@vm.test | Notenwart-e2e-1 |
| musiker-a | Anton | Trompete | musiker-a@vm.test | MusikerA-e2e-1 |
| musiker-b | Bea | Horn | musiker-b@vm.test | MusikerB-e2e-1 |
| musiker-c | Carla | Klarinette | musiker-c@vm.test | MusikerC-e2e-1 |

Melde dich danach aus der Keycloak-Admin-Oberfläche ab.

**E2E-1.2 Erste Anmeldung.** Öffne `https://vm.test` und melde dich mit dem Vereinskonto `admin` an. Du solltest als erste Person automatisch Administrator:in werden und in „Mein Bereich“ landen. Prüfe, dass dein Name aus Keycloak angezeigt wird.

**E2E-1.3 Ensemble.** Lege das Ensemble „Hauptorchester“ an und übernimm dafür die Besetzung „Standard-Blasorchester“.

**E2E-1.4 Standardwerte.** In der Konfiguration:
- Standard-Ensemble für neue Konten: „Hauptorchester“
- Standardrolle für neue Konten: „Musiker:in“
- VM-Web-Adresse für den Druckservice: `https://vm.test`

Das ist wichtig: Ab Werk würde jede neue Anmeldung Administrator:in. Prüfe nach dem Speichern, dass die Werte wirklich übernommen sind (Seite neu laden).

Melde dich am Ende **nicht** ab; dein Browser bleibt für Phase 2 offen.
