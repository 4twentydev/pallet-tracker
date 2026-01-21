'use client';

import { useState } from 'react';
import { login } from '../actions/auth';

export function LoginForm() {
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError('');

    try {
      const result = await login(formData);
      if (result?.error) {
        setError(result.error);
      }
    } catch (err) {
      setError('An error occurred during login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-subtle bg-[color:var(--surface)] p-8 shadow-sm">
          <h2 className="mb-6 text-2xl font-semibold text-strong">
            Enter PIN
          </h2>

          <form action={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="pin" className="mb-2 block text-sm font-medium text-muted">
                PIN Code
              </label>
              <input
                type="password"
                id="pin"
                name="pin"
                required
                minLength={4}
                maxLength={50}
                autoFocus
                className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-foreground focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20"
                placeholder="Enter your PIN (min 4 characters)"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="mb-4 rounded-2xl bg-error/10 px-4 py-3 text-sm text-error">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-accent-primary px-6 py-3 font-medium text-white transition-all hover:bg-accent-primary/90 disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
