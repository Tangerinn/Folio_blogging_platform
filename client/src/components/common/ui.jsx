import { cloneElement, isValidElement, useEffect, useId, useRef, useState } from 'react';
import { initials } from '../../utils/format.js';

const btnBase = 'inline-flex items-center justify-center gap-2 rounded-btn px-5 py-2.5 text-sm font-semibold tracking-[0.02em] transition disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-moss focus-visible:ring-offset-2 focus-visible:ring-offset-surface';
const btnVariants = {
  primary: 'bg-moss text-parchment border border-pine/30 hover:bg-primary',
  secondary: 'bg-transparent border border-sage text-moss hover:bg-sage/10',
  ghost: 'text-moss hover:bg-surface-container',
  danger: 'bg-error text-parchment border border-on-error-container/20 hover:opacity-90',
  outline: 'border border-outline-variant text-on-surface hover:bg-surface-container',
};

export function Button({ variant = 'primary', type = 'button', className = '', ...props }) {
  return <button type={type} className={`${btnBase} ${btnVariants[variant]} ${className}`} {...props} />;
}

const fieldBase = 'folio-field w-full rounded-field bg-surface-container px-4 py-2.5 text-base text-on-surface placeholder:text-outline border border-sage/40 transition focus:border-moss focus:bg-surface focus:outline-none focus:ring-2 focus:ring-moonlit-sage';

export function Field({ id: propId, label, hint, error, required, children }) {
  const autoId = useId();
  const childId = isValidElement(children) ? children.props.id : undefined;
  const id = propId || childId || autoId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  let control = children;
  if (isValidElement(children) && typeof children.type !== 'string' || (isValidElement(children) && ['input', 'textarea', 'select'].includes(children.type))) {
    const existingDescribed = children.props['aria-describedby'];
    const mergedDescribed = [existingDescribed, describedBy].filter(Boolean).join(' ') || undefined;
    control = cloneElement(children, {
      id,
      ...(mergedDescribed ? { 'aria-describedby': mergedDescribed } : {}),
      ...(error ? { 'aria-invalid': 'true' } : {}),
    });
  }

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-on-surface-variant">
          {label}
          {required && <span className="ml-1 text-error" aria-hidden="true">*</span>}
        </label>
      )}
      {hint && <p id={hintId} className="text-xs text-on-surface-variant">{hint}</p>}
      {control}
      {error && (
        <p id={errorId} className="text-xs font-medium text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export const Input = ({ className = '', ...p }) => <input className={`${fieldBase} ${className}`} {...p} />;
export const Textarea = ({ className = '', ...p }) => <textarea className={`${fieldBase} ${className}`} {...p} />;
export const Select = ({ className = '', children, ...p }) => <select className={`${fieldBase} ${className}`} {...p}>{children}</select>;

export function PasswordInput({ className = '', ...props }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input
        {...props}
        type={shown ? 'text' : 'password'}
        className={`${fieldBase} pr-16 ${className}`}
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-pressed={shown}
        aria-label={shown ? 'Hide password' : 'Show password'}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-field px-2.5 py-1 text-xs font-semibold text-moss hover:bg-surface-high focus:outline-none focus-visible:ring-2 focus-visible:ring-moss"
      >
        {shown ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}

export const Card = ({ className = '', children }) => (
  <div className={`rounded-panel border border-outline-variant/50 bg-surface-low p-6 sm:p-8 ${className}`}>{children}</div>
);

export const Chip = ({ children, active, onClick, tone = 'default', className = '' }) => {
  const cls = active
    ? 'bg-moss text-parchment border-pine/30'
    : tone === 'warn' ? 'bg-error-container text-on-error-container border-error/20'
    : 'bg-sage/15 text-moss border-sage/30';
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={Boolean(active)}
        className={`inline-flex items-center rounded-full border px-3.5 py-1 text-xs font-medium tracking-[0.02em] transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-moss ${cls} ${className}`}
      >
        {children}
      </button>
    );
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium tracking-[0.02em] ${cls} ${className}`}>
      {children}
    </span>
  );
};

export const Spinner = ({ label = 'Loading' }) => (
  <div className="flex justify-center py-16" role="status" aria-label={label}>
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-moonlit-sage border-t-moss" />
  </div>
);

export const EmptyState = ({ title, children, action }) => (
  <div className="mx-auto max-w-md py-16 text-center">
    <BotanicalDivider />
    <h3 className="mt-4 font-display text-2xl font-semibold text-pine">{title}</h3>
    {children && <p className="mt-2 text-on-surface-variant">{children}</p>}
    {action && <div className="mt-6">{action}</div>}
  </div>
);

export const ErrorNote = ({ error }) => error ? (
  <p role="alert" className="rounded-field border border-error/25 bg-error-container px-4 py-3 text-sm text-on-error-container">
    {error.message || String(error)}
  </p>
) : null;

export const Avatar = ({ name, size = 36 }) => (
  <span
    aria-hidden="true"
    style={{ width: size, height: size, fontSize: size * 0.38 }}
    className="inline-flex shrink-0 items-center justify-center rounded-full border border-sage/30 bg-moonlit-sage font-semibold text-pine"
  >
    {initials(name)}
  </span>
);

export const BotanicalDivider = () => (
  <div className="flex items-center justify-center gap-3 text-sage" aria-hidden="true">
    <span className="h-px w-12 bg-outline-variant" />
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21V9" /><path d="M12 13c-4 0-6-2-6-6 4 0 6 2 6 6Z" /><path d="M12 16c4 0 6-2 6-6-4 0-6 2-6 6Z" />
    </svg>
    <span className="h-px w-12 bg-outline-variant" />
  </div>
);

export function Modal({ title, onClose, children, dismissible = true }) {
  const ref = useRef(null);
  const titleId = useId();
  const pressedOutsideRef = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  const isOutside = (e, dialog) => {
    const r = dialog.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      closedby={dismissible ? 'any' : 'none'}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onClose();
      }}
      onPointerDown={(e) => {
        if (!dismissible || !ref.current) return;
        pressedOutsideRef.current = isOutside(e, ref.current);
      }}
      onPointerUp={(e) => {
        if (!dismissible || !ref.current) return;
        if (pressedOutsideRef.current && isOutside(e, ref.current)) onClose();
        pressedOutsideRef.current = false;
      }}
      className="m-auto w-[calc(100%-2.5rem)] max-w-md rounded-panel border border-outline-variant/60 bg-surface p-8 text-on-surface"
    >
      <h2 id={titleId} className="mb-4 font-display text-2xl font-bold text-pine">{title}</h2>
      {children}
    </dialog>
  );
}

export function ConfirmModal({ title, message, confirmLabel = 'Confirm', danger, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const handleConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose} dismissible={!busy}>
      <p className="mb-4 text-on-surface-variant">{message}</p>
      {error && <div className="mb-4"><ErrorNote error={error} /></div>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" autoFocus disabled={busy} onClick={onClose}>Cancel</Button>
        <Button variant={danger ? 'danger' : 'primary'} disabled={busy} onClick={handleConfirm}>
          {busy ? 'Working…' : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
