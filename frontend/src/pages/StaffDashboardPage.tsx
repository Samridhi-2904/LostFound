import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { staffApi, custodyApi } from '../services/api';
import type { ItemReport, Claim, CustodyLocation } from '../types';
import { Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  HeartHandshake, 
  ArrowRightLeft, 
  Archive, 
  ExternalLink,
  Clock,
  Layers,
  ArrowRight,
  ShieldAlert,
  FileCheck,
  Check
} from 'lucide-react';

export const StaffDashboardPage: React.FC = () => {
  const { isAdmin } = useAuth();

  const [pendingReports, setPendingReports] = useState<ItemReport[]>([]);
  const [claimsQueue, setClaimsQueue] = useState<Claim[]>([]);
  const [custodyLocations, setCustodyLocations] = useState<CustodyLocation[]>([]);
  const [loading, setLoading] = useState(true);

  // Tab navigation
  const [activeTab, setActiveTab] = useState<'reports' | 'claims' | 'transfer' | 'lifecycle'>('reports');

  // Notifications
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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

  const loadStaffData = useCallback(async () => {
    setLoading(true);
    setActionError(null);
    try {
      const [pending, claims, locs] = await Promise.all([
        staffApi.getPendingReports().catch(() => []),
        staffApi.getStaffClaims().catch(() => []),
        custodyApi.getAdminLocations().catch(() => []),
      ]);
      setPendingReports(pending);
      setClaimsQueue(claims);
      if (locs) setCustodyLocations(locs);
    } catch (err: any) {
      setActionError(err.message || 'Failed to load staff moderation queues.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStaffData();
  }, [loadStaffData]);

  const handleVerifyReport = async (reportId: number) => {
    try {
      await staffApi.verifyReport(reportId, 'Verified by staff moderation desk.');
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
      loadStaffData();
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
      setActionSuccess(`Handover confirmed! Item marked as Returned in the permanent record.`);
      setHandoverClaim(null);
      setHandoverConfirmation('');
      setHandoverNotes('');
      loadStaffData();
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
        storage_reference: newStorageRef.trim() || undefined,
        reason: transferReason.trim() || 'Internal custody relocation',
      });
      setActionSuccess(`Custody relocated for Report #${transferReportId}.`);
      setTransferReportId('');
      setNewLocationId('');
      setNewStorageRef('');
      setTransferReason('');
      loadStaffData();
    } catch (err: any) {
      setActionError(err.message || 'Custody transfer failed.');
    } finally {
      setSubmittingTransfer(false);
    }
  };

  const handleLifecycleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lifecycleReportId || !lifecycleActionType || !lifecycleConfirm) return;

    setSubmittingLifecycle(true);
    setActionError(null);

    try {
      const repId = parseInt(lifecycleReportId, 10);
      if (lifecycleActionType === 'archive') {
        await staffApi.archiveReport(repId, lifecycleReason.trim() || 'Archived by staff policy');
        setActionSuccess(`Report #${repId} has been archived.`);
      } else {
        await staffApi.disposeReport(repId, lifecycleReason.trim() || 'Disposed according to campus retention protocol');
        setActionSuccess(`Report #${repId} recorded as Disposed.`);
      }
      setLifecycleReportId('');
      setLifecycleReason('');
      setLifecycleActionType(null);
      setLifecycleConfirm(false);
      loadStaffData();
    } catch (err: any) {
      setActionError(err.message || `Failed to ${lifecycleActionType} report.`);
    } finally {
      setSubmittingLifecycle(false);
    }
  };

  const pendingVerificationCount = pendingReports.length;
  const approvedForHandoverClaims = claimsQueue.filter((c) => c.claim_status === 'approved');
  const pendingEvaluationClaims = claimsQueue.filter((c) => c.claim_status === 'pending' || c.claim_status === 'more_information_requested');

  return (
    <div>
      {/* Staff Operational Console Header */}
      <div className="dashboard-header dashboard-header-staff">
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
            <ShieldCheck size={14} /> Campus Security &amp; Custody Desk
          </div>
          <h1 style={{ fontSize: '1.9rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.35rem' }}>
            Staff Operations Workstation
          </h1>
          <p style={{ color: '#ccfbf1', fontSize: '0.95rem' }}>
            Intake report verification, claim ownership evaluations, in-person physical handovers, and secure locker management.
          </p>
        </div>

        {isAdmin && (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <Link to="/admin/dashboard" className="btn btn-secondary btn-sm" style={{ fontWeight: 600, color: '#312e81' }}>
              Switch to Admin Console <ArrowRight size={15} />
            </Link>
          </div>
        )}
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

      {/* Operational Queue KPI Counters */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon-wrap" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
            <Clock size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-value">{pendingVerificationCount}</span>
            <span className="metric-label">Reports Awaiting Verification</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-wrap" style={{ background: '#fffbeb', color: '#b45309' }}>
            <FileCheck size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-value">{pendingEvaluationClaims.length}</span>
            <span className="metric-label">Claims Under Staff Review</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-wrap" style={{ background: '#ecfdf5', color: '#047857' }}>
            <HeartHandshake size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-value">{approvedForHandoverClaims.length}</span>
            <span className="metric-label">Approved for Handover</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-wrap" style={{ background: '#f5f3ff', color: '#6d28d9' }}>
            <Layers size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-value">{custodyLocations.length}</span>
            <span className="metric-label">Active Campus Vaults</span>
          </div>
        </div>
      </div>

      {/* Operational Navigation Tabs */}
      <div className="dashboard-tabs">
        <button
          onClick={() => setActiveTab('reports')}
          className={`dashboard-tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
        >
          <Clock size={16} /> Verification Queue ({pendingVerificationCount})
        </button>

        <button
          onClick={() => setActiveTab('claims')}
          className={`dashboard-tab-btn ${activeTab === 'claims' ? 'active' : ''}`}
        >
          <FileCheck size={16} /> Claims Evaluation &amp; Handover ({claimsQueue.length})
        </button>

        <button
          onClick={() => setActiveTab('transfer')}
          className={`dashboard-tab-btn ${activeTab === 'transfer' ? 'active' : ''}`}
        >
          <ArrowRightLeft size={16} /> Custody Storage Transfer
        </button>

        <button
          onClick={() => setActiveTab('lifecycle')}
          className={`dashboard-tab-btn ${activeTab === 'lifecycle' ? 'active' : ''}`}
        >
          <Archive size={16} /> Archival &amp; Disposal Protocol
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Loading operational queues...
        </div>
      ) : (
        <>
          {/* TAB 1: VERIFICATION QUEUE */}
          {activeTab === 'reports' && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Intake Moderation Queue
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Newly filed student reports require staff approval before publishing to public search.
                  </p>
                </div>
              </div>

              {pendingReports.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  <CheckCircle2 size={36} color="#059669" style={{ margin: '0 auto 0.75rem' }} />
                  <p>All submitted reports have been reviewed! No items pending moderation.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {pendingReports.map((r) => (
                    <div
                      key={r.report_id}
                      style={{
                        padding: '1.25rem',
                        background: 'var(--bg-surface-elevated)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '1rem',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: '260px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                          <span className={`badge ${r.report_type === 'found' ? 'badge-found' : 'badge-lost'}`}>
                            {r.report_type}
                          </span>
                          <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                            {r.case_reference}
                          </span>
                        </div>
                        <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                          {r.title}
                        </h4>
                        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', lineHeight: 1.5 }}>
                          {r.description}
                        </p>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                          <span><strong>Location:</strong> {r.location_approximate}</span>
                          <span><strong>Date:</strong> {new Date(r.date_incident).toLocaleDateString()}</span>
                          {r.contact_info_restricted && (
                            <span style={{ color: '#b45309' }}>
                              <strong>Restricted Contact:</strong> {r.contact_info_restricted}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.65rem' }}>
                        <Link to={`/reports/${r.report_id}`} className="btn btn-outline btn-sm">
                          Inspect <ExternalLink size={13} />
                        </Link>
                        <button
                          onClick={() => handleRejectReport(r.report_id)}
                          className="btn btn-danger btn-sm"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleVerifyReport(r.report_id)}
                          className="btn btn-success btn-sm"
                        >
                          <Check size={14} /> Verify &amp; Publish
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CLAIMS REVIEW & HANDOVER */}
          {activeTab === 'claims' && (
            <div className="card">
              <div style={{ marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Ownership Claims &amp; Return Handover Desk
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Decide ownership claims and execute official in-person handovers for approved claims.
                </p>
              </div>

              {claimsQueue.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  <p>No claims currently in the moderation queue.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {claimsQueue.map((claim) => (
                    <div
                      key={claim.claim_id}
                      style={{
                        padding: '1.25rem',
                        background: 'var(--bg-surface-elevated)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '1rem',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: '260px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                          <span className={`badge badge-status ${claim.claim_status}`}>
                            {claim.claim_status.replace('_', ' ')}
                          </span>
                          <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                            Claim #{claim.claim_id} on Report #{claim.report_id}
                          </span>
                        </div>

                        <div style={{ marginBottom: '0.5rem' }}>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Claimant:</span>{' '}
                          <strong style={{ color: 'var(--text-primary)' }}>{claim.claimant?.full_name || `User #${claim.claimant_user_id}`}</strong>
                          {claim.claimant?.email && <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}> ({claim.claimant.email})</span>}
                        </div>

                        <div style={{
                          padding: '0.75rem',
                          background: '#ffffff',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)',
                          fontSize: '0.85rem',
                          color: 'var(--text-secondary)',
                          marginBottom: '0.5rem',
                        }}>
                          <strong style={{ color: 'var(--text-primary)' }}>Submitted Ownership Proof:</strong> {claim.ownership_evidence}
                        </div>

                        {claim.review_notes && (
                          <div style={{ fontSize: '0.82rem', color: '#b45309' }}>
                            <strong>Reviewer Notes:</strong> {claim.review_notes}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '0.65rem' }}>
                        <Link to={`/reports/${claim.report_id}`} className="btn btn-outline btn-sm">
                          Item Details
                        </Link>

                        {claim.claim_status !== 'approved' && (
                          <button
                            onClick={() => {
                              setSelectedClaim(claim);
                              setDecisionType('approve');
                              setDecisionNotes('');
                            }}
                            className="btn btn-primary btn-sm"
                          >
                            Assess Evidence
                          </button>
                        )}

                        {claim.claim_status === 'approved' && (
                          <button
                            onClick={() => {
                              setHandoverClaim(claim);
                              setHandoverConfirmation('');
                              setHandoverNotes('');
                            }}
                            className="btn btn-success btn-sm"
                          >
                            <HeartHandshake size={15} /> Confirm Handover
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CUSTODY TRANSFER */}
          {activeTab === 'transfer' && (
            <div className="card" style={{ maxWidth: '640px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ArrowRightLeft size={18} color="var(--primary)" /> Relocate Custody Location
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                Transfer physical custody of a found item to a central vault, department locker, or security facility.
              </p>

              <form onSubmit={handleTransferCustody}>
                <div className="form-group">
                  <label className="form-label">Report ID *</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="Enter Found Item Report ID (e.g. 1)"
                    value={transferReportId}
                    onChange={(e) => setTransferReportId(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Destination Facility *</label>
                  <select
                    className="form-select"
                    value={newLocationId}
                    onChange={(e) => setNewLocationId(Number(e.target.value))}
                    required
                  >
                    <option value="">Select Target Storage Facility...</option>
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
                    placeholder="e.g. Locker #B-14, Shelf 2"
                    value={newStorageRef}
                    onChange={(e) => setNewStorageRef(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Relocation Reason</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Transferred from Campus Info Hub to Main Security Vault"
                    value={transferReason}
                    onChange={(e) => setTransferReason(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingTransfer}
                  className="btn btn-primary btn-sm"
                  style={{ marginTop: '0.5rem' }}
                >
                  {submittingTransfer ? 'Processing Relocation...' : 'Execute Custody Transfer'}
                </button>
              </form>
            </div>
          )}

          {/* TAB 4: ARCHIVE & DISPOSAL PROTOCOL */}
          {activeTab === 'lifecycle' && (
            <div className="card" style={{ maxWidth: '640px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldAlert size={18} color="#dc2626" /> Policy Archival &amp; Disposal Protocol
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                Execute safeguarded lifecycle actions on unclaimed items in accordance with campus retention regulations.
              </p>

              <form onSubmit={handleLifecycleAction}>
                <div className="form-group">
                  <label className="form-label">Lifecycle Action *</label>
                  <select
                    className="form-select"
                    value={lifecycleActionType || ''}
                    onChange={(e) => setLifecycleActionType(e.target.value as any)}
                    required
                  >
                    <option value="">Select Lifecycle Action...</option>
                    <option value="archive">Archive Report (Case closed, removed from active search)</option>
                    <option value="dispose">Dispose Property (30+ days unclaimed, donation / recycled)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Target Report ID *</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="Enter Report ID"
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
                    placeholder="Record detailed retention justification for the audit trail..."
                    value={lifecycleReason}
                    onChange={(e) => setLifecycleReason(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                  <input
                    type="checkbox"
                    id="confirmLifecycle"
                    checked={lifecycleConfirm}
                    onChange={(e) => setLifecycleConfirm(e.target.checked)}
                  />
                  <label htmlFor="confirmLifecycle" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    I confirm that retention policy requirements have been met and this action is non-reversible.
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={submittingLifecycle || !lifecycleConfirm}
                  className="btn btn-danger btn-sm"
                >
                  {submittingLifecycle ? 'Processing...' : 'Apply Lifecycle Action'}
                </button>
              </form>
            </div>
          )}
        </>
      )}

      {/* Claim Decision Modal */}
      {selectedClaim && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Assess Claim #{selectedClaim.claim_id}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
              Evaluate evidence provided by claimant to determine eligibility for in-person handover.
            </p>

            <form onSubmit={handleSubmitClaimReview}>
              <div className="form-group">
                <label className="form-label">Decision *</label>
                <select
                  className="form-select"
                  value={decisionType}
                  onChange={(e) => setDecisionType(e.target.value as any)}
                >
                  <option value="approve">Approve Claim (Awaits Physical Handover)</option>
                  <option value="reject">Reject Claim (Evidence Insufficient / Inconclusive)</option>
                  <option value="request-info">Request Additional Proof / Specifics</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Staff Review Justification *</label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  placeholder="Record explanation for the decision (shared with claimant and preserved in audit log)..."
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
                  {submittingDecision ? 'Recording...' : 'Submit Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Handover Recording Modal */}
      {handoverClaim && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Confirm Handover &amp; Return
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
              Record verified recipient identity and item condition to officially mark the item as Returned.
            </p>

            <form onSubmit={handleSubmitHandover}>
              <div className="form-group">
                <label className="form-label">Recipient Identity Verification *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Verified Student ID #49281 with driver license match"
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
                  placeholder="e.g. Returned with charging adapter and protective case"
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
                  className="btn btn-success btn-sm"
                >
                  {submittingHandover ? 'Confirming...' : 'Sign & Complete Handover'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
