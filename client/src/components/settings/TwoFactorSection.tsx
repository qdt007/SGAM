import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi, TwoFactorSetup } from '../../api/authApi';

const apiMessage = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { message?: string; errors?: Array<{ message: string }> } } })?.response?.data
    ?.errors?.[0]?.message ??
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
  fallback;

/**
 * Enrolment is three steps because that is the shape of TOTP: scan, prove it works, then keep
 * the recovery codes. The codes are shown exactly once — the server only stores their hashes.
 */
export function TwoFactorSection() {
  const qc = useQueryClient();
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const { data: status } = useQuery({ queryKey: ['auth', '2fa'], queryFn: authApi.twoFactorStatus });

  const reset = () => {
    setSetup(null);
    setCode('');
    setPassword('');
    setDisabling(false);
    setError('');
  };

  const start = useMutation({
    mutationFn: authApi.twoFactorSetup,
    onSuccess: (s) => {
      setSetup(s);
      setError('');
    },
    onError: (e) => setError(apiMessage(e, 'Could not start the setup')),
  });

  const enable = useMutation({
    mutationFn: () => authApi.twoFactorEnable(code.trim()),
    onSuccess: (r) => {
      setBackupCodes(r.backupCodes);
      reset();
      qc.invalidateQueries({ queryKey: ['auth', '2fa'] });
    },
    onError: (e) => setError(apiMessage(e, 'That code is not right')),
  });

  const disable = useMutation({
    mutationFn: () => authApi.twoFactorDisable(password),
    onSuccess: () => {
      reset();
      setBackupCodes(null);
      qc.invalidateQueries({ queryKey: ['auth', '2fa'] });
    },
    onError: (e) => setError(apiMessage(e, 'Could not turn it off')),
  });

  return (
    <div className="space-y-3 rounded-lg bg-sunken px-4 py-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Two-factor authentication</p>
          <p className="text-xs text-ink-muted">
            {status?.enabled
              ? `On. ${status.backupCodesLeft} recovery ${status.backupCodesLeft === 1 ? 'code' : 'codes'} left.`
              : 'Ask for a code from your phone as well as your password.'}
          </p>
        </div>
        {!setup && !disabling && (
          <button
            onClick={() => (status?.enabled ? setDisabling(true) : start.mutate())}
            disabled={start.isPending}
            className={status?.enabled ? 'btn-ghost shrink-0 py-1.5 text-sm text-ink-muted' : 'btn-secondary shrink-0 py-1.5 text-sm'}
          >
            {start.isPending ? 'Preparing…' : status?.enabled ? 'Turn off' : 'Turn on'}
          </button>
        )}
      </div>

      {setup && (
        <div className="space-y-3 border-t border-line-soft pt-3">
          <p className="text-xs text-ink-muted">
            1. Scan this with Google Authenticator, Authy or 1Password.
          </p>
          <img src={setup.qrDataUrl} alt="Two-factor QR code" className="h-40 w-40 rounded-lg bg-white p-2" />
          <p className="text-xs text-ink-muted">
            Cannot scan? Enter this key by hand:
            <br />
            <code className="mt-1 inline-block break-all font-mono text-2xs text-ink">{setup.secret}</code>
          </p>
          <p className="text-xs text-ink-muted">2. Enter the 6-digit code it shows.</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              inputMode="numeric"
              maxLength={6}
              className="input w-32 py-1 text-center font-mono tracking-widest"
            />
            <button onClick={() => enable.mutate()} disabled={enable.isPending || code.trim().length !== 6} className="btn-primary py-1.5 text-sm">
              {enable.isPending ? 'Checking…' : 'Turn on'}
            </button>
            <button onClick={reset} className="btn-ghost py-1.5 text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {disabling && (
        <div className="space-y-2 border-t border-line-soft pt-3">
          <p className="text-xs text-ink-muted">Enter your password to turn two-factor off.</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              autoFocus
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              className="input max-w-[220px] py-1 text-sm"
            />
            <button onClick={() => disable.mutate()} disabled={disable.isPending || !password} className="btn-primary py-1.5 text-sm">
              {disable.isPending ? 'Turning off…' : 'Turn off'}
            </button>
            <button onClick={reset} className="btn-ghost py-1.5 text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      {backupCodes && (
        <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/[0.06] p-3">
          <p className="text-sm font-medium">Save your recovery codes</p>
          <p className="text-xs text-ink-muted">
            Each one works once, if you lose your phone. This is the only time they are shown.
          </p>
          <div className="grid grid-cols-2 gap-1 font-mono text-xs">
            {backupCodes.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => navigator.clipboard?.writeText(backupCodes.join('\n'))}
              className="btn-secondary py-1 text-xs"
            >
              Copy
            </button>
            <button onClick={() => setBackupCodes(null)} className="btn-ghost py-1 text-xs">
              I have saved them
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
