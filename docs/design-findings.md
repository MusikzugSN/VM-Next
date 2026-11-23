# Design-Findings: Material Design 3 für VM-Web

Stand: 23.11.2026 · Basis: `feat/api-mvp` (`1a28bf6`) · Umfang: nur Design/Styling von `apps/web` (CSS, CSS-Variablen, Tailwind-Klassen, Darstellungs-Markup, Theming, UI-Basiskomponenten). Logik, Services, API und Backend sind nicht Teil dieser Übersicht.

Diese Datei ist die verbindliche Reihenfolge für die Design-Umbau-PRs: Grundlagen (Variablen, Größen, `vm-*`-Library) zuerst, danach Basiskomponenten, danach das Umstellen einzelner Seiten. Jeder Umbau-PR verweist auf die Themen-Nummer (`D-xx`).

## Inhalt

1. [Ausgangslage (Scan-Ergebnis)](#ausgangslage-scan-ergebnis)
2. [Rahmenbedingungen und Referenzen](#rahmenbedingungen-und-referenzen)
3. [Themen nach Priorität](#themen-nach-priorität)
4. [Geplantes Variablen-Set](#geplantes-variablen-set)
5. [Geplante vm-Komponenten](#geplante-vm-komponenten)
6. [Abweichungen vom --mat-sys-Schema](#abweichungen-vom---mat-sys-schema)
7. [Kontrastprüfung](#kontrastprüfung)
8. [Lib-Vorschläge (nicht umgesetzt)](#lib-vorschläge-nicht-umgesetzt)

## Ausgangslage (Scan-Ergebnis)

| Bereich | Befund |
| --- | --- |
| Variablen | `apps/web/src/styles.css` definiert 45 Farbvariablen im shadcn-Schema (`--background`, `--primary`, `--muted-foreground` …) plus eigene Erweiterungen (`--primary-soft`, `--brass*`, `--*-soft`, `--*-ink`, `--sidebar-*`). Kein einziges `--mat-sys-*`-Token. |
| Typografie | Keine Typografie-Tokens. Schriftgrößen direkt als Tailwind-Klassen: `text-xs` 90×, `text-[13px]` 55× in 30 Dateien, `text-lg` 36×, `text-2xl` 35×, `text-base` 22×, dazu Einzelwerte `text-[22px]`, `text-[32px]`, `text-[15px]`, `text-[11px]`, `text-[10px]`, `leading-[22px]`. Überschriften: `text-2xl font-semibold` (30×), `text-lg font-semibold` (28×). |
| Formen | Ein Basis-Radius `--radius: 10px`, abgeleitet `radius-sm/md/lg/xl` (6/8/10/14 px). Nutzung: `rounded-lg` 108×, `rounded-md` 74×, `rounded-full` 46×, `rounded-sm` 29×, `rounded` 18×; in Zard zusätzlich `rounded-[min(var(--radius-md),10px)]` u. ä. |
| Elevation | Zwei Schatten (`--shadow-sm`, `--shadow-lg`). Nutzung: `shadow-sm` 71×, `shadow-md` 5×, `shadow-lg` 3×, `shadow`, `shadow-xs`, `shadow-xl` je vereinzelt. Keine Stufenlogik. |
| Größen | `@theme`-Werte `--spacing-touch: 44px`, `--spacing-control: 36px`, `--spacing-header: 56px`, `--spacing-sidebar: 256px`, `--container-content: 1200px`. Höhen sonst als `h-11 xl:h-9`, `min-h-11 xl:min-h-8`, `size-8` direkt im Markup. Feste Breiten `max-w-[560px]`, `[520px]`, `[480px]`, `[360px]`, Höhen `max-h-[65dvh]` u. a. Icon-Größen als Zahlen (`size="14"` 9×, `"20"` 8×, `"8"`, `"12"`, `"18"`, `"24"`). |
| Komponenten | 33 Zard-Komponenten liegen in `apps/web/src/app/shared/components`, genutzt werden 9: `button` (47 Dateien), `input` (20), `native-select` (17), `sonner` (10), `dialog` (8), `dropdown` (5), `textarea` (3), `sheet` (2), `alert-dialog` (2). 24 sind ungenutzt (u. a. `card`, `checkbox`, `table`, `tabs`, `badge`, `switch`). Eigene Bausteine in `shared/ui` (`vm-form-dialog`, `vm-name-dialog`, `vm-status-badge`, `vm-toggle-switch`, `vm-search-field` …). |
| Hand-gebaute Muster | Karten als `rounded-lg border bg-card … shadow-sm` an 59 Stellen in 31 Dateien; 12 `<table>` in 10 Dateien; 17 native Checkboxen mit `accent-primary`; Zähler-Badges mit `text-[10px]`. |
| Hart codierte Farben | Keine Hex-Werte außerhalb von `styles.css`. Tailwind-Palette nur `bg-white` (3× für PDF-Papierdarstellung) und `bg-black/10`, `bg-black/30` (Scrims in Zard dialog/sheet/drawer/alert-dialog). |
| Fokus | Globaler `:focus-visible`-Ring (2 px `--ring`, 2 px Abstand) außerhalb aller Layer; parallel dazu Zard-eigene `focus-visible:ring-3 ring-ring/50`, deren Schatten global abgeschaltet wird. Funktioniert, ist aber doppelt definiert. |
| Zielgrößen | Steuerelemente 44 px (mobil) bzw. 36 px/32 px (ab `xl`). Einzelne Icon-Buttons fest `size-8` (32 px, z. B. Filter entfernen in `scores-page.html`, `folder-page.ts`). WCAG 2.5.8 (AA, 24 px) erfüllt; M3 empfiehlt 48 dp. |
| Farbe als Informationsträger | Status-Badges kombinieren Icon + Text + Farbe (gut). Zähler-Badges und gedimmte Vorschauen (`opacity-40`) tragen Zustand teils nur über Farbe/Transparenz. |
| Dark Mode | Nicht vorhanden (laut `docs/requirements.md` „später“); `@custom-variant dark` ist definiert, Zard enthält `dark:`-Klassen. |

## Rahmenbedingungen und Referenzen

- **Referenzen:** Die Seiten `m3.material.io` und `material.angular.dev/guide/theming` waren in diesem automatischen Lauf nicht abrufbar (Abruf-Freigabe im unbeaufsichtigten Lauf nicht erteilt). Namen und Werte der `--mat-sys-*`-Tokens, der M3-Typeskala, der Corner-, Elevation- und State-Layer-Werte stammen deshalb aus dem Wissensstand zu Material Design 3 und Angular Material (System-Variablen seit v18). Vor dem Umbau von D-01 bis D-03 gegen die Originalseiten gegenprüfen; Werte, bei denen das besonders nötig ist, sind mit „(prüfen)“ markiert.
- **Design Guideline:** Die bisherige [VM-Web Design Guideline](https://claude.ai/artifact/LDi95rWoEnHsFZeFaobAWS) nutzt das shadcn-Schema. Nach D-01 bis D-04 muss sie nachgezogen werden (D-22).
- **Werkzeuge:** Angular Material wird nicht installiert. Die Variablen werden selbst definiert und Tailwind v4 (`@theme`) sowie Zard darauf gemappt.
- **Qualitätssicherung:** CI (`.github/workflows/ci.yml`) läuft nur für PRs gegen `master` und `release/**`, nicht gegen `feat/api-mvp`. Lint, Typecheck, Tests und Build müssen daher vor jedem Umbau-PR lokal laufen: `pnpm nx run-many -t lint typecheck`, `pnpm nx run-many -t test`, `pnpm nx run-many -t build --configuration=production`.

## Themen nach Priorität

Aufwand: S ≈ bis 2 h, M ≈ halber Tag, L ≈ 1–2 Tage, XL ≈ mehr als 2 Tage.

### Übersicht

| Nr. | Titel | Prio | Kategorie | Aufwand | Abhängig von |
| --- | --- | --- | --- | --- | --- |
| D-01 | Farbrollen als `--mat-sys-*` und Mapping für Tailwind/Zard | hoch | Variablen | M | – |
| D-02 | Typografie-Tokens (M3-Typeskala) | hoch | Variablen | M | D-01 |
| D-03 | Formen, Elevation und State-Layer als Tokens | hoch | Variablen | S | D-01 |
| D-04 | Größen-Tokens (Abstände, Höhen, Icons, Layout) | hoch | Größen | M | D-01 |
| D-05 | Nx-Library `libs/ui` und Umzug der Zard-Basis | hoch | Basiskomponente | L | D-01–D-04 |
| D-06 | `vm-button` und `vm-icon-button` | hoch | Basiskomponente | L | D-05 |
| D-07 | Formularfelder: `vm-input`, `vm-textarea`, `vm-select`, `vm-field` | hoch | Basiskomponente | L | D-05 |
| D-08 | `vm-dialog`, `vm-confirm-dialog`, `vm-sheet` | hoch | Basiskomponente | M | D-05, D-06 |
| D-09 | Fokus-Zustände vereinheitlichen | hoch | visuelle Accessibility | S | D-01, D-03 |
| D-10 | `vm-card` und Kartenmuster der Seiten | mittel | Basiskomponente | M | D-05 |
| D-11 | `vm-checkbox` und `vm-switch` | mittel | Basiskomponente | M | D-05 |
| D-12 | `vm-badge` (Status, Hinweis, Zähler) | mittel | Basiskomponente | S | D-05 |
| D-13 | `vm-menu`, `vm-toast`, `vm-tooltip` | mittel | Basiskomponente | M | D-05 |
| D-14 | `vm-table` und Listenmuster | mittel | Basiskomponente | L | D-05 |
| D-15 | Seiten auf Typografie-Tokens umstellen | mittel | M3-Styling | L | D-02 |
| D-16 | Seiten auf Form- und Elevation-Tokens umstellen | mittel | M3-Styling | M | D-03, D-10 |
| D-17 | App-Shell nach M3 (Top App Bar, Navigation Drawer/Rail) | mittel | M3-Styling | L | D-01–D-06 |
| D-18 | Lesbarkeit, Zielgrößen, Farbe nicht als einziger Träger | mittel | visuelle Accessibility | M | D-02, D-04, D-12 |
| D-19 | Zard-Interna an Tokens binden (Scrims, Radien, Scrollbar) | niedrig | Variablen | S | D-05 |
| D-20 | Ungenutzte Zard-Komponenten bereinigen | niedrig | Basiskomponente | S | D-05 |
| D-21 | Dark Theme vorbereiten (`light-dark()`) | niedrig | Variablen | M | D-01 |
| D-22 | Design Guideline auf `--mat-sys-*` nachziehen | niedrig | Variablen | S | D-01–D-04 |

### D-01 – Farbrollen als `--mat-sys-*` und Mapping für Tailwind/Zard

- **Priorität:** hoch · **Kategorie:** Variablen · **Aufwand:** M · **Abhängigkeiten:** keine
- **Betroffene Dateien:** `apps/web/src/styles.css`, neu `apps/web/src/theme/m3-theme.css` (oder `libs/ui/src/styles/m3-theme.css` nach D-05), `apps/web/src/app/shared/core/css/zard.css`, alle Zard-Varianten mit `var(--…)` (u. a. `sonner`, `dropdown`, `popover`, `command`)
- **Begründung (M3 Farbrollen):** M3 trennt Farben in Rollen mit festen Paaren (`primary`/`on-primary`, `*-container`/`on-*-container`, `surface`/`on-surface`, `surface-container-*` für Flächenhierarchie, `outline`/`outline-variant`). Das shadcn-Schema mischt Rolle und Aussehen (`muted`, `accent`, `secondary` haben denselben Wert `#f4f4f5`), eigene Erweiterungen (`*-soft`, `*-ink`) sind faktisch Container-Paare ohne Systemnamen.
- **Geplanter Umbau:**
  1. Vollständiges Farb-Set `--mat-sys-*` (siehe [Variablen-Set](#farben-hell)) in einer eigenen Theme-Datei, eingebunden in `styles.css`.
  2. Tailwind-Farben in `@theme inline` direkt auf `--mat-sys-*` mappen, mit M3-Namen: `bg-primary`, `text-on-primary`, `bg-primary-container`, `text-on-surface-variant`, `bg-surface-container-high`, `border-outline-variant` …
  3. Die von Zard genutzten Tailwind-Namen (`bg-background`, `text-muted-foreground`, `border-input`, `ring-ring` …) bleiben als **Tailwind-Farbaliase** in `@theme` bestehen und zeigen auf `--mat-sys-*`, damit Zard-Quellcode nicht angefasst werden muss. Die shadcn-CSS-Variablen (`--background`, `--muted` …) entfallen; die wenigen `var(--muted)`-Stellen in Zard werden auf `--mat-sys-*` umgestellt.
  4. Zuordnung alt → neu: `background`/`card`/`popover` → `surface`/`surface-container-lowest`; `foreground` → `on-surface`; `muted`/`accent`/`secondary` → `surface-container`; `muted-foreground` → `on-surface-variant`; `primary-soft` → `primary-container`; `brass-soft`/`brass-ink` → `tertiary-container`/`on-tertiary-container`; `brass` → `tertiary-fixed-dim`; `destructive` → `error`; `destructive-soft`/`-ink` → `error-container`/`on-error-container`; `border` → `outline-variant`; `input` → `outline`; `ring` → `primary`; `sidebar` → `surface-container-low`; `sidebar-accent` → `primary-container`.
  5. Sichtbare Änderung: destruktive Buttons werden von `#dc2626` auf `error` `#b91c1c` dunkler (Kontrast 4,83 → 6,47).
- **Geplante Abweichungen:** `--mat-sys-success-container`, `--mat-sys-on-success-container`, `--mat-sys-warning-container`, `--mat-sys-on-warning-container` (siehe [Abweichungen](#abweichungen-vom---mat-sys-schema)).
- **Lib-Vorschlag:** `@material/material-color-utilities` zum Erzeugen/Prüfen der Tonwerte (nicht umgesetzt, siehe unten).

### D-02 – Typografie-Tokens (M3-Typeskala)

- **Priorität:** hoch · **Kategorie:** Variablen · **Aufwand:** M · **Abhängigkeiten:** D-01 (gleiche Theme-Datei)
- **Betroffene Dateien:** Theme-Datei, `apps/web/src/styles.css` (`body`-Basis `text-sm`, `html { font-size: 16px }`)
- **Begründung (M3 Typografie):** M3 hat 15 Rollen (Display, Headline, Title, Body, Label jeweils L/M/S) mit festen Größen, Zeilenhöhen, Gewichten und Laufweiten. Die App nutzt 11 verschiedene Größen, davon 6 außerhalb jeder Skala (`13px`, `15px`, `22px`, `32px`, `11px`, `10px`).
- **Geplanter Umbau:** Tokens im Angular-Material-Muster: Kurzform `--mat-sys-body-medium` (`font`-Shorthand) plus Einzelwerte `--mat-sys-body-medium-font`, `-size`, `-line-height`, `-weight`, `-tracking`. Tailwind-Utilities per `@utility` bzw. `@theme --text-*`: `text-body-medium`, `text-title-large`, `text-label-small` … Body-Basis wird `body-medium` (14 px/20 px, wie heute `text-sm`).
- **Geplante Abweichungen:** Schrift `Inter Variable` statt Roboto (Markenschrift aus der Design Guideline, lokal gebündelt). Angular Material setzt die Schrift ebenfalls pro Theme; das ist keine Abweichung im Namen, nur im Wert. Eine Hilfsvariable `--mat-sys-font-plain` (prüfen, ob Angular Material eine gleichnamige Brand-/Plain-Variable emittiert; sonst Abweichung dokumentieren).

### D-03 – Formen, Elevation und State-Layer als Tokens

- **Priorität:** hoch · **Kategorie:** Variablen · **Aufwand:** S · **Abhängigkeiten:** D-01
- **Betroffene Dateien:** Theme-Datei, `styles.css` (`--radius`, `--radius-*`, `--shadow-*`)
- **Begründung (M3 Formen/Elevation/Zustände):** M3 definiert eine Corner-Skala (none, extra-small 4, small 8, medium 12, large 16, extra-large 28, full) und sechs Elevationsstufen (0, 1, 3, 6, 8, 12 dp). Zustände (Hover, Fokus, Gedrückt, Gezogen) werden als State-Layer mit festen Deckkräften über die `on-*`-Farbe gelegt. Heute: ein Basisradius 10 px mit `calc()`-Ableitungen, zwei Schatten ohne Stufen, Hover als `bg-primary/90` bzw. `bg-muted`.
- **Geplanter Umbau:** `--mat-sys-corner-*` und `--mat-sys-level0…5` sowie `--mat-sys-hover-state-layer-opacity`, `--mat-sys-focus-state-layer-opacity`, `--mat-sys-pressed-state-layer-opacity`, `--mat-sys-dragged-state-layer-opacity`. Tailwind: `--radius-xs/sm/md/lg/xl/full` → Corner-Tokens; `--shadow-*` → Level-Tokens (`shadow-level1` …). Bestehende Klassen `rounded-lg`, `shadow-sm` behalten zunächst ihr Aussehen über Aliase, die Umstellung der Seiten folgt in D-16.
- **Geplante Abweichungen:** keine.

### D-04 – Größen-Tokens (Abstände, Höhen, Icons, Layout)

- **Priorität:** hoch · **Kategorie:** Größen · **Aufwand:** M · **Abhängigkeiten:** D-01
- **Betroffene Dateien:** Theme-Datei, `styles.css` (`@theme`-Block mit `--spacing-touch` …, Seitenrhythmus `gap: 1.5rem/2rem`), Zard `button.variants.ts`, `input.variants.ts`, `native-select`, Feature-Templates mit `max-w-[560px]`, `max-h-[65dvh]` usw.
- **Begründung (M3 Layout/Abstände):** M3 nutzt ein 4-dp-Raster für Abstände, 48 dp als minimale Zielgröße, 40 dp Höhe für Buttons, 24 dp Standard-Icongröße, Dichte-Stufen für kompakte Darstellung. Heute liegen diese Maße verteilt im Markup (`h-11 xl:h-9`, `min-h-11 xl:min-h-8`, `size-8`, Icon-Größen als Zahlen).
- **Geplanter Umbau:** Größen-Tokens nach dem Muster der Corner-Tokens (siehe [Größen](#größen)): `--mat-sys-spacing-*`, `--mat-sys-icon-size-*`, `--mat-sys-control-height*`, `--mat-sys-target-size*`, Layout-Maße. Tailwind-Spacing `p-*`/`gap-*` bleibt am 4-px-Raster (`--spacing: 0.25rem` entspricht `--mat-sys-spacing-xs`); benannte Utilities `gap-spacing-lg`, `h-control`, `size-target`, `w-sidebar`, `max-w-content`, `max-w-dialog-*`. Hart codierte Werte in Basiskomponenten und Seiten werden ersetzt.
- **Geplante Abweichungen:** Alle Größen-Tokens sind eine Erweiterung des Schemas (Angular Material kennt keine `--mat-sys-spacing-*`); vom Auftrag gefordert, Begründung siehe [Abweichungen](#abweichungen-vom---mat-sys-schema).

### D-05 – Nx-Library `libs/ui` und Umzug der Zard-Basis

- **Priorität:** hoch · **Kategorie:** Basiskomponente · **Aufwand:** L · **Abhängigkeiten:** D-01 bis D-04
- **Betroffene Dateien:** neu `libs/ui/**` (`project.json`, `tsconfig*.json`, `eslint.config.mjs`, `vitest.config.mts`), `tsconfig.base.json` (Pfad `@vm/ui`), `components.json` (`baseUrl`/Aliase), `apps/web/src/app/shared/components/**` (Umzug), `apps/web/src/app/shared/core/**` (von Zard genutzte Helfer), `apps/web/src/app/shared/utils/merge-classes.ts`
- **Begründung (M3 Komponenten):** M3-Komponenten haben feste Anatomie, Zustände und Token-Bindung. Eine eigene Library trennt die Basiskomponenten von den Seiten und macht sie testbar. Eine Library kann nicht aus `apps/web` importieren, deshalb muss die Zard-Basis mit in `libs/ui` (z. B. `libs/ui/src/lib/zard/**`).
- **Geplanter Umbau:** Library mit vorhandenem Nx-Generator (`nx g @nx/angular:library ui --directory=libs/ui --prefix=vm`), Zard-Komponenten und -Helfer dorthin verschieben, `components.json` auf die Library zeigen lassen, damit künftige `zard add` dort landen. Theme-Datei aus D-01 bis D-04 in `libs/ui/src/styles/` verschieben und von `apps/web/src/styles.css` importieren. Tailwind-`@source` für `libs/ui` ergänzen. Erste Exporte noch ohne Verhaltensänderung.
- **Geplante Abweichungen:** keine.

### D-06 – `vm-button` und `vm-icon-button`

- **Priorität:** hoch · **Kategorie:** Basiskomponente · **Aufwand:** L · **Abhängigkeiten:** D-05
- **Betroffene Dateien:** `libs/ui` (neu), Zard `button.variants.ts`, 47 Dateien in `apps/web` mit `z-button` (u. a. `form-dialog.ts`, `name-dialog.ts`, alle Listen- und Detailseiten)
- **Begründung (M3 Buttons):** M3 kennt Filled, Tonal, Outlined, Text und Elevated sowie Icon-Buttons (Standard, Filled, Tonal, Outlined); Höhe 40 dp, Form `corner-full`, Label `label-large`, Zustände über State-Layer. Heute: shadcn-Varianten `default/secondary/outline/ghost/link/destructive`, Radius 8–10 px, Hover über Transparenz.
- **Geplanter Umbau:** Attribut-Komponente `button[vm-button]`/`a[vm-button]` mit `variant: 'filled' | 'tonal' | 'outlined' | 'text' | 'danger'` und `vm-icon-button`. Zard `ZardButtonComponent` bleibt intern die Basis; Mapping `default→filled`, `secondary→tonal`, `outline→outlined`, `ghost/link→text`, `destructive→danger`. `zLoading`/`zDisabled` werden durchgereicht (Konvention aus `zard-conventions.spec.ts` bleibt, Test wird auf `vm-button` erweitert). Höhen aus `--mat-sys-control-height*`, Zielgröße mindestens `--mat-sys-target-size-min`.
- **Geplante Abweichungen:** Variante `danger` (Filled mit `error`/`on-error`) ist in M3 keine eigene Button-Art; nötig, weil Löschen/Entfernen in der App deutlich markiert sein muss (Design Guideline). Kein neues Token, nur eine Komponentenvariante.

### D-07 – Formularfelder: `vm-input`, `vm-textarea`, `vm-select`, `vm-field`

- **Priorität:** hoch · **Kategorie:** Basiskomponente · **Aufwand:** L · **Abhängigkeiten:** D-05
- **Betroffene Dateien:** Zard `input`, `textarea`, `native-select`, `input-group`, `field`; `shared/ui/search-field.ts`, `toggle-field.ts`, `voice-select.ts`, `score-search-select.ts`; 20 Dateien mit `z-input`, 17 mit `z-native-select`, 3 mit `z-textarea`
- **Begründung (M3 Textfelder):** M3-Textfelder (Outlined-Variante) haben Label, Supporting Text, Fehlertext, `corner-extra-small`, Rahmen `outline` (Fokus: 2 dp `primary`, Fehler: `error`), Inhalt `body-large`. Heute sind Label, Hinweis und Fehler an jeder Stelle einzeln gebaut.
- **Geplanter Umbau:** `vm-input`/`vm-textarea`/`vm-select` als Attribut-Komponenten auf den nativen Elementen (Formular-Bindings bleiben unverändert), `vm-field` als Rahmen mit Label, Hinweis und Fehlertext. Fehler zusätzlich mit Icon und Text, nicht nur roter Rahmen.
- **Geplante Abweichungen:** keine.

### D-08 – `vm-dialog`, `vm-confirm-dialog`, `vm-sheet`

- **Priorität:** hoch · **Kategorie:** Basiskomponente · **Aufwand:** M · **Abhängigkeiten:** D-05, D-06
- **Betroffene Dateien:** `shared/ui/form-dialog.ts`, `shared/ui/name-dialog.ts`, `core/layout/stand-in-dialog.ts`, Zard `dialog`, `alert-dialog`, `sheet`, 8 bzw. 2 Nutzer
- **Begründung (M3 Dialoge):** Basic Dialog mit `corner-extra-large`, `surface-container-high`, Elevation `level3`, Headline `headline-small`, Aktionen rechts als Text-Buttons; Full-screen Dialog auf kleinen Geräten. Scrim aus `--mat-sys-scrim` mit 32 % statt `bg-black/10`.
- **Geplanter Umbau:** `vm-form-dialog` und `vm-name-dialog` ziehen in `libs/ui` und nutzen `vm-dialog`; Bestätigungsdialoge als `vm-confirm-dialog` über Zard `alert-dialog`; `vm-sheet` für Seitenpaneele. Verhalten (Schließen, Fokus-Start `cdkFocusInitial`, Vollbild auf Phones) bleibt.
- **Geplante Abweichungen:** keine.

### D-09 – Fokus-Zustände vereinheitlichen

- **Priorität:** hoch · **Kategorie:** visuelle Accessibility · **Aufwand:** S · **Abhängigkeiten:** D-01, D-03
- **Betroffene Dateien:** `apps/web/src/styles.css` (globales `:focus-visible`), alle Zard-Varianten mit `focus-visible:ring-3 focus-visible:ring-ring/50`
- **Begründung (M3 Fokus, WCAG 2.4.7/2.4.11):** M3 zeigt Fokus als 3 dp Fokusring in `secondary` bzw. `primary` mit Abstand; der Ring muss mindestens 3:1 zur Umgebung haben. Heute zwei Systeme: globaler Outline-Ring und Zard-Ringschatten, der per `--tw-ring-shadow` wieder abgeschaltet wird.
- **Geplanter Umbau:** Ein Fokus-Token-Satz (`--mat-sys-focus-indicator-color`, `-thickness`, `-outer-offset` – siehe Abweichungen), globale Regel bleibt die einzige Quelle; Zard-`focus-visible:ring-*`-Klassen werden entfernt statt überschrieben. Ring `primary` 11,48:1 auf `surface`, 9,84:1 auf `primary-container`.
- **Geplante Abweichungen:** Fokus-Tokens (siehe [Abweichungen](#abweichungen-vom---mat-sys-schema)).

### D-10 – `vm-card` und Kartenmuster der Seiten

- **Priorität:** mittel · **Kategorie:** Basiskomponente · **Aufwand:** M · **Abhängigkeiten:** D-05
- **Betroffene Dateien:** 31 Dateien mit `rounded-lg border bg-card … shadow-sm` (59 Stellen), u. a. `features/me/*`, `features/library/*`, `features/system/*`, `features/print/print-history-page.html`
- **Begründung (M3 Cards):** Drei Kartentypen: Elevated (`surface-container-low`, `level1`), Filled (`surface-container-highest`, `level0`), Outlined (`surface`, Rand `outline-variant`, `level0`); Form `corner-medium`. Heute Mischform aus Rand und Schatten.
- **Geplanter Umbau:** `vm-card` mit `variant: 'outlined' | 'filled' | 'elevated'`, optional `vm-card-header`/`vm-card-actions`. Seiten nutzen standardmäßig `outlined` (entspricht dem heutigen Bild ohne Schatten).
- **Geplante Abweichungen:** keine.

### D-11 – `vm-checkbox` und `vm-switch`

- **Priorität:** mittel · **Kategorie:** Basiskomponente · **Aufwand:** M · **Abhängigkeiten:** D-05
- **Betroffene Dateien:** 17 native `<input type="checkbox">` (u. a. `scores-page.html`, `member-score-list.html`, `role-page.html`, `score-form.html`, `score-filter-dialog.html`, `ensemble-page.html`), `shared/ui/toggle-switch.ts`, `toggle-field.ts`
- **Begründung (M3 Checkbox/Switch):** Checkbox 18 dp in 40 dp State-Layer, `corner-extra-small`, Haken in `on-primary`; Switch 52×32 dp mit Daumen-Icon. Heute `accent-primary` (Browser-Darstellung, je nach System unterschiedlich) und ein eigener 36×20-px-Schalter.
- **Geplanter Umbau:** `input[type=checkbox][vm-checkbox]` als Attribut-Komponente (Bindings bleiben), `vm-switch` ersetzt die Optik von `vm-toggle-switch` (API bleibt).
- **Geplante Abweichungen:** keine.

### D-12 – `vm-badge` (Status, Hinweis, Zähler)

- **Priorität:** mittel · **Kategorie:** Basiskomponente · **Aufwand:** S · **Abhängigkeiten:** D-05
- **Betroffene Dateien:** `shared/ui/status-badge.ts`, Hinweis-Chips `bg-brass-soft text-brass-ink` (`voice-dialog.html`, `voices-page.html`, `print-dialog.html`), Zähler `text-[10px]` (`scores-page.html`, `tag-filter.ts`)
- **Begründung (M3 Badges/Chips):** Badge klein (6 dp) oder groß (16 dp, `label-small` 11 sp) in `error`/`on-error`; Status-Markierungen eher als Assist-Chip bzw. Container-Paar. Heute drei Muster mit eigener Optik.
- **Geplanter Umbau:** `vm-status-badge` zieht nach `libs/ui`, Farben über Container-Rollen; `vm-badge` für Zähler mit `label-small` statt `10px`; Hinweis-Chip als `vm-badge variant="tertiary"`.
- **Geplante Abweichungen:** Zähler in `primary`/`on-primary` statt M3-Standard `error`, weil der Zähler einen aktiven Filter anzeigt, keinen Fehler. Kein neues Token.

### D-13 – `vm-menu`, `vm-toast`, `vm-tooltip`

- **Priorität:** mittel · **Kategorie:** Basiskomponente · **Aufwand:** M · **Abhängigkeiten:** D-05
- **Betroffene Dateien:** Zard `dropdown` (5 Nutzer, u. a. `user-menu.ts`), `sonner` (10 Nutzer), `tooltip` (ungenutzt), `core/actions/*` (nur Aufrufstellen der Toasts, keine Logik)
- **Begründung (M3 Menüs/Snackbar/Tooltip):** Menü `surface-container`, `level2`, `corner-extra-small`, Einträge 48 dp hoch, `label-large`; Snackbar `inverse-surface`/`inverse-on-surface`, `inverse-primary` für Aktion, `corner-extra-small`, `level3`; Plain Tooltip `inverse-surface`, `body-small`.
- **Geplanter Umbau:** Kapselung als `vm-menu`/`vm-menu-item`, `vm-toaster` (Sonner-Theme auf Snackbar-Optik), `vm-tooltip`.
- **Geplante Abweichungen:** keine.

### D-14 – `vm-table` und Listenmuster

- **Priorität:** mittel · **Kategorie:** Basiskomponente · **Aufwand:** L · **Abhängigkeiten:** D-05
- **Betroffene Dateien:** 12 `<table>` in `manage-folders-page.html`, `scores-page.html`, `score-page.html`, `manage-events-page.html`, `member-score-list.html`, `folders-page.ts`, `profile-page.ts`, `uploads-page.ts`, `print-rules-tab.ts`, `users-page.html`; `shared/ui/list-state.ts`, `selection-bar.ts`
- **Begründung (M3 Listen/Datentabellen):** Listen mit 56/72 dp Zeilen, `body-large`/`body-medium`, Trennlinien `outline-variant`; Tabellenkopf `title-small`, Zeilen-Hover über State-Layer.
- **Geplanter Umbau:** `vm-table` als Attribut-Styling (`table[vm-table]`, `th[vm-th]`, `td[vm-td]`), damit Struktur und Datenfluss der Tabellen unverändert bleiben; `vm-list-item` für die Listen der Mitgliederansicht.
- **Geplante Abweichungen:** keine.

### D-15 – Seiten auf Typografie-Tokens umstellen

- **Priorität:** mittel · **Kategorie:** M3-Styling · **Aufwand:** L · **Abhängigkeiten:** D-02
- **Betroffene Dateien:** 30 Dateien mit `text-[13px]` (u. a. `login-page.ts`, `legal-links.ts`, `scores-page.html`, `score-page.html`, `app-shell.html`, alle `system/*`-Seiten), alle Dateien mit `text-xs`, `text-lg`, `text-2xl`, `text-[22px]`, `text-[32px]`, `text-[15px]`
- **Begründung (M3 Typografie):** Jede Textstelle bekommt eine Rolle statt einer Pixelgröße.
- **Geplanter Umbau (Zuordnung):** Seitentitel `text-2xl font-semibold` und `text-[22px]…md:text-2xl` → `headline-small` (24/32); Abschnittstitel `text-lg font-semibold` → `title-large` (22/28); `text-base font-semibold` → `title-medium`; Fließtext → `body-medium`; `text-[13px]` (Hilfs- und Metatexte) → `body-medium` (14/20) bzw. `body-small` (12/16) nur für Zeitstempel/Zähler; `text-xs font-medium` (Badges, Labels) → `label-medium`/`label-small`; Login-Hero `md:text-[32px]` → `headline-large`.
- **Geplante Abweichungen:** Überschriften behalten Gewicht 600 statt M3 400 (`--mat-sys-*-weight` wird für Headline/Title überschrieben). Grund: Inter wirkt bei 400 in 22–24 px deutlich schwächer als Roboto; die bestehende Hierarchie der Design Guideline setzt auf Halbfett. Als Wertabweichung dokumentieren, Tokennamen bleiben.

### D-16 – Seiten auf Form- und Elevation-Tokens umstellen

- **Priorität:** mittel · **Kategorie:** M3-Styling · **Aufwand:** M · **Abhängigkeiten:** D-03, D-10
- **Betroffene Dateien:** alle Dateien mit `rounded-*` (≈290 Stellen) und `shadow-*` (≈90 Stellen) außerhalb der Basiskomponenten
- **Begründung (M3 Formen/Elevation):** Form folgt dem Komponententyp (Chips `small`, Karten `medium`, Dialoge `extra-large`, Buttons `full`), Elevation folgt der Ebene (Karte `level0/1`, Menü `level2`, Dialog `level3`).
- **Geplanter Umbau:** Klassen ersetzen (`rounded-lg` an Karten → `rounded-medium`, an Avataren `rounded-full`; `shadow-sm` → `shadow-level1` oder entfällt bei Outlined-Karten), Rest-Muster an Basiskomponenten übergeben.
- **Geplante Abweichungen:** keine.

### D-17 – App-Shell nach M3 (Top App Bar, Navigation Drawer/Rail)

- **Priorität:** mittel · **Kategorie:** M3-Styling · **Aufwand:** L · **Abhängigkeiten:** D-01 bis D-06
- **Betroffene Dateien:** `core/layout/app-shell.html`, `app-shell.ts` (nur Klassen), `nav-list.ts`, `nav.ts` (nur Darstellung), `user-menu.ts`, `voice-switcher.ts`, `core/branding/club-logo.ts`
- **Begründung (M3 Navigation):** Navigation Drawer (`surface-container-low`, aktive Einträge als Pill `secondary-container` 56 dp hoch, `label-large`), auf mittleren Breiten Navigation Rail, Top App Bar 64 dp mit `title-large`. Heute: Sidebar 256 px, Header 56 px, aktive Einträge `primary-soft`.
- **Geplanter Umbau:** Klassen und Maße auf Tokens; aktive Einträge als Pill mit `--mat-sys-corner-full`; Voice-Switcher als Tonal-Button. Breakpoints und Verhalten der Navigation bleiben.
- **Geplante Abweichungen:** Aktiver Eintrag in `primary-container` statt `secondary-container`, weil die Markenfarbe Navy die Navigation tragen soll und `secondary` (graublau) sich zu wenig von der Fläche abhebt. Breite Drawer 256 px statt M3 360 dp (Platz für Inhalte auf 1280-px-Displays).

### D-18 – Lesbarkeit, Zielgrößen, Farbe nicht als einziger Träger

- **Priorität:** mittel · **Kategorie:** visuelle Accessibility · **Aufwand:** M · **Abhängigkeiten:** D-02, D-04, D-12
- **Betroffene Dateien:** `scores-page.html`, `tag-filter.ts` (`text-[10px]`), `users-page.html` (`text-[11px]` Initialen), `scores-page.html` und `folder-page.ts` (Icon-Buttons `size-8`), `review-preview.ts`, `upload-split.ts` (`opacity-40` für übersprungene/gedimmte Seiten), Zard-Varianten mit `disabled:opacity-50`
- **Begründung (M3 Barrierefreiheit, WCAG 1.4.1/1.4.3/2.5.8):**
  - Mindestgröße Text: 10 px und 11 px sind unter M3 `label-small` (11 sp) bzw. schwer lesbar; Minimum `label-small`, Zähler mit ausreichender Fläche.
  - Zielgrößen: 32-px-Icon-Buttons auch mobil; M3 fordert 48 dp Zielfläche (Touch-Fläche darf über die sichtbare Fläche hinausgehen).
  - Farbe/Transparenz als einziger Träger: übersprungene Upload-Abschnitte und gedimmte Review-Vorschauen nur über `opacity-40`; zusätzlich Text/Icon („Übersprungen“) einblenden – sofern bereits vorhanden, nur prüfen.
  - Deaktivierte Elemente: `opacity-50` ergibt z. B. 2,78:1 auf deaktivierten Primary-Buttons. WCAG nimmt deaktivierte Elemente aus; M3 nutzt `on-surface` mit 38 % Deckkraft auf 12 % Container – Darstellung über Tokens vereinheitlichen.
- **Geplanter Umbau:** Klassen anpassen, Zielfläche über `--mat-sys-target-size` (unsichtbarer Pseudo-Element-Bereich), Zusatztext nur, wo Information heute ausschließlich visuell gedimmt ist.
- **Geplante Abweichungen:** Desktop-Zielgröße bleibt 32 px (`--mat-sys-target-size-compact`) statt 48 dp: Maus-Bedienung, Dichte der Verwaltungslisten; WCAG 2.5.8 (24 px) bleibt erfüllt.

### D-19 – Zard-Interna an Tokens binden (Scrims, Radien, Scrollbar)

- **Priorität:** niedrig · **Kategorie:** Variablen · **Aufwand:** S · **Abhängigkeiten:** D-05
- **Betroffene Dateien:** Zard `dialog.variants.ts`, `sheet.variants.ts`, `alert-dialog.variants.ts` (`bg-black/10`), `drawer.variants.ts` (`bg-black/30`), Button/Toggle mit `rounded-[min(var(--radius-md),10px)]`, `rounded-[calc(var(--radius)-3px)]`, `zard.css` (`scrollbar-thin` mit `--muted`), `pdf-viewer.ts`, `review-preview.ts`, `upload-split.ts` (`bg-white`)
- **Begründung:** Scrim gehört zur Rolle `scrim`; Radien zur Corner-Skala. `bg-white` an Canvas-Elementen stellt das Papier der Noten dar – bewusst unabhängig vom Theme.
- **Geplanter Umbau:** Scrims `bg-scrim/32`, Radien auf Corner-Tokens, Scrollbar auf `on-surface-variant`/`surface-container`. `bg-white` an PDF-Canvas bleibt (Papierfarbe), mit Kommentar.
- **Geplante Abweichungen:** komponenteninterne Variablen `--z-dialog-duration`, `--z-drawer-*`, `--z-sheet-duration` bleiben (Animationsparameter einzelner Komponenten, keine Theme-Tokens).

### D-20 – Ungenutzte Zard-Komponenten bereinigen

- **Priorität:** niedrig · **Kategorie:** Basiskomponente · **Aufwand:** S · **Abhängigkeiten:** D-05
- **Betroffene Dateien:** 24 ungenutzte Komponenten in `shared/components` (`alert`, `avatar`, `badge`, `breadcrumb`, `card`, `checkbox`, `command`, `drawer`, `empty`, `field`, `input-group`, `kbd`, `popover`, `progress`, `radio-group`, `select`, `separator`, `skeleton`, `spinner`, `switch`, `table`, `tabs`, `toggle`, `toggle-group`, `tooltip`)
- **Begründung:** Jede ungenutzte Komponente müsste sonst ebenfalls auf die Tokens gemappt werden. Teile davon werden in D-10 bis D-14 zur Basis von `vm-*`.
- **Geplanter Umbau:** Beim Umzug (D-05) nur übernehmen, was eine `vm-*`-Komponente nutzt; der Rest kann jederzeit per `zard add` zurückgeholt werden.
- **Geplante Abweichungen:** keine.

### D-21 – Dark Theme vorbereiten (`light-dark()`)

- **Priorität:** niedrig · **Kategorie:** Variablen · **Aufwand:** M · **Abhängigkeiten:** D-01
- **Betroffene Dateien:** Theme-Datei, `styles.css` (`@custom-variant dark`)
- **Begründung (M3 Farbschemata):** Angular Material schreibt Farbtokens als `light-dark(hell, dunkel)` und steuert über `color-scheme`. Darkmode ist laut `docs/requirements.md` „später“.
- **Geplanter Umbau:** Farbtokens bereits in D-01 so anlegen, dass `light-dark()` ergänzt werden kann; `color-scheme: light` setzen. Dunkle Werte erst mit der Anforderung festlegen.
- **Geplante Abweichungen:** keine.

### D-22 – Design Guideline auf `--mat-sys-*` nachziehen

- **Priorität:** niedrig · **Kategorie:** Variablen · **Aufwand:** S · **Abhängigkeiten:** D-01 bis D-04
- **Betroffene Dateien:** `docs/frontend-plan.md`, `docs/requirements.md` (Verweise), externe Design Guideline
- **Begründung:** Guideline und Code sollen dieselben Tokennamen nutzen.
- **Geplanter Umbau:** Tokens der Guideline umbenennen, Verweise in `docs/` anpassen.
- **Geplante Abweichungen:** keine.

## Geplantes Variablen-Set

Nur Lightmode (Darkmode siehe D-21). Werte übernehmen, wo möglich, die bestehenden Markenfarben der Design Guideline; neu sind nur Rollen, die bisher fehlten.

### Farben (hell)

| Variable | Rolle | Wert hell | bisher |
| --- | --- | --- | --- |
| `--mat-sys-primary` | Hauptaktionen, Links, aktive Zustände | `#1f3a5f` | `--primary` |
| `--mat-sys-on-primary` | Inhalt auf primary | `#ffffff` | `--primary-foreground` |
| `--mat-sys-primary-container` | ruhige Hervorhebung (aktiver Navi-Eintrag, Auswahl) | `#e8eef6` | `--primary-soft`, `--sidebar-accent` |
| `--mat-sys-on-primary-container` | Inhalt auf primary-container | `#1f3a5f` | `text-primary` auf `primary-soft` |
| `--mat-sys-primary-fixed` | wie container, themeunabhängig | `#e8eef6` | – |
| `--mat-sys-primary-fixed-dim` | stärkere fixe Variante | `#b7c8de` | – |
| `--mat-sys-on-primary-fixed` | Inhalt auf primary-fixed | `#0b1d33` | – |
| `--mat-sys-on-primary-fixed-variant` | schwächerer Inhalt auf primary-fixed | `#1f3a5f` | – |
| `--mat-sys-inverse-primary` | Aktion auf inverse-surface (Snackbar) | `#a9c7ee` | – |
| `--mat-sys-surface-tint` | Tönung für Elevation | `#1f3a5f` | – |
| `--mat-sys-secondary` | zurückhaltende Akzente | `#535f70` | – |
| `--mat-sys-on-secondary` | Inhalt auf secondary | `#ffffff` | – |
| `--mat-sys-secondary-container` | Tonal-Buttons, Chips | `#d7e3f7` | – |
| `--mat-sys-on-secondary-container` | Inhalt auf secondary-container | `#3b4858` | – |
| `--mat-sys-secondary-fixed` | fixe Variante | `#d7e3f7` | – |
| `--mat-sys-secondary-fixed-dim` | fixe Variante, dunkler | `#bbc7db` | – |
| `--mat-sys-on-secondary-fixed` | Inhalt | `#101c2b` | – |
| `--mat-sys-on-secondary-fixed-variant` | Inhalt, schwächer | `#3b4858` | – |
| `--mat-sys-tertiary` | Messing-Akzent (Ersatzstimme, Hinweise) | `#7a5418` | `--brass-ink` |
| `--mat-sys-on-tertiary` | Inhalt auf tertiary | `#ffffff` | – |
| `--mat-sys-tertiary-container` | Hinweis-Flächen | `#faf3e6` | `--brass-soft` |
| `--mat-sys-on-tertiary-container` | Inhalt auf tertiary-container | `#7a5418` | `--brass-ink` |
| `--mat-sys-tertiary-fixed` | fixe Variante | `#ffddb0` | – |
| `--mat-sys-tertiary-fixed-dim` | Messing (Vereinslogo-Platzhalter) | `#c8963e` | `--brass` |
| `--mat-sys-on-tertiary-fixed` | Inhalt | `#281800` | – |
| `--mat-sys-on-tertiary-fixed-variant` | Inhalt, schwächer | `#5f3f06` | – |
| `--mat-sys-error` | Fehler, destruktive Aktionen | `#b91c1c` | `--destructive` (`#dc2626`), `--destructive-ink` |
| `--mat-sys-on-error` | Inhalt auf error | `#ffffff` | `--destructive-foreground` |
| `--mat-sys-error-container` | Fehlerflächen | `#fef2f2` | `--destructive-soft` |
| `--mat-sys-on-error-container` | Inhalt auf error-container | `#b91c1c` | `--destructive-ink` |
| `--mat-sys-background` | Seitenhintergrund | `#ffffff` | `--background` |
| `--mat-sys-on-background` | Inhalt auf background | `#18181b` | `--foreground` |
| `--mat-sys-surface` | Standardfläche | `#ffffff` | `--background`, `--card`, `--popover` |
| `--mat-sys-on-surface` | Standardtext | `#18181b` | `--foreground` |
| `--mat-sys-surface-variant` | abgesetzte Flächen | `#e4e4e7` | – |
| `--mat-sys-on-surface-variant` | Sekundärtext, Icons | `#63636b` | `--muted-foreground` |
| `--mat-sys-surface-dim` | gedimmte Fläche | `#dcdcdf` | – |
| `--mat-sys-surface-bright` | helle Fläche | `#ffffff` | – |
| `--mat-sys-surface-container-lowest` | Karten auf getönter Fläche | `#ffffff` | `--card` |
| `--mat-sys-surface-container-low` | Navigation, Elevated Card | `#fafafa` | `--sidebar` |
| `--mat-sys-surface-container` | Hover-/Muted-Flächen, Menüs | `#f4f4f5` | `--muted`, `--accent`, `--secondary` |
| `--mat-sys-surface-container-high` | Dialoge | `#ececee` | – |
| `--mat-sys-surface-container-highest` | Filled Card, Eingabe-Flächen | `#e4e4e7` | – |
| `--mat-sys-inverse-surface` | Snackbar, Tooltip | `#2e2e33` | – |
| `--mat-sys-inverse-on-surface` | Inhalt auf inverse-surface | `#f4f4f5` | – |
| `--mat-sys-outline` | Rahmen von Eingaben, Outlined Buttons | `#8a8a93` | `--input` |
| `--mat-sys-outline-variant` | Trennlinien, Kartenrahmen | `#e4e4e7` | `--border`, `--sidebar-border` |
| `--mat-sys-scrim` | Abdunklung hinter Dialogen | `#000000` | `bg-black/10`, `bg-black/30` |
| `--mat-sys-shadow` | Schattenfarbe | `#000000` | `rgba(24,24,27,…)` |
| `--mat-sys-success-container` | Erfolgsflächen (Abweichung) | `#ecfdf3` | `--success-soft` |
| `--mat-sys-on-success-container` | Inhalt darauf (Abweichung) | `#15803d` | `--success-ink` |
| `--mat-sys-warning-container` | Warnflächen (Abweichung) | `#fff7e6` | `--warning-soft` |
| `--mat-sys-on-warning-container` | Inhalt darauf (Abweichung) | `#92400e` | `--warning-ink` |

### Typografie

Schrift für alle Rollen: `'Inter Variable', ui-sans-serif, system-ui, sans-serif`. Werte: Größe / Zeilenhöhe / Gewicht / Laufweite (M3-Baseline, prüfen).

| Variable | Verwendung in VM-Web | Wert |
| --- | --- | --- |
| `--mat-sys-display-large` | – | 57px / 64px / 400 / -0.25px |
| `--mat-sys-display-medium` | – | 45px / 52px / 400 / 0 |
| `--mat-sys-display-small` | – | 36px / 44px / 400 / 0 |
| `--mat-sys-headline-large` | Login-Hero | 32px / 40px / 400 (VM: 600) / 0 |
| `--mat-sys-headline-medium` | – | 28px / 36px / 400 (VM: 600) / 0 |
| `--mat-sys-headline-small` | Seitentitel | 24px / 32px / 400 (VM: 600) / 0 |
| `--mat-sys-title-large` | Abschnittstitel, Top App Bar | 22px / 28px / 400 (VM: 600) / 0 |
| `--mat-sys-title-medium` | Kartentitel | 16px / 24px / 500 (VM: 600) / 0.15px |
| `--mat-sys-title-small` | Tabellenkopf | 14px / 20px / 500 / 0.1px |
| `--mat-sys-body-large` | Eingabefelder | 16px / 24px / 400 / 0.5px |
| `--mat-sys-body-medium` | Fließtext, Hilfstexte (Basis) | 14px / 20px / 400 / 0.25px |
| `--mat-sys-body-small` | Zeitstempel, Metadaten | 12px / 16px / 400 / 0.4px |
| `--mat-sys-label-large` | Buttons, Navigation | 14px / 20px / 500 / 0.1px |
| `--mat-sys-label-medium` | Badges, Chips | 12px / 16px / 500 / 0.5px |
| `--mat-sys-label-small` | Zähler | 11px / 16px / 500 / 0.5px |

Je Rolle: Kurzform (`font`-Shorthand) sowie `-font`, `-size`, `-line-height`, `-weight`, `-tracking`.

### Formen, Elevation, Zustände

| Variable | Rolle | Wert |
| --- | --- | --- |
| `--mat-sys-corner-none` | – | `0` |
| `--mat-sys-corner-extra-small` | Textfelder, Menüs, Snackbar | `4px` |
| `--mat-sys-corner-extra-small-top` | obere Ecken | `4px 4px 0 0` |
| `--mat-sys-corner-small` | Chips, Badges | `8px` |
| `--mat-sys-corner-medium` | Karten | `12px` |
| `--mat-sys-corner-large` | Sheets, FAB | `16px` |
| `--mat-sys-corner-large-start` / `-end` / `-top` | Teilrundungen | `16px` (Seite) |
| `--mat-sys-corner-extra-large` | Dialoge | `28px` |
| `--mat-sys-corner-extra-large-top` | Bottom Sheet | `28px 28px 0 0` |
| `--mat-sys-corner-full` | Buttons, Pills, Avatare | `9999px` |
| `--mat-sys-level0` | flach | `none` |
| `--mat-sys-level1` | Elevated Card | 1 dp (Schatten, prüfen) |
| `--mat-sys-level2` | Menüs | 3 dp |
| `--mat-sys-level3` | Dialoge, Snackbar | 6 dp |
| `--mat-sys-level4` | Hover auf level3 | 8 dp |
| `--mat-sys-level5` | – | 12 dp |
| `--mat-sys-hover-state-layer-opacity` | Hover | `0.08` |
| `--mat-sys-focus-state-layer-opacity` | Fokus | `0.1` (prüfen: 0.1 oder 0.12) |
| `--mat-sys-pressed-state-layer-opacity` | Gedrückt | `0.1` (prüfen: 0.1 oder 0.12) |
| `--mat-sys-dragged-state-layer-opacity` | Ziehen | `0.16` |

### Größen

Alle Größen-Tokens sind eine vom Auftrag geforderte Erweiterung des Schemas (siehe Abweichungen). Raster: 4 px.

| Variable | Rolle | Wert | bisher |
| --- | --- | --- | --- |
| `--mat-sys-spacing-none` | – | `0` | – |
| `--mat-sys-spacing-xxs` | Icon-Text-Abstand eng | `2px` | `gap-0.5` |
| `--mat-sys-spacing-xs` | Rasterbasis | `4px` | `gap-1` |
| `--mat-sys-spacing-sm` | Abstände in Komponenten | `8px` | `gap-2` |
| `--mat-sys-spacing-md` | Abstände zwischen Feldern | `12px` | `gap-3` |
| `--mat-sys-spacing-lg` | Innenabstand Karten | `16px` | `p-4` |
| `--mat-sys-spacing-xl` | Abstand zwischen Abschnitten (mobil) | `24px` | `gap: 1.5rem` |
| `--mat-sys-spacing-xxl` | Abstand zwischen Abschnitten (ab md) | `32px` | `gap: 2rem` |
| `--mat-sys-spacing-xxxl` | große Leerzustände | `48px` | – |
| `--mat-sys-icon-size-xs` | Icons in Badges | `14px` | `size="14"` |
| `--mat-sys-icon-size-sm` | Icons in Buttons, Feldern | `16px` | `size-4` |
| `--mat-sys-icon-size-md` | Navigation | `20px` | `size="20"` |
| `--mat-sys-icon-size-lg` | M3-Standard, Leerzustände | `24px` | `size="24"` |
| `--mat-sys-control-height` | Buttons, Eingaben (mobil/Touch) | `44px` | `h-11` |
| `--mat-sys-control-height-compact` | Buttons, Eingaben ab 1280 px | `36px` | `xl:h-9` |
| `--mat-sys-target-size` | minimale Zielfläche Touch | `44px` | `min-h-11`, `--spacing-touch` |
| `--mat-sys-target-size-compact` | minimale Zielfläche ab 1280 px | `32px` | `xl:min-h-8` |
| `--mat-sys-header-height` | Top App Bar | `56px` | `--spacing-header` |
| `--mat-sys-sidebar-width` | Navigation Drawer | `256px` | `--spacing-sidebar` |
| `--mat-sys-content-max-width` | maximale Inhaltsbreite | `1200px` | `--container-content` |
| `--mat-sys-dialog-width-sm` / `-md` / `-lg` | Dialogbreiten | `360px` / `480px` / `560px` | `max-w-[360px]` … `[560px]` |
| `--mat-sys-focus-indicator-thickness` | Fokusring | `2px` | `outline: 2px` |
| `--mat-sys-focus-indicator-outer-offset` | Fokusabstand | `2px` | `outline-offset: 2px` |
| `--mat-sys-focus-indicator-color` | Fokusfarbe | `var(--mat-sys-primary)` | `--ring` |

Höhen 44/36 px statt M3 40/48 dp: siehe Abweichungen.

## Geplante vm-Komponenten

| Komponente | Basis (Zard) | M3-Vorbild | ersetzt in apps/web | Thema |
| --- | --- | --- | --- | --- |
| `vm-button`, `vm-icon-button` | `button` | Common Buttons, Icon Buttons | `z-button` (47 Dateien) | D-06 |
| `vm-input` | `input` | Outlined Text Field | `z-input` (20) | D-07 |
| `vm-textarea` | `textarea` | Outlined Text Field (mehrzeilig) | `z-textarea` (3) | D-07 |
| `vm-select` | `native-select` | Outlined Select/Menu | `z-native-select` (17) | D-07 |
| `vm-field` | `field` | Text Field Anatomie (Label, Supporting Text) | eigene Label-/Fehler-Markups | D-07 |
| `vm-search-field` | `input-group` | Search Bar | `shared/ui/search-field.ts` | D-07 |
| `vm-dialog`, `vm-form-dialog`, `vm-name-dialog` | `dialog` | Basic/Full-screen Dialog | `z-dialog`, `shared/ui/*-dialog.ts` | D-08 |
| `vm-confirm-dialog` | `alert-dialog` | Basic Dialog | `z-alert-dialog` (2) | D-08 |
| `vm-sheet` | `sheet` | Side Sheet | `z-sheet` (2) | D-08 |
| `vm-card` | `card` | Elevated/Filled/Outlined Card | 59 Kartenmuster | D-10 |
| `vm-checkbox` | `checkbox` (nur Optik) | Checkbox | 17 native Checkboxen | D-11 |
| `vm-switch` | `switch` | Switch | `shared/ui/toggle-switch.ts` | D-11 |
| `vm-badge`, `vm-status-badge` | `badge` | Badge, Assist Chip | `shared/ui/status-badge.ts`, Zähler, Hinweis-Chips | D-12 |
| `vm-menu`, `vm-menu-item` | `dropdown` | Menu | `z-dropdown` (5) | D-13 |
| `vm-toaster` | `sonner` | Snackbar | `z-toaster` (10) | D-13 |
| `vm-tooltip` | `tooltip` | Plain Tooltip | – | D-13 |
| `vm-table` | `table` | Data Table / List | 12 `<table>` | D-14 |
| `vm-list-state` | `empty`, `skeleton` | Empty State, Progress | `shared/ui/list-state.ts` | D-14 |

## Abweichungen vom --mat-sys-Schema

| Abweichung | Art | Begründung |
| --- | --- | --- |
| `--mat-sys-success-container`, `--mat-sys-on-success-container`, `--mat-sys-warning-container`, `--mat-sys-on-warning-container` | zusätzliche Farbrollen | M3 und Angular Material kennen nur `error`. Die Statusmuster der Design Guideline (freigegeben, gedruckt, vollständig; wartend, in Warteschlange) brauchen unterscheidbare Erfolgs- und Warnflächen. Benennung analog zu `error-container`, damit sie wie Systemrollen gelesen werden. Keine `success`/`warning`-Grundrollen, weil die App sie nicht als Flächen- oder Buttonfarbe nutzt. |
| `--mat-sys-spacing-*`, `--mat-sys-icon-size-*`, `--mat-sys-control-height*`, `--mat-sys-target-size*`, `--mat-sys-header-height`, `--mat-sys-sidebar-width`, `--mat-sys-content-max-width`, `--mat-sys-dialog-width-*` | zusätzliche Größen-Tokens | Vom Auftrag gefordert (Größen im gleichen Muster wie `--mat-sys-corner-*`). Angular Material regelt Größen über Dichte und komponenteneigene Tokens, die ohne Angular Material nicht vorhanden sind. |
| `--mat-sys-focus-indicator-*` | zusätzliche Fokus-Tokens | Angular Material führt Fokusindikatoren als `--mat-focus-indicator-*` (ohne `sys`). Um alle Variablen im `--mat-sys-*`-Schema zu halten, unter `sys` angelegt. |
| Steuerelementhöhe 44/36 px statt 40 dp, Zielgröße 44/32 px statt 48 dp | Wert | Design Guideline und Anforderungen legen 44 px (Touch, WCAG 2.5.5 AAA) und 36 px ab 1280 px fest; entspricht M3-Dichte −1 auf dem Desktop. WCAG 2.5.8 (24 px) bleibt erfüllt. |
| Primärfarbe `#1f3a5f` (Ton ≈ 24) statt M3-Ton 40 | Wert | Markenfarbe der Design Guideline; Kontrast 11,48:1 deutlich über AA. `primary-container`/`on-primary-container` sind daran angepasst. |
| `--mat-sys-on-primary-container` = `primary`, `--mat-sys-on-tertiary-container` = `tertiary`, `--mat-sys-on-error-container` = `error` | Wert | Bestehende Paare (`primary-soft`/`primary`, `brass-soft`/`brass-ink`, `destructive-soft`/`destructive-ink`) bleiben optisch gleich; Kontraste 9,84 / 6,12 / 5,91 : 1. |
| Gewicht 600 für Headline/Title statt 400/500 | Wert | Inter wirkt bei 400 deutlich schwächer als Roboto; bestehende Hierarchie der Design Guideline. |
| Schrift Inter statt Roboto | Wert | Markenschrift, lokal gebündelt (`@fontsource-variable/inter`). |
| komponenteninterne `--z-*`-Variablen (Animation) | bleiben | Animationsparameter einzelner Zard-Komponenten, keine Theme-Tokens. |
| Tailwind-Farbaliase für Zard (`--color-muted-foreground` → `var(--mat-sys-on-surface-variant)` usw.) | Tailwind-intern | Zard-Quellcode nutzt shadcn-Klassennamen; die Aliase sind Tailwind-Theme-Werte, keine eigenen Variablen mit eigenem Wert. Werden mit dem Umstieg auf `vm-*` schrittweise überflüssig. |

## Kontrastprüfung

Rechnerisch nach WCAG 2.x (relative Leuchtdichte), geplante Paare. Text: mindestens 4,5:1; UI-Bestandteile, Fokusringe: mindestens 3:1.

| Paar | Kontrast | Ergebnis |
| --- | --- | --- |
| on-primary / primary | 11,48:1 | AA |
| on-primary-container / primary-container | 9,84:1 | AA |
| primary / surface | 11,48:1 | AA |
| on-secondary / secondary | 6,48:1 | AA |
| on-secondary-container / secondary-container | 7,20:1 | AA |
| on-tertiary / tertiary | 6,75:1 | AA |
| on-tertiary-container / tertiary-container | 6,12:1 | AA |
| on-surface / tertiary-fixed-dim (Vereinslogo) | 6,65:1 | AA |
| on-error / error | 6,47:1 | AA |
| on-error-container / error-container | 5,91:1 | AA |
| error / surface | 6,47:1 | AA |
| on-surface / surface | 17,72:1 | AA |
| on-surface-variant / surface | 5,95:1 | AA |
| on-surface-variant / surface-container-low | 5,70:1 | AA |
| on-surface-variant / surface-container | 5,42:1 | AA |
| on-surface-variant / surface-container-high | 5,05:1 | AA |
| on-surface-variant / surface-container-highest | 4,69:1 | AA (knapp) |
| on-surface / surface-container-highest | 13,96:1 | AA |
| inverse-on-surface / inverse-surface | 12,29:1 | AA |
| inverse-primary / inverse-surface | 7,78:1 | AA |
| on-success-container / success-container | 4,76:1 | AA (knapp) |
| on-warning-container / warning-container | 6,65:1 | AA |
| outline / surface (Eingaberahmen) | 3,42:1 | AA (UI) |
| outline / surface-container | 3,11:1 | AA (UI, knapp) |
| outline / surface-container-low | 3,28:1 | AA (UI) |
| primary / surface (Fokusring) | 11,48:1 | AA (UI) |

Befunde im Bestand:

- `--brass` `#c8963e` auf Weiß: 2,66:1 – nur als Fläche mit dunklem Text genutzt (Vereinslogo, 6,65:1), nie als Text oder alleiniger Rahmen. Bleibt so, als `tertiary-fixed-dim` nur für Flächen.
- `--border` `#e4e4e7` auf Weiß: 1,27:1 – nur dekorativ (Kartenrahmen, Trennlinien). Steuerelemente nutzen `--input` (3,42:1). Bleibt als `outline-variant`, darf nicht alleinige Grenze eines Bedienelements sein.
- Deaktivierte Primary-Buttons mit `opacity-50`: 2,78:1 – nach WCAG ausgenommen, wird in D-18 auf M3-Darstellung umgestellt.
- `on-surface-variant` auf `surface-container-highest` und `on-success-container` auf `success-container` sind knapp über 4,5:1 – bei Änderungen dieser Werte neu prüfen.

## Lib-Vorschläge (nicht umgesetzt)

| Lib | Wofür | Warum |
| --- | --- | --- |
| `@material/material-color-utilities` (Google, Apache-2.0) | Tonpaletten (HCT) aus der Markenfarbe erzeugen, inkl. Darkmode-Werten (D-21) | Liefert exakt die M3-Tonwerte statt handgewählter Hex-Werte; nur als Dev-Werkzeug bzw. Skript nötig, nicht im Bundle. |
| `@playwright/test` (falls nicht schon über das E2E-Setup vorhanden) | Screenshot-Vergleiche vor/nach Design-Umbauten | Macht visuelle Änderungen der Umbau-PRs prüfbar; `axe-core` ist bereits vorhanden und kann für automatische Kontrastprüfung im selben Lauf genutzt werden. |

## Umsetzungsstand

Stand: 23.11.2026. Die Referenzseite `material.angular.dev` wurde im Browser ausgelesen. Damit sind die oben mit „(prüfen)“ markierten Werte geklärt: Fokus- und Pressed-State-Layer haben die Deckkraft `0.12`, Laufweiten werden in `rem` geführt, die Schatten `level0` bis `level5` sind die dort ausgegebenen dreiteiligen Werte. `--mat-sys-font-plain` gibt es in der Referenz nicht und wurde nicht angelegt. Ergänzt wurden `--mat-sys-neutral10`, `--mat-sys-neutral-variant20` und `--mat-sys-label-*-weight-prominent`.

| Thema | PR | Anmerkung |
| --- | --- | --- |
| D-01 | MusikzugSN/VM-Next#32 | gemergt |
| D-02 | MusikzugSN/VM-Next#33 | gemergt |
| D-03 | MusikzugSN/VM-Next#34 | |
| D-04 | MusikzugSN/VM-Next#36 | |
| D-05 | MusikzugSN/VM-Next#37 | |
| D-06 | MusikzugSN/VM-Next#38 | |
| D-07 | MusikzugSN/VM-Next#39 | |
| D-08 | MusikzugSN/VM-Next#40 | `vm-form-dialog` und `vm-name-dialog` bleiben in der App |
| D-09 | MusikzugSN/VM-Next#41 | |
| D-10 | MusikzugSN/VM-Next#42 | |
| D-11 | MusikzugSN/VM-Next#43 | |
| D-12 | MusikzugSN/VM-Next#44 | `vm-status-badge` bleibt in der App |
| D-13 | MusikzugSN/VM-Next#45 | kein `vm-tooltip`, die App nutzt keine Tooltips |
| D-14 | MusikzugSN/VM-Next#46 | kein `vm-list-item`, Profil-Tabelle bleibt |
| D-15 | MusikzugSN/VM-Next#47 | |
| D-16 | MusikzugSN/VM-Next#48 | |
| D-17 | MusikzugSN/VM-Next#49 | keine Navigation Rail |
| D-18 | MusikzugSN/VM-Next#50 | |
| D-19 | MusikzugSN/VM-Next#51 | |
| D-20 | MusikzugSN/VM-Next#52 | |
| D-21 | MusikzugSN/VM-Next#53 | keine dunklen Farbwerte, Anforderung steht aus |
| D-22 | MusikzugSN/VM-Next#54 | externe Design Guideline nicht geändert |

### Zusätzliche Abweichungen aus der Umsetzung

| Abweichung | Thema | Begründung |
| --- | --- | --- |
| Dialogfläche `surface-container-low` statt `surface-container-high` | D-08 | `outline` erreicht auf `surface-container-high` nur 2,90:1 (WCAG 1.4.11), auf `surface-container-low` 3,28:1. |
| Trennlinien an Dialog-Header und -Footer | D-08 | Der Inhalt langer Dialoge scrollt zwischen beiden Bereichen. |
| Button-Innenabstand 16 px statt 24 dp | D-06 | Viele Buttons in engen Zeilen der Verwaltungsseiten. |
| Fokusring 2 px in `primary` statt 3 dp in `secondary` | D-09 | Festlegung der Design Guideline, deutlich höherer Kontrast. |
| Schalter 48×28 px statt 52×32 dp | D-11 | Passt in die kompakten Zeilen ab 1280 px. |
| Schalter-Griff aus: `on-surface-variant` statt `outline` | D-11 | `outline` erreicht auf der Spur nicht 3:1. |
| Feste Farben in data-URLs (Haken `#ffffff`, Pfeil `#63636b`) | D-07, D-11 | In data-URLs greifen keine CSS-Variablen. Die Werte entsprechen `on-primary` und `on-surface-variant`. |
| Menüeinträge 44/32 px statt 48 dp | D-13 | Gleiche Zielgrößen wie die übrigen Bedienelemente. |
| Tabellenzeilen kompakt statt 52–56 dp | D-14 | Dichte der Verwaltungslisten. |
| `text-[13px]` einheitlich zu `body-medium` | D-15 | Die größere Rolle ist die lesbarere, eine Unterscheidung nach Inhalt wäre unzuverlässig. |
| Top App Bar 56 px statt 64 dp, Titel `title-medium` | D-17 | Mehr Inhaltshöhe auf kleinen Displays. |
| Keine Navigation Rail | D-17 | Breakpoints und Verhalten der Navigation sollen gleich bleiben. |
| Tailwind-Aliase `rounded-sm` … `-xl`, `shadow-sm`/`-lg`, shadcn-Farbnamen | D-01, D-19 | Der Zard-Code nutzt diese Namen. Sie zeigen ohne eigene Werte auf `--mat-sys-*`. |
