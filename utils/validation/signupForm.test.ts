import { describe, it, expect } from 'vitest';
import {
  hasErrors,
  validateConfirmPassword,
  validateEmail,
  validateFullName,
  validateLoginForm,
  validatePassword,
  validatePhoneNumber,
  validateSignupField,
  validateSignupForm,
  type SignupValues,
} from './signupForm';
import { FIELD_ERROR_CODES } from './codes';

const ZWSP = String.fromCharCode(0x200b);

const VALID: SignupValues = {
  fullName: 'Ada Lovelace',
  email: 'ada@gmail.com',
  phoneNumber: '08012345678',
  password: 'lopay2026pass',
  confirmPassword: 'lopay2026pass',
};

describe('validateFullName', () => {
  it('accepts an ordinary name', () => {
    expect(validateFullName('Ada Lovelace')).toBeNull();
  });

  it('requires a name', () => {
    expect(validateFullName('')?.code).toBe(FIELD_ERROR_CODES.NAME_REQUIRED);
    expect(validateFullName('   ')?.code).toBe(FIELD_ERROR_CODES.NAME_REQUIRED);
  });

  // Whitespace-only input that LOOKS filled in must still report as missing.
  it('treats an invisible-only name as missing', () => {
    expect(validateFullName(`${ZWSP}${ZWSP}`)?.code).toBe(
      FIELD_ERROR_CODES.NAME_REQUIRED,
    );
  });

  it('rejects a single character', () => {
    expect(validateFullName('A')?.code).toBe(FIELD_ERROR_CODES.NAME_LENGTH);
  });

  it('rejects a name past 80 characters', () => {
    expect(validateFullName('a'.repeat(81))?.code).toBe(
      FIELD_ERROR_CODES.NAME_LENGTH,
    );
  });

  it('accepts the boundaries', () => {
    expect(validateFullName('Ab')).toBeNull();
    expect(validateFullName('a'.repeat(80))).toBeNull();
  });

  it('validates the sanitized value, not the raw one', () => {
    // Ten spaces around a 2-char name is valid, because the stored value is 'Ab'.
    expect(validateFullName('     Ab     ')).toBeNull();
  });
});

describe('validateEmail', () => {
  it.each([
    'ada@gmail.com',
    'ada.lovelace@gmail.com',
    'ada+lopay@gmail.com',
    'ada@mail.co.uk',
    'a@b.co',
  ])('accepts %s', (email) => {
    expect(validateEmail(email)).toBeNull();
  });

  it.each([
    ['', FIELD_ERROR_CODES.EMAIL_REQUIRED],
    ['   ', FIELD_ERROR_CODES.EMAIL_REQUIRED],
    ['ada', FIELD_ERROR_CODES.EMAIL_INVALID],
    ['ada@', FIELD_ERROR_CODES.EMAIL_INVALID],
    ['ada@gmail', FIELD_ERROR_CODES.EMAIL_INVALID],
    ['ada@gmail.c', FIELD_ERROR_CODES.EMAIL_INVALID],
    ['@gmail.com', FIELD_ERROR_CODES.EMAIL_INVALID],
    ['ada@@gmail.com', FIELD_ERROR_CODES.EMAIL_INVALID],
  ])('rejects %s', (email, code) => {
    expect(validateEmail(email)?.code).toBe(code);
  });

  it('rejects an over-long address', () => {
    const long = `${'a'.repeat(250)}@gmail.com`;
    expect(validateEmail(long)?.code).toBe(FIELD_ERROR_CODES.EMAIL_TOO_LONG);
  });

  it('accepts an address that is only valid after sanitizing', () => {
    expect(validateEmail('  Ada@Gmail.COM  ')).toBeNull();
  });
});

describe('validatePhoneNumber', () => {
  it.each([
    '08012345678',
    '0801 234 5678',
    '(0801)234-5678',
    '+2348012345678',
    '2348012345678',
    '+234 801 234 5678',
  ])('accepts %s', (phone) => {
    expect(validatePhoneNumber(phone)).toBeNull();
  });

  it('requires a number', () => {
    expect(validatePhoneNumber('')?.code).toBe(
      FIELD_ERROR_CODES.PHONE_REQUIRED,
    );
  });

  it.each(['0801234567', '080123456789', '801234567', '+2358012345678', 'abc'])(
    'rejects %s',
    (phone) => {
      expect(validatePhoneNumber(phone)?.code).toBe(
        FIELD_ERROR_CODES.PHONE_INVALID,
      );
    },
  );

  // The user asked for this explicitly: the message must not imply a country
  // code is needed, even though +234 numbers are accepted.
  it('asks for the plain 11-digit number in its message', () => {
    const error = validatePhoneNumber('0801');
    expect(error?.message).toContain('11-digit');
    expect(error?.message).toContain('08012345678');
    expect(error?.message).not.toContain('+234');
  });
});

describe('validatePassword', () => {
  it('accepts a password meeting the policy', () => {
    expect(validatePassword('lopay2026pass')).toBeNull();
  });

  it('requires a password', () => {
    expect(validatePassword('')?.code).toBe(
      FIELD_ERROR_CODES.PASSWORD_REQUIRED,
    );
  });

  // 8 is not arbitrary: it matches Better Auth's server-side minPasswordLength,
  // so a shorter client bound would produce a server rejection instead.
  it('enforces a minimum of 8, matching the server', () => {
    expect(validatePassword('lopay1')?.code).toBe(
      FIELD_ERROR_CODES.PASSWORD_TOO_SHORT,
    );
    expect(validatePassword('lopay12')?.code).toBe(
      FIELD_ERROR_CODES.PASSWORD_TOO_SHORT,
    );
    expect(validatePassword('lopay123')).toBeNull();
  });

  it('enforces a maximum of 128', () => {
    expect(validatePassword(`${'a'.repeat(128)}1`)?.code).toBe(
      FIELD_ERROR_CODES.PASSWORD_TOO_LONG,
    );
  });

  it('requires both a letter and a number', () => {
    expect(validatePassword('12345678')?.code).toBe(
      FIELD_ERROR_CODES.PASSWORD_NEEDS_LETTER_AND_NUMBER,
    );
    expect(validatePassword('abcdefgh')?.code).toBe(
      FIELD_ERROR_CODES.PASSWORD_NEEDS_LETTER_AND_NUMBER,
    );
  });

  it('does not trim, so a padded password is measured as typed', () => {
    expect(validatePassword('  ab1  ')?.code).toBe(
      FIELD_ERROR_CODES.PASSWORD_TOO_SHORT,
    );
    expect(validatePassword('   abc1   ')).toBeNull();
  });

  describe('personal information', () => {
    it('rejects a password containing the email local part', () => {
      expect(
        validatePassword('adalovelace123', { email: 'adalovelace@gmail.com' })
          ?.code,
      ).toBe(FIELD_ERROR_CODES.PASSWORD_CONTAINS_PERSONAL_INFO);
    });

    it('rejects a password containing a name fragment', () => {
      expect(
        validatePassword('lovelace2026', { fullName: 'Ada Lovelace' })?.code,
      ).toBe(FIELD_ERROR_CODES.PASSWORD_CONTAINS_PERSONAL_INFO);
    });

    it('is case-insensitive', () => {
      expect(
        validatePassword('LOVELACE2026', { fullName: 'Ada Lovelace' })?.code,
      ).toBe(FIELD_ERROR_CODES.PASSWORD_CONTAINS_PERSONAL_INFO);
    });

    // A parent named "Ada" must not be blocked from every password containing
    // those three letters in sequence — that is a lot of ordinary English.
    it('ignores fragments shorter than 4 characters', () => {
      expect(validatePassword('adamant123', { fullName: 'Ada Obi' })).toBeNull();
    });

    it('passes when no context is supplied', () => {
      expect(validatePassword('lovelace2026')).toBeNull();
    });
  });
});

describe('validateConfirmPassword', () => {
  it('accepts a match', () => {
    expect(validateConfirmPassword('lopay2026', 'lopay2026')).toBeNull();
  });

  it('requires confirmation', () => {
    expect(validateConfirmPassword('lopay2026', '')?.code).toBe(
      FIELD_ERROR_CODES.CONFIRM_PASSWORD_REQUIRED,
    );
  });

  it('reports a mismatch', () => {
    expect(validateConfirmPassword('lopay2026', 'lopay2027')?.code).toBe(
      FIELD_ERROR_CODES.PASSWORD_MISMATCH,
    );
  });

  it('is byte-exact — a trailing space is a mismatch, not a match', () => {
    expect(validateConfirmPassword('lopay2026', 'lopay2026 ')?.code).toBe(
      FIELD_ERROR_CODES.PASSWORD_MISMATCH,
    );
  });

  it('puts the mismatch on the confirm field so it renders beside the second box', () => {
    const errors = validateSignupForm({ ...VALID, confirmPassword: 'nope123' });
    expect(errors.confirmPassword?.code).toBe(
      FIELD_ERROR_CODES.PASSWORD_MISMATCH,
    );
    expect(errors.password).toBeUndefined();
  });
});

describe('validateSignupForm', () => {
  it('passes a fully valid form', () => {
    expect(validateSignupForm(VALID)).toEqual({});
    expect(hasErrors(validateSignupForm(VALID))).toBe(false);
  });

  // Submitting an empty form should mark every input at once, not make the
  // parent discover them one at a time.
  it('reports every empty field together', () => {
    const errors = validateSignupForm({
      fullName: '',
      email: '',
      phoneNumber: '',
      password: '',
      confirmPassword: '',
    });

    expect(Object.keys(errors).sort()).toEqual([
      'confirmPassword',
      'email',
      'fullName',
      'password',
      'phoneNumber',
    ]);
  });

  it('keys each error to the field that owns it', () => {
    const errors = validateSignupForm({
      ...VALID,
      email: 'bad',
      phoneNumber: '0801',
    });

    expect(errors.email?.code).toBe(FIELD_ERROR_CODES.EMAIL_INVALID);
    expect(errors.phoneNumber?.code).toBe(FIELD_ERROR_CODES.PHONE_INVALID);
    expect(errors.fullName).toBeUndefined();
  });

  it('feeds name and email into the password check', () => {
    const errors = validateSignupForm({
      ...VALID,
      password: 'lovelace99',
      confirmPassword: 'lovelace99',
    });
    expect(errors.password?.code).toBe(
      FIELD_ERROR_CODES.PASSWORD_CONTAINS_PERSONAL_INFO,
    );
  });
});

describe('validateSignupField', () => {
  it('checks only the named field', () => {
    const values = { ...VALID, email: 'bad', phoneNumber: '0801' };
    expect(validateSignupField('email', values)?.code).toBe(
      FIELD_ERROR_CODES.EMAIL_INVALID,
    );
    expect(validateSignupField('fullName', values)).toBeNull();
  });

  it('returns null for the form pseudo-field', () => {
    expect(validateSignupField('form', VALID)).toBeNull();
  });
});

describe('validateLoginForm', () => {
  it('accepts an email and any non-empty password', () => {
    expect(
      validateLoginForm({ email: 'ada@gmail.com', password: 'x' }),
    ).toEqual({});
  });

  // An account created before the rules tightened still has a valid password.
  // Applying the signup policy here would lock that parent out of their own
  // account with a message implying their password is wrong.
  it('does NOT apply the signup password policy', () => {
    const errors = validateLoginForm({
      email: 'ada@gmail.com',
      password: 'short',
    });
    expect(errors.password).toBeUndefined();
  });

  it('still requires a password to be present', () => {
    const errors = validateLoginForm({ email: 'ada@gmail.com', password: '' });
    expect(errors.password?.code).toBe(FIELD_ERROR_CODES.PASSWORD_REQUIRED);
  });

  it('still validates email shape', () => {
    const errors = validateLoginForm({ email: 'bad', password: 'x' });
    expect(errors.email?.code).toBe(FIELD_ERROR_CODES.EMAIL_INVALID);
  });
});

describe('hasErrors', () => {
  it('is false for an empty map', () => {
    expect(hasErrors({})).toBe(false);
  });

  it('is true when any field has an error', () => {
    expect(hasErrors(validateSignupForm({ ...VALID, email: '' }))).toBe(true);
  });
});
