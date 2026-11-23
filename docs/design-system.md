# Design-System von VM-Web

VM-Web folgt Material Design 3 (M3). Angular Material ist nicht installiert: Die Variablen tragen die Namen der Angular-Material-System-Variablen (`--mat-sys-*`), sind aber selbst definiert. Zard UI bleibt die technische Basis der Komponenten.

Die Begründungen, Abweichungen und die Reihenfolge des Umbaus stehen in [`design-findings.md`](design-findings.md).

## Aufbau

| Ort | Inhalt |
| --- | --- |
| `libs/ui/src/styles/m3-theme.css` | alle `--mat-sys-*`-Tokens |
| `apps/web/src/styles.css` | Mapping der Tokens auf Tailwind (`@theme`), globaler Fokusring |
| `libs/ui/src/lib/<baustein>` | `vm-*`-Komponenten, Import aus `@vm-web/ui` |
| `libs/ui/src/lib/zard` | Zard-Quellcode, nur über `vm-*` verwenden |

## Regeln

1. Farben, Schrift, Formen, Schatten und Größen kommen aus den Tokens. Keine Hex-Werte, keine freien Schriftgrößen wie `text-[13px]`.
2. Seiten nutzen `vm-*`-Bausteine statt Zard direkt.
3. Buttons werden über `[zDisabled]` deaktiviert, nie über `[disabled]`.
4. Text steht auf dem passenden Rollenpaar, zum Beispiel `bg-primary-container` mit `text-on-primary-container`.
5. Zustände sind nie nur an der Farbe erkennbar. Fehler und Status tragen Icon oder Text.
6. Neue Farbpaare müssen WCAG AA erfüllen: Text 4,5:1, Bedienelemente und Fokus 3:1.
7. `bg-white` ist nur für die Papierfläche der Noten erlaubt.
8. Keine `dark:`-Klassen. Der spätere Darkmode entsteht über zweite Werte der Farbrollen mit `light-dark()`.

## Tokens als Tailwind-Klassen

| Bereich | Token | Klassen |
| --- | --- | --- |
| Farbe | `--mat-sys-surface-container`, `--mat-sys-on-surface-variant` … | `bg-surface-container`, `text-on-surface-variant`, `border-outline` |
| Typografie | `--mat-sys-body-medium`, `--mat-sys-title-large` … | `text-body-medium`, `text-title-large`, `text-label-small` |
| Form | `--mat-sys-corner-small` … `-extra-large`, `-full` | `rounded-small`, `rounded-medium`, `rounded-extra-large`, `rounded-full` |
| Elevation | `--mat-sys-level0` … `level5` | `shadow-level1`, `shadow-level3` |
| Abstand | `--mat-sys-spacing-xs` … `-xxxl` | `gap-spacing-lg`, `px-spacing-md` |
| Höhe, Zielfläche | `--mat-sys-control-height(-compact)`, `--mat-sys-target-size(-compact)` | `h-control`, `xl:h-control-compact`, `min-h-target` |
| Icons | `--mat-sys-icon-size-xs` … `-lg` | `size="var(--mat-sys-icon-size-md)"`, `size-icon-sm` |
| Layout | Kopfzeile, Navigation, Inhalt, Dialoge | `h-header`, `w-sidebar`, `max-w-content`, `max-w-dialog-md` |

Die shadcn-Namen wie `bg-muted` oder `text-muted-foreground` bestehen nur noch als Tailwind-Aliase für den Zard-Code und bestehende Templates. Neuer Code nutzt die M3-Namen.

## Typrollen

| Rolle | Verwendung |
| --- | --- |
| `headline-large` | Login-Hero |
| `headline-small` | Seitentitel, Dialogtitel |
| `title-large` | Abschnittstitel |
| `title-medium` | Kartentitel, Vereinsname |
| `title-small` | kleine Überschriften |
| `body-large` | Eingaben auf Telefonen |
| `body-medium` | Fließtext, Hilfstexte |
| `body-small` | Zeitstempel, Metadaten |
| `label-large` | Buttons, Navigation, Feldlabel |
| `label-medium` | Badges, Tabellenkopf |
| `label-small` | Zähler |

## Bausteine

| Baustein | Verwendung |
| --- | --- |
| `button[vm-button]`, `a[vm-button]` | `variant="filled \| tonal \| outlined \| text \| danger"`, `size="default \| sm"` |
| `button[vm-icon-button]` | Icon-Button, braucht immer ein `aria-label` |
| `input[vm-input]`, `textarea[vm-textarea]`, `select[vm-select]` | Outlined-Felder auf den nativen Elementen |
| `label[vm-field]`, `span[vm-field-label]`, `span[vm-field-error]` | Feld-Anatomie, Fehler mit Icon und Text |
| `input[type=checkbox][vm-checkbox]`, `vm-switch` | Checkbox und Schalter |
| `vm-dialog`, `vm-sheet`, `VmConfirmDialogService` | Dialog, Seitenpanel, Bestätigung |
| `[vm-card]` | `variant="outlined \| filled \| elevated"` |
| `[vm-badge]`, `[vm-badge-count]` | `tone="neutral \| primary \| tertiary \| error \| success \| warning"`, Zähler |
| `[vm-menu-trigger]`, `vm-menu-content`, `[vm-menu-item]` | Menü, Import über `VmMenuImports` |
| `vm-toaster`, `VmToastService` | Snackbar |
| `table[vm-table]` | Datentabelle mit Kopf, Trennlinien und Zeilen-Hover |
