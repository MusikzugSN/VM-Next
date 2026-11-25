---
document: privacy
version: 1
date: 2026-11-24
---
# Datenschutzerklärung

Diese Datenschutzerklärung gilt für „VM-Web“, die Notenverwaltung von {{#if imprint.department}}{{imprint.department.name}}, einer Abteilung von {{/if}}{{imprint.legalName}} (im Folgenden „Verein“). VM-Web steht nur Mitgliedern des Vereins zur Verfügung, die sich über das Vereinskonto anmelden. Ohne Anmeldung sind nur die Anmeldeseite, das Impressum und diese Datenschutzerklärung erreichbar.

## Verantwortlicher

Verantwortlich für die Verarbeitung personenbezogener Daten im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:

{{imprint.legalName}}{{#if imprint.hasAddress}}
{{imprint.address.street}}
{{imprint.address.postalCode}} {{imprint.address.city}}{{/if}}{{#if imprint.clubContactLines}}
{{imprint.clubContactLines}}{{/if}}

Vertreten durch:

{{imprint.representativesList}}

{{#if imprint.department}}
Kontakt {{imprint.department.name}}:

{{#if imprint.department.contactsList}}
{{imprint.department.contactsList}}

{{/if}}
{{#if imprint.department.contactLines}}
{{imprint.department.contactLines}}

{{/if}}
{{/if}}
{{#if privacy.dataProtectionOfficer}}
## Datenschutzbeauftragte:r

{{privacy.dataProtectionOfficer.name}}
{{privacy.dataProtectionOfficer.contact}}

{{/if}}
## Hosting und Server-Logs

{{#if privacy.hosting.isProvider}}
VM-Web wird auf Servern von {{privacy.hosting.provider.name}}, {{privacy.hosting.provider.address}}, betrieben. Der Serverstandort ist {{privacy.hosting.countryName}}.{{#if privacy.hosting.dpaConcluded}} Mit dem Anbieter besteht ein Vertrag zur Auftragsverarbeitung nach Art. 28 DSGVO; er verarbeitet die Daten nur nach unserer Weisung.{{/if}}
{{else}}
VM-Web wird vom Verein selbst auf einem eigenen Server betrieben. Der Serverstandort ist {{privacy.hosting.countryName}}.
{{/if}}

Bei jedem Aufruf von VM-Web verarbeitet der Server technisch notwendige Daten, die Ihr Browser übermittelt:

- IP-Adresse
- Datum und Uhrzeit des Aufrufs
- aufgerufene Adresse und Art der Anfrage
- Statuscode der Antwort und übertragene Datenmenge
- Browser und Betriebssystem (User-Agent)

Diese Daten werden in Server-Logs gespeichert, um den sicheren und stabilen Betrieb zu gewährleisten, Fehler zu finden und Missbrauch abzuwehren. Rechtsgrundlage ist unser berechtigtes Interesse nach Art. 6 Abs. 1 lit. f DSGVO. Die Server-Logs werden nach {{privacy.serverLogRetentionDays}} Tagen gelöscht.

VM-Web lädt keine Inhalte von fremden Servern nach. Schriftarten und alle übrigen Dateien werden von unserem Server ausgeliefert. Es gibt keine Werbung und kein Tracking.

## Anmeldung über das Vereinskonto

Die Anmeldung läuft über den Identity-Server des Vereins (Anmeldeverfahren OpenID Connect). VM-Web selbst speichert keine Passwörter.
{{#if privacy.identityServer.isProvider}}
Der Identity-Server wird von {{privacy.identityServer.provider.name}}, {{privacy.identityServer.provider.address}}, betrieben. Der Standort ist {{privacy.identityServer.countryName}}.
{{else}}
Der Identity-Server wird vom Verein selbst betrieben. Der Standort ist {{privacy.identityServer.countryName}}.
{{/if}}

Bei der Anmeldung übermittelt der Identity-Server an VM-Web:

- eine eindeutige Kennung Ihres Kontos (`sub`)
- Ihren Namen
- Ihre E-Mail-Adresse
- die Adresse Ihres Profilbilds, falls vorhanden

VM-Web legt beim ersten Login automatisch ein Konto an und aktualisiert Name, E-Mail-Adresse und Profilbild bei jeder Anmeldung. Gespeichert werden außerdem der Zeitpunkt der letzten Anmeldung und ob das Konto gesperrt ist. Ihr Profilbild lädt Ihr Browser direkt vom Identity-Server; dabei erhält dieser Ihre IP-Adresse.

Die Daten dienen dazu, Sie anzumelden, Ihnen die für Sie bestimmten Inhalte zu zeigen und Ihre Aktionen in VM-Web Ihnen zuzuordnen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Mitgliedschaft und Nutzung von VM-Web).

## Cookies

VM-Web setzt nur technisch notwendige Cookies:

- `vmweb_session`: hält Sie angemeldet. Die Sitzung endet nach {{session.idleDays}} Tagen ohne Nutzung, spätestens nach {{session.maxDays}} Tagen, oder wenn Sie sich abmelden.
- `XSRF-TOKEN`: schützt Formulare vor Missbrauch durch fremde Webseiten (Cross-Site-Request-Forgery). Gültig für die Dauer der Sitzung.

Während der Anmeldung wird für höchstens zehn Minuten eine vorläufige Sitzung gespeichert, damit die Antwort des Identity-Servers sicher zugeordnet werden kann.

Diese Cookies sind für den von Ihnen gewünschten Dienst unbedingt erforderlich. Eine Einwilligung ist dafür nach § 25 Abs. 2 Nr. 2 TDDDG nicht nötig. Die Verarbeitung der Daten stützt sich auf Art. 6 Abs. 1 lit. b DSGVO.

{{> modules}}
## Empfänger

Innerhalb des Vereins sehen nur Personen Ihre Daten, die sie für ihre Aufgabe in VM-Web brauchen, zum Beispiel die Notenverwaltung oder die Administration.

{{#if privacy.anyProvider}}
Folgende Dienstleister verarbeiten Daten für uns, soweit es für den Betrieb nötig ist:

{{#if privacy.hosting.isProvider}}
- Hosting: {{privacy.hosting.provider.name}}
{{/if}}
{{#if privacy.identityServer.isProvider}}
- Identity-Server: {{privacy.identityServer.provider.name}}
{{/if}}

{{/if}}
Eine darüber hinausgehende Weitergabe an Dritte findet nicht statt.

## Speicherdauer

Wir speichern Ihre Daten, solange Ihr Konto in VM-Web besteht. Wird Ihr Konto gelöscht, entfernen wir Ihre persönlichen Daten. Inhalte, die Sie für den Verein beigetragen haben, bleiben ohne Ihren Namen erhalten. Server-Logs löschen wir nach {{privacy.serverLogRetentionDays}} Tagen.

Zur Sicherung erstellen wir Backups. Gelöschte Daten können darin noch bis zu {{privacy.backupRetentionDays}} Tage enthalten sein, bis das Backup überschrieben wird.

## Pflicht zur Bereitstellung

Die Nutzung von VM-Web ist freiwillig. Ohne die oben genannten Daten aus dem Vereinskonto können wir Ihnen VM-Web aber nicht zur Verfügung stellen. Eine automatisierte Entscheidungsfindung einschließlich Profiling nach Art. 22 DSGVO findet nicht statt.

## Ihre Rechte

Sie haben gegenüber dem Verein das Recht auf

- Auskunft über Ihre gespeicherten Daten (Art. 15 DSGVO),
- Berichtigung unrichtiger Daten (Art. 16 DSGVO),
- Löschung (Art. 17 DSGVO),
- Einschränkung der Verarbeitung (Art. 18 DSGVO),
- Datenübertragbarkeit (Art. 20 DSGVO).

Name, E-Mail-Adresse und Profilbild verwalten Sie in Ihrem Vereinskonto beim Identity-Server; VM-Web übernimmt Änderungen bei der nächsten Anmeldung. Für alle anderen Anliegen wenden Sie sich an die oben genannten Kontaktdaten.

**Widerspruchsrecht:** Soweit wir Daten auf Grundlage berechtigter Interessen verarbeiten (Art. 6 Abs. 1 lit. f DSGVO), können Sie dieser Verarbeitung aus Gründen, die sich aus Ihrer besonderen Situation ergeben, jederzeit widersprechen (Art. 21 DSGVO).

## Beschwerderecht

Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren (Art. 77 DSGVO). Zuständig für den Verein ist:

{{authority.name}}
{{authority.address}}
{{authority.website}}

{{#if privacy.additionalText}}
## Ergänzungen

{{privacy.additionalText}}

{{/if}}
---

*Stand: {{meta.asOf}} · Vorlage Version {{meta.templateVersion}}*
