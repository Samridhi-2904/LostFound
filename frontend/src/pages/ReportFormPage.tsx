import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { reportApi, categoryApi, custodyApi } from '../services/api';
import type { Category, CustodyLocation, ReportType } from '../types';
import { useAuth } from '../context/AuthContext';
import { 
  PlusCircle, 
  ShieldCheck, 
  Upload, 
  AlertCircle, 
  CheckCircle2, 
  ArrowLeft,
  Lock
} from 'lucide-react';

interface ReportFormPageProps {
  initialType?: ReportType;
}

export const ReportFormPage: React.FC<ReportFormPageProps> = ({ initialType }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  const isFound = initialType === 'found' || location.pathname.includes('/found');
  const reportType: ReportType = isFound ? 'found' : 'lost';

  const [categories, setCategories] = useState<Category[]>([]);
  const [custodyLocations, setCustodyLocations] = useState<CustodyLocation[]>([]);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [dateIncident, setDateIncident] = useState(() => new Date().toISOString().split('T')[0]);
  const [locationApproximate, setLocationApproximate] = useState('');
  const [primaryColour, setPrimaryColour] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [contactInfoRestricted, setContactInfoRestricted] = useState('');
  const [isHighValue, setIsHighValue] = useState(false);

  // Subtype state
  const [custodyLocationId, setCustodyLocationId] = useState<number | ''>('');
  const [storageReference, setStorageReference] = useState('');
  const [possibleLocations, setPossibleLocations] = useState('');
  const [rewardOffered, setRewardOffered] = useState<number | ''>('');

  // Image upload
  const [imageFile, setImageFile] = useState<File | null>(null);

  // Status state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [cats, locs] = await Promise.all([
          categoryApi.getCategories(),
          isFound ? custodyApi.getPublicLocations() : Promise.resolve([]),
        ]);
        setCategories(cats);
        if (cats.length > 0) setCategoryId(cats[0].category_id);
        if (locs.length > 0) {
          setCustodyLocations(locs);
          const defaultLocId = locs[0].custody_location_id ?? locs[0].location_id;
          if (defaultLocId) setCustodyLocationId(defaultLocId);
        }
      } catch (err) {
        console.error('Failed to load form options', err);
      }
    }
    loadInitialData();
  }, [isFound]);

  if (!isAuthenticated) {
    return (
      <div className="card" style={{ maxWidth: '520px', margin: '3rem auto', textAlign: 'center', padding: '3rem' }}>
        <Lock size={40} color="var(--primary)" style={{ margin: '0 auto 1rem' }} />
        <h2 style={{ color: 'var(--text-primary)', fontSize: '1.5rem', marginBottom: '0.5rem' }}>Authentication Required</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Please sign in to submit a {reportType} item report. This ensures you can track status updates and receive match notifications.
        </p>
        <Link to="/login" className="btn btn-primary btn-sm">
          Sign In Now
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !categoryId || !locationApproximate) {
      setError('Please complete all required fields.');
      return;
    }

    if (isFound && !custodyLocationId) {
      setError('Please select the campus custody location where the found item is held.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: any = {
        item_name: title,
        title,
        description,
        report_type: reportType,
        category_id: Number(categoryId),
        date_lost_found: new Date(dateIncident).toISOString(),
        date_incident: new Date(dateIncident).toISOString(),
        location: locationApproximate,
        location_approximate: locationApproximate,
        colour: primaryColour || undefined,
        primary_colour: primaryColour || undefined,
        brand: brand || undefined,
        model: model || undefined,
        distinguishing_marks: model ? `Model: ${model}` : undefined,
        contact_preference: 'in_app',
        contact_info_restricted: contactInfoRestricted || undefined,
      };

      if (isFound) {
        payload.found_location = locationApproximate;
        if (custodyLocationId) {
          payload.custody_location_id = Number(custodyLocationId);
        }
        if (storageReference) {
          payload.storage_reference = storageReference;
        }
      } else {
        if (possibleLocations) {
          payload.last_seen_location = possibleLocations;
          payload.possible_locations = possibleLocations;
        }
        if (rewardOffered !== '' && rewardOffered !== undefined && rewardOffered !== null) {
          payload.reward_offered = `$${rewardOffered}`;
        }
      }

      const createdReport = await reportApi.createReport(payload);

      // If image file selected, upload it
      if (imageFile) {
        try {
          await reportApi.uploadImage(createdReport.report_id, imageFile, true);
        } catch (imgErr: any) {
          console.warn('Image upload error:', imgErr);
        }
      }

      setSuccess(`Report successfully created! Case Reference: ${createdReport.case_reference}`);
      setTimeout(() => {
        navigate(`/reports/${createdReport.report_id}`);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to submit report.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '780px', margin: '0 auto' }}>
      <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        <ArrowLeft size={16} /> Return to Home
      </Link>

      <div className="card" style={{ padding: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <span className="navbar-logo-badge" style={{ background: isFound ? 'rgba(6, 182, 212, 0.2)' : 'rgba(244, 63, 94, 0.2)', color: isFound ? '#38bdf8' : '#fb7185' }}>
            {isFound ? <ShieldCheck size={22} /> : <PlusCircle size={22} />}
          </span>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            {isFound ? 'Report Found Property' : 'Report a Lost Item'}
          </h1>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginBottom: '2rem' }}>
          {isFound 
            ? 'Record details of an item you found and deposited in campus custody. Restricted storage details are shielded from public view.'
            : 'Provide descriptive details of your lost belonging. Our matching engine will compare it against incoming found property.'}
        </p>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
            <AlertCircle size={18} /> <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert alert-success" style={{ marginBottom: '1.5rem' }}>
            <CheckCircle2 size={18} /> <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Item Basic Information */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Item Title *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Blue Dell XPS 15 Laptop with university sticker"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Category *</label>
              <select
                className="form-select"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}
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
              <label className="form-label">Date {isFound ? 'Found' : 'Lost'} *</label>
              <input
                type="date"
                className="form-input"
                value={dateIncident}
                onChange={(e) => setDateIncident(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Approximate Location *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Science Library, 2nd floor study carrels"
                value={locationApproximate}
                onChange={(e) => setLocationApproximate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Primary Colour</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Midnight Blue, Silver, Black"
                value={primaryColour}
                onChange={(e) => setPrimaryColour(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Brand / Manufacturer</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Apple, Sony, Herschel"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Model / Serial Hint</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. A2338 / WH-1000XM4"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Valuation Classification</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={isHighValue}
                  onChange={(e) => setIsHighValue(e.target.checked)}
                />
                Mark as high-value item (&gt;$100, jewelry, electronics)
              </label>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '0.5rem' }}>
            <label className="form-label">Detailed Description *</label>
            <textarea
              className="form-textarea"
              rows={4}
              placeholder="Describe condition, unique markings, wear, stickers, or case characteristics..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          {/* Subtype specific sections */}
          {isFound ? (
            <div style={{
              marginTop: '1.5rem',
              padding: '1.25rem',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(6, 182, 212, 0.08)',
              border: '1px solid rgba(6, 182, 212, 0.25)',
            }}>
              <h4 style={{ color: '#38bdf8', fontSize: '1rem', marginBottom: '0.75rem', fontWeight: 600 }}>
                Campus Custody &amp; Storage Details
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Custody Location *</label>
                  <select
                    className="form-select"
                    value={custodyLocationId}
                    onChange={(e) => setCustodyLocationId(e.target.value ? Number(e.target.value) : '')}
                    required
                  >
                    {custodyLocations.map((loc) => (
                      <option key={loc.location_id} value={loc.location_id}>
                        {loc.facility_name} ({loc.building})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Internal Locker Reference (Private)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Locker B-14, Bin #3"
                    value={storageReference}
                    onChange={(e) => setStorageReference(e.target.value)}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              marginTop: '1.5rem',
              padding: '1.25rem',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(244, 63, 94, 0.08)',
              border: '1px solid rgba(244, 63, 94, 0.25)',
            }}>
              <h4 style={{ color: '#fb7185', fontSize: '1rem', marginBottom: '0.75rem', fontWeight: 600 }}>
                Lost Item Additional Details
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Other Possible Locations Traveled</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Shuttle bus, Dining hall, Gym"
                    value={possibleLocations}
                    onChange={(e) => setPossibleLocations(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Optional Reward Offered ($)</label>
                  <input
                    type="number"
                    min={0}
                    className="form-input"
                    placeholder="e.g. 25"
                    value={rewardOffered}
                    onChange={(e) => setRewardOffered(e.target.value ? Number(e.target.value) : '')}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Privacy Restricted Contact Information */}
          <div className="form-group" style={{ marginTop: '1.5rem' }}>
            <label className="form-label">Confidential Contact Info (Private to Staff &amp; You)</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Personal cell +1 (555) 234-5678, Alternate email"
              value={contactInfoRestricted}
              onChange={(e) => setContactInfoRestricted(e.target.value)}
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              This will never be publicly visible in search results or unauthenticated directory listings.
            </span>
          </div>

          {/* Image Upload */}
          <div className="form-group" style={{ marginTop: '1.5rem' }}>
            <label className="form-label">Upload Item Photo (JPEG, PNG, or WebP &le; 5 MB)</label>
            <div style={{
              border: '2px dashed var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1.5rem',
              textAlign: 'center',
              background: 'var(--bg-surface-elevated)',
            }}>
              <Upload size={24} color="var(--primary)" style={{ margin: '0 auto 0.5rem' }} />
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setImageFile(e.target.files[0]);
                  }
                }}
                style={{ display: 'none' }}
                id="file-upload-input"
              />
              <label htmlFor="file-upload-input" className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', margin: '0.5rem 0' }}>
                {imageFile ? imageFile.name : 'Choose Image File'}
              </label>
              {imageFile && (
                <div style={{ fontSize: '0.8rem', color: 'var(--accent-emerald)', marginTop: '0.25rem' }}>
                  Selected: {imageFile.name} ({(imageFile.size / 1024 / 1024).toFixed(2)} MB)
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="btn btn-outline"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ minWidth: '160px' }}
            >
              {loading ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
