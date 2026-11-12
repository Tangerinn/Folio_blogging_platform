import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../state/AuthContext.jsx';
import { Button, ErrorNote, Field, Input, PasswordInput } from '../../components/common/ui.jsx';
import { ForestCanopyArt } from '../../components/common/BotanicalArt.jsx';
import { isMock } from '../../services/api/index.js';

export default function Login() {
  const { user, loading: authLoading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!authLoading && user) {
    return <Navigate to={location.state?.from || (user.role === 'admin' ? '/admin' : '/')} replace />;
  }

  const validateField = (key, value) => {
    if (key === 'email') {
      if (!value.trim()) return 'Enter your email address.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'Enter an email address like name@example.com.';
    }
    if (key === 'password' && !value) return 'Enter your password.';
    return '';
  };

  const handleBlur = (key) => {
    const msg = validateField(key, form[key]);
    setFieldErrors((prev) => ({ ...prev, [key]: msg }));
  };

  const handleChange = (key) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
    if (fieldErrors[key]) {
      setFieldErrors((prev) => ({ ...prev, [key]: validateField(key, value) }));
    }
    if (error) setError(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    const nextErrors = {
      email: validateField('email', form.email),
      password: validateField('password', form.password),
    };
    setFieldErrors(nextErrors);
    if (nextErrors.email || nextErrors.password) return;

    setBusy(true);
    setError(null);
    try {
      const u = await login({ email: form.email.trim(), password: form.password });
      navigate(location.state?.from || (u.role === 'admin' ? '/admin' : '/'), { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const fill = (email, password) => {
    setForm({ email, password });
    setFieldErrors({});
    setError(null);
  };

  return (
    <div className="bg-field-grid px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-md overflow-hidden rounded-panel border border-moss/35 bg-surface-low">
        <div className="relative border-b border-outline-variant/45 bg-pine text-on-primary">
          <ForestCanopyArt className="h-28 w-full opacity-95" />
          <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-pine/90 via-pine/35 to-transparent px-6 pb-4">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-sage">Folio Notebook</span>
            <h1 className="font-display text-2xl font-bold leading-tight text-parchment sm:text-3xl">Welcome back</h1>
          </div>
        </div>
        <div className="p-6 sm:p-8">
          <form onSubmit={submit} noValidate className="space-y-5">
            <Field label="Email" error={fieldErrors.email} required>
              <Input
                type="email"
                name="email"
                required
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="next"
                value={form.email}
                onChange={handleChange('email')}
                onBlur={() => handleBlur('email')}
              />
            </Field>
            <Field label="Password" error={fieldErrors.password} required>
              <PasswordInput
                name="password"
                required
                autoComplete="current-password"
                enterKeyHint="done"
                value={form.password}
                onChange={handleChange('password')}
                onBlur={() => handleBlur('password')}
              />
            </Field>
            <ErrorNote error={error} />
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
          {isMock && (
            <div className="mt-6 rounded-field border border-outline-variant/50 bg-surface-container p-3.5 text-xs text-on-surface-variant">
              <p className="mb-1.5 font-semibold text-pine">Demo accounts (local mock data only)</p>
              <div className="flex flex-wrap gap-3">
                <button type="button" className="font-medium text-moss underline" onClick={() => fill('student@demo.com', 'password123')}>
                  Use Student demo
                </button>
                <button type="button" className="font-medium text-moss underline" onClick={() => fill('admin@demo.com', 'admin123')}>
                  Use Admin demo
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <p className="mt-6 text-center text-sm text-on-surface-variant">
        New here? <Link to="/register" className="font-semibold text-moss underline">Create an account</Link>
      </p>
    </div>
  );
}
