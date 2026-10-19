import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { staffApi, adminApi, categoryApi, custodyApi } from '../services/api';
import type { DashboardStats, ItemReport, Claim, User, Category, CustodyLocation, UserRole } from '../types';
import { Link } from 'react-router-dom';
import { 
  AlertCircle, 
  CheckCircle2,
  Users,
  Layers,
  MapPin,
  Clock,
  ArrowRightLeft,
  Archive,
  Plus
} from 'lucide-react';

export const StaffDashboardPage: React.FC = () => {
  const { user, isAdmin } = useAuth();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [pendingReports, setPendingReports] = useState<ItemReport[]>([]);
  const [claimsQueue, setClaimsQueue] = useState<Claim[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [custodyLocations, setCustodyLocations] = useState<CustodyLocation[]>([]);
  const [userList, setUserList] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab navigation
  const [activeTab, setActiveTab] = useState<'reports' | 'claims' | 'transfer' | 'users' | 'categories' | 'locations' | 'audit'>('reports');

  // Claim decision modal state
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [decisionType, setDecisionType] = useState<'approve' | 'reject' | 'request-info'>('approve');
  const [submittingDecision, setSubmittingDecision] = useState(false);

  // Handover modal state
  const [handoverClaim, setHandoverClaim] = useState<Claim | null>(null);
  const [handoverConfirmation, setHandoverConfirmation] = useState('');
  const [itemCondition, setItemCondition] = useState('Good / Unchanged');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [submittingHandover, setSubmittingHandover] = useState(false);

  // Custody Transfer Modal State
  const [transferReportId, setTransferReportId] = useState<string>('');
  const [newLocationId, setNewLocationId] = useState<number | ''>('');
  const [newStorageRef, setNewStorageRef] = useState<string>('');
  const [transferReason, setTransferReason] = useState<string>('');
  const [submittingTransfer, setSubmittingTransfer] = useState(false);

  // Archive / Dispose Modal State
  const [lifecycleActionType, setLifecycleActionType] = useState<'archive' | 'dispose' | null>(null);
  const [lifecycleReportId, setLifecycleReportId] = useState<string>('');
  const [lifecycleReason, setLifecycleReason] = useState<string>('');
  const [lifecycleConfirm, setLifecycleConfirm] = useState(false);
  const [submittingLifecycle, setSubmittingLifecycle] = useState(false);

  // New Category State
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [creatingCat, setCreatingCat] = useState(false);

  // New Location State
  const [newLocFacility, setNewLocFacility] = useState('');
  const [newLocBuilding, setNewLocBuilding] = useState('');
  const [newLocRoom, setNewLocRoom] = useState('');
  const [newLocRestricted, setNewLocRestricted] = useState('');
  const [creatingLoc, setCreatingLoc] = useState(false);

  // Role Promotion State
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('staff');
  const [staffDept, setStaffDept] = useState('');
  const [staffDesk, setStaffDesk] = useState('');
  const [updatingRole, setUpdatingRole] = useState(false);

  // Success / error banner
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setActionError(null);
    try {
      const [pending, claims, cats, locs] = await Promise.all([
        staffApi.getPendingReports(),
        staffApi.getStaffClaims(),
        categoryApi.getCategories(),
        custodyApi.getPublicLocations(),
      ]);
      setPendingReports(pending);
      setClaimsQueue(claims);
      setCategories(cats);
      setCustodyLocations(locs);

      if (isAdmin) {
        const [statsData, adminCats, adminLocs, users, logs] = await Promise.all([
          adminApi.getDashboardStats().catch(() => null),
          categoryApi.getAdminCategories().catch(() => []),
          custodyApi.getAdminLocations().catch(() => []),
          adminApi.getUsers().catch(() => []),
          adminApi.getAuditLogs({ limit: 40 }).catch(() => []),
        ]);
        if (statsData) setStats(statsData);
        if (adminCats.length > 0) setCategories(adminCats);
        if (adminLocs.length > 0) setCustodyLocations(adminLocs);
        setUserList(users);
        setAuditLogs(logs);
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to load staff moderation queues.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleVerifyReport = async (reportId: number) => {
    try {
      await staffApi.verifyReport(reportId, 'Verified by staff moderation.');
      setActionSuccess(`Report #${reportId} verified and published.`);
      setPendingReports((prev) => prev.filter((r) => r.report_id !== reportId));
    } catch (err: any) {
      setActionError(err.message || 'Verification failed.');
    }
  };

  const handleRejectReport = async (reportId: number) => {
    const reason = window.prompt('Enter reason for rejecting this report:');
    if (!reason) return;

    try {
      await staffApi.rejectReport(reportId, reason);
      setActionSuccess(`Report #${reportId} rejected.`);
      setPendingReports((prev) => prev.filter((r) => r.report_id !== reportId));
    } catch (err: any) {
      setActionError(err.message || 'Rejection failed.');
    }
  };

  const handleSubmitClaimReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClaim || !decisionNotes.trim()) return;

    setSubmittingDecision(true);
    setActionError(null);

    try {
      await staffApi.reviewClaim(selectedClaim.claim_id, decisionType, decisionNotes);
      setActionSuccess(`Claim #${selectedClaim.claim_id} decision [${decisionType}] recorded.`);
      setSelectedClaim(null);
      setDecisionNotes('');
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to submit decision.');
    } finally {
      setSubmittingDecision(false);
    }
  };

  const handleSubmitHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handoverClaim || !handoverConfirmation.trim()) return;

    setSubmittingHandover(true);
    setActionError(null);

    try {
      await staffApi.recordReturn(handoverClaim.claim_id, {
        recipient_confirmation: handoverConfirmation,
        condition_of_item: itemCondition,
        notes: handoverNotes || undefined,
      });
      setActionSuccess(`Handover confirmed! Item marked as Returned.`);
      setHandoverClaim(null);
      setHandoverConfirmation('');
      setHandoverNotes('');
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to record handover.');
    } finally {
      setSubmittingHandover(false);
    }
  };

  const handleTransferCustody = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferReportId || !newLocationId) return;

    setSubmittingTransfer(true);
    setActionError(null);

    try {
      await staffApi.transferCustody(parseInt(transferReportId, 10), {
        new_custody_location_id: Number(newLocationId),
        storage_reference: newStorageRef || undefined,
        reason: transferReason || undefined,
      });
      setActionSuccess(`Custody successfully transferred for Report #${transferReportId}.`);
      setTransferReportId('');
      setNewStorageRef('');
      setTransferReason('');
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Custody transfer failed.');
    } finally {
      setSubmittingTransfer(false);
    }
  };

  const handleLifecycleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lifecycleReportId || !lifecycleReason || !lifecycleConfirm) return;

    setSubmittingLifecycle(true);
    setActionError(null);

    try {
      const repId = parseInt(lifecycleReportId, 10);
      if (lifecycleActionType === 'archive') {
        await staffApi.archiveReport(repId, lifecycleReason);
        setActionSuccess(`Report #${repId} successfully archived.`);
      } else if (lifecycleActionType === 'dispose') {
        await staffApi.disposeReport(repId, lifecycleReason);
        setActionSuccess(`Report #${repId} successfully marked as disposed.`);
      }
      setLifecycleActionType(null);
      setLifecycleReportId('');
      setLifecycleReason('');
      setLifecycleConfirm(false);
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Action failed.');
    } finally {
      setSubmittingLifecycle(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setCreatingCat(true);
    try {
      await categoryApi.createCategory({ name: newCatName, description: newCatDesc || undefined });
      setActionSuccess(`Category "${newCatName}" created.`);
      setNewCatName('');
      setNewCatDesc('');
      loadData();
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
        facility_name: newLocFacility,
        building: newLocBuilding,
        room_number: newLocRoom || undefined,
        restricted_details: newLocRestricted || undefined,
      });
      setActionSuccess(`Custody location "${newLocFacility}" created.`);
      setNewLocFacility('');
      setNewLocBuilding('');
      setNewLocRoom('');
      setNewLocRestricted('');
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to create custody location.');
    } finally {
      setCreatingLoc(false);
    }
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser) return;
    setUpdatingRole(true);
    try {
      await adminApi.updateUserRole(targetUser.user_id, selectedRole, staffDept || undefined, staffDesk || undefined);
      setActionSuccess(`User #${targetUser.user_id} (${targetUser.email}) role updated to ${selectedRole}.`);
      setTargetUser(null);
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to update user role.');
    } finally {
      setUpdatingRole(false);
    }
  };

  const handleToggleUserStatus = async (target: User) => {
    if (target.user_id === user?.user_id) {
      alert('You cannot deactivate your own administrative account.');
      return;
    }
    const newStatus = !target.is_active;
    const actionText = newStatus ? 'activate' : 'deactivate';
    if (!window.confirm(`Are you sure you want to ${actionText} user account ${target.email}?`)) {
      return;
    }
    try {
      await adminApi.updateUserStatus(target.user_id, newStatus);
      setActionSuccess(`User account ${target.email} is now ${newStatus ? 'active' : 'deactivated'}.`);
      loadData();
    } catch (err: any) {
      setActionError(err.message || 'Failed to change user status.');
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
          <span className="badge-role admin">{user?.role}</span>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#fff', margin: 0 }}>
            {isAdmin ? 'System Administration & Moderation' : 'Staff Moderation Portal'}
          </h1>
        </div>
        <p style={{ color: 'var(--text-secondary)' }}>
          Review pending report submissions, evaluate confidential ownership claims, manage custody handovers, and administer taxonomy.
        </p>
      </div>

      {actionSuccess && (
        <div className="alert alert-success" style={{ marginBottom: '1.5rem' }}>
          <CheckCircle2 size={18} /> {actionSuccess}
        </div>
      )}

      {actionError && (
        <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle size={18} /> {actionError}
        </div>
      )}

      {/* Admin Dashboard Stats Summary */}
      {isAdmin && stats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          marginBottom: '2.5rem',
        }}>
          <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #3b82f6' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>OPEN REPORTS</span>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff', marginTop: '0.2rem' }}>
              {stats.lifecycle_counts.open}
            </div>
          </div>

          <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #8b5cf6' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>MATCHED</span>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff', marginTop: '0.2rem' }}>
              {stats.lifecycle_counts.matched}
            </div>
          </div>

          <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #f59e0b' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>CLAIMED</span>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff', marginTop: '0.2rem' }}>
              {stats.lifecycle_counts.claimed}
            </div>
          </div>

          <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #10b981' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>RETURNED</span>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff', marginTop: '0.2rem' }}>
              {stats.lifecycle_counts.returned}
            </div>
          </div>

          <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #64748b' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ARCHIVED</span>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff', marginTop: '0.2rem' }}>
              {stats.lifecycle_counts.archived}
            </div>
          </div>

          <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid #ef4444' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>DISPOSED</span>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff', marginTop: '0.2rem' }}>
              {stats.lifecycle_counts.disposed}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', borderBottom: '1px solid var(--border-subtle)', marginBottom: '2rem' }}>
        <button
          className={`btn btn-sm ${activeTab === 'reports' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('reports')}
        >
          Pending Moderation ({pendingReports.length})
        </button>

        <button
          className={`btn btn-sm ${activeTab === 'claims' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('claims')}
        >
          Claims Review Queue ({claimsQueue.length})
        </button>

        <button
          className={`btn btn-sm ${activeTab === 'transfer' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('transfer')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
        >
          <ArrowRightLeft size={14} /> Custody Operations
        </button>

        {isAdmin && (
          <>
            <button
              className={`btn btn-sm ${activeTab === 'users' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveTab('users')}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Users size={14} /> User Directory ({userList.length})
            </button>

            <button
              className={`btn btn-sm ${activeTab === 'categories' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveTab('categories')}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Layers size={14} /> Categories ({categories.length})
            </button>

            <button
              className={`btn btn-sm ${activeTab === 'locations' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveTab('locations')}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <MapPin size={14} /> Custody Locations ({custodyLocations.length})
            </button>

            <button
              className={`btn btn-sm ${activeTab === 'audit' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveTab('audit')}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Clock size={14} /> Audit Trail
            </button>
          </>
        )}
      </div>

      {/* Tab 1: Pending Reports */}
      {activeTab === 'reports' && (
        <div>
          {loading ? (
            <p style={{ color: 'var(--text-secondary)' }}>Loading pending reports...</p>
          ) : pendingReports.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {pendingReports.map((r) => (
                <div key={r.report_id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                      <span className={`badge ${r.report_type === 'found' ? 'badge-found' : 'badge-lost'}`}>
                        {r.report_type}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: '#a5b4fc' }}>
                        {r.case_reference}
                      </span>
                    </div>
                    <h3 style={{ fontSize: '1.15rem', color: '#fff', marginBottom: '0.25rem' }}>{r.title}</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                      {r.description.slice(0, 140)}...
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '0.65rem' }}>
                    <Link to={`/reports/${r.report_id}`} className="btn btn-outline btn-sm">
                      Inspect
                    </Link>
                    <button onClick={() => handleVerifyReport(r.report_id)} className="btn btn-primary btn-sm">
                      Approve &amp; Publish
                    </button>
                    <button onClick={() => handleRejectReport(r.report_id)} className="btn btn-danger btn-sm">
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <CheckCircle2 size={36} color="#10b981" style={{ margin: '0 auto 1rem' }} />
              <h3 style={{ color: '#fff', fontSize: '1.2rem', marginBottom: '0.5rem' }}>Moderation Queue Empty</h3>
              <p style={{ color: 'var(--text-secondary)' }}>All report submissions have been reviewed.</p>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Claims Review Queue */}
      {activeTab === 'claims' && (
        <div>
          {loading ? (
            <p style={{ color: 'var(--text-secondary)' }}>Loading claims queue...</p>
          ) : claimsQueue.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {claimsQueue.map((claim) => (
                <div key={claim.claim_id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <span className={`badge badge-status ${claim.claim_status}`} style={{ fontSize: '0.75rem', marginBottom: '0.4rem' }}>
                        {claim.claim_status.replace(/_/g, ' ')}
                      </span>
                      <h4 style={{ color: '#fff', fontSize: '1.1rem' }}>
                        Claim #{claim.claim_id} on Report #{claim.report_id}
                      </h4>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        Claimant User #{claim.claimant_user_id} • Filed on {new Date(claim.submitted_at).toLocaleString()}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Link to={`/reports/${claim.report_id}`} className="btn btn-outline btn-sm">
                        View Item
                      </Link>

                      {claim.claim_status === 'approved' && (
                        <button
                          onClick={() => setHandoverClaim(claim)}
                          className="btn btn-primary btn-sm"
                          style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                        >
                          Record Handover
                        </button>
                      )}

                      {['pending', 'more_information_requested'].includes(claim.claim_status) && (
                        <button
                          onClick={() => setSelectedClaim(claim)}
                          className="btn btn-primary btn-sm"
                        >
                          Review Claim
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Ownership Evidence Box */}
                  <div style={{
                    padding: '0.85rem',
                    background: 'var(--bg-surface-elevated)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.88rem',
                  }}>
                    <strong style={{ color: '#a5b4fc', display: 'block', marginBottom: '0.3rem' }}>
                      Confidential Ownership Evidence:
                    </strong>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {claim.ownership_evidence}
                    </span>
                  </div>

                  {claim.review_notes && (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      <strong>Latest Review Notes:</strong> {claim.review_notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <CheckCircle2 size={36} color="#10b981" style={{ margin: '0 auto 1rem' }} />
              <h3 style={{ color: '#fff', fontSize: '1.2rem', marginBottom: '0.5rem' }}>No Claims Awaiting Review</h3>
              <p style={{ color: 'var(--text-secondary)' }}>All submitted claims have been assessed.</p>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Custody Operations (Transfer, Archive, Dispose) */}
      {activeTab === 'transfer' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '2rem' }}>
          {/* Custody Facility Transfer */}
          <div className="card">
            <h3 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ArrowRightLeft size={18} color="var(--primary)" /> Physical Custody Relocation
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
              Move a found item to another secured campus storage facility with an updated internal locker code.
            </p>

            <form onSubmit={handleTransferCustody}>
              <div className="form-group">
                <label className="form-label">Report ID *</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="e.g. 1"
                  value={transferReportId}
                  onChange={(e) => setTransferReportId(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">New Custody Facility *</label>
                <select
                  className="form-select"
                  value={newLocationId}
                  onChange={(e) => setNewLocationId(Number(e.target.value))}
                  required
                >
                  <option value="">Select storage location...</option>
                  {custodyLocations.map((loc) => (
                    <option key={loc.location_id} value={loc.location_id}>
                      {loc.facility_name} ({loc.building})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">New Storage / Locker Reference</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Locker 4B, Shelf #2"
                  value={newStorageRef}
                  onChange={(e) => setNewStorageRef(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Reason for Transfer</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Transferred to Central Campus Vault for high-value safekeeping"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={submittingTransfer}
                className="btn btn-primary btn-sm"
                style={{ width: '100%', marginTop: '0.5rem' }}
              >
                {submittingTransfer ? 'Transferring...' : 'Execute Custody Transfer'}
              </button>
            </form>
          </div>

          {/* Policy-Controlled Final Lifecycle Actions */}
          <div className="card">
            <h3 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Archive size={18} color="#ef4444" /> Policy Archival &amp; Disposal
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
              Items uncollected past policy retention windows may be formally archived or disposed with documented justification.
            </p>

            <form onSubmit={handleLifecycleAction}>
              <div className="form-group">
                <label className="form-label">Action Type *</label>
                <select
                  className="form-select"
                  value={lifecycleActionType || ''}
                  onChange={(e) => setLifecycleActionType(e.target.value as any)}
                  required
                >
                  <option value="">Select lifecycle action...</option>
                  <option value="archive">Archive Report (Unclaimed past policy)</option>
                  <option value="dispose">Dispose Item (Damaged/Destroyed/Donated)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Report ID *</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="e.g. 2"
                  value={lifecycleReportId}
                  onChange={(e) => setLifecycleReportId(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Mandatory Policy Justification *</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="Record policy citation, retention expiration, or disposal method..."
                  value={lifecycleReason}
                  onChange={(e) => setLifecycleReason(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fca5a5', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={lifecycleConfirm}
                    onChange={(e) => setLifecycleConfirm(e.target.checked)}
                    required
                  />
                  I explicitly confirm this lifecycle action under university policy.
                </label>
              </div>

              <button
                type="submit"
                disabled={submittingLifecycle || !lifecycleConfirm}
                className="btn btn-danger btn-sm"
                style={{ width: '100%' }}
              >
                {submittingLifecycle ? 'Processing...' : 'Apply Lifecycle Action'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tab 4: User Directory (Admin Only) */}
      {isAdmin && activeTab === 'users' && (
        <div className="card">
          <h3 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={18} color="var(--primary)" /> Registered User Accounts
          </h3>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem' }}>User ID</th>
                  <th style={{ padding: '0.75rem' }}>Name</th>
                  <th style={{ padding: '0.75rem' }}>Email</th>
                  <th style={{ padding: '0.75rem' }}>Role</th>
                  <th style={{ padding: '0.75rem' }}>Status</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {userList.map((u) => (
                  <tr key={u.user_id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '0.75rem', fontFamily: 'var(--font-mono)' }}>#{u.user_id}</td>
                    <td style={{ padding: '0.75rem', color: '#fff', fontWeight: 600 }}>{u.full_name}</td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{u.email}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span className={`badge-role ${u.role}`}>{u.role}</span>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <span className="badge" style={{ background: u.is_active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: u.is_active ? '#34d399' : '#f87171' }}>
                        {u.is_active ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                      <button
                        onClick={() => {
                          setTargetUser(u);
                          setSelectedRole(u.role);
                          setStaffDept(u.staff_profile?.department || '');
                          setStaffDesk(u.staff_profile?.desk_phone || '');
                        }}
                        className="btn btn-outline btn-sm"
                        style={{ fontSize: '0.78rem', marginRight: '0.5rem' }}
                      >
                        Change Role
                      </button>

                      {u.user_id !== user?.user_id && (
                        <button
                          onClick={() => handleToggleUserStatus(u)}
                          className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-secondary'}`}
                          style={{ fontSize: '0.78rem' }}
                        >
                          {u.is_active ? 'Deactivate' : 'Activate'}
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

      {/* Tab 5: Category Management (Admin Only) */}
      {isAdmin && activeTab === 'categories' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
          {/* Categories List */}
          <div className="card">
            <h3 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '1rem' }}>Active Item Categories</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {categories.map((c) => (
                <div key={c.category_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)' }}>
                  <div>
                    <strong style={{ color: '#fff' }}>{c.name}</strong>
                    {c.description && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.description}</p>}
                  </div>
                  <span className="badge" style={{ background: c.is_active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: c.is_active ? '#34d399' : '#f87171' }}>
                    {c.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Create Category Form */}
          <div className="card">
            <h3 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={18} color="var(--primary)" /> Add New Category
            </h3>
            <form onSubmit={handleCreateCategory}>
              <div className="form-group">
                <label className="form-label">Category Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Musical Instruments, Eyewear"
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
                  placeholder="e.g. Guitars, violins, brass instruments"
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

      {/* Tab 6: Custody Locations Management (Admin Only) */}
      {isAdmin && activeTab === 'locations' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
          {/* Locations List */}
          <div className="card">
            <h3 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '1rem' }}>Storage Custody Facilities</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {custodyLocations.map((loc) => (
                <div key={loc.location_id} style={{ padding: '0.85rem 1rem', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: '#fff' }}>{loc.facility_name}</strong>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{loc.building}</span>
                  </div>
                  {loc.restricted_details && (
                    <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: '#a5b4fc', background: 'rgba(0,0,0,0.2)', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)' }}>
                      <strong>Restricted Staff Details:</strong> {loc.restricted_details}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Add Custody Location Form */}
          <div className="card">
            <h3 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={18} color="var(--primary)" /> Add Custody Facility
            </h3>
            <form onSubmit={handleCreateLocation}>
              <div className="form-group">
                <label className="form-label">Facility Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Student Union Lost & Found Desk"
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
                  placeholder="e.g. Memorial Union"
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
                  placeholder="e.g. Room 104"
                  value={newLocRoom}
                  onChange={(e) => setNewLocRoom(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Restricted Access Details (Passcodes/Keypad)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Locker safe combo 84-21-99"
                  value={newLocRestricted}
                  onChange={(e) => setNewLocRestricted(e.target.value)}
                />
              </div>

              <button type="submit" disabled={creatingLoc} className="btn btn-primary btn-sm" style={{ width: '100%', marginTop: '0.5rem' }}>
                {creatingLoc ? 'Saving...' : 'Add Storage Facility'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Tab 7: System Audit Trail (Admin Only) */}
      {isAdmin && activeTab === 'audit' && (
        <div className="card">
          <h3 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={18} color="var(--primary)" /> System Security &amp; Activity Audit Log
          </h3>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.65rem' }}>Timestamp</th>
                  <th style={{ padding: '0.65rem' }}>Action</th>
                  <th style={{ padding: '0.65rem' }}>Entity</th>
                  <th style={{ padding: '0.65rem' }}>Actor</th>
                  <th style={{ padding: '0.65rem' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log: any) => (
                  <tr key={log.audit_id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '0.65rem', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: '0.65rem' }}>
                      <span className="badge badge-status" style={{ fontSize: '0.7rem' }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: '0.65rem', color: '#fff' }}>
                      {log.entity_type} {log.entity_id ? `#${log.entity_id}` : ''}
                    </td>
                    <td style={{ padding: '0.65rem', color: 'var(--text-secondary)' }}>
                      {log.actor_user_id ? `User #${log.actor_user_id}` : 'System'}
                    </td>
                    <td style={{ padding: '0.65rem', color: 'var(--text-secondary)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.details ? JSON.stringify(log.details) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Role Management Modal (Admin) */}
      {targetUser && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}>
          <div className="card" style={{ maxWidth: '480px', width: '100%', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#fff', marginBottom: '0.5rem' }}>
              Update User Role
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
              User: <strong>{targetUser.full_name}</strong> ({targetUser.email})
            </p>

            <form onSubmit={handleUpdateRole}>
              <div className="form-group">
                <label className="form-label">Role *</label>
                <select
                  className="form-select"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as any)}
                  required
                >
                  <option value="user">User (Standard Member)</option>
                  <option value="staff">Staff (Case Handler)</option>
                  <option value="admin">Administrator (System Manager)</option>
                </select>
              </div>

              {selectedRole === 'staff' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Department</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Campus Security, Library Services"
                      value={staffDept}
                      onChange={(e) => setStaffDept(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Desk Phone</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. +1 (555) 432-1000"
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

      {/* Claim Decision Modal */}
      {selectedClaim && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}>
          <div className="card" style={{ maxWidth: '520px', width: '100%', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#fff', marginBottom: '0.5rem' }}>
              Review Claim #{selectedClaim.claim_id}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
              Decide whether ownership evidence is sufficient to authorize physical handover.
            </p>

            <form onSubmit={handleSubmitClaimReview}>
              <div className="form-group">
                <label className="form-label">Review Decision</label>
                <select
                  className="form-select"
                  value={decisionType}
                  onChange={(e) => setDecisionType(e.target.value as any)}
                >
                  <option value="approve">Approve Claim (Awaits physical handover)</option>
                  <option value="reject">Reject Claim (Evidence insufficient)</option>
                  <option value="request-info">Request More Information</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Review Justification &amp; Notes *</label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  placeholder="Record explanation for this decision (communicated to claimant and logged for audit)..."
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setSelectedClaim(null)}
                  className="btn btn-outline btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDecision || !decisionNotes.trim()}
                  className="btn btn-primary btn-sm"
                >
                  {submittingDecision ? 'Submitting...' : 'Record Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Handover Recording Modal */}
      {handoverClaim && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}>
          <div className="card" style={{ maxWidth: '520px', width: '100%', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#fff', marginBottom: '0.5rem' }}>
              Confirm Handover &amp; Return
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
              Record in-person verification details to mark this item officially Returned.
            </p>

            <form onSubmit={handleSubmitHandover}>
              <div className="form-group">
                <label className="form-label">Recipient Confirmation Details *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Student ID #98234 verified in person with driver license"
                  value={handoverConfirmation}
                  onChange={(e) => setHandoverConfirmation(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Item Condition upon Handover</label>
                <input
                  type="text"
                  className="form-input"
                  value={itemCondition}
                  onChange={(e) => setItemCondition(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Additional Handover Notes (Optional)</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="Any extra comments regarding the handover process..."
                  value={handoverNotes}
                  onChange={(e) => setHandoverNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setHandoverClaim(null)}
                  className="btn btn-outline btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingHandover || !handoverConfirmation.trim()}
                  className="btn btn-primary btn-sm"
                  style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                >
                  {submittingHandover ? 'Recording...' : 'Confirm Return Handover'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
