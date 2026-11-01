/**
 * Sign-in and sign-up errors by code (V2 closing). Pure logic. The identity service answers codes; the app shows its own
 * words in the app's language instead of the server's Turkish text (or, before, English "Invalid credentials.").
 */
export const MIN_PASSWORD_LENGTH = 8;

const AUTH_CODES = new Set([
  'INVALID_CREDENTIALS',
  'INVALID_USERNAME',
  'USERNAME_TAKEN',
  'INVALID_EMAIL',
  'EMAIL_TAKEN',
  'INVALID_PASSWORD',
  'PASSWORD_TOO_SHORT',
  'PASSWORD_TOO_LONG',
  'AGE_TOO_YOUNG',
  'BIRTH_YEAR_REQUIRED',
  'INVALID_BIRTH_YEAR',
  'TOO_MANY_ATTEMPTS',
]);

/** The translation key for an identity error code, or null when it is not one of them. */
export const authErrorKey = (code: string | null | undefined) => (code && AUTH_CODES.has(code) ? `errors:auth.${code}` : null);

/** Register form: whether the password is long enough yet (the server checks it too). */
export const passwordLongEnough = (password: string) => password.length >= MIN_PASSWORD_LENGTH;
