import React, { useState } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/Layout';
import { FormField } from '../components/common/FormField';
import { canonicalizePhone } from '../utils/phone';
import {
  FIELD_ERROR_CODES,
  type FieldName,
  type FormErrors,
} from '../utils/validation/codes';
import {
  hasErrors,
  validateLoginForm,
  validateSignupField,
  validateSignupForm,
  type SignupValues,
} from '../utils/validation/signupForm';
import { mapServerError } from '../utils/validation/serverErrors';
import { sanitizeEmail, sanitizeName } from '../utils/validation/sanitize';
import { CLIENT_EVENTS, logger } from '../utils/logger';

/**
 * Sign-up / sign-in.
 *
 * ## The error model
 *
 * All errors live in one `FormErrors` map keyed by field name, whether they came
 * from client-side validation or from the server. `FormField` renders whatever is
 * under its key, inline and wired for screen readers. Nothing here formats a
 * message or decides placement — `utils/validation/` owns both, so the copy for
 * "email already used" is identical however it was discovered.
 *
 * ## When errors appear
 *
 * - **On blur**, for the field just left, so a malformed phone number is caught
 *   immediately rather than after four more fields.
 * - **On submit**, for everything at once, so an empty form marks all five inputs.
 * - **On response**, mapped to the owning field — a duplicate email lands under the
 *   email box, not in a banner.
 *
 * An error clears as soon as its field is edited: keeping it visible while the
 * parent is actively fixing it just adds noise.
 */

const EMPTY_VALUES: SignupValues = {
  fullName: '',
  email: '',
  phoneNumber: '',
  password: '',
  confirmPassword: '',
};

const AuthScreen: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [roleSelection, setRoleSelection] = useState<'parent'>('parent');

  const [values, setValues] = useState<SignupValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    login,
    loginWithGoogle,
    register,
    isAuthenticated,
    role: userRole,
  } = useAuth();
  const navigate = useNavigate();

  if (isAuthenticated) {
    if (userRole === 'owner') return <Navigate to="/owner-dashboard" replace />;
    if (userRole === 'school_owner')
      return <Navigate to="/school-owner-dashboard" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  /** Update a field and drop any error on it — they are fixing it. */
  const setField = (field: keyof SignupValues) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field] && !current.form) return current;
      const next = { ...current };
      delete next[field];
      // A form-level error ("couldn't create your account") is stale the moment
      // any input changes, so clear it too rather than leaving a banner that no
      // longer describes the current state.
      delete next.form;
      return next;
    });
  };

  /** Validate one field when it loses focus. Sign-in skips per-field checks —
   * marking a password "too short" while signing in is wrong (see
   * validateLoginForm). */
  const handleBlur = (field: FieldName) => () => {
    if (mode !== 'signup') return;
    const error = validateSignupField(field, values);
    setErrors((current) => {
      const next = { ...current };
      if (error) next[field] = error;
      else delete next[field];
      return next;
    });
  };

  const clearForMode = (next: 'login' | 'signup') => {
    setMode(next);
    setErrors({});
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors =
      mode === 'signup'
        ? validateSignupForm(values)
        : validateLoginForm({ email: values.email, password: values.password });

    if (hasErrors(validationErrors)) {
      setErrors(validationErrors);
      logger.event(
        CLIENT_EVENTS.SIGNUP_VALIDATION_FAILED,
        {
          mode,
          // Codes only — never the values that failed.
          fields: Object.keys(validationErrors),
          reasons: Object.values(validationErrors).map((error) => error?.code),
        },
        'warn',
      );
      // Move focus to the first bad field so a keyboard or screen-reader user
      // lands on the problem instead of hunting for it.
      focusFirstError(validationErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    const email = sanitizeEmail(values.email);

    try {
      if (mode === 'login') {
        logger.event(CLIENT_EVENTS.LOGIN_SUBMITTED, { email });
        await login(email, values.password);
        logger.event(CLIENT_EVENTS.LOGIN_SUCCEEDED, { email });
      } else {
        logger.event(CLIENT_EVENTS.SIGNUP_SUBMITTED, {
          email,
          phoneNumber: values.phoneNumber,
        });
        await register({
          fullName: sanitizeName(values.fullName),
          email,
          // Send the canonical +234 form — the same shape the server stores and
          // makes its uniqueness check against. validateSignupForm has already
          // established the number is valid, so the ?? is unreachable defence.
          phoneNumber: canonicalizePhone(values.phoneNumber) ?? '',
          password: values.password,
          confirmPassword: values.confirmPassword,
          role: roleSelection,
          schoolId: '',
        });
        logger.event(CLIENT_EVENTS.SIGNUP_SUCCEEDED, { email });
      }
      // Navigation happens via the isAuthenticated redirect above once the auth
      // context has hydrated.
    } catch (error: unknown) {
      const fallback =
        mode === 'signup'
          ? FIELD_ERROR_CODES.SIGNUP_FAILED
          : FIELD_ERROR_CODES.INVALID_CREDENTIALS;
      const mapped = mapServerError(error, fallback);

      setErrors({ [mapped.field]: mapped.error });
      logger.event(
        mode === 'signup'
          ? CLIENT_EVENTS.SIGNUP_REJECTED
          : CLIENT_EVENTS.LOGIN_REJECTED,
        {
          email,
          serverCode: mapped.serverCode,
          reason: mapped.error.code,
          field: mapped.field,
        },
        'warn',
      );
      focusFirstError({ [mapped.field]: mapped.error });
      setIsSubmitting(false);
    }
  };

  const roleOptions = [
    {
      id: 'parent',
      title: 'Parent',
      desc: 'Paying for my child in Primary/Secondary school',
      icon: 'family_restroom',
      color: 'bg-primary',
    },
  ] as const;

  const isSignup = mode === 'signup';

  return (
    <Layout>
      <div className="flex flex-col grow px-6 py-6 animate-fade-in-up">
        {/* Navigation Back */}
        <button
          onClick={() => navigate('/welcome')}
          className="mb-6 flex items-center gap-2 text-text-secondary-light hover:text-primary transition-colors text-sm font-bold"
        >
          <span className="material-symbols-outlined">arrow_back</span>
          <span>Back</span>
        </button>

        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-4xl text-primary filled">
              account_balance
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight">LOPAY</h1>
          </div>
          <p className="text-text-secondary-light dark:text-text-secondary-dark text-sm font-medium">
            Smart School Fee Management
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-2xl mb-8">
          <button
            onClick={() => clearForMode('signup')}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${isSignup ? 'bg-white dark:bg-card-dark text-primary shadow-sm' : 'text-text-secondary-light'}`}
          >
            Create Account
          </button>
          <button
            onClick={() => clearForMode('login')}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${!isSignup ? 'bg-white dark:bg-card-dark text-primary shadow-sm' : 'text-text-secondary-light'}`}
          >
            Sign In
          </button>
        </div>

        {/* Account Type Selection (Signup Only) */}
        {isSignup && (
          <div className="space-y-4 mb-8">
            <h2 className="text-sm font-bold text-text-secondary-light uppercase tracking-widest px-1">
              Choose Account Type
            </h2>
            <div className="grid grid-cols-1 gap-3">
              {roleOptions.map((opt) => {
                const isSelected = roleSelection === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setRoleSelection(opt.id)}
                    className={`relative flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all duration-200 ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-md shadow-primary/5'
                        : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-card-dark hover:border-gray-200'
                    }`}
                  >
                    <div
                      className={`size-12 rounded-full flex items-center justify-center text-white shrink-0 ${opt.color} ${isSelected ? 'scale-110 shadow-lg' : 'opacity-80'}`}
                    >
                      <span className="material-symbols-outlined text-2xl">
                        {opt.icon}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p
                        className={`font-bold text-base ${isSelected ? 'text-primary' : 'text-text-primary-light dark:text-text-primary-dark'}`}
                      >
                        {opt.title}
                      </p>
                      <p className="text-xs text-text-secondary-light leading-snug">
                        {opt.desc}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="absolute top-3 right-3">
                        <span className="material-symbols-outlined text-primary text-xl filled">
                          check_circle
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* noValidate: the browser's own bubbles would pre-empt our inline,
            screen-reader-wired messages with untranslatable native copy. */}
        <form onSubmit={handleAuth} className="space-y-5" noValidate>
          {isSignup && (
            <FormField
              label="Full Name"
              value={values.fullName}
              onChange={setField('fullName')}
              onBlur={handleBlur('fullName')}
              error={errors.fullName}
              placeholder="Michael Brown"
              autoComplete="name"
              testId="signup-fullName"
            />
          )}

          <FormField
            label="Email Address"
            type="email"
            inputMode="email"
            value={values.email}
            onChange={setField('email')}
            onBlur={handleBlur('email')}
            error={errors.email}
            placeholder="name@email.com"
            autoComplete="email"
            testId="auth-email"
          />

          {isSignup && (
            <FormField
              label="Phone Number"
              type="tel"
              inputMode="tel"
              value={values.phoneNumber}
              onChange={setField('phoneNumber')}
              onBlur={handleBlur('phoneNumber')}
              error={errors.phoneNumber}
              placeholder="08012345678"
              hint="Your 11-digit number, starting with 0."
              autoComplete="tel"
              testId="signup-phoneNumber"
            />
          )}

          <FormField
            label="Password"
            type="password"
            revealable
            value={values.password}
            onChange={setField('password')}
            onBlur={handleBlur('password')}
            error={errors.password}
            placeholder="••••••••"
            hint={isSignup ? 'At least 8 characters, with a number.' : undefined}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            testId="auth-password"
          />

          {isSignup && (
            <div className="animate-fade-in-up">
              <FormField
                label="Confirm Password"
                type="password"
                revealable
                value={values.confirmPassword}
                onChange={setField('confirmPassword')}
                onBlur={handleBlur('confirmPassword')}
                error={errors.confirmPassword}
                placeholder="••••••••"
                autoComplete="new-password"
                testId="signup-confirmPassword"
              />
            </div>
          )}

          {/* Whole-form errors only (network, rate limit, unattributable
              failures). Anything field-scoped is rendered by its own FormField. */}
          {errors.form && (
            <div
              role="alert"
              className="flex items-start gap-2 p-4 rounded-xl bg-danger/10 text-danger text-sm font-bold"
            >
              <span
                className="material-symbols-outlined text-base leading-none"
                aria-hidden="true"
              >
                error
              </span>
              <span>{errors.form.message}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-16 bg-primary text-white rounded-2xl font-bold text-lg shadow-xl shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubmitting
              ? 'Processing...'
              : isSignup
                ? 'Create My Account'
                : 'Sign In to LOPAY'}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
            <span className="text-[10px] font-bold text-text-secondary-light uppercase tracking-widest">
              or
            </span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
          </div>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={async () => {
              setErrors({});
              try {
                await loginWithGoogle();
              } catch (error: unknown) {
                const mapped = mapServerError(
                  error,
                  FIELD_ERROR_CODES.UNKNOWN_ERROR,
                );
                setErrors({ form: mapped.error });
                logger.event(
                  CLIENT_EVENTS.LOGIN_REJECTED,
                  { provider: 'google', reason: mapped.error.code },
                  'warn',
                );
              }
            }}
            className="w-full h-14 bg-white dark:bg-card-dark border-2 border-gray-200 dark:border-gray-800 rounded-2xl font-bold text-base flex items-center justify-center gap-3 hover:border-gray-300 active:scale-[0.99] transition-all disabled:opacity-70"
          >
            <img
              src="https://www.google.com/favicon.ico"
              alt=""
              className="size-5"
            />
            Continue with Google
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-xs text-text-secondary-light">
            By continuing, you agree to our{' '}
            <Link to="/terms" className="text-primary font-bold">
              Terms
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="text-primary font-bold">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </Layout>
  );
};

/**
 * Focus the input owning the first error, in the order the fields appear on
 * screen. Without this, submitting a long form scrolls nowhere and the parent has
 * to hunt for what went wrong — and a screen-reader user gets no indication at all
 * beyond a message somewhere in the document.
 */
function focusFirstError(errors: FormErrors): void {
  const order: FieldName[] = [
    'fullName',
    'email',
    'phoneNumber',
    'password',
    'confirmPassword',
  ];
  const first = order.find((field) => errors[field]);
  if (!first || typeof document === 'undefined') return;

  const testId =
    first === 'email' || first === 'password'
      ? `auth-${first}`
      : `signup-${first}`;
  const input = document.querySelector<HTMLInputElement>(
    `[data-testid="${testId}"]`,
  );
  input?.focus();
}

export default AuthScreen;
