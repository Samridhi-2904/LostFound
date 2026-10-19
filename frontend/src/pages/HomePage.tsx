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
  HeartHandshake
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
      <section style={{ textAlign: 'center', padding: '3.5rem 1rem 4rem', position: 'relative' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.4rem 1rem',
          borderRadius: 'var(--radius-full)',
          background: 'rgba(99, 102, 241, 0.12)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          color: '#a5b4fc',
          fontSize: '0.85rem',
          fontWeight: 600,
          marginBottom: '1.5rem',
        }}>
          <Sparkles size={14} /> Official Campus Lost &amp; Found System
        </div>

        <h1 style={{
          fontSize: 'clamp(2.2rem, 5vw, 3.8rem)',
          fontWeight: 800,
          lineHeight: 1.15,
          letterSpacing: '-0.03em',
          maxWidth: '850px',
          margin: '0 auto 1.5rem',
          background: 'linear-gradient(135deg, #ffffff 0%, #cbd5e1 50%, #94a3b8 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          Reuniting Misplaced Property With Its Rightful Owner.
        </h1>

        <p style={{
          fontSize: '1.15rem',
          color: 'var(--text-secondary)',
          maxWidth: '640px',
          margin: '0 auto 2.5rem',
          lineHeight: 1.6,
        }}>
          Report lost items immediately, record found valuables securely, and track items with verifiable custody and human-reviewed handover confirmations.
        </p>

        {/* Quick Search Bar */}
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            window.location.href = `/search?q=${encodeURIComponent(searchQuery)}`;
          }}
          style={{
            maxWidth: '600px',
            margin: '0 auto 3rem',
            display: 'flex',
            gap: '0.5rem',
            background: 'var(--bg-surface-elevated)',
            padding: '0.4rem',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-lg), 0 0 30px -10px var(--primary-glow)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '1rem', color: 'var(--text-muted)' }}>
            <Search size={20} />
          </div>
          <input
            type="text"
            className="form-input"
            placeholder="Search by keyword (e.g., blue backpack, MacBook, student ID)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              boxShadow: 'none',
              padding: '0.75rem 0.5rem',
            }}
          />
          <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 1.5rem' }}>
            Search
          </button>
        </form>

        {/* Action Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.5rem',
          maxWidth: '960px',
          margin: '0 auto',
          textAlign: 'left',
        }}>
          <Link to="/report/lost" className="card card-hover" style={{ borderLeft: '4px solid #fb7185' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <span className="navbar-logo-badge" style={{ background: 'rgba(244, 63, 94, 0.2)', color: '#fb7185' }}>
                <PlusCircle size={20} />
              </span>
              <h3 style={{ fontSize: '1.2rem', color: '#fff', fontWeight: 700 }}>Lost Something?</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.2rem' }}>
              Submit a detailed report with approximate location, date, and description. Our system scans new entries to detect potential matches.
            </p>
            <span style={{ color: '#fb7185', fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              Create Lost Report <ArrowRight size={15} />
            </span>
          </Link>

          <Link to="/report/found" className="card card-hover" style={{ borderLeft: '4px solid #38bdf8' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <span className="navbar-logo-badge" style={{ background: 'rgba(6, 182, 212, 0.2)', color: '#38bdf8' }}>
                <ShieldCheck size={20} />
              </span>
              <h3 style={{ fontSize: '1.2rem', color: '#fff', fontWeight: 700 }}>Found Property?</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.2rem' }}>
              Log found items to deposit them at official campus custody. Locker references remain restricted to protect privacy and property.
            </p>
            <span style={{ color: '#38bdf8', fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              Turn In Found Item <ArrowRight size={15} />
            </span>
          </Link>

          <Link to="/search" className="card card-hover" style={{ borderLeft: '4px solid #a855f7' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <span className="navbar-logo-badge" style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc' }}>
                <Layers size={20} />
              </span>
              <h3 style={{ fontSize: '1.2rem', color: '#fff', fontWeight: 700 }}>Browse Public Feed</h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.2rem' }}>
              Filter through verified reports across campus locations, categories, colors, and date ranges with real-time status tracking.
            </p>
            <span style={{ color: '#c084fc', fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              Explore All Items <ArrowRight size={15} />
            </span>
          </Link>
        </div>
      </section>

      {/* Category Pills */}
      {categories.length > 0 && (
        <section style={{ marginBottom: '3.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#fff' }}>Browse By Category</h2>
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
                style={{ borderRadius: 'var(--radius-full)', padding: '0.5rem 1.1rem' }}
              >
                {cat.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recent Items Section */}
      <section style={{ marginBottom: '4rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>Recently Reported Items</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Verified active listings from across campus.
            </p>
          </div>
          <Link to="/search" className="btn btn-outline btn-sm">
            View Complete Directory
          </Link>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
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

      {/* Trust & Safety Invariants Banner */}
      <section className="card" style={{
        background: 'linear-gradient(135deg, rgba(22, 28, 45, 0.9) 0%, rgba(30, 27, 75, 0.6) 100%)',
        border: '1px solid rgba(99, 102, 241, 0.25)',
        padding: '2.5rem',
        marginBottom: '2rem',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '2rem' }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span style={{ color: '#10b981', flexShrink: 0 }}>
              <CheckCircle2 size={24} />
            </span>
            <div>
              <h4 style={{ color: '#fff', fontSize: '1.05rem', marginBottom: '0.35rem', fontWeight: 600 }}>
                Privacy-Protected Details
              </h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Finder contact info and restricted locker addresses are shielded from public view to ensure student safety.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <span style={{ color: '#6366f1', flexShrink: 0 }}>
              <HeartHandshake size={24} />
            </span>
            <div>
              <h4 style={{ color: '#fff', fontSize: '1.05rem', marginBottom: '0.35rem', fontWeight: 600 }}>
                Verified Claims Only
              </h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Ownership evidence is confidential. Handover is recorded and signed off by authorized campus staff.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <span style={{ color: '#f59e0b', flexShrink: 0 }}>
              <Sparkles size={24} />
            </span>
            <div>
              <h4 style={{ color: '#fff', fontSize: '1.05rem', marginBottom: '0.35rem', fontWeight: 600 }}>
                Advisory Match Assistant
              </h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Automated similarity scoring assists human staff in connecting potential owners with logged found property.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
