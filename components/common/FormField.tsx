import React, { useId, useState } from 'react';
import type { FieldError } from '../../utils/validation/codes';

/**
 * A labelled text input with an inline error message beneath it.
 *
 * ## Why a component rather than repeated markup
 *
 * The error styling is the easy part. The part worth centralising is the
 * accessibility wiring, which is easy to get subtly wrong five times over:
 *
 *  - `aria-invalid` on the input, so a screen reader announces the field as
 *    invalid rather than the parent discovering it only on submit.
 *  - `aria-describedby` pointing at the error element's id, so the message is read
 *    out as part of the field instead of being an orphaned sentence.
 *  - `role="alert"` on the message, so it is announced the moment it appears.
 *  - `htmlFor`/`id` pairing, so tapping the label focuses the input — which on a
 *    phone is the difference between a usable form and a fiddly one.
 *
 * `useId` generates the ids, so several instances on one page never collide.
 *
 * The error is displayed only when `error` is set — the parent component decides
 * *when* that happens (on blur, on submit), and this component decides only how it
 * looks and how it is announced.
 */

export interface FormFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Shown beneath the input, and wired up for assistive tech. */
  error?: FieldError | null;
  type?: 'text' | 'email' | 'tel' | 'password';
  placeholder?: string;
  /** Called when the input loses focus — the natural moment to validate a field. */
  onBlur?: () => void;
  autoComplete?: string;
  /** Adds a show/hide toggle. Only meaningful for `type="password"`. */
  revealable?: boolean;
  /** Extra guidance shown when there is no error (e.g. a format hint). */
  hint?: string;
  inputMode?: 'text' | 'email' | 'tel' | 'numeric';
  required?: boolean;
  disabled?: boolean;
  /** Stable hook for tests, since the generated ids are not predictable. */
  testId?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  value,
  onChange,
  error,
  type = 'text',
  placeholder,
  onBlur,
  autoComplete,
  revealable = false,
  hint,
  inputMode,
  required = true,
  disabled = false,
  testId,
}) => {
  const reactId = useId();
  const inputId = `field-${reactId}`;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const [revealed, setRevealed] = useState(false);

  const showHint = Boolean(hint) && !error;
  // Only reference ids that are actually rendered — pointing aria-describedby at a
  // missing element makes some screen readers announce nothing at all.
  const describedBy =
    [error ? errorId : null, showHint ? hintId : null]
      .filter(Boolean)
      .join(' ') || undefined;

  const inputType = revealable && revealed ? 'text' : type;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={inputId}
        className="block text-xs font-bold text-text-secondary-light uppercase px-1"
      >
        {label}
      </label>

      <div className="relative">
        <input
          id={inputId}
          type={inputType}
          inputMode={inputMode}
          required={required}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          data-testid={testId}
          className={`w-full bg-gray-50 dark:bg-white/5 border rounded-2xl p-4 outline-none text-base transition-colors ${
            revealable ? 'pr-12' : ''
          } ${
            error
              ? 'border-danger focus:ring-2 focus:ring-danger/40'
              : 'border-gray-100 dark:border-gray-800 focus:ring-2 focus:ring-primary/50'
          }`}
        />

        {revealable && (
          <button
            type="button"
            onClick={() => setRevealed((shown) => !shown)}
            // Without this the toggle reads as an unlabelled button, and it must
            // not be a tab stop between the input and the next field.
            aria-label={revealed ? 'Hide password' : 'Show password'}
            tabIndex={-1}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
          >
            <span className="material-symbols-outlined text-xl">
              {revealed ? 'visibility_off' : 'visibility'}
            </span>
          </button>
        )}
      </div>

      {error && (
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-1.5 px-1 pt-0.5 text-xs font-semibold text-danger"
        >
          <span
            className="material-symbols-outlined text-sm leading-none mt-px"
            aria-hidden="true"
          >
            error
          </span>
          <span>{error.message}</span>
        </p>
      )}

      {showHint && (
        <p id={hintId} className="px-1 text-xs text-text-secondary-light">
          {hint}
        </p>
      )}
    </div>
  );
};
