# KI-Testlauf 1 – Befunde nachprüfen

Stand 22.11.2026. Das System aus dem Lauf läuft noch, mit allen Daten: Keycloak-Realm, fünf Konten, 11 Stücke, Konzertmappe, Event „Frühlingskonzert“, 20 Notenblätter, Carlas geprüfte Uploads.

**Update:** Die Befunde 1 bis 4 sind behoben, und das Web-Image im laufenden System ist bereits aktualisiert.
- **1:** Ein gemerktes neues Feld wird auf das inzwischen angelegte Feld abgebildet.
- **2:** Im Stimmen-Menü gibt es „Andere Stimme …“ mit allen Stimmen; das Profil bleibt unverändert.
- **3:** „Aushilfe“ erscheint nur noch bei einer fremden Stimme.
- **4:** Die PDF-Vorschau zeichnet nur noch neu, wenn sich die Breite ändert, und zwar im nächsten Frame.

Die Schritte unten zeigen deshalb jetzt das korrigierte Verhalten.

## 1. Zugang einrichten (einmalig)

**Hosts-Einträge.** PowerShell **als Administrator** öffnen und ausführen:

```powershell
Add-Content -Path "$env:windir\System32\drivers\etc\hosts" -Value "`n127.0.0.1 vm.test auth.vm.test"
```

Danach `https://vm.test` öffnen. Der Browser warnt zweimal vor dem Zertifikat, einmal für `vm.test` und einmal beim Login für `auth.vm.test`. Beide Male „Erweitert → Weiter zu …“ wählen. Das Zertifikat stammt von der Test-CA des Laufs.

Ohne Warnungen geht es, wenn du `deploy/e2e/run/vm-e2e-ca.crt` unter Windows als vertrauenswürdige Stammzertifizierungsstelle importierst. Das ist optional; die CA gilt nur für `vm.test` und `auth.vm.test`. Lösche sie nach dem Test wieder.

**Konten** (Passwörter auch in `deploy/e2e/agents/accounts.json`):

| Rolle | Benutzer | Passwort |
| --- | --- | --- |
| Admin | `admin` | `Admin-e2e-1` |
| Notenwart:in | `notenwart` | `Notenwart-e2e-1` |
| Musiker A (Trompete 1) | `musiker-a` | `MusikerA-e2e-1` |
| Musiker B (Horn 1 in F) | `musiker-b` | `MusikerB-e2e-1` |
| Musiker C (Klarinette 1) | `musiker-c` | `MusikerC-e2e-1` |

Für einen Rollenwechsel ein privates Fenster nutzen oder in VM-Web **und** in Keycloak abmelden. VM-Web beendet die Keycloak-Sitzung beim Abmelden noch nicht (A-6).

Keycloak-Admin: `https://auth.vm.test/admin/`, Benutzer `kcadmin`, Passwort `kcadmin-e2e`.

## 2. Ergebnis der Prüfung

| # | Befund aus dem Lauf | Urteil | Ursache |
| --- | --- | --- | --- |
| 1 | CSV-Import: „Genre“ beim zweiten Import wieder „Neues eigenes Feld“, Fehler „Ein neues Feld heißt wie ein bestehendes …“ | **Echter Fehler** | `initialMapping` übernimmt die gemerkte Zuordnung „neu“, auch wenn das Feld inzwischen existiert ([import-model.ts:106](../../apps/web/src/app/features/library/scores/import/import-model.ts:106)) |
| 2 | Stimme in der Kopfzeile nicht auf „Trompete 2 in B“ umschaltbar | **Echte Lücke zu M-2** | Der Umschalter bietet nur die eigenen Profilstimmen an ([voice-switcher.ts:46](../../apps/web/src/app/core/layout/voice-switcher.ts:46)). Um auszuhelfen, musste der Agent die Stimme ins Profil aufnehmen; das Profil von Musiker B hat jetzt zwei Stimmen |
| 3 | „Aushilfe“ an der eigenen Stimme „Horn 1 in F“ | **Echter Fehler (Anzeige)** | Jede Auswahl im Umschalter gilt als Aushilfe, auch eine eigene Profilstimme ([me.service.ts:50](../../apps/api/src/me/me.service.ts:50)). Folge von Befund 2 |
| 4 | Konsole: „ResizeObserver loop completed with undelivered notifications“ (Notenansicht, Prüfung) | **Echt, harmlos** | PDF-Vorschau und Prüfansicht zeichnen bei jeder Größenänderung neu; das Neuzeichnen ändert die Größe des beobachteten Rahmens erneut ([pdf-viewer.ts:132](../../apps/web/src/app/shared/ui/pdf-viewer.ts:132), [review-preview.ts:90](../../apps/web/src/app/features/library/review/review-preview.ts:90)). Keine sichtbare Wirkung, aber ein Fehler in der Konsole |
| 5 | Setlist: Drag & Drop ändert die Reihenfolge nicht | **Unklar, bitte von Hand prüfen** | Angular CDK Drag & Drop reagiert oft nicht auf die synthetischen Mausbewegungen von Playwright. Die Pfeil-Buttons funktionierten |
| 6 | „Dateien auswählen“ von einem `<p>` überdeckt | **Kein Fehler** | Der sichtbare Text ist ein `<label>` um ein unsichtbares Datei-Feld. Der Agent hat das unsichtbare Feld angeklickt; für Menschen funktioniert das Label |
| – | Fehlende Blätter (Trompete 2 in B, Horn 1 in Es), keine Ersatzstimme bei Musiker B, „Tuba“ | **Fehler im Testaufbau** | Dateinamen standen nicht im Auftrag, die Stimme heißt „Tuba in C“; beides korrigiert |
| – | Browser-Einzeldrucke fehlen in der CUPS-Ausgabe | **Bekannt, akzeptiert** | Kiosk-Druck von Chromium unter Playwright schickt keinen Auftrag |

## 3. Was du dir anschauen solltest

### Befund 1 – CSV-Import merkt sich „neues Feld“ (Notenwart:in)

Die Zuordnung wird pro Browser gespeichert. In deinem Browser musst du den Fehler deshalb einmal selbst auslösen:

1. Als `notenwart` anmelden → Notenverwaltung → Stücke → CSV importieren.
2. `deploy/e2e/fixtures/generated/gruen.csv` wählen. Spalte „Genre“ auf **Neues eigenes Feld** stellen, Name `Stil`, Typ Auswahl. Vorschau → Importieren. Vorhandene Stücke werden nur verknüpft, das schadet nicht.
3. Dieselbe Datei noch einmal importieren.
4. **Erwartet:** „Genre“ ist auf das vorhandene Feld „Stil“ vorbelegt. **Tatsächlich:** „Neues eigenes Feld: Stil“ und die Fehlermeldung „Ein neues Feld heißt wie ein bestehendes …“; „Vorschau anzeigen“ ist gesperrt.

### Befund 2 und 3 – Aushelfen in einer fremden Stimme (Musiker B)

1. Als `musiker-b` anmelden. Oben rechts zeigt der Stimmen-Button die aktiven Stimmen.
2. Menü öffnen. Dort stehen nur „Alle meine Stimmen“, „Horn 1 in F“ und „Trompete 2 in B“. Trompete 2 steht da nur, weil der Agent sie ins Profil aufgenommen hat.
3. **M-2 verlangt:** jede Stimme frei wählbar, Profil bleibt unverändert. Eine Auswahl fremder Stimmen gibt es nicht.
4. „Horn 1 in F“ wählen. Der Button zeigt „Aushilfe“, obwohl es die eigene Stimme ist.
5. Zum Gegencheck: Profil öffnen, Trompete 2 in B entfernen. Danach gibt es im Menü nur noch eine Stimme und keinen Weg, auszuhelfen.

### Befund 4 – ResizeObserver (beliebiges Konto)

1. Entwicklerwerkzeuge öffnen (F12 → Konsole).
2. Mein Bereich → Konzertmappe → „Heimatgrüße“ öffnen, dann das Fenster schmaler und breiter ziehen.
3. Die Meldung „ResizeObserver loop completed with undelivered notifications“ erscheint, die Vorschau bleibt aber in Ordnung. Dasselbe passiert in der Prüfansicht der Notenwart:in.

### Befund 5 – Setlist per Drag & Drop (Notenwart:in)

1. Notenverwaltung → Events → „Frühlingskonzert“ bearbeiten.
2. Einen Eintrag am Griff greifen und an eine andere Stelle ziehen.
3. Klappt es mit der echten Maus, war es die Automatisierung. Dann hat der Lauf keinen Fehler gefunden. Danach die Reihenfolge wiederherstellen: Auf zum Start, Festliche Intrade, Am Ufer der Adria, Heimatgrüße, Waldzauber.

### Befund 6 und Browser-Druck – kurz gegenprüfen

- Notenwart:in → ein Stück → „Noten hochladen“ → auf „Dateien auswählen“ klicken. Der Dateidialog muss aufgehen.
- Musiker A → Konzertmappe → „Heimatgrüße“ drucken. Der Druckdialog des Browsers muss erscheinen, nicht der Druckservice-Hinweis.

### Daten vervollständigen (optional, zeigt Ersatzstimmen)

Als `notenwart` diese drei Dateien in einem Vorgang hochladen (Ordner `deploy/e2e/fixtures/generated/uploads/`):

- `Festliche Intrade - Trompete 2 in B.pdf`
- `Auf zum Start - Trompete 2 in B.pdf`
- `Am Ufer der Adria - Horn 1 in Es.pdf`

Danach als `musiker-b`: Konzertmappe → „Am Ufer der Adria“ muss mit „Ersatz: Horn 1 in Es“ erscheinen (M-3).

## 4. Aufräumen

```bash
cd deploy/e2e && ./run.sh down     # in WSL; löscht alle Daten des Laufs
```

Danach die Zeile `127.0.0.1 vm.test auth.vm.test` wieder aus der Hosts-Datei entfernen. Falls du die Test-CA importiert hast, lösche auch sie.
