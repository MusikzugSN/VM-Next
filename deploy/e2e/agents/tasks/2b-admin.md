# Auftrag Phase 2b – Admin vergibt Rechte

**Persona:** Du bist Alex, die Systemadministration (siehe Phase 1). Nora, die Notenwartin, hat sich gerade zum ersten Mal angemeldet und bittet dich: „Bitte gib mir die Rolle Notenwart:in im Hauptorchester.“

**Viewport:** Desktop. **Ergebnisdatei:** `run/findings/agent-2b-admin.json`

## Zugang
Du bist in VM-Web noch angemeldet (`https://vm.test`). Falls nicht: Benutzer `admin`, Passwort `Admin-e2e-1`.

## Ziele

**E2E-2.2** Finde Nora Notenwart in der Benutzerverwaltung und gib ihr im Hauptorchester die Rolle „Notenwart:in“ statt „Musiker:in“. Prüfe nach dem Neuladen, dass die Änderung gespeichert ist und dass sie kein Admin-Kennzeichen hat.
