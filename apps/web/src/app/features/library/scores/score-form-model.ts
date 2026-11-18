import type { CreateScoreBody, CustomFieldValue, FieldDefinition, ScoreDetailsResponse } from '@vm-web/shared';

import { formatDuration, parseDuration } from './score-query';

/** Text inputs of the score form; custom fields keep their raw input per field id. */
export interface ScoreFormInput {
  title: string;
  composer: string;
  arranger: string;
  publisher: string;
  publisherNumber: string;
  duration: string;
  tagIds: string[];
  /** text/link/number/date/select: string; multiselect: string[]; boolean: boolean. */
  custom: Record<string, string | string[] | boolean>;
}

/** Field → i18n key of the problem (`validation.*`), same keys as the API's JSON pointers below `/body`. */
export type ScoreFormErrors = Record<string, string>;

export function emptyScoreForm(): ScoreFormInput {
  return { title: '', composer: '', arranger: '', publisher: '', publisherNumber: '', duration: '', tagIds: [], custom: {} };
}

export function scoreFormFromDetails(details: ScoreDetailsResponse, fields: readonly FieldDefinition[]): ScoreFormInput {
  const custom: ScoreFormInput['custom'] = {};
  for (const field of fields) {
    const value = details.customFields[field.id];
    if (field.type === 'multiselect') custom[field.id] = Array.isArray(value) ? value.map(String) : [];
    else if (field.type === 'boolean') custom[field.id] = value === true;
    else custom[field.id] = value === null || value === undefined ? '' : String(value);
  }
  return {
    title: details.title,
    composer: details.composer ?? '',
    arranger: details.arranger ?? '',
    publisher: details.publisher ?? '',
    publisherNumber: details.publisherNumber ?? '',
    duration: formatDuration(details.durationSeconds),
    tagIds: details.tags.map((tag) => tag.id),
    custom,
  };
}

const text = (value: string): string | null => value.trim() || null;

/**
 * Checks the input like the API does and builds the request body. Errors use the API's field
 * paths (`title`, `durationSeconds`, `customFields/<id>`) so server errors land at the same place.
 */
export function buildScoreBody(input: ScoreFormInput, fields: readonly FieldDefinition[]): { body?: CreateScoreBody; errors: ScoreFormErrors } {
  const errors: ScoreFormErrors = {};
  if (!input.title.trim()) errors['title'] = 'required';
  const duration = parseDuration(input.duration);
  if (Number.isNaN(duration)) errors['durationSeconds'] = 'invalid_format';

  const customFields: Record<string, CustomFieldValue> = {};
  for (const field of fields) {
    const raw = input.custom[field.id];
    let value: CustomFieldValue = null;
    switch (field.type) {
      case 'multiselect':
        value = Array.isArray(raw) && raw.length ? raw : null;
        break;
      case 'boolean':
        value = raw === true;
        break;
      case 'number': {
        const s = typeof raw === 'string' ? raw.trim().replace(',', '.') : '';
        if (s) {
          const n = Number(s);
          if (Number.isNaN(n)) errors[`customFields/${field.id}`] = 'invalid_type';
          else value = n;
        }
        break;
      }
      default:
        value = typeof raw === 'string' && raw.trim() ? raw.trim() : null;
    }
    if (field.required && field.type !== 'boolean' && value === null && !errors[`customFields/${field.id}`]) {
      errors[`customFields/${field.id}`] = 'required';
    }
    customFields[field.id] = value;
  }

  if (Object.keys(errors).length) return { errors };
  return {
    errors,
    body: {
      title: input.title.trim(),
      composer: text(input.composer),
      arranger: text(input.arranger),
      publisher: text(input.publisher),
      publisherNumber: text(input.publisherNumber),
      durationSeconds: duration,
      customFields,
      tagIds: input.tagIds,
    },
  };
}
