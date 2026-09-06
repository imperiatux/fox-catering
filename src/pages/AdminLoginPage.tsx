import { useState } from 'react';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        window.location.href = '/admin/dashboard';
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Login failed');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <main className="admin-login-wrap">
        <div className="admin-login-card card">
          <h1 className="admin-login-title">Fox Catering</h1>
          <p className="text-muted admin-login-subtitle">Admin access</p>

          <form onSubmit={handleSubmit} className="admin-login-form">
            <div className="form-field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                disabled={loading}
              />
            </div>

            {error && (
              <p className="text-error admin-login-error" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="btn btn-primary admin-login-btn"
              disabled={loading || password.length === 0}
            >
              {loading ? 'Logging in…' : 'Login'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
