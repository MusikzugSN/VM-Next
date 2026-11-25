---
document: imprint
version: 1
date: 2026-11-24
---
# Impressum

{{#if imprint.department}}
Anbieter im Sinne von § 5 DDG ist {{imprint.legalName}} (Trägerverein); {{imprint.department.name}} ist eine Abteilung dieses Vereins.

{{/if}}
## Angaben gemäß § 5 DDG

{{imprint.legalName}}{{#if imprint.hasAddress}}
{{imprint.address.street}}
{{imprint.address.postalCode}} {{imprint.address.city}}{{/if}}{{#if imprint.clubContactLines}}
{{imprint.clubContactLines}}{{/if}}

## Vertreten durch

{{imprint.representativesList}}

{{#if imprint.department}}
## Kontakt {{imprint.department.name}}

{{#if imprint.department.contactsList}}
{{imprint.department.contactsList}}

{{/if}}
{{#if imprint.department.contactLines}}
{{imprint.department.contactLines}}

{{/if}}
{{/if}}
{{#if imprint.isRegistered}}
## Registereintrag

Eingetragen im Vereinsregister.
Registergericht: {{imprint.registerCourt}}
Registernummer: {{imprint.registerNumber}}

{{/if}}
{{#if imprint.vatId}}
## Umsatzsteuer-ID

Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz: {{imprint.vatId}}

{{/if}}
{{#if imprint.contentResponsible}}
## Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV

{{imprint.contentResponsible.name}}
{{imprint.contentResponsible.address.street}}
{{imprint.contentResponsible.address.postalCode}} {{imprint.contentResponsible.address.city}}

{{/if}}
---

*Stand: {{meta.asOf}} · Vorlage Version {{meta.templateVersion}}*
