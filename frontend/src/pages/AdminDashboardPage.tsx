import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { adminApi, categoryApi, custodyApi } from '../services/api';
import type { DashboardStats, User, Category, CustodyLocation, UserRole } from '../types';
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
  Search
} from 'lucide-react';

export const AdminDashboardPage: React.FC = () => {
  const { user } = useAuth();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [custodyLocations, setCustodyLocations] = useState<CustodyLocation[]>([]);
  const [userList, setUserList] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Admin Module Tab
  const [activeTab, setActiveTab] = useState<'users' | 'categories' | 'locations' | 'audit'>('users');

  // User search filter
  const [userSearch, setUserSearch] = useState('');

  // Notifications
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Role Management Modal
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('user');
  const [staffDept, setStaffDept] = useState('');
  const [staffDesk, setStaffDesk] = useState('');
  const [updatingRole, setUpdatingRole] = useState(false);

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
      const [statsData, adminCats, adminLocs, users, logs] = await Promise.all([
        adminApi.getDashboardStats().catch(() => null),
        categoryApi.getAdminCategories().catch(() => []),
        custodyApi.getAdminLocations().catch(() => []),
        adminApi.getUsers().catch(() => []),
        adminApi.getAuditLogs({ limit: 50 }).catch(() => []),
      ]);
      if (statsData) setStats(statsData);
      if (adminCats) setCategories(adminCats);
      if (adminLocs) setCustodyLocations(adminLocs);
      if (users) setUserList(users);
      if (logs) setAuditLogs(logs);
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
    try {
      await categoryApi.createCategory({
        name: newCatName.trim(),
        description: newCatDesc.trim() || undefined,
      });
      setActionSuccess(`Category "${newCatName}" created successfully.`);
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
    try {
      await custodyApi.createLocation({
        facility_name: newLocFacility.trim(),
        building: newLocBuilding.trim(),
        room_number: newLocRoom.trim() || undefined,
        restricted_details: newLocRestricted.trim() || undefined,
      });
      setActionSuccess(`Storage facility "${newLocFacility}" created.`);
      setNewLocFacility('');
      setNewLocBuilding('');
      setNewLocRoom('');
      setNewLocRestricted('');
      loadAdminData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to create custody location.');
    } finally {
      setCreatingLoc(false);
    }
  };

  const filteredUsers = userList.filter((u) => 
    u.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.role.toLowerCase().includes(userSearch.toLowerCase())
  );

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
            System governance, user role delegation, property taxonomy, custody vaults, and immutable audit compliance.
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
            <span className="metric-value">{stats?.reports?.total ?? '—'}</span>
            <span className="metric-label">Total System Reports</span>
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
          <div className="metric-icon-wrap" style={{ background: '#ecfdf5', color: '#047857' }}>
            <Users size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-value">{userList.length}</span>
            <span className="metric-label">Registered Users</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-wrap" style={{ background: '#f5f3ff', color: '#6d28d9' }}>
            <MapPin size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-value">{custodyLocations.length}</span>
            <span className="metric-label">Custody Vaults &amp; Desks</span>
          </div>
        </div>
      </div>

      {/* Module Navigation Tabs */}
      <div className="dashboard-tabs">
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
          {/* TAB 1: USER DIRECTORY & ROLES */}
          {activeTab === 'users' && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Campus User Directory
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
                          {new Date(log.created_at).toLocaleString()}
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
                          {log.details ? JSON.stringify(log.details) : '—'}
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
