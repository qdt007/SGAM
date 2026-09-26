import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '../../api/authApi';
import { useAuthStore } from '../../stores/authStore';
import { cn } from '../../utils/cn';
import { SgamLogo } from '../../components/layout/Layout';
const schema = z
  .object({
    displayName: z.string().min(1).max(60),
    username: z
      .string()
      .min(3)
      .max(30)
      .regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers, underscores only'),
    email: z.string().email('Invalid email'),
    password: z.string().min(8, 'At least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });
type FormData = z.infer<typeof schema>;
export function RegisterPage() {
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
      const r = await authApi.register({
        email: data.email,
        username: data.username,
        password: data.password,
        displayName: data.displayName,
      });
      setAuth(r.user, r.accessToken, r.refreshToken);
      navigate('/dashboard');
    } catch (err: unknown) {
      setServerError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Registration failed.',
      );
    }
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-page p-4">
      <div className="w-full max-w-[400px]">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="mb-5 h-14 w-14 overflow-hidden rounded-xl shadow-card">
            <SgamLogo size={56} />
          </div>
          <h1 className="font-display text-section font-bold text-ink">Create your account</h1>
          <p className="mt-2 text-small text-ink-muted">Join SGAM and start collaborating</p>
        </div>
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
            {[
              { name: 'displayName' as const, label: 'Full name', placeholder: 'John Doe', type: 'text' },
              { name: 'username' as const, label: 'Username', placeholder: 'john_doe', type: 'text' },
              { name: 'email' as const, label: 'Email', placeholder: 'you@example.com', type: 'email' },
              { name: 'password' as const, label: 'Password', placeholder: 'Min. 8 chars', type: 'password' },
              {
                name: 'confirmPassword' as const,
                label: 'Confirm password',
                placeholder: 'Repeat password',
                type: 'password',
              },
            ].map(({ name, label, placeholder, type }) => (
              <div key={name}>
                <label className="label">{label}</label>
                <input
                  {...register(name)}
                  type={type}
                  placeholder={placeholder}
                  className={cn('input', errors[name] && 'input-invalid')}
                />
                {errors[name] && <p className="field-error">{errors[name]?.message}</p>}
              </div>
            ))}
            <button type="submit" disabled={isSubmitting} className="btn-primary mt-2 w-full">
              {isSubmitting ? 'Creating…' : 'Create account'}
            </button>
          </form>
        </div>
        <p className="mt-6 text-center text-sm text-ink-muted">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
