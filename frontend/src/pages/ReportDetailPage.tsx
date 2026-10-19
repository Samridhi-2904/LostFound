import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { reportApi, claimApi, staffApi, categoryApi } from '../services/api';
import type { ItemReport, Category } from '../types';
import { useAuth } from '../context/AuthContext';
import { 
  MapPin, 
  Calendar, 
  Tag, 
  ShieldCheck, 
  AlertCircle, 
  Lock, 
  ArrowLeft, 
  HeartHandshake, 
  CheckCircle2, 
  Eye,
  Edit3,
  Clock,
  Sparkles,
  Trash2,
  Upload,
  ExternalLink,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';

export const ReportDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated, isStaff } = useAuth();

  const [report, setReport] = useState<ItemReport | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active sub-tab
  const [activeTab, setActiveTab] = useState<'details' | 'matches' | 'history'>('details');

  // Claim modal state
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [ownershipEvidence, setOwnershipEvidence] = useState('');
  const [submittingClaim, setSubmittingClaim] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategoryId, setEditCategoryId] = useState<number>(0);
  const [editColour, setEditColour] = useState('');
  const [editBrand, setEditBrand] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Image upload state
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Close report state
  const [closingReport, setClosingReport] = useState(false);

  const fetchReportData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const reportId = parseInt(id, 10);
      const data = await reportApi.getReport(reportId);
      setReport(data);

      // Populate edit fields
      setEditTitle(data.title);
      setEditDescription(data.description);
      setEditCategoryId(data.category_id);
      setEditColour(data.primary_colour || '');
      setEditBrand(data.brand || '');
      setEditModel(data.model || '');
      setEditLocation(data.location_approximate);

      // Concurrently fetch matches and history if user is creator or staff
      const promises: Promise<any>[] = [categoryApi.getCategories()];
      if (isAuthenticated && (user?.user_id === data.creator_user_id || isStaff)) {
        promises.push(reportApi.getReportMatches(reportId).catch(() => []));
        promises.push(reportApi.getReportHistory(reportId).catch(() => []));
      }

      const results = await Promise.all(promises);
      setCategories(results[0] || []);
      if (results[1]) setMatches(results[1]);
      if (results[2]) setHistory(results[2]);
    } catch (err: any) {
      setError(err.message || 'Report not found or unavailable.');
    } finally {
      setLoading(false);
    }
  }, [id, isAuthenticated, user?.user_id, isStaff]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!report || !ownershipEvidence.trim()) return;

    setSubmittingClaim(true);
    setClaimError(null);

    try {
      await claimApi.submitClaim(report.report_id, ownershipEvidence);
      setClaimSuccess(true);
      setTimeout(() => {
        setShowClaimModal(false);
        fetchReportData();
      }, 1500);
    } catch (err: any) {
      setClaimError(err.message || 'Failed to submit claim.');
    } finally {
      setSubmittingClaim(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!report) return;

    setSubmittingEdit(true);
    setEditError(null);

    try {
      await reportApi.updateReport(report.report_id, {
        title: editTitle,
        description: editDescription,
        category_id: editCategoryId,
        primary_colour: editColour || undefined,
        brand: editBrand || undefined,
        model: editModel || undefined,
        location_approximate: editLocation,
      });
      setShowEditModal(false);
      fetchReportData();
    } catch (err: any) {
      setEditError(err.message || 'Failed to update report.');
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleCloseReport = async () => {
    if (!report) return;
    if (!window.confirm('Are you sure you want to close this report? It will be archived and no longer match with new items.')) {
      return;
    }

    setClosingReport(true);
    try {
      await reportApi.closeReport(report.report_id);
      fetchReportData();
    } catch (err: any) {
      alert(err.message || 'Failed to close report.');
    } finally {
      setClosingReport(false);
    }
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!report || !e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    setUploadingImage(true);
    setUploadError(null);

    try {
      await reportApi.uploadImage(report.report_id, file, false);
      fetchReportData();
    } catch (err: any) {
      setUploadError(err.message || 'Image upload failed. Must be JPEG/PNG/WebP <= 5MB.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeleteImage = async (imageId: number) => {
    if (!window.confirm('Are you sure you want to delete this photo?')) return;
    try {
      await reportApi.deleteImage(imageId);
      fetchReportData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete image.');
    }
  };

  const handleReviewMatch = async (matchId: number, status: 'confirmed' | 'dismissed') => {
    try {
      if (status === 'confirmed') {
        await staffApi.reviewMatch(matchId);
      } else {
        await staffApi.dismissMatch(matchId);
      }
      fetchReportData();
    } catch (err: any) {
      alert(err.message || 'Failed to review match.');
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
        Loading report details...
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="card" style={{ maxWidth: '600px', margin: '3rem auto', textAlign: 'center', padding: '3rem' }}>
        <AlertCircle size={48} color="#fb7185" style={{ margin: '0 auto 1rem' }} />
        <h2 style={{ fontSize: '1.5rem', color: '#fff', marginBottom: '0.75rem' }}>Report Unavailable</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          {error || 'This report may have been archived or does not exist.'}
        </p>
        <Link to="/search" className="btn btn-secondary btn-sm">
          <ArrowLeft size={16} /> Back to Search
        </Link>
      </div>
    );
  }

  const isOwner = user?.user_id === report.creator_user_id;
  const isFound = report.report_type === 'found';
  const canClaim = isAuthenticated && isFound && !isOwner && ['open', 'matched', 'claimed'].includes(report.lifecycle_status);
  const canEdit = (isOwner || isStaff) && report.lifecycle_status === 'open';
  const canClose = (isOwner || isStaff) && report.lifecycle_status === 'open';
  const canManageImages = (isOwner || isStaff);

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/search" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
          <ArrowLeft size={16} /> Back to Listings
        </Link>
      </div>

      <div className="card" style={{ padding: '2.5rem' }}>
        {/* Header Badges */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.75rem' }}>
              <span className={`badge ${isFound ? 'badge-found' : 'badge-lost'}`} style={{ fontSize: '0.82rem', padding: '0.35rem 0.85rem' }}>
                {report.report_type} Item
              </span>
              <span className={`badge badge-status ${report.lifecycle_status}`} style={{ fontSize: '0.82rem', padding: '0.35rem 0.85rem' }}>
                Status: {report.lifecycle_status}
              </span>
              {report.moderation_status !== 'verified' && (
                <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24' }}>
                  Moderation: {report.moderation_status}
                </span>
              )}
            </div>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#fff', lineHeight: 1.25, margin: 0 }}>
              {report.title}
            </h1>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              Case Reference:
            </span>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#a5b4fc' }}>
              {report.case_reference}
            </div>
          </div>
        </div>

        {/* Sub-tab Navigation (Details / Match Suggestions / Audit History) */}
        {(isOwner || isStaff) && (
          <div style={{ display: 'flex', gap: '0.75rem', borderBottom: '1px solid var(--border-subtle)', marginBottom: '2rem' }}>
            <button
              className={`btn btn-sm ${activeTab === 'details' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveTab('details')}
            >
              Item Details
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'matches' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveTab('matches')}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Sparkles size={14} /> Potential Matches ({matches.length})
            </button>
            <button
              className={`btn btn-sm ${activeTab === 'history' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setActiveTab('history')}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Clock size={14} /> Case History ({history.length})
            </button>
          </div>
        )}

        {/* Tab 1: Main Details */}
        {activeTab === 'details' && (
          <div>
            {/* Photos Preview & Management */}
            <div style={{ marginBottom: '2.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#fff' }}>
                  Photographs ({report.images?.length || 0})
                </h3>
                {canManageImages && (
                  <div>
                    <input
                      type="file"
                      id="add-photo-input"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleUploadImage}
                      style={{ display: 'none' }}
                      disabled={uploadingImage}
                    />
                    <label htmlFor="add-photo-input" className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Upload size={14} /> {uploadingImage ? 'Uploading...' : 'Add Photo'}
                    </label>
                  </div>
                )}
              </div>

              {uploadError && (
                <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                  <AlertCircle size={15} /> {uploadError}
                </div>
              )}

              {report.images && report.images.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                  {report.images.map((img) => (
                    <div key={img.image_id} style={{ position: 'relative', height: '180px', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                      <img
                        src={`/api/v1/images/${img.image_id}`}
                        alt={report.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      {canManageImages && (
                        <button
                          onClick={() => handleDeleteImage(img.image_id)}
                          className="btn btn-danger btn-sm"
                          title="Delete photo"
                          style={{ position: 'absolute', top: '8px', right: '8px', padding: '0.35rem', borderRadius: '50%' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '1.5rem', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  No photos uploaded for this report.
                </div>
              )}
            </div>

            {/* Key Attributes Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '1.25rem',
              padding: '1.25rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface-elevated)',
              marginBottom: '2rem',
            }}>
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Category</div>
                <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Tag size={14} color="#a5b4fc" /> {report.category?.name || 'Uncategorized'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Date Reported</div>
                <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Calendar size={14} color="#38bdf8" /> {new Date(report.date_incident).toLocaleDateString()}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Approx. Location</div>
                <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <MapPin size={14} color="#6366f1" /> {report.location_approximate}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Colour / Brand</div>
                <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: 600 }}>
                  {report.primary_colour || 'N/A'} {report.brand ? `• ${report.brand}` : ''}
                </div>
              </div>
            </div>

            {/* Full Description */}
            <div style={{ marginBottom: '2.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '0.75rem' }}>Detailed Description</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
                {report.description}
              </p>
            </div>

            {/* Custody Information Section (Privacy Aware) */}
            {isFound && (
              <div style={{
                padding: '1.5rem',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(6, 182, 212, 0.08)',
                border: '1px solid rgba(6, 182, 212, 0.25)',
                marginBottom: '2.5rem',
              }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#38bdf8', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShieldCheck size={18} /> Physical Custody Status
                </h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  Facility: <strong>{report.custody_location?.facility_name || 'Designated Campus Custody'}</strong> ({report.custody_location?.building || 'Main Campus'})
                </p>

                {(isStaff || isOwner) && report.storage_reference ? (
                  <div style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)', border: '1px dashed rgba(6, 182, 212, 0.4)' }}>
                    <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Lock size={12} /> Restricted Storage Reference:
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.95rem', color: '#fff' }}>
                      {report.storage_reference}
                    </span>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Lock size={13} /> Precise locker addresses and compartment codes are restricted to authorized personnel.
                  </div>
                )}
              </div>
            )}

            {/* Contact Info (Owner / Staff view vs Public view) */}
            {report.contact_info_restricted ? (
              <div style={{
                padding: '1rem 1.25rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                marginBottom: '2.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}>
                <Lock size={16} color="#a5b4fc" />
                <div>
                  <div style={{ fontSize: '0.88rem', color: '#fff', fontWeight: 600 }}>Contact Details (Privileged View)</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{report.contact_info_restricted}</div>
                </div>
              </div>
            ) : null}

            {/* Action Controls */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
              {canClaim && (
                <button
                  onClick={() => setShowClaimModal(true)}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <HeartHandshake size={18} /> File Ownership Claim
                </button>
              )}

              {canEdit && (
                <button
                  onClick={() => setShowEditModal(true)}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Edit3 size={15} /> Edit Details
                </button>
              )}

              {canClose && (
                <button
                  onClick={handleCloseReport}
                  disabled={closingReport}
                  className="btn btn-danger btn-sm"
                >
                  {closingReport ? 'Closing...' : 'Close & Archive'}
                </button>
              )}

              {!isAuthenticated && isFound && (
                <Link to="/login" className="btn btn-primary btn-sm">
                  Sign In to Claim This Item
                </Link>
              )}

              {isStaff && (
                <Link to="/staff/dashboard" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Eye size={16} /> Open in Staff Moderation
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Advisory Match Suggestions */}
        {activeTab === 'matches' && (
          <div>
            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(99, 102, 241, 0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
              <h4 style={{ color: '#a5b4fc', fontSize: '0.95rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Sparkles size={16} /> Advisory Matching Engine
              </h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Matches are algorithmic suggestions based on item attributes, dates, and locations. A match is advisory and does not prove ownership or auto-approve claims.
              </p>
            </div>

            {matches.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {matches.map((match: any) => {
                  const otherReportId = isFound ? match.lost_report_id : match.found_report_id;
                  const matchScorePct = Math.round(match.confidence_score * 100);

                  return (
                    <div key={match.match_id} className="card" style={{ padding: '1.25rem', background: 'var(--bg-surface-elevated)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className="badge" style={{ background: matchScorePct > 70 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)', color: matchScorePct > 70 ? '#34d399' : '#fbbf24' }}>
                              {matchScorePct}% Match Confidence
                            </span>
                            <span className="badge badge-status" style={{ fontSize: '0.75rem' }}>
                              {match.status}
                            </span>
                          </div>
                          <div style={{ marginTop: '0.4rem', fontSize: '1rem', color: '#fff', fontWeight: 600 }}>
                            Matched with Report #{otherReportId}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <Link to={`/reports/${otherReportId}`} className="btn btn-outline btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            Inspect Item <ExternalLink size={12} />
                          </Link>

                          {isStaff && match.status === 'suggested' && (
                            <>
                              <button
                                onClick={() => handleReviewMatch(match.match_id, 'confirmed')}
                                className="btn btn-primary btn-sm"
                                style={{ background: '#10b981', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                              >
                                <ThumbsUp size={13} /> Confirm
                              </button>
                              <button
                                onClick={() => handleReviewMatch(match.match_id, 'dismissed')}
                                className="btn btn-danger btn-sm"
                                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                              >
                                <ThumbsDown size={13} /> Dismiss
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Match Reasons */}
                      {match.match_reasons && match.match_reasons.signals && (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          <strong>Matching Signals:</strong>
                          <ul style={{ marginTop: '0.35rem', paddingLeft: '1.25rem' }}>
                            {match.match_reasons.signals.map((sig: string, idx: number) => (
                              <li key={idx}>{sig}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)' }}>
                No active match suggestions detected yet for this report.
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Case History Timeline */}
        {activeTab === 'history' && (
          <div>
            <h3 style={{ fontSize: '1.1rem', color: '#fff', marginBottom: '1rem' }}>Lifecycle &amp; Custody Audit Trail</h3>
            {history.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderLeft: '2px solid var(--border-subtle)', paddingLeft: '1.25rem', marginLeft: '0.5rem' }}>
                {history.map((item: any, idx: number) => (
                  <div key={idx} style={{ position: 'relative' }}>
                    <div style={{
                      position: 'absolute',
                      left: '-1.65rem',
                      top: '4px',
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: 'var(--primary)',
                      border: '2px solid var(--bg-surface)'
                    }} />
                    <div style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 600 }}>
                      Status transitioned to <span className="badge badge-status" style={{ fontSize: '0.72rem' }}>{item.new_lifecycle_status || item.new_moderation_status}</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                      {new Date(item.changed_at).toLocaleString()} {item.changed_by_user_id ? `• User #${item.changed_by_user_id}` : ''}
                    </div>
                    {item.notes && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'var(--bg-surface-elevated)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
                        {item.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                No status changes recorded yet.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Report Modal */}
      {showEditModal && (
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
          <div className="card" style={{ maxWidth: '600px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#fff', marginBottom: '0.5rem' }}>
              Edit Report Details
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
              Update item specifications. Note: Reports cannot be edited once claimed, returned, or closed.
            </p>

            {editError && (
              <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                <AlertCircle size={16} /> {editError}
              </div>
            )}

            <form onSubmit={handleEditSubmit}>
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input
                  type="text"
                  className="form-input"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Category *</label>
                <select
                  className="form-select"
                  value={editCategoryId}
                  onChange={(e) => setEditCategoryId(Number(e.target.value))}
                  required
                >
                  {categories.map((c) => (
                    <option key={c.category_id} value={c.category_id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Approximate Location *</label>
                <input
                  type="text"
                  className="form-input"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Colour</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editColour}
                    onChange={(e) => setEditColour(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Brand</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editBrand}
                    onChange={(e) => setEditBrand(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Description *</label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn btn-outline btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="btn btn-primary btn-sm"
                >
                  {submittingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Claim Submission Modal */}
      {showClaimModal && (
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
              <HeartHandshake size={22} color="var(--primary)" /> Submit Ownership Claim
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
              Case: <strong>{report.case_reference}</strong> ({report.title})
            </p>

            {claimError && (
              <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                <AlertCircle size={16} /> {claimError}
              </div>
            )}

            {claimSuccess ? (
              <div className="alert alert-success">
                <CheckCircle2 size={16} /> Claim successfully submitted! Campus staff will review your evidence.
              </div>
            ) : (
              <form onSubmit={handleClaimSubmit}>
                <div className="form-group">
                  <label className="form-label">
                    Proof of Ownership &amp; Distinguishing Marks *
                  </label>
                  <textarea
                    className="form-textarea"
                    rows={5}
                    placeholder="Describe unique details that prove this belongs to you (e.g., serial number, specific contents, stickers, passcode pattern, purchase receipt details)..."
                    value={ownershipEvidence}
                    onChange={(e) => setOwnershipEvidence(e.target.value)}
                    required
                  />
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    This evidence is strictly confidential and visible only to you and authorized staff reviewers.
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowClaimModal(false)}
                    className="btn btn-outline btn-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingClaim || !ownershipEvidence.trim()}
                    className="btn btn-primary btn-sm"
                  >
                    {submittingClaim ? 'Submitting...' : 'Submit Claim for Review'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
