import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormField } from './FormField';
import { fieldError, FIELD_ERROR_CODES } from '../../utils/validation/codes';

describe('FormField', () => {
  it('associates the label with the input, so tapping the label focuses it', async () => {
    render(
      <FormField label="Email Address" value="" onChange={() => {}} />,
    );

    // getByLabelText only resolves when htmlFor/id are correctly paired.
    const input = screen.getByLabelText('Email Address');
    await userEvent.click(screen.getByText('Email Address'));
    expect(input).toHaveFocus();
  });

  it('renders no error element when there is no error', () => {
    render(<FormField label="Email" value="" onChange={() => {}} />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid');
  });

  describe('when there is an error', () => {
    const error = fieldError(FIELD_ERROR_CODES.EMAIL_ALREADY_REGISTERED);

    it('shows the message inline', () => {
      render(
        <FormField label="Email" value="a@b.com" onChange={() => {}} error={error} />,
      );

      expect(
        screen.getByText(/already has a LOPAY account/i),
      ).toBeInTheDocument();
    });

    // role="alert" is what makes a screen reader announce the message the moment
    // it appears, rather than leaving it silently on screen.
    it('announces the message via role="alert"', () => {
      render(
        <FormField label="Email" value="" onChange={() => {}} error={error} />,
      );

      expect(screen.getByRole('alert')).toHaveTextContent(
        /already has a LOPAY account/i,
      );
    });

    it('marks the input invalid for assistive tech', () => {
      render(
        <FormField label="Email" value="" onChange={() => {}} error={error} />,
      );

      expect(screen.getByLabelText('Email')).toHaveAttribute(
        'aria-invalid',
        'true',
      );
    });

    // Without aria-describedby the message is an orphaned sentence: visible, but
    // never read out as part of the field.
    it('points aria-describedby at the error element', () => {
      render(
        <FormField label="Email" value="" onChange={() => {}} error={error} />,
      );

      const input = screen.getByLabelText('Email');
      const describedBy = input.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      expect(document.getElementById(describedBy!)).toHaveTextContent(
        /already has a LOPAY account/i,
      );
    });

    it('hides the hint while an error is showing, so they never stack', () => {
      render(
        <FormField
          label="Phone"
          value=""
          onChange={() => {}}
          hint="Your 11-digit number."
          error={fieldError(FIELD_ERROR_CODES.PHONE_INVALID)}
        />,
      );

      expect(screen.queryByText('Your 11-digit number.')).not.toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  describe('hint', () => {
    it('is shown and described when there is no error', () => {
      render(
        <FormField
          label="Phone"
          value=""
          onChange={() => {}}
          hint="Your 11-digit number."
        />,
      );

      const input = screen.getByLabelText('Phone');
      const describedBy = input.getAttribute('aria-describedby');
      expect(document.getElementById(describedBy!)).toHaveTextContent(
        'Your 11-digit number.',
      );
    });
  });

  it('reports typed characters to onChange', async () => {
    const onChange = vi.fn();
    render(<FormField label="Name" value="" onChange={onChange} />);

    await userEvent.type(screen.getByLabelText('Name'), 'Ada');

    // Controlled input with a static value: each keystroke reports one character.
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(onChange).toHaveBeenLastCalledWith('a');
  });

  it('calls onBlur when the field loses focus, which is when validation runs', async () => {
    const onBlur = vi.fn();
    render(
      <>
        <FormField label="Name" value="" onChange={() => {}} onBlur={onBlur} />
        <button type="button">elsewhere</button>
      </>,
    );

    await userEvent.click(screen.getByLabelText('Name'));
    await userEvent.click(screen.getByRole('button', { name: 'elsewhere' }));

    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  describe('password reveal', () => {
    it('starts masked and toggles to text', async () => {
      render(
        <FormField
          label="Password"
          type="password"
          revealable
          value="secret"
          onChange={() => {}}
        />,
      );

      const input = screen.getByLabelText('Password');
      expect(input).toHaveAttribute('type', 'password');

      await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
      expect(input).toHaveAttribute('type', 'text');

      await userEvent.click(screen.getByRole('button', { name: 'Hide password' }));
      expect(input).toHaveAttribute('type', 'password');
    });

    it('is absent unless revealable is set', () => {
      render(
        <FormField
          label="Password"
          type="password"
          value=""
          onChange={() => {}}
        />,
      );

      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  it('gives each instance unique ids so two fields never collide', () => {
    render(
      <>
        <FormField
          label="First"
          value=""
          onChange={() => {}}
          error={fieldError(FIELD_ERROR_CODES.NAME_REQUIRED)}
        />
        <FormField
          label="Second"
          value=""
          onChange={() => {}}
          error={fieldError(FIELD_ERROR_CODES.EMAIL_REQUIRED)}
        />
      </>,
    );

    const first = screen.getByLabelText('First');
    const second = screen.getByLabelText('Second');
    expect(first.id).not.toBe(second.id);
    expect(first.getAttribute('aria-describedby')).not.toBe(
      second.getAttribute('aria-describedby'),
    );
  });
});
