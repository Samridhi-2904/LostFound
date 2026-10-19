import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { reportApi, categoryApi } from '../services/api';
import type { ItemReport, Category } from '../types';
import { ReportCard } from '../components/reports/ReportCard';
import { 
  Search, 
  PlusCircle, 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles,
  Layers,
  HeartHandshake,
  Lock,
  Building2,
  Clock
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const [recentReports, setRecentReports] = useState<ItemReport[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const [reportsRes, catRes] = await Promise.all([
          reportApi.searchReports({ page: 1, page_size: 6 }),
          categoryApi.getCategories(),
        ]);
        setRecentReports(reportsRes.items);
        setCategories(catRes);
      } catch (err) {
        console.error('Failed to load home page data', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div>
      {/* Hero Section */}
      <section style={{ textAlign: 'center', padding: '3rem 1rem 3.5rem', position: 'relative' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.4rem 1rem',
          borderRadius: 'var(--radius-full)',
          background: 'var(--primary-light)',
          border: '1px solid #bfdbfe',
          color: 'var(--primary)',
          fontSize: '0.85rem',
          fontWeight: 600,
          marginBottom: '1.25rem',
        }}>
          <Sparkles size={14} /> Official Campus Lost &amp; Found Portal
        </div>

        <h1 style={{
          fontSize: 'clamp(2.1rem, 4.5vw, 3.4rem)',
          fontWeight: 800,
          lineHeight: 1.2,
          letterSpacing: '-0.025em',
          maxWidth: '850px',
          margin: '0 auto 1.25rem',
          color: 'var(--text-primary)',
        }}>
          Reuniting Misplaced Property With Its Rightful Owner.
        </h1>

        <p style={{
          fontSize: '1.1rem',
          color: 'var(--text-secondary)',
          maxWidth: '680px',
          margin: '0 auto 2.5rem',
          lineHeight: 1.6,
        }}>
          Report lost items immediately, turn in found property at official custody lockers, and safely reclaim items with verified proof of ownership.
        </p>

        {/* Quick Search Bar */}
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            window.location.href = `/search?q=${encodeURIComponent(searchQuery)}`;
          }}
          style={{
            maxWidth: '620px',
            margin: '0 auto 2.5rem',
            display: 'flex',
            gap: '0.5rem',
            background: '#ffffff',
            padding: '0.45rem',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '0.85rem', color: 'var(--text-muted)' }}>
            <Search size={20} />
          </div>
          <input
            type="text"
            className="form-input"
            placeholder="Search by keyword (e.g., MacBook, Blue Backpack, Student ID)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              boxShadow: 'none',
              padding: '0.75rem 0.5rem',
              color: 'var(--text-primary)',
            }}
          />
          <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 1.6rem' }}>
            Search Items
          </button>
        </form>

        {/* Quick Action Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.5rem',
          maxWidth: '980px',
          margin: '0 auto',
          textAlign: 'left',
        }}>
          {/* Lost Property */}
          <Link to="/report/lost" className="card card-hover" style={{ borderTop: '4px solid #ef4444' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-md)',
                background: '#fee2e2',
                color: '#b91c1c',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <PlusCircle size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: 700 }}>Lost Something?</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>File an official lost report</span>
              </div>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Submit item description, date, and last seen location. The system will alert you when matching property is handed in.
            </p>
            <span style={{ color: '#b91c1c', fontSize: '0.88rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              Report Lost Property <ArrowRight size={15} />
            </span>
          </Link>

          {/* Found Property */}
          <Link to="/report/found" className="card card-hover" style={{ borderTop: '4px solid #059669' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-md)',
                background: '#d1fae5',
                color: '#047857',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <ShieldCheck size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: 700 }}>Found Property?</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Turn in at campus custody</span>
              </div>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Deposit found items into official security lockers or info desks. Precise locker PINs remain restricted to staff.
            </p>
            <span style={{ color: '#047857', fontSize: '0.88rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              Turn In Found Item <ArrowRight size={15} />
            </span>
          </Link>

          {/* Browse Directory */}
          <Link to="/search" className="card card-hover" style={{ borderTop: '4px solid #2563eb' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-md)',
                background: '#eff6ff',
                color: '#1d4ed8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Layers size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: 700 }}>Browse Public Feed</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Search verified listings</span>
              </div>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Filter through verified reports across categories, colors, dates, and locations with live status indicators.
            </p>
            <span style={{ color: '#1d4ed8', fontSize: '0.88rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              Explore Directory <ArrowRight size={15} />
            </span>
          </Link>
        </div>
      </section>

      {/* Campus Trust & Metrics Strip */}
      <section style={{
        background: '#ffffff',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.5rem 2rem',
        marginBottom: '3.5rem',
        boxShadow: 'var(--shadow-sm)',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '2rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: '#eff6ff', color: '#1d4ed8' }}>
            <ShieldCheck size={26} />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>100% Verified</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Human Staff Handover Sign-off</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: '#ecfdf5', color: '#047857' }}>
            <Building2 size={26} />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>Custody Vaults</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Secured Campus Lockers</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: '#fffbeb', color: '#b45309' }}>
            <Lock size={26} />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>Confidential</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Masked Finder Contact Details</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: '#f5f3ff', color: '#6d28d9' }}>
            <Clock size={26} />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>30-Day Policy</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Standard Campus Retention</div>
          </div>
        </div>
      </section>

      {/* Category Pills */}
      {categories.length > 0 && (
        <section style={{ marginBottom: '3.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>Browse By Category</h2>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>Find items categorized by campus property types</p>
            </div>
            <Link to="/search" style={{ fontSize: '0.88rem', color: 'var(--primary)', fontWeight: 600 }}>
              View All Categories &rarr;
            </Link>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            {categories.map((cat) => (
              <Link
                key={cat.category_id}
                to={`/search?category_id=${cat.category_id}`}
                className="btn btn-secondary btn-sm"
                style={{ borderRadius: 'var(--radius-full)', padding: '0.55rem 1.25rem', fontWeight: 500 }}
              >
                {cat.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recent Items Section */}
      <section style={{ marginBottom: '4rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-primary)' }}>Recently Verified Items</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Latest lost and found property authenticated by campus desk officers.
            </p>
          </div>
          <Link to="/search" className="btn btn-outline btn-sm">
            View Complete Directory
          </Link>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            Loading verified listings...
          </div>
        ) : recentReports.length > 0 ? (
          <div className="grid-cards">
            {recentReports.map((report) => (
              <ReportCard key={report.report_id} report={report} />
            ))}
          </div>
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              No verified reports in the system yet.
            </p>
            <Link to="/report/lost" className="btn btn-primary btn-sm">
              Submit the First Report
            </Link>
          </div>
        )}
      </section>

      {/* 4-Step How It Works Guide */}
      <section style={{ marginBottom: '4rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            How Campus Lost &amp; Found Works
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '580px', margin: '0 auto' }}>
            A transparent 4-stage chain of custody ensuring items are safely stored and returned only to proven owners.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1.5rem',
        }}>
          <div className="card" style={{ textAlign: 'center', padding: '2rem 1.5rem' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              background: '#eff6ff',
              color: '#1d4ed8',
              fontWeight: 800,
              fontSize: '1.1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.2rem',
            }}>
              1
            </div>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              Submit Report
            </h4>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Register your misplaced item or log property found across campus facilities.
            </p>
          </div>

          <div className="card" style={{ textAlign: 'center', padding: '2rem 1.5rem' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              background: '#f5f3ff',
              color: '#6d28d9',
              fontWeight: 800,
              fontSize: '1.1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.2rem',
            }}>
              2
            </div>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              Advisory Match
            </h4>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              The multi-signal matching engine flags candidate items for mutual review.
            </p>
          </div>

          <div className="card" style={{ textAlign: 'center', padding: '2rem 1.5rem' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              background: '#fffbeb',
              color: '#b45309',
              fontWeight: 800,
              fontSize: '1.1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.2rem',
            }}>
              3
            </div>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              Claim &amp; Proof
            </h4>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Submit private ownership evidence. Authorized staff evaluate and approve the claim.
            </p>
          </div>

          <div className="card" style={{ textAlign: 'center', padding: '2rem 1.5rem' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              background: '#ecfdf5',
              color: '#047857',
              fontWeight: 800,
              fontSize: '1.1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.2rem',
            }}>
              4
            </div>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              Verified Handover
            </h4>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Present student ID at the custody desk to sign for and retrieve your belongings.
            </p>
          </div>
        </div>
      </section>

      {/* Safety & Policy Banner */}
      <section className="card" style={{
        background: '#f8fafc',
        border: '1px solid var(--border-subtle)',
        padding: '2.5rem',
        marginBottom: '2rem',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '2rem' }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span style={{ color: '#059669', flexShrink: 0 }}>
              <CheckCircle2 size={24} />
            </span>
            <div>
              <h4 style={{ color: 'var(--text-primary)', fontSize: '1.05rem', marginBottom: '0.35rem', fontWeight: 700 }}>
                Privacy-Protected Records
              </h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Finder contact info and restricted locker PINs are shielded from public view to protect student privacy and custody security.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <span style={{ color: '#1d4ed8', flexShrink: 0 }}>
              <HeartHandshake size={24} />
            </span>
            <div>
              <h4 style={{ color: 'var(--text-primary)', fontSize: '1.05rem', marginBottom: '0.35rem', fontWeight: 700 }}>
                Official Handover Sign-Off
              </h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                An item transitions to "Returned" only after an approved claim and an in-person physical handover record verified by staff.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <span style={{ color: '#d97706', flexShrink: 0 }}>
              <Sparkles size={24} />
            </span>
            <div>
              <h4 style={{ color: 'var(--text-primary)', fontSize: '1.05rem', marginBottom: '0.35rem', fontWeight: 700 }}>
                Advisory Matching Engine
              </h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Automated similarity scoring assists human review, ensuring every match is carefully vetted before handover.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
