import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { adminApi, categoryApi, custodyApi, reportApi } from '../services/api';
import type { DashboardStats, User, Category, CustodyLocation, UserRole, ItemReport } from '../types';
import { Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  Users, 
  Layers, 
  MapPin, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Plus, 
  Activity, 
  FileCheck, 
  ArrowRight, 
  Search,
  Trash2,
  FileText,
  Eye,
  Filter,
  PackageCheck
} from 'lucide-react';

export const AdminDashboardPage: React.FC = () => {
  const { user } = useAuth();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [custodyLocations, setCustodyLocations] = useState<CustodyLocation[]>([]);
  const [userList, setUserList] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [reports, setReports] = useState<ItemReport[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Admin Module Tab: defaults to reports so admin can immediately see and manage all items
  const [activeTab, setActiveTab] = useState<'reports' | 'users' | 'categories' | 'locations' | 'audit'>('reports');

  // Search & Filters
  const [userSearch, setUserSearch] = useState('');
  const [reportSearch, setReportSearch] = useState('');
  const [reportTypeFilter, setReportTypeFilter] = useState<'all' | 'lost' | 'found'>('all');
  const [reportStatusFilter, setReportStatusFilter] = useState<string>('all');

  // Notifications
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Role Management Modal
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('user');
  const [staffDept, setStaffDept] = useState('');
  const [staffDesk, setStaffDesk] = useState('');
  const [updatingRole, setUpdatingRole] = useState(false);

  // Delete Report Modal
  const [deletingReport, setDeletingReport] = useState<ItemReport | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [submittingDelete, setSubmittingDelete] = useState(false);

  // New Category State
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [creatingCat, setCreatingCat] = useState(false);

  // New Custody Location State
  const [newLocFacility, setNewLocFacility] = useState('');
  const [newLocBuilding, setNewLocBuilding] = useState('');
  const [newLocRoom, setNewLocRoom] = useState('');
  const [newLocRestricted, setNewLocRestricted] = useState('');
  const [creatingLoc, setCreatingLoc] = useState(false);

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    setActionError(null);
    try {
      const [statsData, adminCats, adminLocs, users, logs, reportsRes] = await Promise.all([
        adminApi.getDashboardStats().catch(() => null),
        categoryApi.getAdminCategories().catch(() => []),
        custodyApi.getAdminLocations().catch(() => []),
        adminApi.getUsers().catch(() => []),
        adminApi.getAuditLogs({ limit: 50 }).catch(() => []),
        reportApi.searchReports({ page: 1, page_size: 100 }).catch(() => ({ items: [] })),
      ]);
      if (statsData) setStats(statsData);
      if (adminCats) setCategories(adminCats);
      if (adminLocs) setCustodyLocations(adminLocs);
      if (users) setUserList(users);
      if (logs) setAuditLogs(logs);
      if (reportsRes?.items) setReports(reportsRes.items);
    } catch (err: any) {
      setActionError(err.message || 'Failed to load administrator records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser) return;
    setUpdatingRole(true);
    setActionError(null);
    try {
      await adminApi.updateUserRole(
        targetUser.user_id,
        selectedRole,
        selectedRole === 'staff' ? staffDept : undefined,
        selectedRole === 'staff' ? staffDesk : undefined
      );
      setActionSuccess(`Role for ${targetUser.full_name} updated to ${selectedRole}.`);
      setTargetUser(null);
      loadAdminData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to update user role.');
    } finally {
      setUpdatingRole(false);
    }
  };

  const handleToggleUserStatus = async (target: User) => {
    const action = target.is_active ? 'deactivate' : 'activate';
    if (!window.confirm(`Are you sure you want to ${action} ${target.full_name}?`)) return;
    try {
      await adminApi.updateUserStatus(target.user_id, !target.is_active);
      setActionSuccess(`User ${target.full_name} has been ${action}d.`);
      loadAdminData();
    } catch (err: any) {
      setActionError(err.message || `Failed to ${action} user.`);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setCreatingCat(true);
    setActionError(null);
    try {
      await categoryApi.createCategory({
        name: newCatName.trim(),
        description: newCatDesc.trim() || undefined,
      });
      setActionSuccess(`Category "${newCatName}" registered.`);
      setNewCatName('');
      setNewCatDesc('');
      loadAdminData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to create category.');
    } finally {
      setCreatingCat(false);
    }
  };

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocFacility.trim() || !newLocBuilding.trim()) return;
    setCreatingLoc(true);
    setActionError(null);
    try {
      await custodyApi.createLocation({
        facility_name: newLocFacility.trim(),
        building: newLocBuilding.trim(),
        room_number: newLocRoom.trim() || undefined,
        restricted_details: newLocRestricted.trim() || undefined,
      });
      setActionSuccess(`Storage facility "${newLocFacility}" registered.`);
      setNewLocFacility('');
      setNewLocBuilding('');
      setNewLocRoom('');
      setNewLocRestricted('');
      loadAdminData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to create location.');
    } finally {
      setCreatingLoc(false);
    }
  };

  const handleDeleteReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletingReport) return;
    setSubmittingDelete(true);
    setActionError(null);
    try {
      await reportApi.deleteReport(deletingReport.report_id, deleteReason.trim() || 'Deleted by Administrator');
      setActionSuccess(`Report #${deletingReport.report_id} (${deletingReport.title || deletingReport.item_name}) permanently removed from database.`);
      setDeletingReport(null);
      setDeleteReason('');
      loadAdminData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to remove report from database.');
    } finally {
      setSubmittingDelete(false);
    }
  };

  const filteredUsers = userList.filter((u) => {
    const q = userSearch.toLowerCase();
    return (
      u.full_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  const filteredReports = reports.filter((r) => {
    if (reportTypeFilter !== 'all' && r.report_type !== reportTypeFilter) {
      return false;
    }
    if (reportStatusFilter !== 'all') {
      if (reportStatusFilter === 'returned' && r.lifecycle_status !== 'returned') return false;
      if (reportStatusFilter === 'archived' && r.lifecycle_status !== 'archived') return false;
      if (reportStatusFilter === 'disposed' && r.lifecycle_status !== 'disposed') return false;
      if (reportStatusFilter === 'active' && (r.lifecycle_status === 'returned' || r.lifecycle_status === 'archived' || r.lifecycle_status === 'disposed')) return false;
      if (reportStatusFilter === 'pending' && r.moderation_status !== 'pending') return false;
    }
    if (reportSearch.trim()) {
      const q = reportSearch.toLowerCase();
      const matchName = (r.item_name || r.title || '').toLowerCase().includes(q);
      const matchRef = (r.case_reference || '').toLowerCase().includes(q);
      const matchLoc = (r.location || r.location_approximate || '').toLowerCase().includes(q);
      return matchName || matchRef || matchLoc;
    }
    return true;
  });

  const returnedCount = reports.filter((r) => r.lifecycle_status === 'returned').length;
  const foundCount = reports.filter((r) => r.report_type === 'found').length;
  const lostCount = reports.filter((r) => r.report_type === 'lost').length;

  return (
    <div>
      {/* Admin Executive Header */}
      <div className="dashboard-header dashboard-header-admin">
        <div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.25rem 0.75rem',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(255, 255, 255, 0.2)',
            fontSize: '0.78rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            marginBottom: '0.75rem',
          }}>
            <ShieldCheck size={14} /> System Administrator Console
          </div>
          <h1 style={{ fontSize: '1.9rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.35rem' }}>
            Campus Lost &amp; Found Administration
          </h1>
          <p style={{ color: '#e0e7ff', fontSize: '0.95rem' }}>
            Master oversight: view all system reports, remove items from database, manage users, categories, custody vaults, and audit trails.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Link to="/staff/dashboard" className="btn btn-secondary btn-sm" style={{ fontWeight: 600 }}>
            Go to Staff Desk <ArrowRight size={15} />
          </Link>
        </div>
      </div>

      {/* Global Alerts */}
      {actionSuccess && (
        <div className="alert alert-success">
          <CheckCircle2 size={18} /> {actionSuccess}
        </div>
      )}
      {actionError && (
        <div className="alert alert-error">
          <AlertCircle size={18} /> {actionError}
        </div>
      )}

      {/* System KPI Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon-wrap" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
            <Activity size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-value">{reports.length}</span>
            <span className="metric-label">All System Reports</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-wrap" style={{ background: '#ecfdf5', color: '#047857' }}>
            <PackageCheck size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-value">{returnedCount}</span>
            <span className="metric-label">Items Given to Owner (Returned)</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-wrap" style={{ background: '#fffbeb', color: '#b45309' }}>
            <FileCheck size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-value">{stats?.claims?.pending ?? '—'}</span>
            <span className="metric-label">Active Claims in Review</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-wrap" style={{ background: '#f5f3ff', color: '#6d28d9' }}>
            <Users size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-value">{userList.length}</span>
            <span className="metric-label">Registered Accounts</span>
          </div>
        </div>
      </div>

      {/* Module Navigation Tabs */}
      <div className="dashboard-tabs">
        <button
          onClick={() => setActiveTab('reports')}
          className={`dashboard-tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
        >
          <FileText size={16} /> All Reports &amp; Items ({reports.length})
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`dashboard-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
        >
          <Users size={16} /> User Directory &amp; Roles ({userList.length})
        </button>

        <button
          onClick={() => setActiveTab('categories')}
          className={`dashboard-tab-btn ${activeTab === 'categories' ? 'active' : ''}`}
        >
          <Layers size={16} /> Property Categories ({categories.length})
        </button>

        <button
          onClick={() => setActiveTab('locations')}
          className={`dashboard-tab-btn ${activeTab === 'locations' ? 'active' : ''}`}
        >
          <MapPin size={16} /> Custody Storage Facilities ({custodyLocations.length})
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`dashboard-tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
        >
          <Clock size={16} /> Immutable Audit Logs ({auditLogs.length})
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Loading administrative records...
        </div>
      ) : (
        <>
          {/* TAB 0: ALL REPORTS & ITEM MANAGEMENT */}
          {activeTab === 'reports' && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    All Campus Reports &amp; Inventory ({filteredReports.length})
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Complete database visibility. Inspect any lost or found record, verify handovers, or remove entries from database.
                  </p>
                </div>

                <div style={{ position: 'relative', width: '280px' }}>
                  <Search size={16} style={{ position: 'absolute', left: '10px', top: '11px', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search name, case ref, location..."
                    value={reportSearch}
                    onChange={(e) => setReportSearch(e.target.value)}
                    style={{ paddingLeft: '2.1rem', fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              {/* Filters */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginRight: '0.25rem' }}>
                  <Filter size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '3px' }} />
                  Type:
                </span>
                {(['all', 'found', 'lost'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setReportTypeFilter(t)}
                    className={`btn btn-sm ${reportTypeFilter === t ? 'btn-primary' : 'btn-outline'}`}
                    style={{ textTransform: 'capitalize', padding: '0.25rem 0.65rem', fontSize: '0.8rem' }}
                  >
                    {t === 'all' ? `All (${reports.length})` : t === 'found' ? `Found (${foundCount})` : `Lost (${lostCount})`}
                  </button>
                ))}

                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginLeft: '1rem', marginRight: '0.25rem' }}>
                  Status:
                </span>
                {[
                  { id: 'all', label: 'All Statuses' },
                  { id: 'active', label: 'Active' },
                  { id: 'returned', label: `Given to Owner (${returnedCount})` },
                  { id: 'pending', label: 'Pending Verification' },
                  { id: 'archived', label: 'Archived' },
                  { id: 'disposed', label: 'Disposed' },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setReportStatusFilter(s.id)}
                    className={`btn btn-sm ${reportStatusFilter === s.id ? 'btn-secondary' : 'btn-outline'}`}
                    style={{ padding: '0.25rem 0.65rem', fontSize: '0.8rem' }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {filteredReports.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                  No reports match the current filter and search criteria.
                </div>
              ) : (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Case Ref</th>
                        <th>Item Name</th>
                        <th>Type</th>
                        <th>Location</th>
                        <th>Lifecycle / Custody</th>
                        <th>Moderation</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReports.map((r) => {
                        const isReturned = r.lifecycle_status === 'returned';
                        const isFound = r.report_type === 'found';
                        return (
                          <tr key={r.report_id}>
                            <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.82rem' }}>
                              {r.case_reference || `#${r.report_id}`}
                            </td>
                            <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                              {r.item_name || r.title}
                              {r.category_name && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  {r.category_name}
                                </div>
                              )}
                            </td>
                            <td>
                              <span
                                className="badge"
                                style={{
                                  background: isFound ? '#f0fdfa' : '#fef3c7',
                                  color: isFound ? '#0f766e' : '#b45309',
                                  border: isFound ? '1px solid #99f6e4' : '1px solid #fde68a',
                                  textTransform: 'capitalize',
                                  fontWeight: 600,
                                }}
                              >
                                {r.report_type}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.85rem' }}>
                              {r.location || r.location_approximate || 'Campus Area'}
                            </td>
                            <td>
                              {isReturned ? (
                                <span className="badge" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontWeight: 700 }}>
                                  ✓ Given to Owner (Returned)
                                </span>
                              ) : r.lifecycle_status === 'archived' ? (
                                <span className="badge" style={{ background: '#f3f4f6', color: '#4b5563', border: '1px solid #e5e7eb' }}>
                                  Archived
                                </span>
                              ) : r.lifecycle_status === 'disposed' ? (
                                <span className="badge" style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>
                                  Disposed
                                </span>
                              ) : isFound ? (
                                <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                                  In Custody (Active)
                                </span>
                              ) : (
                                <span className="badge" style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>
                                  Active Search
                                </span>
                              )}
                            </td>
                            <td>
                              <span className={`badge-status ${r.moderation_status}`} style={{ textTransform: 'capitalize' }}>
                                {r.moderation_status}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <Link
                                to={`/reports/${r.report_id}`}
                                className="btn btn-outline btn-sm"
                                style={{ marginRight: '0.5rem', padding: '0.35rem 0.65rem' }}
                                title="View public detail"
                              >
                                <Eye size={14} style={{ marginRight: '3px' }} /> View
                              </Link>
                              <button
                                onClick={() => {
                                  setDeletingReport(r);
                                  setDeleteReason('');
                                }}
                                className="btn btn-sm"
                                style={{
                                  background: '#fee2e2',
                                  color: '#dc2626',
                                  border: '1px solid #fca5a5',
                                  padding: '0.35rem 0.65rem',
                                  fontWeight: 600,
                                }}
                                title="Remove report from database"
                              >
                                <Trash2 size={14} style={{ marginRight: '3px' }} /> Remove from DB
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 1: USER DIRECTORY & ROLES */}
          {activeTab === 'users' && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Campus User Directory ({filteredUsers.length})
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Manage access permissions, promote verified personnel to Staff or Admin, and toggle account states.
                  </p>
                </div>

                <div style={{ position: 'relative', width: '280px' }}>
                  <Search size={16} style={{ position: 'absolute', left: '10px', top: '11px', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search by name, email, or role..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    style={{ paddingLeft: '2.1rem', fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Full Name</th>
                      <th>Campus Email</th>
                      <th>Role</th>
                      <th>Account Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr key={u.user_id}>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>#{u.user_id}</td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.full_name}</td>
                        <td>{u.email}</td>
                        <td>
                          <span className={`badge-role ${u.role}`}>{u.role}</span>
                        </td>
                        <td>
                          <span className="badge" style={{
                            background: u.is_active ? '#ecfdf5' : '#fef2f2',
                            color: u.is_active ? '#047857' : '#b91c1c',
                            border: u.is_active ? '1px solid #a7f3d0' : '1px solid #fecaca',
                          }}>
                            {u.is_active ? 'Active' : 'Suspended'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            onClick={() => {
                              setTargetUser(u);
                              setSelectedRole(u.role);
                              setStaffDept(u.staff_profile?.department || '');
                              setStaffDesk(u.staff_profile?.desk_phone || '');
                            }}
                            className="btn btn-outline btn-sm"
                            style={{ marginRight: '0.5rem' }}
                          >
                            Change Role
                          </button>

                          {u.user_id !== user?.user_id && (
                            <button
                              onClick={() => handleToggleUserStatus(u)}
                              className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-secondary'}`}
                            >
                              {u.is_active ? 'Suspend' : 'Activate'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: CATEGORY MANAGEMENT */}
          {activeTab === 'categories' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
              <div className="card">
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>
                  Configured Item Categories
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {categories.map((c) => (
                    <div
                      key={c.category_id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.85rem 1rem',
                        background: 'var(--bg-surface-elevated)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div>
                        <strong style={{ color: 'var(--text-primary)' }}>{c.name}</strong>
                        {c.description && <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{c.description}</p>}
                      </div>
                      <span className="badge" style={{
                        background: c.is_active ? '#ecfdf5' : '#fef2f2',
                        color: c.is_active ? '#047857' : '#b91c1c',
                      }}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Plus size={18} color="var(--primary)" /> Add Property Category
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                  Categories group items across student reports and filter indexes.
                </p>

                <form onSubmit={handleCreateCategory}>
                  <div className="form-group">
                    <label className="form-label">Category Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Eyewear & Sunglasses"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description (Optional)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Prescription glasses, reading lenses, cases"
                      value={newCatDesc}
                      onChange={(e) => setNewCatDesc(e.target.value)}
                    />
                  </div>
                  <button type="submit" disabled={creatingCat} className="btn btn-primary btn-sm" style={{ width: '100%', marginTop: '0.5rem' }}>
                    {creatingCat ? 'Adding...' : 'Create Category'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 3: CUSTODY LOCATIONS */}
          {activeTab === 'locations' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
              <div className="card">
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>
                  Campus Custody Storage Facilities
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {custodyLocations.map((loc) => (
                    <div
                      key={loc.location_id}
                      style={{
                        padding: '1rem',
                        background: 'var(--bg-surface-elevated)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ color: 'var(--text-primary)' }}>{loc.facility_name}</strong>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{loc.building} {loc.room_number ? `(${loc.room_number})` : ''}</span>
                      </div>
                      {loc.restricted_details && (
                        <div style={{
                          marginTop: '0.5rem',
                          fontSize: '0.8rem',
                          color: '#b45309',
                          background: '#fffbeb',
                          padding: '0.45rem 0.65rem',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid #fde68a',
                        }}>
                          <strong>Restricted Custody Details (Staff/Admin Only):</strong> {loc.restricted_details}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Plus size={18} color="var(--primary)" /> Add Custody Facility
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                  Register security lockers, department lost-and-found desks, or campus vaults.
                </p>

                <form onSubmit={handleCreateLocation}>
                  <div className="form-group">
                    <label className="form-label">Facility Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Science Library Circulation Desk"
                      value={newLocFacility}
                      onChange={(e) => setNewLocFacility(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Building Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Science Complex Block B"
                      value={newLocBuilding}
                      onChange={(e) => setNewLocBuilding(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Room Number</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Room 204"
                      value={newLocRoom}
                      onChange={(e) => setNewLocRoom(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Restricted Access Details (Keypad PIN / Safe Combo)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Keypad Code: 5821, Cabinet 3"
                      value={newLocRestricted}
                      onChange={(e) => setNewLocRestricted(e.target.value)}
                    />
                  </div>

                  <button type="submit" disabled={creatingLoc} className="btn btn-primary btn-sm" style={{ width: '100%', marginTop: '0.5rem' }}>
                    {creatingLoc ? 'Saving...' : 'Register Storage Facility'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 4: IMMUTABLE AUDIT LOG */}
          {activeTab === 'audit' && (
            <div className="card">
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={18} color="var(--primary)" /> Immutable System Audit Trail
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                Chronological record of status transitions, role escalations, handovers, and custody events.
              </p>

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Action</th>
                      <th>Target Entity</th>
                      <th>Actor</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log: any) => (
                      <tr key={log.audit_id}>
                        <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                          {new Date(log.created_at || log.timestamp).toLocaleString()}
                        </td>
                        <td>
                          <span className="badge badge-status" style={{ fontSize: '0.72rem' }}>
                            {log.action}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {log.entity_type} {log.entity_id ? `#${log.entity_id}` : ''}
                        </td>
                        <td>
                          {log.actor_user_id ? `User #${log.actor_user_id}` : 'System'}
                        </td>
                        <td style={{ color: 'var(--text-secondary)', maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.summary || (log.details ? JSON.stringify(log.details) : '—')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Delete Report Confirmation Modal */}
      {deletingReport && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: '#dc2626' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={22} color="#dc2626" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
                  Permanently Delete Report?
                </h3>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Case Ref: {deletingReport.case_reference || `#${deletingReport.report_id}`}
                </span>
              </div>
            </div>

            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem 1rem',
              marginBottom: '1.25rem',
              fontSize: '0.88rem',
              color: '#991b1b',
            }}>
              <strong>Warning:</strong> You are about to remove <strong>"{deletingReport.item_name || deletingReport.title}"</strong> from the database. This will remove its claims, matches, and images permanently. This action is recorded in the immutable audit log.
            </div>

            <form onSubmit={handleDeleteReport}>
              <div className="form-group">
                <label className="form-label">Reason for Removal *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Duplicate submission, spam, test entry, or student requested deletion"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setDeletingReport(null)}
                  className="btn btn-outline btn-sm"
                  disabled={submittingDelete}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDelete}
                  className="btn btn-sm"
                  style={{ background: '#dc2626', color: '#ffffff', fontWeight: 600 }}
                >
                  {submittingDelete ? 'Deleting...' : 'Confirm Remove from Database'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Role Management Modal */}
      {targetUser && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Update User Role
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
              Delegate administrative or moderation authority for <strong>{targetUser.full_name}</strong> ({targetUser.email}).
            </p>

            <form onSubmit={handleUpdateRole}>
              <div className="form-group">
                <label className="form-label">Designated Role *</label>
                <select
                  className="form-select"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as any)}
                  required
                >
                  <option value="user">User (Registered Student / Visitor)</option>
                  <option value="staff">Staff (Case Handler / Custody Officer)</option>
                  <option value="admin">Administrator (Full System Authority)</option>
                </select>
              </div>

              {selectedRole === 'staff' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Staff Department</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Campus Security, Student Union Desk"
                      value={staffDept}
                      onChange={(e) => setStaffDept(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Desk Extension / Phone</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Ext. 4821"
                      value={staffDesk}
                      onChange={(e) => setStaffDesk(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setTargetUser(null)}
                  className="btn btn-outline btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingRole}
                  className="btn btn-primary btn-sm"
                >
                  {updatingRole ? 'Updating...' : 'Save Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
