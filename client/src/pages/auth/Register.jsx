import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../state/AuthContext.jsx';
import { Button, ErrorNote, Field, Input, PasswordInput } from '../../components/common/ui.jsx';
import { ForestCanopyArt } from '../../components/common/BotanicalArt.jsx';

export default function Register() {
  const { user, loading: authLoading, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!authLoading && user) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/'} replace />;
  }

  const validateField = (key, value, current = form) => {
    if (key === 'name' && !value.trim()) return 'Enter your full name.';
    if (key === 'email') {
      if (!value.trim()) return 'Enter your email address.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'Enter an email address like name@example.com.';
    }
    if (key === 'password') {
      if (!value) return 'Choose a password.';
      if (value.length < 8) return 'Password must be at least 8 characters.';
    }
    if (key === 'confirmPassword') {
      if (!value) return 'Confirm your password.';
      if (value !== current.password) return 'Passwords do not match.';
    }
    return '';
  };

  const handleBlur = (key) => {
    setFieldErrors((prev) => ({ ...prev, [key]: validateField(key, form[key]) }));
  };

  const handleChange = (key) => (e) => {
    const value = e.target.value;
    const next = { ...form, [key]: value };
    setForm(next);
    setFieldErrors((prev) => {
      const updated = { ...prev };
      if (updated[key]) updated[key] = validateField(key, value, next);
      if (key === 'password' && updated.confirmPassword) {
        updated.confirmPassword = validateField('confirmPassword', next.confirmPassword, next);
      }
      return updated;
    });
    if (error) setError(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    const nextErrors = {
      name: validateField('name', form.name),
      email: validateField('email', form.email),
      password: validateField('password', form.password),
      confirmPassword: validateField('confirmPassword', form.confirmPassword),
    };
    setFieldErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;

    setBusy(true);
    setError(null);
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-field-grid px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-md overflow-hidden rounded-panel border border-moss/35 bg-surface-low">
        <div className="relative border-b border-outline-variant/45 bg-pine text-on-primary">
          <ForestCanopyArt className="h-28 w-full opacity-95" />
          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-pine/90 via-pine/35 to-transparent px-6 pb-4">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-sage">Start Writing</span>
            <h1 className="font-display text-2xl font-bold leading-tight text-parchment sm:text-3xl">Join Folio</h1>
          </div>
        </div>
        <div className="p-6 sm:p-8">
          <form onSubmit={submit} noValidate className="space-y-5">
            <Field label="Name" error={fieldErrors.name} required>
              <Input
                name="name"
                required
                autoComplete="name"
              enterKeyHint="next"
              value={form.name}
              onChange={handleChange('name')}
              onBlur={() => handleBlur('name')}
            />
          </Field>
          <Field label="Email" error={fieldErrors.email} required>
            <Input
              type="email"
              name="email"
              required
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="next"
              value={form.email}
              onChange={handleChange('email')}
              onBlur={() => handleBlur('email')}
            />
          </Field>
          <Field label="Password" hint="At least 8 characters." error={fieldErrors.password} required>
            <PasswordInput
              name="password"
              required
              minLength={8}
              autoComplete="new-password"
              enterKeyHint="next"
              value={form.password}
              onChange={handleChange('password')}
              onBlur={() => handleBlur('password')}
            />
          </Field>
          <Field label="Confirm password" error={fieldErrors.confirmPassword} required>
            <PasswordInput
              name="confirmPassword"
              required
              minLength={8}
              autoComplete="new-password"
              enterKeyHint="done"
              value={form.confirmPassword}
              onChange={handleChange('confirmPassword')}
              onBlur={() => handleBlur('confirmPassword')}
            />
          </Field>
          <ErrorNote error={error} />
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Creating account…' : 'Create account'}
            </Button>
          </form>
        </div>
      </div>
      <p className="mt-6 text-center text-sm text-on-surface-variant">
        Already a member? <Link to="/login" className="font-semibold text-moss underline">Sign in</Link>
      </p>
    </div>
  );
}
