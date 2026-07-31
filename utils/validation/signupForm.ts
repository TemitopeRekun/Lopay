import {
  FIELD_ERROR_CODES,
  MAX_EMAIL_LENGTH,
  MAX_NAME_LENGTH,
  MAX_PASSWORD_LENGTH,
  MIN_NAME_LENGTH,
  MIN_PASSWORD_LENGTH,
  fieldError,
  type FieldError,
  type FieldName,
  type FormErrors,
} from './codes';
import {
  sanitizeEmail,
  sanitizeName,
  sanitizePassword,
  sanitizePhone,
} from './sanitize';
import { isValidPhone } from '../phone';

/**
 * Field-level validation for the sign-up and sign-in forms.
 *
 * Each validator takes the RAW input, sanitizes it, and returns a `FieldError` or
 * `null`. Sanitizing inside the validator rather than before it means a caller
 * cannot accidentally validate one value and submit another — the check and the
 * payload are derived from the same normalisation.
 *
 * Validators are individually exported so the form can check one field on blur
 * without evaluating (and prematurely erroring on) fields the parent hasn't
 * reached yet.
 */

/**
 * Email shape check.
 *
 * Deliberately NOT an RFC 5322 regex. Those are enormous, and every one in the
 * wild rejects some address that really exists. The only cheap check worth making
 * client-side is "does this look like it could be an address" — the authoritative
 * answer comes from the server (and ultimately from whether mail arrives).
 *
 * Requires: something, one @, something, a dot, a 2+ char TLD, and no spaces.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/;

export function validateFullName(raw: string): FieldError | null {
  const name = sanitizeName(raw);
  if (!name) return fieldError(FIELD_ERROR_CODES.NAME_REQUIRED);
  if (name.length < MIN_NAME_LENGTH || name.length > MAX_NAME_LENGTH) {
    return fieldError(FIELD_ERROR_CODES.NAME_LENGTH);
  }
  return null;
}

export function validateEmail(raw: string): FieldError | null {
  const email = sanitizeEmail(raw);
  if (!email) return fieldError(FIELD_ERROR_CODES.EMAIL_REQUIRED);
  if (email.length > MAX_EMAIL_LENGTH) {
    return fieldError(FIELD_ERROR_CODES.EMAIL_TOO_LONG);
  }
  if (!EMAIL_SHAPE.test(email)) {
    return fieldError(FIELD_ERROR_CODES.EMAIL_INVALID);
  }
  return null;
}

export function validatePhoneNumber(raw: string): FieldError | null {
  const phone = sanitizePhone(raw);
  if (!phone) return fieldError(FIELD_ERROR_CODES.PHONE_REQUIRED);
  if (!isValidPhone(phone)) {
    return fieldError(FIELD_ERROR_CODES.PHONE_INVALID);
  }
  return null;
}

/**
 * Password policy.
 *
 * The minimum is 8 to match the server's `minPasswordLength`. Beyond length, one
 * letter and one number is required — a low bar chosen on purpose: complexity
 * rules past that point push people toward `Password1!` and writing it on a note
 * beside the laptop, without adding real entropy.
 *
 * `context` lets the check refuse a password containing the user's own name or
 * email local part, which is the single most guessable choice a real person makes.
 */
export function validatePassword(
  raw: string,
  context: { fullName?: string; email?: string } = {},
): FieldError | null {
  const password = sanitizePassword(raw);
  if (!password) return fieldError(FIELD_ERROR_CODES.PASSWORD_REQUIRED);
  if (password.length < MIN_PASSWORD_LENGTH) {
    return fieldError(FIELD_ERROR_CODES.PASSWORD_TOO_SHORT);
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return fieldError(FIELD_ERROR_CODES.PASSWORD_TOO_LONG);
  }
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return fieldError(FIELD_ERROR_CODES.PASSWORD_NEEDS_LETTER_AND_NUMBER);
  }
  if (containsPersonalInfo(password, context)) {
    return fieldError(FIELD_ERROR_CODES.PASSWORD_CONTAINS_PERSONAL_INFO);
  }
  return null;
}

/**
 * Does the password embed the user's name or email local part?
 *
 * Only checks fragments of 4+ characters: a parent named "Ada" would otherwise be
 * unable to use any password containing those three letters in sequence, which is
 * a lot of ordinary English.
 */
function containsPersonalInfo(
  password: string,
  context: { fullName?: string; email?: string },
): boolean {
  const haystack = password.toLowerCase();
  const fragments: string[] = [];

  if (context.fullName) {
    fragments.push(...sanitizeName(context.fullName).toLowerCase().split(' '));
  }
  if (context.email) {
    const local = sanitizeEmail(context.email).split('@')[0];
    if (local) fragments.push(local);
  }

  return fragments.some(
    (fragment) => fragment.length >= 4 && haystack.includes(fragment),
  );
}

export function validateConfirmPassword(
  password: string,
  confirmPassword: string,
): FieldError | null {
  if (!confirmPassword) {
    return fieldError(FIELD_ERROR_CODES.CONFIRM_PASSWORD_REQUIRED);
  }
  if (password !== confirmPassword) {
    return fieldError(FIELD_ERROR_CODES.PASSWORD_MISMATCH);
  }
  return null;
}

/** The raw values the sign-up form holds. */
export interface SignupValues {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
}

/** The raw values the sign-in form holds. */
export interface LoginValues {
  email: string;
  password: string;
}

/**
 * Validate one field of the sign-up form.
 *
 * Used for on-blur checks, so a parent learns their phone number is malformed
 * when they leave the field rather than after filling in four more.
 */
export function validateSignupField(
  field: FieldName,
  values: SignupValues,
): FieldError | null {
  switch (field) {
    case 'fullName':
      return validateFullName(values.fullName);
    case 'email':
      return validateEmail(values.email);
    case 'phoneNumber':
      return validatePhoneNumber(values.phoneNumber);
    case 'password':
      return validatePassword(values.password, {
        fullName: values.fullName,
        email: values.email,
      });
    case 'confirmPassword':
      return validateConfirmPassword(values.password, values.confirmPassword);
    default:
      return null;
  }
}

/**
 * Validate the whole sign-up form. Returns every failure at once, keyed by field,
 * so submitting an empty form marks all five inputs rather than making the parent
 * discover them one at a time.
 */
export function validateSignupForm(values: SignupValues): FormErrors {
  const errors: FormErrors = {};

  const fields: Exclude<FieldName, 'form'>[] = [
    'fullName',
    'email',
    'phoneNumber',
    'password',
    'confirmPassword',
  ];
  for (const field of fields) {
    const error = validateSignupField(field, values);
    if (error) errors[field] = error;
  }

  return errors;
}

/**
 * Validate the sign-in form.
 *
 * Only presence and shape — sign-in must NOT apply the password policy. An
 * account created before the rules tightened still has a valid password, and
 * refusing to even attempt the login would lock that parent out of their own
 * account with a message implying their password is wrong.
 */
export function validateLoginForm(values: LoginValues): FormErrors {
  const errors: FormErrors = {};

  const emailError = validateEmail(values.email);
  if (emailError) errors.email = emailError;

  if (!values.password) {
    errors.password = fieldError(FIELD_ERROR_CODES.PASSWORD_REQUIRED);
  }

  return errors;
}

/** Does this error map contain anything? */
export function hasErrors(errors: FormErrors): boolean {
  return Object.values(errors).some(Boolean);
}
