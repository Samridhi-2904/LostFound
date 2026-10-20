import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Compass, Lock, Mail, AlertCircle, ArrowRight, User, ShieldCheck, Settings } from 'lucide-react';

type LoginMode = 'user' | 'staff' | 'admin';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginMode, setLoginMode] = useState<LoginMode>('user');

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const modeConfig = {
    user: {
      label: 'Student / User',
      icon: <User size={20} />,
      color: '#2563eb',
      bg: '#eff6ff',
      desc: 'Access your reports, claims, and notifications.',
      email: 'alice@campus.edu',
      password: 'StudentPass123!',
    },
    staff: {
      label: 'Staff Member',
      icon: <ShieldCheck size={20} />,
      color: '#0f766e',
      bg: '#f0fdfa',
      desc: 'Review reports, process claims, and manage custody.',
      email: 'staff@campus.edu',
      password: 'StaffSecret123!',
    },
    admin: {
      label: 'Administrator',
      icon: <Settings size={20} />,
      color: '#7c3aed',
      bg: '#f5f3ff',
      desc: 'Full system access: users, categories, and audit logs.',
      email: 'admin@campus.edu',
      password: 'AdminSecret123!',
    },
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const loggedUser = await login(email, password);
      if (from && from !== '/dashboard') {
        navigate(from, { replace: true });
      } else if (loggedUser?.role === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else if (loggedUser?.role === 'staff') {
        navigate('/staff/dashboard', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const current = modeConfig[loginMode];

  return (
    <div style={{ maxWidth: '480px', margin: '2rem auto', padding: '0 1rem' }}>
      <div className="card" style={{ padding: '2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'var(--primary)', color: '#fff', marginBottom: '1rem', boxShadow: '0 2px 8px var(--primary-glow)' }}>
            <Compass size={28} />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
            Welcome Back
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Sign in to manage reports, file claims, or track custody.
          </p>
        </div>

        {/* Login As Selection */}
        <div style={{ marginBottom: '1.75rem' }}>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Sign In As
          </label>
          <div className="login-role-selector">
            {(Object.keys(modeConfig) as LoginMode[]).map((mode) => {
              const cfg = modeConfig[mode];
              const isActive = loginMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setLoginMode(mode);
                    setEmail(cfg.email);
                    setPassword(cfg.password);
                    setError(null);
                  }}
                  className={`login-role-btn ${isActive ? 'active' : ''}`}
                  style={{
                    '--role-color': cfg.color,
                    '--role-bg': cfg.bg,
                  } as React.CSSProperties}
                >
                  <span className="login-role-icon">{cfg.icon}</span>
                  <span className="login-role-label">{cfg.label}</span>
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.65rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: current.color, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              {current.icon} {current.desc}
            </span>
            <button
              type="button"
              onClick={() => {
                setEmail(current.email);
                setPassword(current.password);
                setError(null);
              }}
              style={{
                background: current.bg,
                color: current.color,
                border: `1px solid ${current.color}40`,
                borderRadius: 'var(--radius-sm)',
                padding: '0.2rem 0.6rem',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Fill Demo Credentials ({current.email})
            </button>
          </div>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Campus Email</label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-email"
                type="email"
                className="form-input"
                placeholder="student@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                style={{ paddingLeft: '2.5rem' }}
              />
              <Mail size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label" htmlFor="login-password">Password</label>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                type="password"
                className="form-input"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{ paddingLeft: '2.5rem' }}
              />
              <Lock size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', marginTop: '0.75rem', padding: '0.8rem' }}
          >
            {loading ? 'Authenticating...' : `Sign In as ${current.label}`}
            <ArrowRight size={16} />
          </button>
        </form>

        <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Don't have an account yet?{' '}
          <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600 }}>
            Create one now
          </Link>
        </div>
      </div>
    </div>
  );
};
