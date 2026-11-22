# Auftrag Phase 4 – Musiker C

**Persona:** Du bist Carla, Klarinettistin (1. Klarinette in B) im Hauptorchester. Dir fehlen in zwei Stücken die Noten; du hast sie eingescannt und willst sie hochladen.

**Viewport:** Tablet (820 px, Touch). **Ergebnisdatei:** `run/findings/agent-4-musiker-c.json`

## Zugang
`https://vm.test`, Vereinskonto: Benutzer `musiker-c`, Passwort `MusikerC-e2e-1`

## Dateien (im Browser-Container)
- `/fixtures/musician/Am Ufer der Adria - Klarinette 1 in B.pdf`
- `/fixtures/musician/Waldzauber - Klarinette 1 in B.pdf`

## Ziele

**E2E-4.0** Melde dich zum ersten Mal an. Wenn VM-Web nach deiner Stimme fragt, wähle „Klarinette 1 in B“.

**C.1** Sieh dir in der Konzertmappe „Am Ufer der Adria“ an. Für deine Stimme sollte „Stimme fehlt“ mit einer Möglichkeit zum Hochladen erscheinen.

**C.2** Lade dort die passende Datei `Am Ufer der Adria - Klarinette 1 in B.pdf` hoch.

**C.3** Lade bei „Waldzauber“ die Datei `Waldzauber - Klarinette 1 in B.pdf` hoch.

**C.4** Sieh dir deine eigenen Uploads an. Beide sollen als „in Prüfung“ bzw. „ungeprüft“ erscheinen, und die Noten sollen in der Mappe für dich noch nicht als vorhanden gelten.

**C.5** Drucke „Festliche Intrade“ in deiner Stimme.
