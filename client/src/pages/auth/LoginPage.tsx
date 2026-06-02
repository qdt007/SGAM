import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '../../api/authApi';
import { useAuthStore } from '../../stores/authStore';
import { cn } from '../../utils/cn';
const schema = z.object({ email: z.string().email('Invalid email'), password: z.string().min(1, 'Required') });
type FormData = z.infer<typeof schema>;
export function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });
  const onSubmit = async (data: FormData) => {
    setServerError('');
    try { const r = await authApi.login(data); setAuth(r.user, r.accessToken); navigate('/dashboard'); }
    catch (err: unknown) { setServerError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Login failed.'); }
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 to-indigo-100 dark:from-gray-950 dark:to-gray-900 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600 text-2xl shadow-lg">P</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome back</h1>
          <p className="mt-1 text-sm text-gray-500">Sign in to your account</p>
        </div>
        <div className="card p-8 shadow-xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {serverError && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{serverError}</div>}
            <div>
              <label className="label">Email address</label>
              <input {...register('email')} type="email" placeholder="you@example.com" className={cn('input', errors.email && 'border-red-400')} />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
            </div>
            <div>
              <label className="label">Password</label>
              <input {...register('password')} type="password" placeholder="Password" className={cn('input', errors.password && 'border-red-400')} />
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
            </div>
            <button type="submit" disabled={isSubmitting} className="btn-primary w-full justify-center py-2.5">
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-gray-500">
            No account? <Link to="/register" className="font-medium text-primary-600 hover:text-primary-700">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
