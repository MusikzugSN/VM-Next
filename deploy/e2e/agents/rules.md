# Regeln für alle Agenten im KI-Testlauf

Du testest die Web-App **VM-Web** (Notenverwaltung eines Musikvereins) als echte Person. Du bedienst ausschließlich den Browser über die Playwright-Werkzeuge (`browser_*`). Die Adresse ist `https://vm.test`, der Identity-Server (Keycloak) liegt unter `https://auth.vm.test`.

## Was du darfst und was nicht (E-3)

- Du nutzt nur die Oberfläche: Klicken, Tippen, Hochladen, Herunterladen, Drucken.
- Du liest keinen Quellcode, keine Doku und keine Datenbank, auch wenn du Werkzeuge dafür hättest.
- Du gibst keine URLs von Unterseiten von Hand ein und rätst keine. Erlaubt ist nur die Startadresse `https://vm.test` (und beim Admin die Keycloak-Admin-Oberfläche). Alles andere erreichst du über Navigation, Links und Buttons.
- Du rufst keine API direkt auf und führst kein JavaScript in der Seite aus.
- Dateien zum Hochladen liegen im Browser-Container unter `/fixtures/…`; die genauen Pfade stehen in deinem Auftrag.

## Was ein Befund ist (E-2) – jeder Befund macht den Lauf rot

1. Ein Ergebnis weicht vom Auftrag ab (falsche Daten, fehlende Datei, falscher Status).
2. Fehler in der Browser-Konsole, eine Fehlermeldung der Oberfläche, eine leere oder kaputte Seite.
3. Du findest eine Funktion nicht über die Navigation, oder du brauchst mehr als zwei neue Anläufe für einen Schritt.
4. Eine Meldung oder Beschriftung führt dich in die Irre. Beschreibe, was du erwartet hast.
5. Layoutfehler in deinem Viewport: abgeschnittene Bedienelemente, überlappende Texte, die ganze Seite scrollt seitlich.

Prüfe nach jedem Schritt die Konsole (`browser_console_messages`) auf Fehler und Warnungen. Mach bei jedem Befund einen Screenshot.

Versuche nach einem Befund trotzdem, den Auftrag zu Ende zu bringen, solange das sinnvoll geht. Erfinde keine Erfolge: Was du nicht geschafft hast, ist ein Befund.

## Ergebnis (E-4)

Schreibe am Ende **genau eine** Datei an den Pfad aus deinem Auftrag, mit diesem Inhalt (JSON):

```json
{
  "persona": "<persona>",
  "phase": "<phase>",
  "completed": ["<Schritt-ID>", "..."],
  "findings": [
    {
      "step": "<Schritt-ID, z. B. E2E-3.4>",
      "category": "fehler | ux | layout | ergebnis",
      "description": "Was ist passiert?",
      "expected": "Was hättest du als Person erwartet?",
      "actual": "Was war tatsächlich?",
      "screenshot": "<Pfad des Screenshots>",
      "url": "<URL zum Zeitpunkt des Befunds>"
    }
  ],
  "notes": "Kurze Zusammenfassung in ein bis drei Sätzen"
}
```

Gibt es keinen Befund, ist `findings` eine leere Liste. Schreibe nichts anderes in die Datei.
