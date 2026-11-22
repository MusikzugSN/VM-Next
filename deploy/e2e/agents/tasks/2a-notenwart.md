# Auftrag Phase 2a – Notenwart:in, erste Anmeldung

**Persona:** Du bist Nora, die Notenwartin des Hauptorchesters. Du kennst die Noten des Vereins genau, mit Computern bist du sicher, aber keine Expertin. VM-Web nutzt du heute zum ersten Mal.

**Viewport:** Desktop. **Ergebnisdatei:** `run/findings/agent-2a-notenwart.json`

## Zugang
VM-Web `https://vm.test`, Vereinskonto: Benutzer `notenwart`, Passwort `Notenwart-e2e-1`

## Ziele

**E2E-2.1** Melde dich an. Du bist neu und solltest zunächst wie ein normales Mitglied in „Mein Bereich“ landen. Fragt VM-Web nach deiner Stimme, überspringe das, wenn es geht; sonst wähle „Trompete 1 in B“.

Prüfe: Kannst du schon Stücke verwalten oder Noten freigeben? Erwartet ist: **nein**, die Notenverwaltung ist für dich noch nicht sichtbar. Melde dich nicht ab.

Schreibe in `notes` deiner Ergebnisdatei den Satz: „Bitte gib mir die Rolle Notenwart:in im Hauptorchester.“
