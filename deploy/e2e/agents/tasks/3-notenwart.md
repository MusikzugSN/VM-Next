# Auftrag Phase 3 – Notenwart:in pflegt die Noten

**Persona:** Du bist Nora, die Notenwartin (siehe Phase 2a). Alex hat dir gerade die Rolle Notenwart:in gegeben. Heute überträgst du die Altdaten und lädst die ersten Noten hoch.

**Viewport:** Desktop. **Ergebnisdatei:** `run/findings/agent-3-notenwart.json`

## Zugang
Du bist noch angemeldet (`https://vm.test`). Falls nicht: Benutzer `notenwart`, Passwort `Notenwart-e2e-1`.

## Dateien (im Browser-Container)
- `/fixtures/konzertmappe.csv`, `/fixtures/gruen.csv` – Altdaten
- `/fixtures/uploads/*.pdf` – 15 Einzelstimmen, Dateiname „Titel - Stimme.pdf“
- `/fixtures/sammel.pdf` – Sammel-PDF mit Deckblatt

## Ziele

**E2E-2.2 (Gegenprobe)** Lade die Seite neu, **ohne** dich neu anzumelden. Die Notenverwaltung muss jetzt sichtbar sein.

**E2E-3.1 CSV-Import Konzertmappe.** Importiere `/fixtures/konzertmappe.csv` ins Hauptorchester mit dieser Zuordnung:
- „Titel“ → Titel, „Komponist“ → Komponist, „Arrangeur“ → Arrangeur, „Verlag“ → Verlag
- „Genre“ → **neues** eigenes Feld „Genre“ vom Typ Auswahl
- „Notenbücher“ → Mappe, „_Nummer“ → Nummer in der Mappe
- alle anderen Spalten → nicht importieren

Sieh dir die Vorschau an, bevor du importierst. Notiere in `notes`, wie viele Stücke neu angelegt werden.

**E2E-3.2 CSV-Import Grünes Marschbuch.** Importiere `/fixtures/gruen.csv` mit derselben Zuordnung, aber „Genre“ → das **vorhandene** Feld „Genre“ und „Grün“ → Nummer in der Mappe (statt „_Nummer“). Prüfe: Sind die Zuordnungen für bekannte Spalten schon vorbelegt? Werden Stücke, die es schon gibt, als vorhanden erkannt und standardmäßig verknüpft?

**E2E-3.3 Einzel-Upload.** Lade diese 15 Dateien **in einem Vorgang** hoch (alle Pfade auf einmal an die Dateiauswahl übergeben):
- `/fixtures/uploads/Am Ufer der Adria - Horn 1 in Es.pdf`
- `/fixtures/uploads/Am Ufer der Adria - Trompete 1 in B.pdf`
- `/fixtures/uploads/Auf zum Start - Horn 1 in F.pdf`
- `/fixtures/uploads/Auf zum Start - Klarinette 1 in B.pdf`
- `/fixtures/uploads/Auf zum Start - Trompete 1 in B.pdf`
- `/fixtures/uploads/Auf zum Start - Trompete 2 in B.pdf`
- `/fixtures/uploads/Festliche Intrade - Horn 1 in F.pdf`
- `/fixtures/uploads/Festliche Intrade - Klarinette 1 in B.pdf`
- `/fixtures/uploads/Festliche Intrade - Trompete 1 in B.pdf`
- `/fixtures/uploads/Festliche Intrade - Trompete 2 in B.pdf`
- `/fixtures/uploads/Heimatgrüße - Horn 1 in F.pdf`
- `/fixtures/uploads/Heimatgrüße - Klarinette 1 in B.pdf`
- `/fixtures/uploads/Heimatgrüße - Trompete 1 in B.pdf`
- `/fixtures/uploads/Waldzauber - Horn 1 in F.pdf`
- `/fixtures/uploads/Waldzauber - Trompete 1 in B.pdf`

 Prüfe, ob die Stimme aus dem Dateinamen vorgeschlagen wird; ordne jede Datei dem Stück aus ihrem Namen zu. Danach sollen die Noten sofort freigegeben sein, nicht in der Prüfung.

**E2E-3.4 Sammel-PDF aufteilen.** Lade `/fixtures/sammel.pdf` hoch und teile es im Upload-Dialog auf. Seite 1 ist ein Deckblatt und wird übersprungen. Danach folgen (jede Seite trägt oben „Titel – Stimme“):
- „Preussens Gloria“: Posaune 1 in C (2 Seiten), Tuba in C (1 Seite)
- „Der Petersburger“: Posaune 1 in C (1), Tuba in C (2)
- „Testpolka E2E“: Posaune 1 in C (2), Tuba in C (1). Dieses Stück gibt es noch nicht; lege es direkt im Viewer an.

**E2E-3.5 Mappe und Event.**
- Die Mappe „Konzertmappe“ soll in „Mein Bereich“ angezeigt werden.
- Lege im Hauptorchester das Event „Frühlingskonzert“ an, Datum in etwa zwei Monaten, in „Mein Bereich“ sichtbar. Setlist in genau dieser Reihenfolge, per Drag & Drop sortiert: 1. Auf zum Start, 2. Festliche Intrade, 3. Am Ufer der Adria, 4. Heimatgrüße, 5. Waldzauber.

**E2E-3.6 Vollständigkeit.** Sieh dir bei „Am Ufer der Adria“ an, welche Stimmen fehlen. Klarinette 1 in B muss als fehlend erscheinen. Notiere die angezeigte Vollständigkeit (z. B. „3/32“) in `notes`.

**E2E-3.7 Mappendruck.** Drucke die ganze Konzertmappe für die Stimme „Trompete 1 in B“. Der Auftrag ist größer als die Seitengrenze und muss an den lokalen Druckservice gehen. Verfolge den Status im Druckdialog bis „fertig“ und prüfe, dass der Auftrag im Druckverlauf steht.
