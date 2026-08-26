// Strict validation for values that get interpolated directly into XRS XML
// requests (date="${...}" time="${...}"). Client-side checks (input maxlength,
// onChange guards) can always be bypassed by calling these API routes
// directly, so every route that builds XML from these fields must validate
// here first — an unvalidated string can break the XML attribute it's
// injected into or smuggle extra attributes/nodes into the request.

const DATE_RE = /^\d{8}$/;              // YYYYMMDD, as sent to <checkout/checkin date="...">
const TIME_RE = /^([01]\d|2[0-3])[0-5]\d$/; // HHMM, 0000–2359

export function isValidXRSDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const year  = parseInt(value.slice(0, 4), 10);
  const month = parseInt(value.slice(4, 6), 10);
  const day   = parseInt(value.slice(6, 8), 10);
  if (year < 2000 || year > 2099) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  return true;
}

export function isValidXRSTime(value: unknown): value is string {
  return typeof value === 'string' && TIME_RE.test(value);
}
