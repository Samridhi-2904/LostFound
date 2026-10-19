import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, ArrowLeft } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="card" style={{ maxWidth: '500px', margin: '4rem auto', textAlign: 'center', padding: '3.5rem 2rem' }}>
      <div style={{ display: 'inline-flex', padding: '1rem', borderRadius: 'var(--radius-full)', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)', marginBottom: '1.25rem' }}>
        <Compass size={40} />
      </div>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#fff', marginBottom: '0.5rem' }}>404</h1>
      <h2 style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', fontWeight: 500 }}>
        Page Not Found
      </h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>
        The link you followed may be broken or the page may have been relocated.
      </p>
      <Link to="/" className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
        <ArrowLeft size={16} /> Return to Home
      </Link>
    </div>
  );
};
