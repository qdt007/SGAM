import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/authApi';
import { useAuthStore } from '../../stores/authStore';
import { SgamLogo } from '../../components/layout/Layout';

/**
 * Where Google's callback drops the browser. The server puts the result in the URL fragment
 * rather than the query string, so the tokens never reach a server log or a Referer header;
 * this page reads them once and wipes the fragment out of the address bar and history.
 */
export function GoogleCallbackPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [error, setError] = useState('');
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  // Strict mode runs effects twice in dev; the fragment is gone by the second pass.
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    window.history.replaceState(null, '', window.location.pathname);

    const failed = params.get('error');
    if (failed) return setError(failed);

    const challenge = params.get('challengeToken');
    if (challenge) return setChallengeToken(challenge);

    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');
    if (!accessToken || !refreshToken) return setError('Google did not return a session. Try again.');

    // Store the tokens first: the axios interceptor reads them straight back out of storage,
    // so getMe would go out unauthenticated if we asked before saving.
    useAuthStore.getState().setAccessToken(accessToken, refreshToken);
    authApi
      .getMe()
      .then((user) => {
        setAuth(user, accessToken, refreshToken);
        navigate('/dashboard', { replace: true });
      })
      .catch(() => setError('Signed in, but the profile could not be loaded. Try again.'));
  }, [navigate, setAuth]);

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeToken) return;
    setError('');
    setVerifying(true);
    try {
      const r = await authApi.twoFactorVerify(challengeToken, code);
      if (r.requiresTwoFactor) return;
      setAuth(r.user, r.accessToken, r.refreshToken);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'That code is not right.',
      );
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-page p-4">
      <div className="w-full max-w-[400px] text-center">
        <div className="mx-auto mb-5 h-14 w-14 overflow-hidden rounded-xl shadow-card">
          <SgamLogo size={56} />
        </div>

        {error ? (
          <>
            <h1 className="font-display text-section font-bold text-ink">Could not sign you in</h1>
            <p className="mt-2 text-sm text-ink-muted">{error}</p>
            <Link to="/login" className="btn-primary mt-6 w-full">
              Back to sign in
            </Link>
          </>
        ) : challengeToken ? (
          <form onSubmit={submitCode} className="card mt-2 space-y-4 text-left">
            <div>
              <h1 className="text-sm font-semibold text-ink">Two-step verification</h1>
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
              className="input w-full text-center font-mono text-lg tracking-[0.3em]"
            />
            <button type="submit" disabled={verifying || code.trim().length < 6} className="btn-primary w-full">
              {verifying ? 'Checking…' : 'Verify'}
            </button>
          </form>
        ) : (
          <p className="text-sm text-ink-muted">Finishing sign-in…</p>
        )}
      </div>
    </div>
  );
}
