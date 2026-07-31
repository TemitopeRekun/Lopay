import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AuthScreen from './AuthScreen';

/**
 * End-to-end behaviour of the sign-up form's error handling.
 *
 * These are the tests that actually prove the feature: that a duplicate email
 * message appears UNDER THE EMAIL BOX, that a mismatched password is reported on
 * the confirm field, and that a server rejection is placed by code rather than by
 * reading its English.
 */

const register = vi.fn();
const login = vi.fn();
const loginWithGoogle = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    register,
    login,
    loginWithGoogle,
    isAuthenticated: false,
    role: null,
  }),
}));

// Layout pulls in nav/theme chrome irrelevant to the form's behaviour.
vi.mock('../components/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

function renderScreen() {
  return render(
    <MemoryRouter>
      <AuthScreen />
    </MemoryRouter>,
  );
}

const VALID = {
  fullName: 'Ada Lovelace',
  email: 'ada@gmail.com',
  phoneNumber: '08012345678',
  password: 'lopay2026pass',
};

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Full Name'), VALID.fullName);
  await user.type(screen.getByLabelText('Email Address'), VALID.email);
  await user.type(screen.getByLabelText('Phone Number'), VALID.phoneNumber);
  await user.type(screen.getByLabelText('Password'), VALID.password);
  await user.type(screen.getByLabelText('Confirm Password'), VALID.password);
}

const submit = () =>
  screen.getByRole('button', { name: 'Create My Account' });

describe('AuthScreen sign-up', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    register.mockResolvedValue(true);
    // Silence the structured log lines the form emits.
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('client-side validation on submit', () => {
    it('marks every empty field at once rather than one at a time', async () => {
      const user = userEvent.setup();
      renderScreen();

      await user.click(submit());

      expect(await screen.findByText('Enter your full name.')).toBeInTheDocument();
      expect(screen.getByText('Enter your email address.')).toBeInTheDocument();
      expect(screen.getByText('Enter your phone number.')).toBeInTheDocument();
      expect(screen.getByText('Choose a password.')).toBeInTheDocument();
      expect(register).not.toHaveBeenCalled();
    });

    // The specific case called out in the request.
    it('reports mismatched passwords on the confirm field', async () => {
      const user = userEvent.setup();
      renderScreen();

      await fillValidForm(user);
      await user.clear(screen.getByLabelText('Confirm Password'));
      await user.type(screen.getByLabelText('Confirm Password'), 'different99');
      await user.click(submit());

      const error = await screen.findByText(/Both passwords must match/i);
      expect(error).toBeInTheDocument();

      // It must be attached to the confirm input, not the first password box.
      const confirm = screen.getByLabelText('Confirm Password');
      expect(confirm).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByLabelText('Password')).not.toHaveAttribute(
        'aria-invalid',
      );
      expect(register).not.toHaveBeenCalled();
    });

    it('reports a malformed phone number by asking for the 11-digit form', async () => {
      const user = userEvent.setup();
      renderScreen();

      await fillValidForm(user);
      await user.clear(screen.getByLabelText('Phone Number'));
      await user.type(screen.getByLabelText('Phone Number'), '0801');
      await user.click(submit());

      const error = await screen.findByText(/11-digit phone number/i);
      expect(error).toBeInTheDocument();
      expect(error.textContent).not.toContain('+234');
    });

    it('reports a too-short password', async () => {
      const user = userEvent.setup();
      renderScreen();

      await fillValidForm(user);
      await user.clear(screen.getByLabelText('Password'));
      await user.type(screen.getByLabelText('Password'), 'ab1');
      await user.click(submit());

      expect(
        await screen.findByText('Use at least 8 characters.'),
      ).toBeInTheDocument();
    });
  });

  describe('on-blur validation', () => {
    it('flags a bad email as soon as the field is left', async () => {
      const user = userEvent.setup();
      renderScreen();

      await user.type(screen.getByLabelText('Email Address'), 'not-an-email');
      await user.tab();

      expect(
        await screen.findByText(/Enter a valid email address/i),
      ).toBeInTheDocument();
    });

    it('does not flag fields the parent has not reached yet', async () => {
      const user = userEvent.setup();
      renderScreen();

      await user.type(screen.getByLabelText('Email Address'), 'not-an-email');
      await user.tab();

      await screen.findByText(/Enter a valid email address/i);
      // Phone and password are still untouched — they must stay clean.
      expect(screen.queryByText('Enter your phone number.')).not.toBeInTheDocument();
      expect(screen.queryByText('Choose a password.')).not.toBeInTheDocument();
    });

    it('clears the error as soon as the parent starts fixing the field', async () => {
      const user = userEvent.setup();
      renderScreen();

      const email = screen.getByLabelText('Email Address');
      await user.type(email, 'bad');
      await user.tab();
      await screen.findByText(/Enter a valid email address/i);

      await user.type(email, 'x');

      await waitFor(() => {
        expect(
          screen.queryByText(/Enter a valid email address/i),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('server rejections land on the right field', () => {
    // The headline case: "when an email has been used".
    it('shows a duplicate-email error under the email input', async () => {
      register.mockRejectedValue({
        code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
        message: 'User already exists. Use another email.',
        status: 422,
      });

      const user = userEvent.setup();
      renderScreen();
      await fillValidForm(user);
      await user.click(submit());

      const error = await screen.findByText(/already has a LOPAY account/i);
      expect(error).toBeInTheDocument();
      expect(screen.getByLabelText('Email Address')).toHaveAttribute(
        'aria-invalid',
        'true',
      );
      // and NOT on any other field
      expect(screen.getByLabelText('Phone Number')).not.toHaveAttribute(
        'aria-invalid',
      );
    });

    // The other headline case: "or phone number".
    it('shows a duplicate-phone error under the phone input', async () => {
      register.mockRejectedValue({
        code: 'PHONE_ALREADY_REGISTERED',
        message: 'This phone number is already linked to another account.',
        status: 422,
      });

      const user = userEvent.setup();
      renderScreen();
      await fillValidForm(user);
      await user.click(submit());

      expect(
        await screen.findByText(/already linked to another account/i),
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Phone Number')).toHaveAttribute(
        'aria-invalid',
        'true',
      );
      expect(screen.getByLabelText('Email Address')).not.toHaveAttribute(
        'aria-invalid',
      );
    });

    it('shows our copy, not the raw server sentence', async () => {
      register.mockRejectedValue({
        code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
        message: 'User already exists. Use another email.',
      });

      const user = userEvent.setup();
      renderScreen();
      await fillValidForm(user);
      await user.click(submit());

      await screen.findByText(/already has a LOPAY account/i);
      expect(
        screen.queryByText('User already exists. Use another email.'),
      ).not.toBeInTheDocument();
    });

    it('puts an unattributable failure in the form-level banner', async () => {
      register.mockRejectedValue({ status: 500 });

      const user = userEvent.setup();
      renderScreen();
      await fillValidForm(user);
      await user.click(submit());

      expect(
        await screen.findByText(/went wrong on our end/i),
      ).toBeInTheDocument();
    });

    it('re-enables the submit button after a rejection so the parent can retry', async () => {
      register.mockRejectedValue({ code: 'PHONE_ALREADY_REGISTERED' });

      const user = userEvent.setup();
      renderScreen();
      await fillValidForm(user);
      await user.click(submit());

      await screen.findByText(/already linked to another account/i);
      expect(submit()).not.toBeDisabled();
    });
  });

  describe('submission', () => {
    it('sends sanitized values, with the phone in canonical +234 form', async () => {
      const user = userEvent.setup();
      renderScreen();

      await user.type(screen.getByLabelText('Full Name'), '  Ada   Lovelace  ');
      await user.type(screen.getByLabelText('Email Address'), '  Ada@Gmail.COM ');
      await user.type(screen.getByLabelText('Phone Number'), '0801 234-5678');
      await user.type(screen.getByLabelText('Password'), VALID.password);
      await user.type(screen.getByLabelText('Confirm Password'), VALID.password);
      await user.click(submit());

      await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
      expect(register).toHaveBeenCalledWith(
        expect.objectContaining({
          fullName: 'Ada Lovelace',
          email: 'ada@gmail.com',
          phoneNumber: '+2348012345678',
          password: VALID.password,
          role: 'parent',
        }),
      );
    });

    it('does not trim the password', async () => {
      const user = userEvent.setup();
      renderScreen();

      const padded = '  lopay2026  ';
      await user.type(screen.getByLabelText('Full Name'), VALID.fullName);
      await user.type(screen.getByLabelText('Email Address'), VALID.email);
      await user.type(screen.getByLabelText('Phone Number'), VALID.phoneNumber);
      await user.type(screen.getByLabelText('Password'), padded);
      await user.type(screen.getByLabelText('Confirm Password'), padded);
      await user.click(submit());

      await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
      expect(register.mock.calls[0][0].password).toBe(padded);
    });
  });

  describe('sign-in mode', () => {
    it('does not apply the sign-up password policy', async () => {
      login.mockResolvedValue({});
      const user = userEvent.setup();
      renderScreen();

      await user.click(screen.getByRole('button', { name: 'Sign In' }));
      await user.type(screen.getByLabelText('Email Address'), VALID.email);
      await user.type(screen.getByLabelText('Password'), 'short');
      await user.click(screen.getByRole('button', { name: 'Sign In to LOPAY' }));

      await waitFor(() => expect(login).toHaveBeenCalledTimes(1));
      expect(
        screen.queryByText('Use at least 8 characters.'),
      ).not.toBeInTheDocument();
    });

    // Saying which of the two was wrong would reveal whether the account exists.
    it('reports bad credentials at form level, not on a single field', async () => {
      login.mockRejectedValue({ code: 'INVALID_EMAIL_OR_PASSWORD' });
      const user = userEvent.setup();
      renderScreen();

      await user.click(screen.getByRole('button', { name: 'Sign In' }));
      await user.type(screen.getByLabelText('Email Address'), VALID.email);
      await user.type(screen.getByLabelText('Password'), 'wrongpass1');
      await user.click(screen.getByRole('button', { name: 'Sign In to LOPAY' }));

      expect(
        await screen.findByText(/combination is incorrect/i),
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Email Address')).not.toHaveAttribute(
        'aria-invalid',
      );
    });

    it('clears errors when switching between modes', async () => {
      const user = userEvent.setup();
      renderScreen();

      await user.click(submit());
      await screen.findByText('Enter your full name.');

      await user.click(screen.getByRole('button', { name: 'Sign In' }));

      expect(screen.queryByText('Enter your full name.')).not.toBeInTheDocument();
    });
  });

  describe('logging', () => {
    it('never writes the password or a raw email to the console', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const info = vi.spyOn(console, 'info').mockImplementation(() => {});
      register.mockRejectedValue({ code: 'PHONE_ALREADY_REGISTERED' });

      const user = userEvent.setup();
      renderScreen();
      await fillValidForm(user);
      await user.click(submit());
      await screen.findByText(/already linked to another account/i);

      const everything = JSON.stringify([
        ...warn.mock.calls,
        ...info.mock.calls,
      ]);
      expect(everything).not.toContain(VALID.password);
      expect(everything).not.toContain('ada@gmail.com');
      expect(everything).not.toContain('08012345678');
      // but the diagnostic reason IS present
      expect(everything).toContain('PHONE_ALREADY_REGISTERED');
    });
  });
});
