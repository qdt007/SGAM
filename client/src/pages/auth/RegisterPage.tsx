import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '../../api/authApi';
import { useAuthStore } from '../../stores/authStore';
import { cn } from '../../utils/cn';
const schema = z.object({
  displayName: z.string().min(1).max(60),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers, underscores only'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'At least 8 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });
type FormData = z.infer<typeof schema>;
export function RegisterPage() {
  const navigate = useNavigate(); const { setAuth } = useAuthStore(); const [serverError, setServerError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });
  const onSubmit = async (data: FormData) => {
    setServerError('');
    try { const r = await authApi.register({ email: data.email, username: data.username, password: data.password, displayName: data.displayName }); setAuth(r.user, r.accessToken); navigate('/dashboard'); }
    catch (err: unknown) { setServerError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Registration failed.'); }
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 to-indigo-100 dark:from-gray-950 dark:to-gray-900 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600 text-2xl shadow-lg">P</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create account</h1>
        </div>
        <div className="card p-8 shadow-xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {serverError && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{serverError}</div>}
            {[{ name: 'displayName' as const, label: 'Full name', placeholder: 'John Doe', type: 'text' }, { name: 'username' as const, label: 'Username', placeholder: 'john_doe', type: 'text' }, { name: 'email' as const, label: 'Email', placeholder: 'you@example.com', type: 'email' }, { name: 'password' as const, label: 'Password', placeholder: 'Min. 8 chars', type: 'password' }, { name: 'confirmPassword' as const, label: 'Confirm password', placeholder: 'Repeat password', type: 'password' }].map(({ name, label, placeholder, type }) => (
              <div key={name}>
                <label className="label">{label}</label>
                <input {...register(name)} type={type} placeholder={placeholder} className={cn('input', errors[name] && 'border-red-400')} />
                {errors[name] && <p className="mt-1 text-xs text-red-500">{errors[name]?.message}</p>}
              </div>
            ))}
            <button type="submit" disabled={isSubmitting} className="btn-primary w-full justify-center py-2.5 mt-2">{isSubmitting ? 'Creating...' : 'Create account'}</button>
          </form>
          <p className="mt-6 text-center text-sm text-gray-500">Already have an account? <Link to="/login" className="font-medium text-primary-600">Sign in</Link></p>
        </div>
      </div>
    </div>
  );
}
