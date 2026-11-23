/** M3 Outlined Text Field: Rahmen `outline`, Fokus 2 px `primary`, Fehler 2 px `error`. */
const outlined =
  'w-full min-w-0 rounded-extra-small border border-outline bg-transparent text-body-large text-on-surface transition-colors outline-none placeholder:text-on-surface-variant hover:border-on-surface focus-visible:border-primary aria-invalid:border-error aria-invalid:inset-ring-1 aria-invalid:inset-ring-error disabled:cursor-not-allowed disabled:border-on-surface/12 disabled:text-on-surface/38 md:text-body-medium';

export const vmInputClasses = `${outlined} h-control px-spacing-md py-spacing-xs file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-label-large file:text-on-surface xl:h-control-compact`;

export const vmTextareaClasses = `${outlined} flex field-sizing-content min-h-16 px-spacing-md py-spacing-sm`;

// Lucide `chevron-down` in `on-surface-variant` (#63636b). In einer data-URL greifen keine CSS-Variablen.
const CHEVRON =
  'bg-[url(data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20viewBox%3D%270%200%2024%2024%27%20fill%3D%27none%27%20stroke%3D%27%2363636b%27%20stroke-width%3D%272%27%20stroke-linecap%3D%27round%27%20stroke-linejoin%3D%27round%27%3E%3Cpath%20d%3D%27m6%209%206%206%206-6%27%2F%3E%3C%2Fsvg%3E)]';

export const vmSelectClasses = `${outlined} h-control appearance-none bg-size-[1rem] bg-position-[right_0.625rem_center] bg-no-repeat py-spacing-xs ps-spacing-md pe-8 select-none xl:h-control-compact ${CHEVRON} [&[multiple]]:h-auto [&[multiple]]:bg-none [&_optgroup]:bg-[Canvas] [&_optgroup]:text-[CanvasText] [&_option]:bg-[Canvas] [&_option]:text-[CanvasText]`;
