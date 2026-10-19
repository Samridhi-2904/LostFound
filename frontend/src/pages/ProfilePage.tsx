import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { claimApi, authApi, reportApi } from '../services/api';
import type { Claim, ReturnRecord, ItemReport } from '../types';
import { Link } from 'react-router-dom';
import { 
  HeartHandshake, 
  AlertCircle, 
  CheckCircle2, 
  ExternalLink,
  MessageSquare,
  Ban,
  FileCheck,
  FileText
} from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [myReports, setMyReports] = useState<ItemReport[]>([]);
  const [loadingData, setLoadingData] = useState(true);

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
      const [myClaims, reportsRes] = await Promise.all([
        claimApi.getMyClaims(),
        reportApi.searchReports({ page: 1, page_size: 50 }),
      ]);
      setClaims(myClaims);
      // Filter reports created by current user
      if (user) {
        setMyReports(reportsRes.items.filter((r) => r.creator_user_id === user.user_id));
      }
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

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#fff', marginBottom: '0.5rem' }}>
          My Account &amp; Activity
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Manage your account credentials, view your filed reports, and track ownership claims.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
        {/* Left Column: Profile Card & Settings */}
        <div>
          <div className="card" style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '1.4rem',
              }}>
                {user.full_name.charAt(0)}
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', color: '#fff', marginBottom: '0.2rem' }}>{user.full_name}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className={`badge-role ${user.role}`}>{user.role}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Member since {new Date(user.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>

            <form onSubmit={handleUpdateProfile}>
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
                  style={{ opacity: 0.6, cursor: 'not-allowed' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number</label>
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
                  placeholder="New password (min 8 chars)"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary btn-sm"
                style={{ width: '100%', marginTop: '0.5rem' }}
              >
                {saving ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </form>
          </div>

          {/* My Submitted Reports */}
          <div className="card">
            <h3 style={{ fontSize: '1.15rem', color: '#fff', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={18} color="var(--primary)" /> My Filed Reports ({myReports.length})
            </h3>
            {myReports.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {myReports.map((rep) => (
                  <Link
                    key={rep.report_id}
                    to={`/reports/${rep.report_id}`}
                    style={{
                      padding: '0.75rem 1rem',
                      background: 'var(--bg-surface-elevated)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.92rem', color: '#fff', fontWeight: 600 }}>{rep.title}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {rep.case_reference} • {new Date(rep.date_incident).toLocaleDateString()}
                      </div>
                    </div>
                    <span className={`badge badge-status ${rep.lifecycle_status}`} style={{ fontSize: '0.7rem' }}>
                      {rep.lifecycle_status}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                You haven't filed any reports yet.
              </p>
            )}
          </div>
        </div>

        {/* Right Column: My Claims Queue */}
        <div>
          <div className="card">
            <h3 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <HeartHandshake size={20} color="var(--primary)" /> My Ownership Claims ({claims.length})
            </h3>

            {loadingData ? (
              <p style={{ color: 'var(--text-secondary)', padding: '1rem 0' }}>Loading claims...</p>
            ) : claims.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {claims.map((claim) => (
                  <div
                    key={claim.claim_id}
                    style={{
                      padding: '1.25rem',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.65rem' }}>
                      <span className={`badge badge-status ${claim.claim_status}`} style={{ fontSize: '0.75rem' }}>
                        {claim.claim_status.replace(/_/g, ' ')}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Submitted {new Date(claim.submitted_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div style={{ fontSize: '1rem', color: '#fff', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Claim #{claim.claim_id} for Report #{claim.report_id}
                    </div>

                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', background: 'rgba(0,0,0,0.2)', padding: '0.65rem', borderRadius: 'var(--radius-sm)' }}>
                      <strong>Your Evidence:</strong> {claim.ownership_evidence}
                    </div>

                    {/* Staff Review Notes */}
                    {claim.review_notes && (
                      <div style={{
                        padding: '0.75rem',
                        background: claim.claim_status === 'more_information_requested' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(99, 102, 241, 0.1)',
                        borderLeft: '3px solid ' + (claim.claim_status === 'more_information_requested' ? '#f59e0b' : 'var(--primary)'),
                        borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                        fontSize: '0.82rem',
                        color: claim.claim_status === 'more_information_requested' ? '#fde68a' : '#c7d2fe',
                        marginBottom: '0.75rem',
                      }}>
                        <strong>Staff Note:</strong> {claim.review_notes}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
                      <Link to={`/reports/${claim.report_id}`} className="btn btn-outline btn-sm" style={{ fontSize: '0.78rem' }}>
                        View Item <ExternalLink size={12} />
                      </Link>

                      {claim.claim_status === 'more_information_requested' && (
                        <button
                          onClick={() => setRespondClaim(claim)}
                          className="btn btn-primary btn-sm"
                          style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                        >
                          <MessageSquare size={13} /> Submit More Info
                        </button>
                      )}

                      {['pending', 'more_information_requested'].includes(claim.claim_status) && (
                        <button
                          onClick={() => handleCancelClaim(claim.claim_id)}
                          className="btn btn-danger btn-sm"
                          style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                        >
                          <Ban size={13} /> Cancel Claim
                        </button>
                      )}

                      {claim.claim_status === 'approved' && (
                        <button
                          onClick={() => handleViewReturn(claim.claim_id)}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                        >
                          <FileCheck size={13} /> Handover Info
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
                <p style={{ marginBottom: '1.25rem' }}>You have not submitted any item claims yet.</p>
                <Link to="/search" className="btn btn-secondary btn-sm">
                  Browse Found Directory
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Respond More Information Modal */}
      {respondClaim && (
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
            <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#fff', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MessageSquare size={20} color="var(--primary)" /> Submit Requested Evidence
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
              Staff requested additional details for Claim #{respondClaim.claim_id}.
            </p>

            {responseError && (
              <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                <AlertCircle size={16} /> {responseError}
              </div>
            )}

            <form onSubmit={handleRespondMoreInfo}>
              <div className="form-group">
                <label className="form-label">Supplementary Evidence *</label>
                <textarea
                  className="form-textarea"
                  rows={5}
                  placeholder="Provide the specific verification details requested by campus staff..."
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

      {/* Handover Record Details Modal */}
      {viewingReturnClaimId && (
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
          <div className="card" style={{ maxWidth: '500px', width: '100%', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#fff', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileCheck size={20} color="#10b981" /> Verified Return Handover
            </h3>

            {loadingReturn ? (
              <p style={{ color: 'var(--text-secondary)', padding: '1.5rem 0' }}>Loading handover record...</p>
            ) : returnRecord ? (
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                <div>
                  <strong style={{ color: '#fff' }}>Returned At:</strong> {new Date(returnRecord.returned_at).toLocaleString()}
                </div>
                <div>
                  <strong style={{ color: '#fff' }}>Recipient Confirmation:</strong> {returnRecord.recipient_confirmation}
                </div>
                <div>
                  <strong style={{ color: '#fff' }}>Condition of Item:</strong> {returnRecord.condition_of_item}
                </div>
                {returnRecord.notes && (
                  <div>
                    <strong style={{ color: '#fff' }}>Handover Notes:</strong> {returnRecord.notes}
                  </div>
                )}
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Recorded by Staff Member #{returnRecord.recorded_by_user_id}
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--text-secondary)', padding: '1rem 0' }}>
                Handover has not yet been physically completed. Please present your campus ID at the designated custody desk.
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button
                type="button"
                onClick={() => { setViewingReturnClaimId(null); setReturnRecord(null); }}
                className="btn btn-secondary btn-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
