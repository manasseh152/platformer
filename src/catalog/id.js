export const KEBAB_CASE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isKebabCaseId(value) {
  return typeof value === 'string' && KEBAB_CASE_ID.test(value);
}
