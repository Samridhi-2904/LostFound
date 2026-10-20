import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Compass, ShieldCheck, Lock, HeartHandshake } from 'lucide-react';

const currentYear = new Date().getFullYear();

export const Footer: React.FC = () => {
  const location = useLocation();

  if (location.pathname === '/dashboard' || location.pathname === '/profile') {
    return null;
  }

  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1rem', color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.2rem' }}>
            <span className="navbar-logo-badge" style={{ width: '30px', height: '30px' }}>
              <Compass size={18} />
            </span>
            FindIt Portal
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '380px', lineHeight: 1.6 }}>
            The official campus lost and found service. Helping students, staff, and visitors securely report, track, and reclaim misplaced belongings.
          </p>
          <div style={{ marginTop: '1.2rem', display: 'flex', gap: '1rem', color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}>
              <Lock size={14} color="#059669" /> Data Privacy Enforced
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem' }}>
              <ShieldCheck size={14} color="var(--primary)" /> Verified Custody
            </span>
          </div>
        </div>

        <div>
          <h4 style={{ color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: '1rem', fontWeight: 600 }}>Quick Navigation</h4>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.9rem' }}>
            <li><Link to="/search" style={{ color: 'var(--text-secondary)', transition: 'color 0.2s' }}>Browse Verified Items</Link></li>
            <li><Link to="/report/lost" style={{ color: 'var(--text-secondary)', transition: 'color 0.2s' }}>Report Lost Property</Link></li>
            <li><Link to="/report/found" style={{ color: 'var(--text-secondary)', transition: 'color 0.2s' }}>Turn in a Found Item</Link></li>
            <li><Link to="/login" style={{ color: 'var(--text-secondary)', transition: 'color 0.2s' }}>Account Login</Link></li>
          </ul>
        </div>

        <div>
          <h4 style={{ color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: '1rem', fontWeight: 600 }}>Custody &amp; Handover</h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.6 }}>
            Found items are safeguarded at official designated campus custody facilities. To protect finder privacy and secure physical lockers, precise locker codes and contacts are verified in person upon claim approval.
          </p>
          <div style={{ marginTop: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', fontSize: '0.82rem', fontWeight: 600 }}>
            <HeartHandshake size={15} /> Verified return workflow
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <div>&copy; {currentYear} FindIt Campus Lost and Found Management System. All rights reserved.</div>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <span>Privacy Policy</span>
          <span>Terms of Custody</span>
          <span>Security</span>
        </div>
      </div>
    </footer>
  );
};
