# VM-Web Neustart – Anforderungsdokument

2026-11-14 · @Vaxance

## Zusammenfassung & Ziele

VM-Web wird als Neustart gebaut: ein Verein pro Installation, Anmeldung nur über einen eigenen Identity-Server, und Musiker:innen sehen ohne Zusatzrechte automatisch die Noten ihrer Stimmen. Eine Datenmigration aus der alten Version ist nicht vorgesehen.

- **Musiker:innen** kommen in zwei Klicks an die Noten ihrer Stimmen – als Mappe, Event-Setlist oder Einzelstück, als ZIP oder einzeln.
- **Notenwart:innen** pflegen Stücke, Stimmen und Freigaben, ohne das Datenmodell kennen zu müssen.
- **Rechte** bleiben feingranular, gelten pro Ensemble und kommen mit mitgelieferten Standardrollen (`defaults/roles.default.json`).
- **Drucken**: kleine Aufträge über den Druckdialog des Browsers, große Aufträge wie ganze Mappen über einen neuen Druckservice, den jede:r lokal auf dem eigenen Linux-Rechner installiert.
- **Oberfläche**: Zard UI, responsiv für Desktop, Tablet und Mobil, zunächst Lightmode. Gestaltung nach der [VM-Web Design Guideline](https://claude.ai/artifact/LDi95rWoEnHsFZeFaobAWS).

Anforderungen tragen IDs (z. B. R-2), damit sie in Issues und Pull Requests referenziert werden können. „Muss“ gilt für die erste Version, „Soll“ ist erwünscht, „Später“ ist bewusst verschoben.

## Ausgangslage: Schwachstellen der aktuellen Version

Die größten Reibungspunkte stecken im Rechtemodell, in der Anmeldung und in der Trennung von Stimmen und Instrumenten. Grundlage ist der Stand von `MusikzugSN/VM-Web` (Branch main).

| # | Problem heute | Fundstelle im Code | Folge für den Neustart |
| --- | --- | --- | --- |
| 1 | „Mein Bereich“ zeigt Mappen, Events und Tags nur mit Verwaltungsrechten | `me/app-me-layout.component.ts` prüft `OpenMusicFolder`, `OpenEvent`, `OpenTags` | Mitgliedschaft reicht (R-2) |
| 2 | Musiker:innen haben keine hinterlegte Stimme, der Filter liegt nur im Browser-Cookie | `unverified-voice-filter`-Cookie, `User` ohne Stimmen | Stimmen im Profil (M-1) |
| 3 | Stimmen und Instrumente sind zwei Tabellen, der Name wird zusammengesetzt | `Stimmen-Instrumente`, `instrumentName + name` | Eine Liste, Instrument automatisch (N-7) |
| 4 | Passwort und OAuth laufen parallel, mit zwei widersprüchlichen Schaltern | `loginSettigs`: „Passwort Login für OAuth Benutzer erlauben“ / „Passwort Login deaktivieren“ | Nur OIDC (A-1) |
| 5 | Die OAuth-Kennung wird im Benutzerdialog von Hand eingetragen | `app-user-data-dialog`: Felder Anbieter, OAuth Kennung, Passwort | Zuordnung nur über Login (A-4) |
| 6 | 52 Einzelrechte, „Öffnen“ und „Auflisten“ getrennt ohne erkennbaren Unterschied | `PermissionType`, 11 Bereiche × bis zu 5 Aktionen | 4 Aktionen + Standardrollen (R-3, R-5) |
| 7 | Begriffe uneinheitlich: Rollen-Dialog fragt nach „Gruppenname“, „Vereinsgruppe“ ist unklar | `app-role-data-dialog`, Ordner `goups`, `loginSettigs` | Glossar: Ensemble, Rolle (R-1) |
| 8 | Benutzer haben nur einen Benutzernamen, keinen Anzeigenamen und keine E-Mail | `User`-Interface | Name/E-Mail aus dem IdP (A-4) |
| 9 | Druckeinstellungen existieren, sind aber ausgeblendet | `isPrintConfAllowed = signal(false)` | Neues Druckkonzept (D-1 bis D-7) |
| 10 | PDF-Zuschneiden ist eine eigene Seite, Prüfen ist Liste plus Einzelansicht | `crop-pdf`, `unverified`, `verify-sheet` | Eine Prüfansicht mit Zuschneiden (N-12) |
| 11 | Erstinstallation läuft über einen Pseudo-Benutzer „Install“ mit Adminrechten | `auth.service.ts` | Automatischer Erststart (S-5) |

## Rollen, Ensembles & Rechte

Rechte bleiben feingranular und gelten pro Ensemble, aber Mitglied-Sein reicht für „Mein Bereich“, und mitgelieferte Standardrollen machen das Modell ohne Einarbeitung nutzbar.

**Begriffe**: *Ensemble* ersetzt „Vereinsgruppe“ (z. B. Hauptorchester, Jugendorchester). *Rolle* ist ein benanntes Bündel von Rechten. *Mitglied* ist eine Person in einem Ensemble mit genau einer Rolle dort.

1. **R-1 (Muss)** Eine Person kann Mitglied in mehreren Ensembles sein, mit je eigener Rolle.
2. **R-2 (Muss)** Mitgliedschaft gibt ohne weiteres Recht Lesezugriff auf „Mein Bereich“: alle für Mein Bereich freigegebenen Mappen und Events des Ensembles, die Vereins-Tags und alle darin enthaltenen Stücke in den eigenen Stimmen. Dafür ist kein Recht auf „Stücke“ nötig.
3. **R-3 (Muss)** Pro Bereich gibt es vier Aktionen: Sehen, Anlegen, Bearbeiten, Löschen. „Öffnen“ und „Auflisten“ werden zu „Sehen“ zusammengelegt. Dazu kommen Einzelrechte ohne CRUD-Schema, z. B. „Noten freigeben“ und „Mitglieder sehen“.
4. **R-4 (Muss)** Fachrechte (Stücke, Mappen, Events, Tags, Prüfung, Mitglieder sehen) gelten pro Ensemble. Systemrechte (Benutzer, Rollen, Ensembles, Konfiguration) gelten vereinsweit. Elemente ohne Ensemble (Stücke, Stimmen, Vereins-Tags) sehen und bearbeiten alle, die das passende Recht in mindestens einem Ensemble haben; Mappen und Events nur in den Ensembles, in denen das Recht besteht.
5. **R-5 (Muss)** Die Datei `defaults/roles.default.json` wird mit ausgeliefert und beim ersten Start importiert. Admins können die Rollen danach ändern und jederzeit auf den Standard zurücksetzen.
6. **R-6 (Muss)** Ein Admin-Kennzeichen bleibt als Notfallzugang mit allen Rechten erhalten.
7. **R-7 (Muss)** Die Rechte-Matrix zeigt Bereiche als Zeilen und Aktionen als Spalten mit Checkboxen, statt einer langen Liste.

Vorschlag für die Standardrollen:

| Rolle | Gilt für | Darf |
| --- | --- | --- |
| Musiker:in | Ensemble | Mein Bereich (implizit), fehlende Stimmen hochladen (mit Prüfung), persönliche Tags |
| Notenwart:in | Ensemble | Stücke, Stimmen, Mappen, Events, Vereins-Tags verwalten; Noten freigeben |
| Vorstand | Ensemble | Mitglieder des eigenen Ensembles sehen (keine vereinsweite Benutzerverwaltung), Events verwalten |
| Administrator:in | Verein | Alles, inklusive Benutzer, Rollen, Ensembles und Konfiguration |

Skizze der Datei:

```json
{
  "version": 1,
  "roles": [
    { "key": "musician", "name": "Musiker:in", "scope": "ensemble", "default": true,
      "permissions": ["sheet.upload", "tag.personal"] },
    { "key": "librarian", "name": "Notenwart:in", "scope": "ensemble",
      "permissions": ["score.*", "voice.*", "folder.*", "event.*", "tag.*", "sheet.approve"] }
  ]
}
```

## Anmeldung über eigenen Identity-Server

VM-Web meldet nur noch über OpenID Connect bei einem vereinseigenen Identity-Server an (z. B. Keycloak, Authentik oder Pocket ID) und speichert keine Passwörter mehr. Für alle drei werden Beispielkonfigurationen mitgeliefert.

1. **A-1 (Muss)** Genau ein OIDC-Anbieter ist konfiguriert (Issuer-URL, Client-ID), Ablauf Authorization Code mit PKCE.
2. **A-2 (Muss)** Die Anmeldeseite zeigt Vereinslogo, Banner und einen Button „Mit Vereinskonto anmelden“. Optional leitet sie direkt zum Identity-Server weiter.
3. **A-3 (Muss)** Bei der ersten Anmeldung wird das Konto automatisch angelegt, mit der Standardrolle aus R-5 im konfigurierten Standard-Ensemble. Nach der Anmeldung landet man standardmäßig in Mein Bereich; eine eigene Seite dazwischen gibt es nicht.
4. **A-4 (Muss)** Name, E-Mail und Profilbild kommen aus den Claims (`name`, `email`, `picture`) und werden bei jedem Login aktualisiert. Die Zuordnung läuft über den `sub`-Claim und wird nie von Hand eingetragen.
5. **A-5 (Muss)** Admins können ein Konto in VM-Web sperren, unabhängig vom Identity-Server.
6. **A-6 (Soll)** Abmelden beendet auch die Sitzung beim Identity-Server (RP-initiated Logout).
7. **A-7 (Später)** Ensembles und Rollen aus Gruppen-Claims des Identity-Servers übernehmen.

Entfällt komplett: Passwort-Login, Passwortfelder, Anbieter-Auswahl, Feld „OAuth Kennung“ und die beiden Passwort-Schalter in den Logineinstellungen.

## Mein Bereich

Mitglieder sehen ohne weitere Rechte die freigegebenen Mappen, Events und Tags ihrer Ensembles, automatisch gefiltert auf die Stimmen in ihrem Profil.

1. **M-1 (Muss)** Im Profil stehen eine oder mehrere Stimmen (z. B. „Trompete 1 in B“ und „Flügelhorn“). Ist noch keine gesetzt, fragt VM-Web beim ersten Besuch danach.
2. **M-2 (Muss)** Alle Listen zeigen nur die Notenblätter der eigenen Stimmen. Die Stimme steht sichtbar in der Kopfzeile und lässt sich dort jederzeit auf eine andere Stimme umschalten, z. B. als Aushilfe; das Profil bleibt dabei unverändert.
3. **M-3 (Muss)** Hinterlegte Ersatzstimmen werden immer zusätzlich zur eigenen Stimme angezeigt, nachrangig und markiert (z. B. „Ersatz: Horn in Es“). Fehlen eigene Stimme und Ersatzstimmen, steht dort „Stimme fehlt“ mit der Möglichkeit zum Hochladen.
4. **M-4 (Muss)** Mappen: Stücke mit Nummer, Titel, Komponist und Seitenzahl, sortiert nach Nummer, mit Suche über Titel und Komponist.
5. **M-5 (Muss)** Events als Setlist: Datum, Name und die Stücke in Spielreihenfolge. Kommende Events stehen oben, vergangene wandern ins Archiv.
6. **M-6 (Muss)** Download: ein Stück als PDF; eine ganze Mappe, ein Event oder eine Auswahl als ZIP mit einem PDF pro Stück, benannt nach „Nr – Titel – Stimme.pdf“.
7. **M-7 (Muss)** Drucken aus jeder Liste, Ablauf siehe Drucken.
8. **M-8 (Muss)** Vereins-Tags dienen als Filter; persönliche Tags vergibt jede:r für sich, sie sind nur für die Person selbst sichtbar.
9. **M-9 (Muss)** „Fehlende Stimme hochladen“ direkt am Stück; der Upload geht in die Prüfung (N-10).
10. **M-10 (Später)** Benachrichtigung bei neuen oder geänderten Noten, Offline-Nutzung als installierbare Web-App.

## Notenverwaltung

Notenwart:innen pflegen Stücke mit frei definierbaren Feldern, eine einzige Stimmenliste statt zwei Tabellen und eine Prüfwarteschlange für alle Uploads.

### Stücke und eigene Felder

1. **N-1 (Muss)** Feste Felder: Titel (Pflicht), Komponist, Arrangeur, Verlag, Verlagsnummer, Dauer.
2. **N-2 (Muss)** Eigene Felder: Admins und Notenwart:innen legen Felder in der Konfiguration oder direkt beim Anlegen eines Stücks an mit Name, Typ (Text, Zahl, Datum, Auswahl, Mehrfachauswahl, Link, Ja/Nein), Pflicht ja/nein und Reihenfolge. Beispiele: Schwierigkeitsgrad, Archivnummer, Hörprobe.
3. **N-3 (Muss)** Eigene Felder verhalten sich wie feste: im Formular, als ein- und ausblendbare Tabellenspalte, filter-, sortier- und durchsuchbar, im Export.
4. **N-4 (Muss)** Jedes Stück zeigt seine Vollständigkeit: vorhandene Stimmen gegenüber der Besetzung des Ensembles (z. B. 18/24), mit Liste der fehlenden.
5. **N-5 (Muss)** Ein Stück kann in mehreren Mappen stehen, mit eigener Nummer je Mappe; in Mappen-Ansichten steht diese Nummer hervorgehoben vor dem Titel.
6. **N-19 (Muss)** CSV-Import von Stücken (Altdaten): Notenwart:innen laden eine CSV-Datei hoch (UTF-8 oder Windows-1252, Trennzeichen `,` oder `;` automatisch erkannt, erste Zeile = Spaltennamen) und ordnen jeder Spalte ein Ziel zu: ein festes Feld, ein eigenes Feld, ein neu angelegtes eigenes Feld (Auswahloptionen entstehen aus den Werten der Datei), „Mappe“ oder „Nummer in der Mappe“ – oder „nicht importieren“.
   - Die Mappe kommt aus einer Spalte oder ist ein fester Name; fehlende Mappen werden im gewählten Ensemble angelegt.
   - Werte werden beim Import umgewandelt: Leerzeichen am Rand fallen weg, Ja/Nein (`true`, `ja`, `x`, `1` …), Zahlen mit Komma, Datum `TT.MM.JJJJ`, Dauer `m:ss`, Mehrfachauswahl durch Komma getrennt.
   - Eine Vorschau zeigt je Zeile, ob das Stück neu ist oder schon existiert (gleicher Titel, bei gesetztem Komponisten auch gleicher Komponist). Standard bei Treffer: verknüpfen – Mappen-Eintrag ergänzen und nur leere Felder füllen; je Zeile umstellbar auf überschreiben, neu anlegen oder überspringen. Gleiche Stücke innerhalb einer Datei werden zusammengeführt.
   - Recht: Stücke anlegen und bearbeiten; für Mappen zusätzlich das Mappen-Recht im Ensemble. Die Zuordnung wird im Browser pro Spaltenname gemerkt.

### Stimmen und Instrumente

1. **N-6 (Muss)** Das Datenmodell bleibt Instrument plus Stimme, die Oberfläche zeigt aber eine Liste („Trompete 1 in B“), gruppiert nach Instrument.
2. **N-7 (Muss)** Beim Anlegen einer Stimme wird das Instrument mit Autovervollständigung eingetippt; gibt es es noch nicht, wird es automatisch angelegt.
3. **N-8 (Muss)** Eine Besetzungs-Vorlage (Standard-Blasorchester) wird mitgeliefert und wird beim ersten Start importiert und lässt sich später mit einem Klick erneut übernehmen.
4. **N-9 (Muss)** Jede Stimme hat eine geordnete Liste von Ersatzstimmen (z. B. Horn in F → Horn in Es). Sie wird in Mein Bereich (M-3) und bei der Vollständigkeit (N-4) genutzt.

### Upload und Prüfung

1. **N-10 (Muss)** Alle Mitglieder dürfen hochladen. Uploads von Personen mit dem Recht „Noten freigeben“ sind sofort sichtbar, alle anderen landen unter „Ungeprüft“.
2. **N-11 (Muss)** Hochladen ist ein Dialog, erreichbar aus Notenverwaltung, Stück und Mein Bereich. Er erlaubt Mehrfach-Upload: mehrere PDFs auf einmal, die Stimme wird aus dem Dateinamen vorgeschlagen und vor dem Absenden bestätigt.
3. **N-12 (Muss)** Prüfansicht auf einem Bildschirm: Warteschlange, PDF-Vorschau mit Blättern, Drehen und Zuschneiden, Zuordnung von Stück und Stimme, „Annehmen & weiter“ und „Ablehnen“ mit Begründung. Die eigene Seite zum Zuschneiden entfällt.
4. **N-13 (Soll)** Tastenkürzel in der Prüfansicht: A annehmen, R ablehnen, Pfeiltasten blättern.
5. **N-14 (Muss)** Die hochladende Person sieht den Status ihrer Uploads, inklusive Ablehnungsgrund, in VM-Web. Eine Benachrichtigung per E-Mail kommt später.
6. **N-18 (Muss)** Sammel-PDF aufteilen: Im Upload-Dialog lässt sich jede PDF mit „Aufteilen …“ in einem Viewer öffnen. Man scrollt durch die Seiten und legt an einer Seite fest „ab hier: Stück X, Stimme Y“; die Werte gelten bis zur nächsten Änderung. Gewechselt wird nur an Seitengrenzen, Seiten (z. B. Deckblatt) können übersprungen werden. Fehlt ein Stück, wird es mit dem Recht „Stücke anlegen“ direkt im Viewer angelegt, sonst bleibt es leer und die Prüfung ordnet zu. Die Abschnitte ersetzen die PDF in der Upload-Liste und werden wie normale Uploads behandelt (N-10).

### Mappen, Events und Tags

1. **N-15 (Muss)** Mappen und Events gehören zu einem Ensemble und haben einen Schalter „in Mein Bereich anzeigen“.
2. **N-16 (Muss)** Events haben Datum und eine Setlist, deren Reihenfolge per Drag & Drop festgelegt wird.
3. **N-17 (Muss)** Vereins-Tags werden von Notenwart:innen gepflegt; persönliche Tags sind davon getrennt (M-8).

## Drucken & lokaler Druckservice

VM-Web erzeugt immer ein druckfertiges PDF; kleine Aufträge gehen an den Druckdialog des Browsers, große wie ganze Mappen an einen Druckservice, den jede:r lokal auf dem eigenen Linux-Rechner installiert. Es gibt keine Druckaufträge an entfernte Drucker über den Server.

[eingebetteter Inhalt]

1. **D-1 (Muss)** Jeder Druck basiert auf einem PDF, das VM-Web passend aufbereitet: Papierformat, Ränder, Seitenreihenfolge und Leerseiten für beidseitigen Druck.
2. **D-2 (Muss)** Aufträge unter einer konfigurierbaren Seitengrenze (Standard: bis 10 Seiten) öffnen den Druckdialog des Browsers.
3. **D-3 (Muss)** Größere Aufträge (Mappen, Events, mehrere Stimmen) schickt der Browser direkt an den lokalen Druckservice. Läuft keiner, zeigt VM-Web eine Warnung mit Installationsanleitung und bietet den Druckdialog des Browsers an.
4. **D-4 (Muss)** Der Druckservice ist eine eigene, neu zu bauende Komponente in TypeScript/Node, die auf dem Rechner der Person läuft und nur auf localhost lauscht. Er nimmt nur Aufträge von der eingetragenen VM-Web-Adresse an (Origin-Prüfung) und druckt auf einen lokal gewählten Drucker. Im MVP nur Linux über CUPS; die Druckausgabe liegt hinter einer Schnittstelle, damit Windows später als zweite Umsetzung dazukommt.
5. **D-5 (Muss)** Der Druckdialog zeigt den Status jedes Auftrags: wartend, druckt, fertig, Fehler. Der Druckservice führt einen lokalen Verlauf, den die Seite „Druckverlauf“ anzeigt.
6. **D-6 (Soll)** Wie ein Stück aufs Blatt kommt, legt jedes Ensemble als Druckregeln nach Seitenzahl fest („1 Seite → einseitig“, „2 Seiten → ein Blatt beidseitig“, „ab 4 Seiten → beidseitig, Leerseite bei ungerader Zahl“). VM-Web bereitet das PDF danach auf; der Druckdialog zeigt die Regeln nur an und fragt nichts mehr ab.
7. **D-7 (Muss)** Alle Mitglieder dürfen den Druckservice nutzen; ein eigenes Recht dafür gibt es nicht.

## Systemverwaltung & Konfiguration

Die Systemverwaltung schrumpft auf Benutzer, Ensembles, Rollen und eine Konfigurationsseite, weil Passwörter und Anbieter-Verwaltung wegfallen.

1. **S-1 (Muss)** Benutzer: Liste mit Name, E-Mail, Ensembles und Rollen, Stimmen, Status und letzter Anmeldung. Aktionen: Rolle je Ensemble zuweisen, Stimmen vorbelegen, sperren.
2. **S-2 (Muss)** Ensembles: anlegen, umbenennen, archivieren; je Ensemble eine Besetzung (Stimmenliste) für die Vollständigkeit (N-4) und Druckregeln nach Seitenzahl (D-6).
3. **S-3 (Muss)** Rollen: Rechte-Matrix (R-7), Standardrollen aus R-5 mit „Auf Standard zurücksetzen“.
4. **S-4 (Muss)** Konfiguration: Vereinsname, Logo, Anmelde-Banner, Impressum- und Datenschutz-Link, Standard-Ensemble und Standardrolle für neue Konten, Seitengrenze für den Browser-Druck (Standard 10 Seiten), VM-Web-Adresse für die Origin-Prüfung des Druckservice. OIDC-Zugangsdaten kommen aus Umgebungsvariablen.
5. **S-5 (Muss)** Kein Setup-Assistent und kein Pseudo-Benutzer „Install“: Beim ersten Start werden Standardrollen und Besetzungs-Vorlage automatisch importiert, die erste angemeldete Person wird Admin und pflegt die Vereinsdaten danach in der Konfiguration.
6. **S-6 (Soll)** Änderungsprotokoll für Rechte, Freigaben und Löschungen (wer, was, wann).

## Seiten & Unterseiten

VM-Web gliedert sich in fünf Bereiche mit 31 Seiten und zwei Dialogen; Mein Bereich ist für jedes Mitglied ohne weiteres Recht erreichbar (R-2), alle anderen Bereiche erscheinen nur mit dem passenden Recht.

[eingebetteter Inhalt]

Detailseiten (›) öffnen sich aus ihrer Liste; der Druckdialog ist keine eigene Seite, sondern aus jeder Liste erreichbar.

### Öffentlich & Einstieg

| Seite | Unterseiten & Ansichten | Route (Vorschlag) | Zugang | Anforderungen |
| --- | --- | --- | --- | --- |
| Anmeldung | Vereinslogo, Banner, „Mit Vereinskonto anmelden“; optional Direktweiterleitung | `/login` | alle | A-1, A-2 |
| Konto gesperrt | Hinweis mit Kontakt zum Verein | `/gesperrt` | gesperrte Konten | A-5 |
| Fehlerseiten | Nicht gefunden, Kein Zugriff | `/404`, `/kein-zugriff` | alle | – |

### Mein Bereich

| Seite | Unterseiten & Ansichten | Route (Vorschlag) | Zugang | Anforderungen |
| --- | --- | --- | --- | --- |
| Start | kommende Events, freigegebene Mappen, Status eigener Uploads; beim ersten Besuch Dialog „Stimmen wählen“ | `/me` | Mitglied | M-1, M-2, M-5 |
| Mappen | Liste der freigegebenen Mappen | `/me/mappen` | Mitglied | R-2, M-4 |
| Mappe | Stücke mit Nr., Titel, Komponist, Seiten; Suche; ZIP, Drucken; Ersatz/fehlt-Hinweise | `/me/mappen/:id` | Mitglied | M-3, M-4, M-6, M-7 |
| Events | Tabs Kommende / Archiv | `/me/events` | Mitglied | M-5 |
| Event | Setlist in Spielreihenfolge; ZIP, Drucken | `/me/events/:id` | Mitglied | M-5, M-6, M-7 |
| Tags | Vereins-Tags und persönliche Tags als Filter | `/me/tags`, `/me/tags/:id` | Mitglied | M-8 |
| Stück | PDF-Vorschau der eigenen Stimme; Download, Drucken, persönliche Tags; „Fehlende Stimme hochladen“ | `/me/stuecke/:id` | Mitglied | M-3, M-6, M-8, M-9 |
| Meine Uploads | Status je Upload inkl. Ablehnungsgrund | `/me/uploads` | Mitglied | N-14 |
| Profil | Name, E-Mail, Bild aus dem Identity-Server (nur lesen); eigene Stimmen; Ensembles & Rollen; Abmelden | `/profil` | Mitglied | M-1, A-4, A-6 |

### Notenverwaltung

| Seite | Unterseiten & Ansichten | Route (Vorschlag) | Zugang | Anforderungen |
| --- | --- | --- | --- | --- |
| Stücke | Tabelle mit festen und eigenen Feldern als Spalten, Filter, Suche, Vollständigkeit 18/24, Export | `/noten/stuecke` | Stücke: Sehen | N-1, N-3, N-4 |
| Stück anlegen | Formular mit festen und eigenen Feldern; „Feld hinzufügen“ legt ein neues eigenes Feld direkt im Formular an | `/noten/stuecke/neu` | Stücke: Anlegen | N-1, N-2 |
| Stück | Tabs: Stammdaten · Stimmen & Vollständigkeit (fehlende Stimmen) · Mappen & Nummern | `/noten/stuecke/:id` | Stücke: Sehen / Bearbeiten | N-1 bis N-5, N-9 |
| Hochladen | Mehrfach-Upload, Stimme aus Dateinamen vorgeschlagen, Bestätigung vor dem Absenden | kein eigener Pfad (Dialog) | Mitglied | N-10, N-11 |
| Prüfung | Warteschlange, PDF-Vorschau mit Blättern, Drehen, Zuschneiden; Zuordnung Stück/Stimme; Annehmen & weiter, Ablehnen mit Grund; Tastenkürzel | `/noten/pruefung`, `/noten/pruefung/:uploadId` | Noten freigeben | N-12, N-13 |
| Mappen | Liste je Ensemble, Schalter „in Mein Bereich anzeigen“ | `/noten/mappen` | Mappen: Sehen | N-15 |
| Mappe bearbeiten | Stücke mit eigener Nummer je Mappe | `/noten/mappen/:id` | Mappen: Bearbeiten | N-5, N-15 |
| Events | Liste je Ensemble, Schalter „in Mein Bereich anzeigen“ | `/noten/events` | Events: Sehen | N-15 |
| Event bearbeiten | Datum, Setlist per Drag & Drop mit Tastatur-Alternative | `/noten/events/:id` | Events: Bearbeiten | N-15, N-16 |
| Vereins-Tags | Tags anlegen, umbenennen, löschen | `/noten/tags` | Tags: Bearbeiten | N-17 |
| Stimmen & Instrumente | Eine Liste gruppiert nach Instrument, Autovervollständigung, Ersatzstimmen je Stimme | `/noten/stimmen` | Stimmen: Bearbeiten | N-6, N-7, N-9 |

### Drucken

| Seite | Unterseiten & Ansichten | Route (Vorschlag) | Zugang | Anforderungen |
| --- | --- | --- | --- | --- |
| Druckdialog | Dialog aus jeder Liste: Umfang, Stimmen, Druckregeln des Ensembles (nur Anzeige); zeigt vorab Browser-Druck oder Druckservice | kein eigener Pfad (Dialog) | Mitglied | D-1, D-2, D-3, D-6, D-7, M-7 |
| Druckverlauf | Lokaler Verlauf des Druckservice auf diesem Rechner: Wartend, Druckt, Fertig, Fehler; erneut senden; Installationsanleitung, wenn kein Druckservice läuft | `/druck` | Mitglied | D-3, D-5 |

### Systemverwaltung

| Seite | Unterseiten & Ansichten | Route (Vorschlag) | Zugang | Anforderungen |
| --- | --- | --- | --- | --- |
| Benutzer | Liste mit Name, E-Mail, Ensembles & Rollen, Stimmen, Status, letzter Anmeldung | `/system/benutzer` | Benutzer: Sehen | S-1 |
| Benutzer | Rolle je Ensemble zuweisen, Stimmen vorbelegen, sperren | `/system/benutzer/:id` | Benutzer: Bearbeiten | S-1, A-5, R-1 |
| Ensembles | Liste; anlegen, umbenennen, archivieren | `/system/ensembles` | Ensembles: Sehen | S-2 |
| Ensemble | Stammdaten, Besetzung (Stimmenliste), Mitglieder, Druck (Regeln nach Seitenzahl) | `/system/ensembles/:id` | Ensembles: Bearbeiten; Mitglieder auch mit „Mitglieder sehen“ im Ensemble | S-2, N-4, N-8 |
| Rollen | Liste mit Standardrollen | `/system/rollen` | Rollen: Sehen | S-3, R-5 |
| Rolle | Rechte-Matrix, Einzelrechte, „Auf Standard zurücksetzen“ | `/system/rollen/:id` | Rollen: Bearbeiten | R-3, R-4, R-7, S-3 |
| Konfiguration | Tabs: Verein & Anmeldung (Name, Logo, Banner, Impressum, Datenschutz) · Standardwerte (Ensemble, Rolle) · Drucken (Seitengrenze, VM-Web-Adresse für den Druckservice) · Eigene Felder (Name, Typ, Pflicht, Reihenfolge) | `/system/konfiguration` | Konfiguration; Tab Eigene Felder auch für Notenwart:innen | S-4, D-2, D-4, N-2 |
| Änderungsprotokoll | Rechte, Freigaben, Löschungen: wer, was, wann | `/system/protokoll` | Admin | S-6 (Soll) |

Die Routen sind ein Vorschlag für das Angular-Routing; Seiten ohne Recht werden in der Navigation ausgeblendet. „Hochladen“ ist ein Dialog (N-11) ohne eigenen Pfad.

## Nicht-funktionale Anforderungen

VM-Web bleibt selbst gehostet, ein Verein pro Installation, mit einer Oberfläche auf Basis von Zard UI.

| Bereich | Anforderung |
| --- | --- |
| Oberfläche | Angular mit [Zard UI](https://zardui.com/) (Tailwind CSS v4, Signals), Lightmode; Darkmode später. Gestaltung nach der [VM-Web Design Guideline](https://claude.ai/artifact/LDi95rWoEnHsFZeFaobAWS). |
| Technik | Nx-Monorepo mit pnpm und Node 24 LTS in einem neuen Repository. Frontend Angular mit Zard UI, Backend NestJS, Datenbank MySQL mit Drizzle. Ein gemeinsames Paket enthält Zod-Schemas für Requests und Responses sowie URL-Konstanten. PDFs erzeugt das Backend mit pdf-lib, die Vorschau im Browser läuft mit pdf.js. Unit-Tests mit Vitest. Ende-zu-Ende prüft ein KI-Testlauf die gebauten Images produktionsnah (Traefik, Keycloak, CUPS-PDF) mit Agenten als Admin, Notenwart:in und Musiker:innen; Akzeptanzkriterien in [e2e-acceptance.md](e2e-acceptance.md), Umgebung in `deploy/e2e`. Druckservice ebenfalls TypeScript/Node. |
| Responsiv | Desktop ab 1280 px mit fester Seitenleiste, Tablet 768–1279 px mit ausklappbarer Navigation, Mobil unter 768 px mit Karten statt Tabellen; Tippflächen mindestens 44 px. |
| Barrierefreiheit | Kontraste nach WCAG 2.2 AA, vollständig per Tastatur bedienbar, echte Buttons, Links und Labels. |
| Sprache | Deutsch, Texte über i18n-Dateien, damit weitere Sprachen möglich sind. |
| Betrieb | Ein Verein pro Installation; Auslieferung als Docker Compose mit Web, API und MySQL, PDFs auf einem Dateisystem-Volume hinter einer Speicher-Schnittstelle; TLS über den vorhandenen Reverse Proxy des Vereins; Konfiguration über Umgebungsvariablen. GitHub Actions prüft jeden Pull Request und veröffentlicht Images bei Releases in der GitHub Container Registry. Der Druckservice wird als Einzeldatei (Node SEA) mit Installationsskript für einen systemd-User-Service verteilt. |
| Datenschutz | Personendaten nur aus dem Identity-Server, Löschen eines Kontos entfernt alle persönlichen Daten (Profilstimmen, persönliche Tags). |
| Sicherung | Export von Datenbank und PDFs für Backups. |
| Lizenz | GPLv3, wie bisher. |

## MVP-Umfang & Abgrenzung

Die erste Version enthält Mein Bereich, Notenverwaltung mit Prüfung und den Druckservice; alles, was diese drei braucht (Anmeldung, Rechte, Grundverwaltung), ist automatisch dabei.

| Bereich | Erste Version | Später |
| --- | --- | --- |
| Mein Bereich | M-1 bis M-9 | Benachrichtigungen, Offline-Nutzung (M-10) |
| Notenverwaltung & Prüfung | N-1 bis N-19 | E-Mail bei Ablehnung (N-14) |
| Drucken | D-1 bis D-5, D-7, Druckservice für Linux | D-6, Druckservice für Windows |
| Anmeldung | A-1 bis A-5 | A-6, Rollen aus dem Identity-Server (A-7) |
| Rechte | R-1 bis R-7 | – |
| Systemverwaltung | S-1 bis S-5 | Änderungsprotokoll (S-6) |
| Oberfläche | Lightmode, responsiv | Darkmode |
| Daten | Neustart; Stücke und Mappen per CSV-Import (N-19) | Import von Noten-PDFs aus Altdaten |

## Entscheidungen & Annahmen

Alle neun offenen Punkte sind entschieden; offen bleibt nur die Feinabstimmung der Standardrollen.

| Frage | Entscheidung | Eingearbeitet in |
| --- | --- | --- |
| Backend-Stack | TypeScript-Backend mit gemeinsamem Paket für Request-/Response-Modelle und URL-Konstanten, MySQL | Nicht-funktionale Anforderungen |
| Identity-Server | Beispielkonfigurationen für Keycloak, Authentik und Pocket ID | Anmeldung |
| Druckservice | Lokal bei jeder Person, nur Linux (CUPS), TypeScript/Node; Windows über eine zweite Umsetzung der Druckschnittstelle vorbereitet; keine entfernten Druckaufträge | D-3, D-4, D-5 |
| Seitengrenze | Standard 10 Seiten | D-2, S-4 |
| Ersatzstimmen | Immer zusätzlich, nachrangig markiert | M-3 |
| Fremde Stimme | Frei umschaltbar in der Kopfzeile | M-2 |
| Vorstand | Bleibt, pro Ensemble: Mitglieder sehen, Events verwalten | R-3, R-4, Standardrollen |
| Ablehnung | Erst nur in VM-Web, E-Mail später | N-14 |
| Altdaten | CSV-Import für Stücke und Mappen mit Spaltenzuordnung; Sammel-PDFs werden im Upload-Dialog aufgeteilt | N-18, N-19, MVP-Umfang |

Zusätzlich geklärt: Alle Mitglieder dürfen den Druckservice nutzen (D-7), die Rechte-Matrix gehört ins MVP (R-7), Hochladen ist ein Dialog, Elemente ohne Ensemble gelten für alle mit dem Recht in mindestens einem Ensemble (R-4), und der Druckverlauf ersetzt die Druckwarteschlange.

**Annahmen**

- Bestätigt: „Keine Seitenanzahlen“ war als „kleine Seitenanzahlen“ gemeint (D-2).
- Bestätigt: Persönliche Tags sind nur für die Person selbst sichtbar (M-8).
- Offen: Die Standardrollen in R-5 sind ein Vorschlag und werden vor dem Bau abgestimmt.
