import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '../../api/authApi';
import { useAuthStore } from '../../stores/authStore';
import { cn } from '../../utils/cn';
import { SgamLogo } from '../../components/layout/Layout';
const schema = z.object({ email: z.string().email('Invalid email'), password: z.string().min(1, 'Required') });
type FormData = z.infer<typeof schema>;
export function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [serverError, setServerError] = useState('');
  // Set once the password is accepted but the account also wants a second factor.
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const startGoogle = async () => {
    setServerError('');
    setGoogleBusy(true);
    try {
      window.location.href = await authApi.googleUrl();
    } catch (err: unknown) {
      setGoogleBusy(false);
      setServerError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Google sign-in is not available right now.',
      );
    }
  };
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });
  const onSubmit = async (data: FormData) => {
    setServerError('');
    try {
      const r = await authApi.login(data);
      if (r.requiresTwoFactor) {
        setChallengeToken(r.challengeToken);
        return;
      }
      setAuth(r.user, r.accessToken, r.refreshToken);
      navigate('/dashboard');
    } catch (err: unknown) {
      setServerError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Login failed.',
      );
    }
  };
  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeToken) return;
    setServerError('');
    setVerifying(true);
    try {
      const r = await authApi.twoFactorVerify(challengeToken, code);
      if (r.requiresTwoFactor) return; // cannot happen, but keeps the union honest
      setAuth(r.user, r.accessToken, r.refreshToken);
      navigate('/dashboard');
    } catch (err: unknown) {
      setServerError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'That code is not right.',
      );
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-page p-4">
      <div className="w-full max-w-[400px]">
        {/* Brand */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="mb-5 h-14 w-14 overflow-hidden rounded-xl shadow-card">
            <SgamLogo size={56} />
          </div>
          <h1 className="font-display text-section font-bold text-ink">Sign in to SGAM</h1>
          <p className="mt-2 text-small text-ink-muted">Manage your projects and track contributions</p>
        </div>

        {/* Card */}
        <div className="card">
          {challengeToken ? (
            <form onSubmit={submitCode} className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-ink">Two-step verification</h2>
                <p className="mt-1 text-sm text-ink-muted">
                  Enter the 6-digit code from your authenticator app, or one of your recovery codes.
                </p>
              </div>
              <input
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                autoComplete="one-time-code"
                inputMode="text"
                className="input w-full text-center font-mono text-lg tracking-[0.3em]"
              />
              {serverError && <p className="text-sm text-red-500">{serverError}</p>}
              <button type="submit" disabled={verifying || code.trim().length < 6} className="btn-primary w-full">
                {verifying ? 'Checking…' : 'Verify'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setChallengeToken(null);
                  setCode('');
                  setServerError('');
                }}
                className="btn-ghost w-full text-sm"
              >
                Back to sign in
              </button>
            </form>
          ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {serverError && (
              <div
                role="alert"
                className="rounded-lg border border-danger/25 bg-danger/[0.07] px-4 py-3 text-small text-danger"
              >
                {serverError}
              </div>
            )}
            <div>
              <label className="label">Email address</label>
              <input
                {...register('email')}
                type="email"
                placeholder="you@example.com"
                className={cn('input', errors.email && 'input-invalid')}
              />
              {errors.email && <p className="field-error">{errors.email.message}</p>}
            </div>
            <div>
              <label className="label">Password</label>
              <input
                {...register('password')}
                type="password"
                placeholder="••••••••"
                className={cn('input', errors.password && 'input-invalid')}
              />
              {errors.password && <p className="field-error">{errors.password.message}</p>}
            </div>
            <button type="submit" disabled={isSubmitting} className="btn-primary mt-2 w-full">
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>

            <div className="flex items-center gap-3 pt-1">
              <span className="h-px flex-1 bg-line" />
              <span className="text-xs text-ink-subtle">or</span>
              <span className="h-px flex-1 bg-line" />
            </div>

            {/* The jump to Google starts from this origin on purpose — see googleStart. */}
            <button type="button" onClick={startGoogle} disabled={googleBusy} className="btn-secondary w-full justify-center gap-2">
              <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
                <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
                <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C39.9 35.6 44 30.4 44 24c0-1.3-.1-2.6-.4-3.9z" />
              </svg>
              {googleBusy ? 'Opening Google…' : 'Continue with Google'}
            </button>
          </form>
          )}
        </div>

        <p className="mt-6 text-sm text-ink-muted text-center">
          Don't have an account?{' '}
          <Link to="/register" className="text-primary font-medium hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
