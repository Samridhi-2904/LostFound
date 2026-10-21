import React from 'react';
import { Link } from 'react-router-dom';
import type { ItemReport } from '../../types';
import { MapPin, Calendar, Tag, ShieldCheck, HelpCircle } from 'lucide-react';

interface ReportCardProps {
  report: ItemReport;
}

export const ReportCard: React.FC<ReportCardProps> = ({ report }) => {
  const isFound = report.report_type === 'found';
  const primaryImage = report.images?.find((img) => img.is_primary) || report.images?.[0];

  const formattedDate = new Date(report.date_incident).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Link to={`/reports/${report.report_id}`} className="card card-hover" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Thumbnail or placeholder */}
      <div 
        style={{
          height: '180px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-surface-elevated)',
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1rem',
        }}
      >
        {primaryImage ? (
          <img 
            src={`/api/v1/images/${primaryImage.image_id}`} 
            alt={report.title} 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => {
              // fallback if image fails to load
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <div style={{ color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
            {isFound ? <ShieldCheck size={36} color="#38bdf8" /> : <HelpCircle size={36} color="#fb7185" />}
            <span style={{ fontSize: '0.8rem' }}>No image attached</span>
          </div>
        )}

        <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span className={`badge ${isFound ? 'badge-found' : 'badge-lost'}`}>
            {report.report_type}
          </span>
          <span className={`badge badge-status ${report.lifecycle_status}`}>
            {report.lifecycle_status}
          </span>
          {report.moderation_status && String(report.moderation_status).toLowerCase().includes('pending') && (
            <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.4)' }}>
              Under Review
            </span>
          )}
        </div>

        {report.is_high_value && (
          <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
            <span className="badge" style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
              High Value
            </span>
          </div>
        )}
      </div>

      {/* Card Content */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            {report.case_reference}
          </span>
          {report.category && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--primary)' }}>
              <Tag size={12} /> {report.category.name}
            </span>
          )}
        </div>

        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', lineHeight: 1.3 }}>
          {report.title}
        </h3>

        <p style={{
          fontSize: '0.88rem',
          color: 'var(--text-secondary)',
          marginBottom: '1rem',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {report.description}
        </p>

        {/* Card Footer details */}
        <div style={{ marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <MapPin size={13} color="var(--primary)" />
            <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {report.location_approximate}
            </span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Calendar size={13} /> {formattedDate}
          </span>
        </div>
      </div>
    </Link>
  );
};
