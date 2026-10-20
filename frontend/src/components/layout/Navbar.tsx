import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  Search, 
  PlusCircle, 
  User, 
  LogOut, 
  ShieldCheck, 
  Bell, 
  Menu, 
  X,
  Compass
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, isStaff, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const isActive = (path: string) => location.pathname === path;

  // When on dashboard (which has its own dedicated sidebar navigation), hide the top navbar
  if (location.pathname === '/dashboard' || location.pathname === '/profile') {
    return null;
  }

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-logo" onClick={() => setMobileMenuOpen(false)}>
          <span className="navbar-logo-badge">
            <Compass size={22} />
          </span>
          FindIt
        </Link>

        {/* Desktop Navigation */}
        <nav className="nav-links" style={{ display: 'none' }}>
          {/* Will be enabled with CSS breakpoint below */}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div className="nav-links-desktop" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <Link 
              to="/search" 
              className={`nav-link ${isActive('/search') ? 'active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Search size={16} />
              Browse Reports
            </Link>

            <Link 
              to="/report/lost" 
              className={`nav-link ${isActive('/report/lost') ? 'active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <PlusCircle size={16} />
              Report Lost
            </Link>

            <Link 
              to="/report/found" 
              className={`nav-link ${isActive('/report/found') ? 'active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <ShieldCheck size={16} />
              Report Found
            </Link>

            {isAuthenticated && !isStaff && (
              <Link 
                to="/dashboard" 
                className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <User size={16} />
                My Dashboard
              </Link>
            )}

            {isStaff && (
              <Link 
                to="/staff/dashboard" 
                className={`nav-link ${isActive('/staff/dashboard') ? 'active' : ''}`}
                style={{ fontWeight: 600, color: 'var(--secondary)' }}
              >
                Staff Desk
              </Link>
            )}

            {isAdmin && (
              <Link 
                to="/admin/dashboard" 
                className={`nav-link ${isActive('/admin/dashboard') ? 'active' : ''}`}
                style={{ fontWeight: 600, color: '#4338ca' }}
              >
                Admin Console
              </Link>
            )}
          </div>

          <div className="nav-actions">
            {isAuthenticated && user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <Link 
                  to="/notifications" 
                  className="btn btn-outline btn-sm" 
                  title="Notifications"
                  style={{ padding: '0.5rem', borderRadius: '50%' }}
                >
                  <Bell size={18} />
                </Link>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ textAlign: 'right', display: 'none' }} className="user-text-info">
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user.full_name}</div>
                    <span className={`badge-role ${user.role}`}>
                      {user.role}
                    </span>
                  </div>
                  <Link 
                    to={user.role === 'admin' ? '/admin/dashboard' : user.role === 'staff' ? '/staff/dashboard' : '/dashboard'} 
                    className="btn btn-secondary btn-sm" 
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <User size={15} />
                    <span>{user.full_name.split(' ')[0]}</span>
                    <span className={`badge-role ${user.role}`}>{user.role}</span>
                  </Link>
                </div>

                <button 
                  onClick={handleLogout} 
                  className="btn btn-outline btn-sm"
                  title="Sign Out"
                  style={{ padding: '0.55rem' }}
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Link to="/login" className="btn btn-outline btn-sm">
                  Sign In
                </Link>
                <Link to="/register" className="btn btn-primary btn-sm">
                  Register
                </Link>
              </div>
            )}

            {/* Mobile Hamburger Button */}
            <button 
              className="btn btn-outline btn-sm mobile-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{ display: 'none' }}
              aria-label="Toggle Navigation"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div style={{
          padding: '1.5rem',
          background: 'var(--bg-surface-elevated)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}>
          <Link 
            to="/search" 
            className="nav-link" 
            onClick={() => setMobileMenuOpen(false)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Search size={18} /> Browse Reports
          </Link>
          <Link 
            to="/report/lost" 
            className="nav-link" 
            onClick={() => setMobileMenuOpen(false)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <PlusCircle size={18} /> Report Lost Item
          </Link>
          <Link 
            to="/report/found" 
            className="nav-link" 
            onClick={() => setMobileMenuOpen(false)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <ShieldCheck size={18} /> Report Found Property
          </Link>
          {isAuthenticated && !isStaff && (
            <Link 
              to="/dashboard" 
              className="nav-link" 
              onClick={() => setMobileMenuOpen(false)}
            >
              <User size={18} /> My Dashboard
            </Link>
          )}
          {isStaff && (
            <Link 
              to="/staff/dashboard" 
              className="nav-link" 
              onClick={() => setMobileMenuOpen(false)}
              style={{ color: 'var(--secondary)' }}
            >
              Staff Desk
            </Link>
          )}
          {isAdmin && (
            <Link 
              to="/admin/dashboard" 
              className="nav-link" 
              onClick={() => setMobileMenuOpen(false)}
              style={{ color: '#4338ca' }}
            >
              Admin Console
            </Link>
          )}
        </div>
      )}
    </header>
  );
};
