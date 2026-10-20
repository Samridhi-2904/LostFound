import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Compass, Lock, Mail, User, Phone, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      await register({
        full_name: fullName,
        email,
        password,
        phone_number: phoneNumber || undefined,
      });
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Registration failed. An account with this email may already exist.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '480px', margin: '2rem auto', padding: '0 1rem' }}>
      <div className="card" style={{ padding: '2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'var(--primary)', color: '#fff', marginBottom: '1rem', boxShadow: '0 2px 8px var(--primary-glow)' }}>
            <Compass size={28} />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
            Create Your Account
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Register to file reports, track misplaced property, and claim found items.
          </p>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="register-name">Full Name</label>
            <div style={{ position: 'relative' }}>
              <input
                id="register-name"
                type="text"
                className="form-input"
                placeholder="Jane Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                style={{ paddingLeft: '2.5rem' }}
              />
              <User size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="register-email">Campus Email</label>
            <div style={{ position: 'relative' }}>
              <input
                id="register-email"
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
            <label className="form-label" htmlFor="register-phone">Phone Number (Optional)</label>
            <div style={{ position: 'relative' }}>
              <input
                id="register-phone"
                type="tel"
                className="form-input"
                placeholder="+1 (555) 000-0000"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                style={{ paddingLeft: '2.5rem' }}
              />
              <Phone size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="register-password">Password (Minimum 8 characters)</label>
            <div style={{ position: 'relative' }}>
              <input
                id="register-password"
                type="password"
                className="form-input"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                style={{ paddingLeft: '2.5rem' }}
              />
              <Lock size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="register-confirm">Confirm Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="register-confirm"
                type="password"
                className="form-input"
                placeholder="••••••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                style={{ paddingLeft: '2.5rem' }}
              />
              <CheckCircle2 size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
            By registering, your account will have standard member permissions. Contact an administrator for staff role assignment.
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '0.8rem' }}
          >
            {loading ? 'Creating Account...' : 'Complete Registration'}
            <ArrowRight size={16} />
          </button>
        </form>

        <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>
            Sign In here
          </Link>
        </div>
      </div>
    </div>
  );
};
