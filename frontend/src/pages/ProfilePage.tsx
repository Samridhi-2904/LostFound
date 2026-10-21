import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { claimApi, authApi, reportApi } from '../services/api';
import type { Claim, ReturnRecord, ItemReport } from '../types';
import { Link } from 'react-router-dom';
import { 
  HeartHandshake, 
  AlertCircle, 
  CheckCircle2, 
  MessageSquare,
  FileCheck,
  FileText,
  User,
  PlusCircle,
  ShieldCheck,
  Lock,
  Tag,
  MapPin,
  Calendar
} from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [myReports, setMyReports] = useState<ItemReport[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'reports' | 'claims' | 'security'>('reports');

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
      const [myClaims, myReportsList] = await Promise.all([
        claimApi.getMyClaims(),
        reportApi.getMyReports(),
      ]);
      setClaims(myClaims);
      setMyReports(myReportsList);
    } catch (err) {
      console.error('Failed to load user claims or reports', err);
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

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
    if (!window.confirm('Are you sure you want to cancel this ownership claim?')) {
      return;
    }
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

  if (!user) return null;

  const myLostCount = myReports.filter((r) => r.report_type === 'lost').length;
  const myFoundCount = myReports.filter((r) => r.report_type === 'found').length;
  const activeClaimsCount = claims.filter((c) => c.claim_status === 'pending' || c.claim_status === 'more_information_requested').length;
  const approvedClaimsCount = claims.filter((c) => c.claim_status === 'approved').length;

  return (
    <div>
      {/* Student / User Dashboard Header */}
      <div className="dashboard-header dashboard-header-user">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: '#ffffff',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '1.6rem',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          }}>
            {user.full_name.charAt(0)}
          </div>

          <div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.2rem 0.65rem',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(255, 255, 255, 0.2)',
              fontSize: '0.78rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              marginBottom: '0.4rem',
            }}>
              <User size={13} /> {user.role === 'admin' ? 'Campus Administrator' : user.role === 'staff' ? 'Staff Member' : 'Registered Student'}
            </div>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.25rem' }}>
              Welcome back, {user.full_name}
            </h1>
            <p style={{ color: '#dbeafe', fontSize: '0.92rem' }}>
              {user.email} &bull; Member since {new Date(user.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link to="/report/lost" className="btn btn-secondary btn-sm" style={{ fontWeight: 600 }}>
            <PlusCircle size={15} color="#ef4444" /> Report Lost Item
          </Link>
          <Link to="/report/found" className="btn btn-secondary btn-sm" style={{ fontWeight: 600 }}>
            <ShieldCheck size={15} color="#059669" /> Report Found Item
          </Link>
        </div>
      </div>

      {/* Quick Summary Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon-wrap" style={{ background: '#fee2e2', color: '#b91c1c' }}>
            <FileText size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-value">{myLostCount}</span>
            <span className="metric-label">Lost Reports Filed</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-wrap" style={{ background: '#ecfdf5', color: '#047857' }}>
            <ShieldCheck size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-value">{myFoundCount}</span>
            <span className="metric-label">Found Items Logged</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-wrap" style={{ background: '#fffbeb', color: '#b45309' }}>
            <FileCheck size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-value">{activeClaimsCount}</span>
            <span className="metric-label">Claims in Review</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-wrap" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
            <HeartHandshake size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-value">{approvedClaimsCount}</span>
            <span className="metric-label">Ready for Handover</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="dashboard-tabs">
        <button
          onClick={() => setActiveTab('reports')}
          className={`dashboard-tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
        >
          <FileText size={16} /> My Reports ({myReports.length})
        </button>

        <button
          onClick={() => setActiveTab('claims')}
          className={`dashboard-tab-btn ${activeTab === 'claims' ? 'active' : ''}`}
        >
          <FileCheck size={16} /> My Ownership Claims ({claims.length})
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`dashboard-tab-btn ${activeTab === 'security' ? 'active' : ''}`}
        >
          <Lock size={16} /> Account &amp; Profile Settings
        </button>
      </div>

      {loadingData ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Loading your account activity...
        </div>
      ) : (
        <>
          {/* TAB 1: MY REPORTS */}
          {activeTab === 'reports' && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    My Filed Property Reports
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
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
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  <p style={{ marginBottom: '1rem' }}>You have not submitted any property reports yet.</p>
                  <Link to="/report/lost" className="btn btn-primary btn-sm">
                    Report a Lost Item
                  </Link>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {myReports.map((rep) => (
                    <div
                      key={rep.report_id}
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
                      <div style={{ flex: 1, minWidth: '240px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                          <span className={`badge ${rep.report_type === 'found' ? 'badge-found' : 'badge-lost'}`}>
                            {rep.report_type}
                          </span>
                          <span className={`badge badge-status ${rep.lifecycle_status}`}>
                            {rep.lifecycle_status}
                          </span>
                          <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                            {rep.case_reference}
                          </span>
                        </div>

                        <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                          {rep.title}
                        </h4>
                        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', lineHeight: 1.5 }}>
                          {rep.description}
                        </p>

                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <MapPin size={12} /> {rep.location_approximate}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <Calendar size={12} /> {new Date(rep.date_incident).toLocaleDateString()}
                          </span>
                          {rep.category && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <Tag size={12} /> {rep.category.name}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Link to={`/reports/${rep.report_id}`} className="btn btn-primary btn-sm">
                          View Details &amp; Matches
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MY CLAIMS */}
          {activeTab === 'claims' && (
            <div className="card">
              <div style={{ marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Submitted Ownership Claims
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Track security desk decisions on claims you filed for found property.
                </p>
              </div>

              {claims.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  <p style={{ marginBottom: '1rem' }}>You have not submitted any ownership claims.</p>
                  <Link to="/search?report_type=found" className="btn btn-outline btn-sm">
                    Search Found Items Directory
                  </Link>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {claims.map((claim) => (
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                          <span className={`badge badge-status ${claim.claim_status}`}>
                            {claim.claim_status.replace('_', ' ')}
                          </span>
                          <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                            Claim #{claim.claim_id} on Report #{claim.report_id}
                          </span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            Filed {new Date(claim.submitted_at).toLocaleDateString()}
                          </span>
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
                          <strong style={{ color: 'var(--text-primary)' }}>Submitted Proof:</strong> {claim.ownership_evidence}
                        </div>

                        {claim.review_notes && (
                          <div style={{
                            padding: '0.6rem 0.85rem',
                            background: claim.claim_status === 'approved' ? '#ecfdf5' : '#fffbeb',
                            borderRadius: 'var(--radius-sm)',
                            border: claim.claim_status === 'approved' ? '1px solid #a7f3d0' : '1px solid #fde68a',
                            fontSize: '0.82rem',
                            color: claim.claim_status === 'approved' ? '#047857' : '#b45309',
                          }}>
                            <strong>Reviewer Note:</strong> {claim.review_notes}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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

          {/* TAB 3: ACCOUNT & SECURITY */}
          {activeTab === 'security' && (
            <div className="card" style={{ maxWidth: '600px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                Account Profile &amp; Password
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                Update your contact details or change your account credentials.
              </p>

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

              <form onSubmit={handleUpdateProfile}>
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
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Email address cannot be changed.</span>
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
                  <label className="form-label">Change Password (leave blank to keep current)</label>
                  <input
                    type="password"
                    className="form-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new secure password (min 8 characters)"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary btn-sm"
                  style={{ marginTop: '0.5rem' }}
                >
                  {saving ? 'Saving...' : 'Save Profile Changes'}
                </button>
              </form>
            </div>
          )}
        </>
      )}

      {/* Provide Additional Evidence Modal */}
      {respondClaim && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Provide Additional Evidence
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
              Staff requested more specific details to verify your claim on Report #{respondClaim.report_id}.
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
                <button
                  type="button"
                  onClick={() => setRespondClaim(null)}
                  className="btn btn-outline btn-sm"
                >
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

      {/* View Return / Handover Modal */}
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

                <div style={{
                  padding: '1.25rem',
                  background: 'var(--bg-surface-elevated)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  fontSize: '0.88rem',
                }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Handover Timestamp:</span>{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>{new Date(returnRecord.returned_at).toLocaleString()}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Verification Notes:</span>{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>{returnRecord.recipient_confirmation}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Item Condition at Return:</span>{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>{returnRecord.condition_of_item}</strong>
                  </div>
                  {returnRecord.notes && (
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Desk Officer Notes:</span>{' '}
                      <span style={{ color: 'var(--text-secondary)' }}>{returnRecord.notes}</span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                  <button
                    onClick={() => setViewingReturnClaimId(null)}
                    className="btn btn-primary btn-sm"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                  Your claim is approved! Please bring your campus student ID to the Central Campus Security Vault during operational hours (9 AM - 5 PM) to sign for and collect your property.
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setViewingReturnClaimId(null)}
                    className="btn btn-primary btn-sm"
                  >
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
