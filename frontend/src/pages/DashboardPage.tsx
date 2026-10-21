import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { claimApi, authApi, reportApi, notificationApi } from '../services/api';
import type { Claim, ReturnRecord, ItemReport, NotificationItem } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import {
  HeartHandshake,
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  FileCheck,
  FileText,
  ArrowRight,
  PlusCircle,
  ShieldCheck,
  Lock,
  Tag,
  MapPin,
  Calendar,
  Bell,
  Settings,
  LayoutDashboard,
  Search,
  ChevronRight,
  Clock,
  TrendingUp,
  Eye,
  LogOut,
  Shield,
  Compass,
} from 'lucide-react';

type SidebarTab = 'overview' | 'reports' | 'claims' | 'notifications' | 'settings';

export const DashboardPage: React.FC = () => {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [myReports, setMyReports] = useState<ItemReport[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState<SidebarTab>('overview');

  // Edit profile state
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number || '');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Respond more info modal state
  const [respondClaim, setRespondClaim] = useState<Claim | null>(null);
  const [additionalEvidence, setAdditionalEvidence] = useState('');
  const [submittingResponse, setSubmittingResponse] = useState(false);
  const [responseError, setResponseError] = useState<string | null>(null);

  // View return record modal state
  const [returnRecord, setReturnRecord] = useState<ReturnRecord | null>(null);
  const [viewingReturnClaimId, setViewingReturnClaimId] = useState<number | null>(null);
  const [loadingReturn, setLoadingReturn] = useState(false);

  const loadUserData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [myClaims, myReportsList, notifs] = await Promise.all([
        claimApi.getMyClaims(),
        reportApi.getMyReports(),
        notificationApi.getNotifications(),
      ]);
      setClaims(myClaims);
      setNotifications(notifs);
      setMyReports(myReportsList);
    } catch (err) {
      console.error('Failed to load user data', err);
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name);
      setPhoneNumber(user.phone_number || '');
    }
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(null);
    setSaveError(null);
    try {
      await authApi.updateProfile({
        full_name: fullName,
        phone_number: phoneNumber || undefined,
        password: newPassword || undefined,
      });
      await refreshUser();
      setSaveSuccess('Profile successfully updated.');
      setNewPassword('');
    } catch (err: any) {
      setSaveError(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelClaim = async (claimId: number) => {
    if (!window.confirm('Are you sure you want to cancel this ownership claim?')) return;
    try {
      await claimApi.cancelClaim(claimId);
      loadUserData();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel claim.');
    }
  };

  const handleRespondMoreInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!respondClaim || !additionalEvidence.trim()) return;
    setSubmittingResponse(true);
    setResponseError(null);
    try {
      await claimApi.respondMoreInfo(respondClaim.claim_id, additionalEvidence);
      setRespondClaim(null);
      setAdditionalEvidence('');
      loadUserData();
    } catch (err: any) {
      setResponseError(err.message || 'Failed to submit additional evidence.');
    } finally {
      setSubmittingResponse(false);
    }
  };

  const handleViewReturn = async (claimId: number) => {
    setViewingReturnClaimId(claimId);
    setLoadingReturn(true);
    try {
      const rec = await claimApi.getReturnRecord(claimId);
      setReturnRecord(rec);
    } catch (err: any) {
      alert(err.message || 'Could not fetch return record.');
      setViewingReturnClaimId(null);
    } finally {
      setLoadingReturn(false);
    }
  };

  const handleMarkNotificationRead = async (id: number) => {
    try {
      await notificationApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.notification_id === id ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      console.error('Failed to mark notification as read', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Failed to mark all as read', err);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  if (!user) return null;

  const myLostCount = myReports.filter((r) => r.report_type === 'lost').length;
  const myFoundCount = myReports.filter((r) => r.report_type === 'found').length;
  const activeClaimsCount = claims.filter(
    (c) => c.claim_status === 'pending' || c.claim_status === 'more_information_requested'
  ).length;
  const approvedClaimsCount = claims.filter((c) => c.claim_status === 'approved').length;
  const unreadNotifs = notifications.filter((n) => !n.is_read).length;
  const pendingReports = myReports.filter((r) => r.moderation_status === 'pending').length;

  const roleLabel =
    user.role === 'admin'
      ? 'Administrator'
      : user.role === 'staff'
      ? 'Staff Member'
      : 'Student';

  const sidebarItems: { id: SidebarTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={20} /> },
    { id: 'reports', label: 'My Reports', icon: <FileText size={20} />, badge: myReports.length },
    { id: 'claims', label: 'My Claims', icon: <FileCheck size={20} />, badge: activeClaimsCount },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={20} />, badge: unreadNotifs },
    { id: 'settings', label: 'Account Settings', icon: <Settings size={20} /> },
  ];

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        {/* Brand Header */}
        <Link 
          to="/" 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.65rem', 
            padding: '0 1.25rem 1rem', 
            borderBottom: '1px solid var(--border-subtle)', 
            marginBottom: '0.85rem', 
            textDecoration: 'none' 
          }}
        >
          <span className="navbar-logo-badge" style={{ width: '34px', height: '34px' }}>
            <Compass size={20} />
          </span>
          <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            FindIt
          </span>
        </Link>

        {/* Profile Card */}
        <div className="sidebar-profile">
          <div className="sidebar-avatar">
            {user.full_name.charAt(0).toUpperCase()}
          </div>
          <div className="sidebar-user-info">
            <h3 className="sidebar-username">{user.full_name}</h3>
            <span className="sidebar-role-badge">{roleLabel}</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`sidebar-nav-item ${activeTab === item.id ? 'active' : ''}`}
            >
              <span className="sidebar-nav-icon">{item.icon}</span>
              <span className="sidebar-nav-label">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="sidebar-nav-badge">{item.badge}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Quick Actions */}
        <div className="sidebar-actions">
          <Link to="/report/lost" className="sidebar-action-btn sidebar-action-lost">
            <PlusCircle size={16} /> Report Lost
          </Link>
          <Link to="/report/found" className="sidebar-action-btn sidebar-action-found">
            <ShieldCheck size={16} /> Report Found
          </Link>
          <Link to="/search" className="sidebar-action-btn sidebar-action-browse">
            <Search size={16} /> Browse Reports
          </Link>
        </div>

        {/* Role-specific Links */}
        {(user.role === 'staff' || user.role === 'admin') && (
          <div className="sidebar-role-links">
            <div className="sidebar-divider-label">
              <Shield size={14} /> Staff Tools
            </div>
            <Link to="/staff/dashboard" className="sidebar-nav-item">
              <span className="sidebar-nav-icon"><ShieldCheck size={20} /></span>
              <span className="sidebar-nav-label">Staff Dashboard</span>
              <ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} />
            </Link>
            {user.role === 'admin' && (
              <Link to="/admin/dashboard" className="sidebar-nav-item">
                <span className="sidebar-nav-icon"><Settings size={20} /></span>
                <span className="sidebar-nav-label">Admin Console</span>
                <ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} />
              </Link>
            )}
          </div>
        )}

        {/* Logout */}
        <button onClick={handleLogout} className="sidebar-logout-btn">
          <LogOut size={16} /> Sign Out
        </button>
      </aside>

      {/* Main Content */}
      <main className="dashboard-main">
        {loadingData ? (
          <div className="dashboard-loading">
            <div className="dashboard-spinner" />
            <span>Loading your dashboard...</span>
          </div>
        ) : (
          <>
            {/* Privileged Role Banner for Staff / Admin */}
            {user.role !== 'user' && (
              <div style={{
                background: user.role === 'admin' ? '#eff6ff' : '#f0fdfa',
                border: user.role === 'admin' ? '1px solid #bfdbfe' : '1px solid #99f6e4',
                padding: '0.85rem 1.25rem',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <ShieldCheck size={22} color={user.role === 'admin' ? '#2563eb' : '#0f766e'} />
                  <div>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                      You are signed in with {user.role === 'admin' ? 'Administrator' : 'Staff'} authority
                    </strong>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      {user.role === 'admin'
                        ? 'Master control: view all system reports, remove items from database, manage users and taxonomy.'
                        : 'Operational workstation: manage found & given items, verify handovers, and relocate custody.'}
                    </p>
                  </div>
                </div>
                <Link
                  to={user.role === 'admin' ? '/admin/dashboard' : '/staff/dashboard'}
                  className="btn btn-sm"
                  style={{
                    background: user.role === 'admin' ? '#2563eb' : '#0f766e',
                    color: '#ffffff',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  Go to {user.role === 'admin' ? 'Admin Console' : 'Staff Desk'} <ArrowRight size={14} />
                </Link>
              </div>
            )}

            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="dashboard-content">
                <div className="dashboard-content-header">
                  <div>
                    <h1 className="dashboard-title">Welcome back, {user.full_name.split(' ')[0]}!</h1>
                    <p className="dashboard-subtitle">
                      Here's a summary of your lost & found activity.
                    </p>
                  </div>
                  <div className="dashboard-header-meta">
                    <span className="dashboard-date">
                      <Clock size={14} /> {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="dashboard-stats-grid">
                  <div className="dashboard-stat-card" onClick={() => setActiveTab('reports')}>
                    <div className="stat-icon stat-icon-lost">
                      <FileText size={24} />
                    </div>
                    <div className="stat-info">
                      <span className="stat-value">{myLostCount}</span>
                      <span className="stat-label">Lost Reports</span>
                    </div>
                  </div>

                  <div className="dashboard-stat-card" onClick={() => setActiveTab('reports')}>
                    <div className="stat-icon stat-icon-found">
                      <ShieldCheck size={24} />
                    </div>
                    <div className="stat-info">
                      <span className="stat-value">{myFoundCount}</span>
                      <span className="stat-label">Found Items</span>
                    </div>
                  </div>

                  <div className="dashboard-stat-card" onClick={() => setActiveTab('claims')}>
                    <div className="stat-icon stat-icon-claims">
                      <FileCheck size={24} />
                    </div>
                    <div className="stat-info">
                      <span className="stat-value">{activeClaimsCount}</span>
                      <span className="stat-label">Active Claims</span>
                    </div>
                  </div>

                  <div className="dashboard-stat-card" onClick={() => setActiveTab('claims')}>
                    <div className="stat-icon stat-icon-approved">
                      <HeartHandshake size={24} />
                    </div>
                    <div className="stat-info">
                      <span className="stat-value">{approvedClaimsCount}</span>
                      <span className="stat-label">Ready for Handover</span>
                    </div>
                  </div>
                </div>

                {/* Pending Attention Banner */}
                {(pendingReports > 0 || activeClaimsCount > 0 || unreadNotifs > 0) && (
                  <div className="dashboard-attention-banner">
                    <TrendingUp size={20} />
                    <div className="attention-content">
                      <strong>Needs Your Attention</strong>
                      <div className="attention-items">
                        {pendingReports > 0 && (
                          <span className="attention-item" onClick={() => setActiveTab('reports')}>
                            {pendingReports} report{pendingReports > 1 ? 's' : ''} pending moderation
                          </span>
                        )}
                        {activeClaimsCount > 0 && (
                          <span className="attention-item" onClick={() => setActiveTab('claims')}>
                            {activeClaimsCount} claim{activeClaimsCount > 1 ? 's' : ''} awaiting review
                          </span>
                        )}
                        {unreadNotifs > 0 && (
                          <span className="attention-item" onClick={() => setActiveTab('notifications')}>
                            {unreadNotifs} unread notification{unreadNotifs > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Recent Reports Quick View */}
                <div className="dashboard-section">
                  <div className="dashboard-section-header">
                    <h2>Recent Reports</h2>
                    <button onClick={() => setActiveTab('reports')} className="dashboard-view-all">
                      View All <ChevronRight size={16} />
                    </button>
                  </div>
                  {myReports.length === 0 ? (
                    <div className="dashboard-empty-state">
                      <FileText size={40} />
                      <p>You haven't submitted any reports yet.</p>
                      <Link to="/report/lost" className="btn btn-primary btn-sm">
                        Report a Lost Item
                      </Link>
                    </div>
                  ) : (
                    <div className="dashboard-recent-list">
                      {myReports.slice(0, 3).map((rep) => (
                        <Link
                          to={`/reports/${rep.report_id}`}
                          key={rep.report_id}
                          className="dashboard-recent-item"
                        >
                          <div className="recent-item-left">
                            <div className="recent-item-badges">
                              <span className={`badge ${rep.report_type === 'found' ? 'badge-found' : 'badge-lost'}`}>
                                {rep.report_type}
                              </span>
                              <span className={`badge badge-status ${rep.lifecycle_status}`}>
                                {rep.lifecycle_status}
                              </span>
                            </div>
                            <h4>{rep.title}</h4>
                            <div className="recent-item-meta">
                              <span><MapPin size={12} /> {rep.location_approximate}</span>
                              <span><Calendar size={12} /> {new Date(rep.date_incident).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <Eye size={18} className="recent-item-arrow" />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Notifications */}
                <div className="dashboard-section">
                  <div className="dashboard-section-header">
                    <h2>Recent Notifications</h2>
                    <button onClick={() => setActiveTab('notifications')} className="dashboard-view-all">
                      View All <ChevronRight size={16} />
                    </button>
                  </div>
                  {notifications.length === 0 ? (
                    <div className="dashboard-empty-state">
                      <Bell size={40} />
                      <p>No notifications yet.</p>
                    </div>
                  ) : (
                    <div className="dashboard-recent-list">
                      {notifications.slice(0, 3).map((n) => (
                        <div
                          key={n.notification_id}
                          className={`dashboard-notif-item ${!n.is_read ? 'unread' : ''}`}
                          onClick={() => !n.is_read && handleMarkNotificationRead(n.notification_id)}
                        >
                          <div className="notif-dot-wrap">
                            {!n.is_read && <span className="notif-dot" />}
                          </div>
                          <div className="notif-content">
                            <strong>{n.title}</strong>
                            <p>{n.message}</p>
                            <span className="notif-time">
                              {new Date(n.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* REPORTS TAB */}
            {activeTab === 'reports' && (
              <div className="dashboard-content">
                <div className="dashboard-content-header">
                  <div>
                    <h1 className="dashboard-title">My Reports</h1>
                    <p className="dashboard-subtitle">
                      Track status transitions, edit descriptions, or close resolved listings.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Link to="/report/lost" className="btn btn-outline btn-sm">
                      <PlusCircle size={14} /> New Lost Report
                    </Link>
                    <Link to="/report/found" className="btn btn-outline btn-sm">
                      <ShieldCheck size={14} /> New Found Item
                    </Link>
                  </div>
                </div>

                {myReports.length === 0 ? (
                  <div className="dashboard-empty-state" style={{ padding: '4rem 2rem' }}>
                    <FileText size={48} />
                    <h3>No Reports Yet</h3>
                    <p>You haven't submitted any property reports yet.</p>
                    <Link to="/report/lost" className="btn btn-primary btn-sm">
                      Report a Lost Item
                    </Link>
                  </div>
                ) : (
                  <div className="dashboard-reports-list">
                    {myReports.map((rep) => (
                      <div key={rep.report_id} className="dashboard-report-card">
                        <div className="report-card-main">
                          <div className="report-card-badges">
                            <span className={`badge ${rep.report_type === 'found' ? 'badge-found' : 'badge-lost'}`}>
                              {rep.report_type}
                            </span>
                            <span className={`badge badge-status ${rep.lifecycle_status}`}>
                              {rep.lifecycle_status}
                            </span>
                            <span className="report-case-ref">{rep.case_reference}</span>
                          </div>
                          <h3 className="report-card-title">{rep.title}</h3>
                          <p className="report-card-desc">{rep.description}</p>
                          <div className="report-card-meta">
                            <span><MapPin size={12} /> {rep.location_approximate}</span>
                            <span><Calendar size={12} /> {new Date(rep.date_incident).toLocaleDateString()}</span>
                            {rep.category && <span><Tag size={12} /> {rep.category.name || rep.category.category_name}</span>}
                          </div>
                        </div>
                        <div className="report-card-actions">
                          <Link to={`/reports/${rep.report_id}`} className="btn btn-primary btn-sm">
                            View Details & Matches
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* CLAIMS TAB */}
            {activeTab === 'claims' && (
              <div className="dashboard-content">
                <div className="dashboard-content-header">
                  <div>
                    <h1 className="dashboard-title">My Ownership Claims</h1>
                    <p className="dashboard-subtitle">
                      Track security desk decisions on claims you filed for found property.
                    </p>
                  </div>
                </div>

                {claims.length === 0 ? (
                  <div className="dashboard-empty-state" style={{ padding: '4rem 2rem' }}>
                    <FileCheck size={48} />
                    <h3>No Claims Filed</h3>
                    <p>You haven't submitted any ownership claims.</p>
                    <Link to="/search?report_type=found" className="btn btn-outline btn-sm">
                      Search Found Items
                    </Link>
                  </div>
                ) : (
                  <div className="dashboard-reports-list">
                    {claims.map((claim) => (
                      <div key={claim.claim_id} className="dashboard-report-card">
                        <div className="report-card-main">
                          <div className="report-card-badges">
                            <span className={`badge badge-status ${claim.claim_status}`}>
                              {claim.claim_status.replace(/_/g, ' ')}
                            </span>
                            <span className="report-case-ref">
                              Claim #{claim.claim_id} on Report #{claim.report_id}
                            </span>
                            <span className="report-case-ref">
                              Filed {new Date(claim.submitted_at).toLocaleDateString()}
                            </span>
                          </div>

                          <div className="claim-evidence-box">
                            <strong>Submitted Proof:</strong> {claim.ownership_evidence}
                          </div>

                          {claim.review_notes && (
                            <div
                              className={`claim-review-note ${
                                claim.claim_status === 'approved' ? 'approved' : 'pending'
                              }`}
                            >
                              <strong>Reviewer Note:</strong> {claim.review_notes}
                            </div>
                          )}
                        </div>

                        <div className="report-card-actions">
                          <Link to={`/reports/${claim.report_id}`} className="btn btn-outline btn-sm">
                            Item Details
                          </Link>
                          {claim.claim_status === 'more_information_requested' && (
                            <button
                              onClick={() => {
                                setRespondClaim(claim);
                                setAdditionalEvidence('');
                              }}
                              className="btn btn-primary btn-sm"
                            >
                              <MessageSquare size={14} /> Provide Evidence
                            </button>
                          )}
                          {claim.claim_status === 'pending' && (
                            <button
                              onClick={() => handleCancelClaim(claim.claim_id)}
                              className="btn btn-outline btn-sm"
                              style={{ color: '#dc2626' }}
                            >
                              Cancel Claim
                            </button>
                          )}
                          {claim.claim_status === 'approved' && (
                            <button
                              onClick={() => handleViewReturn(claim.claim_id)}
                              className="btn btn-success btn-sm"
                            >
                              <HeartHandshake size={14} /> Handover Instructions
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* NOTIFICATIONS TAB */}
            {activeTab === 'notifications' && (
              <div className="dashboard-content">
                <div className="dashboard-content-header">
                  <div>
                    <h1 className="dashboard-title">Notifications</h1>
                    <p className="dashboard-subtitle">Stay updated on your reports and claims.</p>
                  </div>
                  {notifications.some((n) => !n.is_read) && (
                    <button onClick={handleMarkAllRead} className="btn btn-outline btn-sm">
                      <CheckCircle2 size={14} /> Mark All Read
                    </button>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <div className="dashboard-empty-state" style={{ padding: '4rem 2rem' }}>
                    <Bell size={48} />
                    <h3>All Caught Up</h3>
                    <p>You have no notifications right now.</p>
                  </div>
                ) : (
                  <div className="dashboard-notifs-list">
                    {notifications.map((n) => (
                      <div
                        key={n.notification_id}
                        className={`dashboard-notif-card ${!n.is_read ? 'unread' : ''}`}
                        onClick={() => !n.is_read && handleMarkNotificationRead(n.notification_id)}
                      >
                        <div className="notif-card-left">
                          {!n.is_read && <span className="notif-dot" />}
                          <div className="notif-card-icon">
                            <Bell size={18} />
                          </div>
                        </div>
                        <div className="notif-card-body">
                          <h4>{n.title}</h4>
                          <p>{n.message}</p>
                          <span className="notif-card-time">
                            <Clock size={12} /> {new Date(n.created_at).toLocaleString()}
                          </span>
                        </div>
                        {n.related_report_id && (
                          <Link
                            to={`/reports/${n.related_report_id}`}
                            className="btn btn-outline btn-sm"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SETTINGS TAB */}
            {activeTab === 'settings' && (
              <div className="dashboard-content">
                <div className="dashboard-content-header">
                  <div>
                    <h1 className="dashboard-title">Account Settings</h1>
                    <p className="dashboard-subtitle">
                      Update your contact details or change your credentials.
                    </p>
                  </div>
                </div>

                <div className="dashboard-settings-card">
                  {/* Account Info Read-Only */}
                  <div className="settings-info-grid">
                    <div className="settings-info-item">
                      <span className="settings-info-label">Email</span>
                      <span className="settings-info-value">{user.email}</span>
                    </div>
                    <div className="settings-info-item">
                      <span className="settings-info-label">Role</span>
                      <span className="settings-info-value">{roleLabel}</span>
                    </div>
                    <div className="settings-info-item">
                      <span className="settings-info-label">Member Since</span>
                      <span className="settings-info-value">
                        {new Date(user.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="settings-info-item">
                      <span className="settings-info-label">Account Status</span>
                      <span className="settings-info-value">
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            color: user.is_active ? '#059669' : '#dc2626',
                          }}
                        >
                          {user.is_active ? (
                            <>
                              <CheckCircle2 size={14} /> Active
                            </>
                          ) : (
                            <>
                              <AlertCircle size={14} /> Inactive
                            </>
                          )}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="settings-divider" />

                  {/* Editable Profile Form */}
                  <h3 className="settings-section-title">Edit Profile</h3>

                  {saveSuccess && (
                    <div className="alert alert-success" style={{ padding: '0.75rem', marginBottom: '1rem' }}>
                      <CheckCircle2 size={16} /> {saveSuccess}
                    </div>
                  )}
                  {saveError && (
                    <div className="alert alert-error" style={{ padding: '0.75rem', marginBottom: '1rem' }}>
                      <AlertCircle size={16} /> {saveError}
                    </div>
                  )}

                  <form onSubmit={handleUpdateProfile} className="settings-form">
                    <div className="form-group">
                      <label className="form-label">Full Name</label>
                      <input
                        type="text"
                        className="form-input"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Campus Email</label>
                      <input
                        type="email"
                        className="form-input"
                        value={user.email}
                        disabled
                        style={{ background: '#f1f5f9', cursor: 'not-allowed' }}
                      />
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Email cannot be changed.
                      </span>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Contact Phone (Optional)</label>
                      <input
                        type="tel"
                        className="form-input"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="+1 (555) 000-0000"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">New Password (leave blank to keep current)</label>
                      <input
                        type="password"
                        className="form-input"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new secure password (min 8 characters)"
                      />
                    </div>

                    <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
                      <Lock size={14} />
                      {saving ? 'Saving...' : 'Save Profile Changes'}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Modals */}
      {respondClaim && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Provide Additional Evidence
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
              Staff requested more details to verify your claim on Report #{respondClaim.report_id}.
            </p>
            {responseError && (
              <div className="alert alert-error" style={{ padding: '0.75rem', marginBottom: '1rem' }}>
                <AlertCircle size={16} /> {responseError}
              </div>
            )}
            <form onSubmit={handleRespondMoreInfo}>
              <div className="form-group">
                <label className="form-label">Additional Verification Details *</label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  placeholder="Provide distinguishing serial numbers, lockscreen descriptions, contents, or receipt details..."
                  value={additionalEvidence}
                  onChange={(e) => setAdditionalEvidence(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setRespondClaim(null)} className="btn btn-outline btn-sm">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingResponse || !additionalEvidence.trim()}
                  className="btn btn-primary btn-sm"
                >
                  {submittingResponse ? 'Submitting...' : 'Submit Evidence'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingReturnClaimId && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: '#047857' }}>
              <HeartHandshake size={24} />
              <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Official Handover Confirmation
              </h3>
            </div>
            {loadingReturn ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                Fetching official return certificate...
              </div>
            ) : returnRecord ? (
              <div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                  This item has completed verified physical handover by authorized campus staff.
                </p>
                <div className="return-record-details">
                  <div>
                    <span className="return-label">Handover Timestamp:</span>{' '}
                    <strong>{new Date(returnRecord.returned_at).toLocaleString()}</strong>
                  </div>
                  <div>
                    <span className="return-label">Verification Notes:</span>{' '}
                    <strong>{returnRecord.recipient_confirmation}</strong>
                  </div>
                  <div>
                    <span className="return-label">Item Condition:</span>{' '}
                    <strong>{returnRecord.condition_of_item}</strong>
                  </div>
                  {returnRecord.notes && (
                    <div>
                      <span className="return-label">Desk Officer Notes:</span>{' '}
                      <span style={{ color: 'var(--text-secondary)' }}>{returnRecord.notes}</span>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                  <button onClick={() => setViewingReturnClaimId(null)} className="btn btn-primary btn-sm">
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                  Your claim is approved! Please bring your campus student ID to the Central Campus
                  Security Vault during operational hours (9 AM - 5 PM) to sign for and collect your
                  property.
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => setViewingReturnClaimId(null)} className="btn btn-primary btn-sm">
                    Understood
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
