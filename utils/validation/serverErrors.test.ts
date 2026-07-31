import { describe, it, expect, afterEach, vi } from 'vitest';
import { mapServerError } from './serverErrors';
import { FIELD_ERROR_CODES } from './codes';

describe('mapServerError', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── The headline cases the sign-up form exists to handle ────────────────────

  describe('email already used', () => {
    // This exact code string is what better-auth@1.6 throws from
    // /sign-up/email when the address is taken. If a version bump changes it,
    // this test fails rather than the message silently becoming generic.
    it('maps Better Auth USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL to the email field', () => {
      const mapped = mapServerError({
        code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
        message: 'User already exists. Use another email.',
      });

      expect(mapped.field).toBe('email');
      expect(mapped.error.code).toBe(
        FIELD_ERROR_CODES.EMAIL_ALREADY_REGISTERED,
      );
      expect(mapped.error.message).toContain('already has a LOPAY account');
    });

    it('also handles the shorter USER_ALREADY_EXISTS variant', () => {
      expect(mapServerError({ code: 'USER_ALREADY_EXISTS' }).field).toBe(
        'email',
      );
    });

    // Never render the server's own sentence: that is how internal detail and
    // untranslated library copy leak into the UI.
    it('shows our copy, not the server message', () => {
      const mapped = mapServerError({
        code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
        message: 'User already exists. Use another email.',
      });
      expect(mapped.error.message).not.toBe(
        'User already exists. Use another email.',
      );
    });
  });

  describe('phone already used', () => {
    it('maps our PHONE_ALREADY_REGISTERED to the phone field', () => {
      const mapped = mapServerError({ code: 'PHONE_ALREADY_REGISTERED' });

      expect(mapped.field).toBe('phoneNumber');
      expect(mapped.error.code).toBe(
        FIELD_ERROR_CODES.PHONE_ALREADY_REGISTERED,
      );
    });

    it('maps our PHONE_INVALID to the phone field', () => {
      expect(mapServerError({ code: 'PHONE_INVALID' }).field).toBe(
        'phoneNumber',
      );
    });
  });

  describe('name codes from the server guard', () => {
    it('maps NAME_REQUIRED and NAME_LENGTH to the name field', () => {
      expect(mapServerError({ code: 'NAME_REQUIRED' }).field).toBe('fullName');
      expect(mapServerError({ code: 'NAME_LENGTH' }).field).toBe('fullName');
    });
  });

  describe('password and credentials', () => {
    it('maps PASSWORD_TOO_SHORT to the password field', () => {
      const mapped = mapServerError({ code: 'PASSWORD_TOO_SHORT' });
      expect(mapped.field).toBe('password');
      expect(mapped.error.code).toBe(FIELD_ERROR_CODES.PASSWORD_TOO_SHORT);
    });

    // A wrong sign-in must NOT be attributed to one field: saying which of the
    // two was wrong tells an attacker whether the account exists.
    it('keeps INVALID_EMAIL_OR_PASSWORD at form level', () => {
      const mapped = mapServerError({ code: 'INVALID_EMAIL_OR_PASSWORD' });
      expect(mapped.field).toBe('form');
      expect(mapped.error.code).toBe(FIELD_ERROR_CODES.INVALID_CREDENTIALS);
    });
  });

  // FAILED_TO_CREATE_USER is what surfaces when a concurrent signup loses the
  // race to the phoneHash unique index — we genuinely don't know the field.
  it('maps FAILED_TO_CREATE_USER to a generic form error', () => {
    const mapped = mapServerError({ code: 'FAILED_TO_CREATE_USER' });
    expect(mapped.field).toBe('form');
    expect(mapped.error.code).toBe(FIELD_ERROR_CODES.SIGNUP_FAILED);
  });

  // ── Where the code is found ─────────────────────────────────────────────────

  describe('error shapes', () => {
    it('reads a code off the Better Auth client error object', () => {
      expect(
        mapServerError({ code: 'PHONE_ALREADY_REGISTERED', status: 422 }).field,
      ).toBe('phoneNumber');
    });

    it('reads a code off a thrown APIError body', () => {
      expect(
        mapServerError({ body: { code: 'PHONE_ALREADY_REGISTERED' } }).field,
      ).toBe('phoneNumber');
    });

    it('reads a code off an axios response body', () => {
      expect(
        mapServerError({
          response: { status: 409, data: { code: 'PHONE_ALREADY_REGISTERED' } },
        }).field,
      ).toBe('phoneNumber');
    });

    it('reports the raw server code for logging', () => {
      expect(mapServerError({ code: 'PHONE_ALREADY_REGISTERED' }).serverCode).toBe(
        'PHONE_ALREADY_REGISTERED',
      );
      expect(mapServerError({ status: 500 }).serverCode).toBeNull();
    });
  });

  // ── Transport-level failures ────────────────────────────────────────────────

  describe('status-based inference', () => {
    it('maps 429 to a rate-limit message', () => {
      const mapped = mapServerError({ status: 429 });
      expect(mapped.error.code).toBe(FIELD_ERROR_CODES.RATE_LIMITED);
      expect(mapped.field).toBe('form');
    });

    it('maps a 5xx to a server error', () => {
      expect(mapServerError({ status: 500 }).error.code).toBe(
        FIELD_ERROR_CODES.SERVER_ERROR,
      );
      expect(mapServerError({ response: { status: 503 } }).error.code).toBe(
        FIELD_ERROR_CODES.SERVER_ERROR,
      );
    });

    // "Check your connection" and "check what you typed" are opposite advice,
    // and mobile connectivity makes guessing wrong a real support cost.
    it('detects a network failure from an axios code', () => {
      expect(mapServerError({ code: 'ERR_NETWORK' }).error.code).toBe(
        FIELD_ERROR_CODES.NETWORK_UNAVAILABLE,
      );
    });

    it('detects a network failure from a fetch message', () => {
      expect(
        mapServerError({ message: 'Failed to fetch' }).error.code,
      ).toBe(FIELD_ERROR_CODES.NETWORK_UNAVAILABLE);
    });

    it('detects a network failure when the browser reports being offline', () => {
      vi.stubGlobal('navigator', { onLine: false });
      expect(mapServerError({ message: 'boom' }).error.code).toBe(
        FIELD_ERROR_CODES.NETWORK_UNAVAILABLE,
      );
    });

    it('prefers a recognised code over status inference', () => {
      const mapped = mapServerError({
        code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
        status: 500,
      });
      expect(mapped.field).toBe('email');
    });
  });

  // ── Fallbacks ──────────────────────────────────────────────────────────────

  describe('unrecognised input', () => {
    it('falls back to the supplied code', () => {
      const mapped = mapServerError(
        { code: 'SOME_NEW_CODE', status: 422 },
        FIELD_ERROR_CODES.SIGNUP_FAILED,
      );
      expect(mapped.field).toBe('form');
      expect(mapped.error.code).toBe(FIELD_ERROR_CODES.SIGNUP_FAILED);
      // Still reported, so an unmapped code shows up in the logs.
      expect(mapped.serverCode).toBe('SOME_NEW_CODE');
    });

    it('defaults to UNKNOWN_ERROR with no fallback given', () => {
      vi.stubGlobal('navigator', { onLine: true });
      expect(mapServerError({ status: 422 }).error.code).toBe(
        FIELD_ERROR_CODES.UNKNOWN_ERROR,
      );
    });

    it.each([null, undefined, 'a string', 42])(
      'handles %s without throwing',
      (input) => {
        vi.stubGlobal('navigator', { onLine: true });
        expect(() => mapServerError(input)).not.toThrow();
        expect(mapServerError(input).field).toBe('form');
      },
    );

    it('always returns a non-empty message', () => {
      vi.stubGlobal('navigator', { onLine: true });
      expect(mapServerError({}).error.message.length).toBeGreaterThan(0);
    });
  });
});
