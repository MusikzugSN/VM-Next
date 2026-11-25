# Vorlagen für Impressum und Datenschutzerklärung (S-7)

Die Texte sind Muster, keine Rechtsberatung. Der Verein bleibt für die Richtigkeit verantwortlich.

## Dateien

| Datei | Inhalt |
| --- | --- |
| `imprint.de.md` | Impressum |
| `privacy.de.md` | Rahmen der Datenschutzerklärung mit den Abschnitten, die immer gelten (Modul `base`) |
| `privacy.<modul>.de.md` | Abschnitt eines `LegalModule`, eingesetzt an der Stelle `{{> modules}}` |
| `supervisory-authorities.json` | Aufsichtsbehörden der 16 Länder (nicht-öffentlicher Bereich) |

Jede Vorlage beginnt mit einem Kopf:

```yaml
---
document: privacy        # imprint | privacy
module: library          # nur bei Modul-Abschnitten
version: 1               # Ganzzahl, wird bei jeder inhaltlichen Änderung erhöht
date: 2026-11-24
---
```

Die Version der Datenschutzerklärung ist die Version von `privacy.de.md`. Ändert sich ein Modul-Abschnitt, steigt auch sie. Ein Test (`legal-templates.spec.ts`) vergleicht die Inhalte mit `versions.lock.json` und schlägt fehl, wenn sich ein Text ohne neue Version ändert. Nach einer Änderung: `version` und `date` im Kopf erhöhen und den Hash, den der Test ausgibt, in `versions.lock.json` eintragen. Erst „Übernehmen“ in der Konfiguration macht die neue Version in einer Installation gültig.

## Geplante Änderungen

- **Speicherdauer der Original-Uploads** (Modul `library`): Sobald der Wartungsjob die Originale nach der Prüfentscheidung löscht (api.md, Annahme 7), nennt der Abschnitt „Notenbereich“ die Frist. Das wird Vorlage Version 2 der Datenschutzerklärung; Installationen übernehmen sie über „Neue Vorlage übernehmen“.

## Syntax

Der Renderer kann nur Platzhalter und Bedingungen. Alles andere ist Markdown.

| Syntax | Bedeutung |
| --- | --- |
| `{{imprint.legalName}}` | Wert einsetzen. HTML- und Markdown-Zeichen werden immer escaped. |
| `{{#if pfad}} … {{/if}}` | Block nur, wenn der Wert gesetzt ist. Nicht gesetzt: `null`, `false`, leerer Text, leere Liste. Zahlen gelten immer als gesetzt, auch `0`. |
| `{{#if pfad}} … {{else}} … {{/if}}` | mit Alternative; verschachtelbar |
| `{{> modules}}` | nur in `privacy.de.md`: Abschnitte der aktiven Module in Registry-Reihenfolge. Wird vor dem Rendern zusammengesetzt, kein Platzhalter. |

Ein unbekannter Pfad ist ein Fehler beim Laden der Vorlage (Test), kein leerer Text. Fehlt ein Pflichtwert, erscheint in der Vorschau „[fehlt: …]“; veröffentlicht wird dann nicht.

Einzelne Zeilenumbrüche werden als Zeilenumbruch übernommen (Anschriften).

## Werte

| Pfad | Herkunft |
| --- | --- |
| `imprint.*` | `imprintData` (siehe `libs/shared/src/lib/legal/legal.schema.ts`) |
| `imprint.representativesList` | berechnet: je Person ein Absatz „Name, Funktion“, darunter Anschrift, Telefon und E-Mail, soweit angegeben |
| `imprint.department`, `imprint.department.contactsList` | nur bei einer Abteilung: Name, E-Mail, Telefon und Ansprechpartner (wie oben) |
| `imprint.hasAddress` | berechnet: der Verein hat eine Anschrift (mindestens ein Teil ausgefüllt) |
| `imprint.clubContactLines` | berechnet: „Telefon: …“ / „E-Mail: …“ des Vereins, soweit angegeben; bei einer Abteilung leer |
| `imprint.department.contactLines` | berechnet: Telefon und E-Mail der Abteilung, soweit angegeben |
| `privacy.*` | `privacyData` |
| `privacy.hosting.isProvider`, `privacy.identityServer.isProvider`, `privacy.anyProvider` | berechnet aus `operator` |
| `privacy.hosting.countryName`, `privacy.identityServer.countryName` | Ländername zum ISO-Code |
| `authority.name`, `authority.address`, `authority.website` | aus `supervisory-authorities.json` zum Bundesland |
| `session.idleDays`, `session.maxDays` | `SESSION_IDLE_TTL_DAYS`, `SESSION_ABSOLUTE_TTL_DAYS` |
| `module.<key>` | `true`, wenn das Modul aktiv ist |
| `meta.asOf`, `meta.templateVersion` | Stand (TT.MM.JJJJ) und übernommene Vorlagenversion |
