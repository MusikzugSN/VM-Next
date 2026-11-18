import type { CustomFieldType, FieldDefinition } from '@vm-web/shared';

/** Editor state of a custom field; options as text, one per line. */
export interface FieldDraft {
  name: string;
  type: CustomFieldType;
  required: boolean;
  options: string;
}

export function emptyDraft(): FieldDraft {
  return { name: '', type: 'text', required: false, options: '' };
}

export function draftFromField(field: FieldDefinition): FieldDraft {
  return { name: field.name, type: field.type, required: field.required, options: field.options.map((o) => o.label).join('\n') };
}

/**
 * Lines → option inputs. A line whose label matches an existing option keeps that option's id, so
 * values already stored in scores stay valid (N-2); duplicates and empty lines are dropped.
 */
export function optionsFromText(text: string, existing: readonly { id: string; label: string }[]): { id?: string; label: string }[] {
  const byLabel = new Map(existing.map((o) => [o.label, o.id]));
  const seen = new Set<string>();
  const result: { id?: string; label: string }[] = [];
  for (const raw of text.split('\n')) {
    const label = raw.trim().slice(0, 100);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    const id = byLabel.get(label);
    result.push(id ? { id, label } : { label });
  }
  return result;
}
