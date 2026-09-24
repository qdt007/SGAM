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
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });
  const onSubmit = async (data: FormData) => {
    setServerError('');
    try {
      const r = await authApi.login(data);
      setAuth(r.user, r.accessToken);
      navigate('/dashboard');
    } catch (err: unknown) {
      setServerError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Login failed.',
      );
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
          </form>
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
