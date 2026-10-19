import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { reportApi, categoryApi } from '../services/api';
import type { ItemReport, Category, ReportType, LifecycleStatus } from '../types';
import { ReportCard } from '../components/reports/ReportCard';
import { 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  SlidersHorizontal, 
  RefreshCw 
} from 'lucide-react';

export const SearchPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [reports, setReports] = useState<ItemReport[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state initialized from URL query params
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [reportType, setReportType] = useState<string>(searchParams.get('report_type') || '');
  const [categoryId, setCategoryId] = useState<string>(searchParams.get('category_id') || '');
  const [lifecycleStatus, setLifecycleStatus] = useState<string>(searchParams.get('lifecycle_status') || '');
  const [colour, setColour] = useState(searchParams.get('primary_colour') || '');
  const [location, setLocation] = useState(searchParams.get('location') || '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('date_from') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('date_to') || '');
  const [page, setPage] = useState<number>(parseInt(searchParams.get('page') || '1', 10));

  const [showFiltersMobile, setShowFiltersMobile] = useState(false);

  // Load active categories
  useEffect(() => {
    async function fetchCats() {
      try {
        const cats = await categoryApi.getCategories();
        setCategories(cats);
      } catch (e) {
        console.error('Failed to load categories', e);
      }
    }
    fetchCats();
  }, []);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await reportApi.searchReports({
        q: q || undefined,
        report_type: (reportType as ReportType) || undefined,
        category_id: categoryId ? parseInt(categoryId, 10) : undefined,
        lifecycle_status: (lifecycleStatus as LifecycleStatus) || undefined,
        primary_colour: colour || undefined,
        location: location || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        page,
        page_size: 9,
      });

      setReports(res.items);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err: any) {
      setError(err.message || 'Failed to search reports');
    } finally {
      setLoading(false);
    }
  }, [q, reportType, categoryId, lifecycleStatus, colour, location, dateFrom, dateTo, page]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Sync state into URL params
  const handleApplyFilters = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (reportType) params.set('report_type', reportType);
    if (categoryId) params.set('category_id', categoryId);
    if (lifecycleStatus) params.set('lifecycle_status', lifecycleStatus);
    if (colour) params.set('primary_colour', colour);
    if (location) params.set('location', location);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);
    params.set('page', '1');
    setPage(1);
    setSearchParams(params);
  };

  const handleResetFilters = () => {
    setQ('');
    setReportType('');
    setCategoryId('');
    setLifecycleStatus('');
    setColour('');
    setLocation('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
    setSearchParams({});
  };

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800, color: '#fff', marginBottom: '0.5rem' }}>
          Browse &amp; Search Reports
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Explore all verified items reported lost or found across campus facilities.
        </p>
      </div>

      {/* Main Search Bar */}
      <form onSubmit={handleApplyFilters} style={{ marginBottom: '2rem' }}>
        <div style={{
          display: 'flex',
          gap: '0.75rem',
          background: 'var(--bg-surface-elevated)',
          padding: '0.5rem',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '0.75rem', color: 'var(--text-muted)' }}>
            <Search size={20} />
          </div>
          <input
            type="text"
            className="form-input"
            placeholder="Search keywords, item title, brand, description..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}
          />
          <button type="submit" className="btn btn-primary" style={{ padding: '0.65rem 1.5rem' }}>
            Search
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowFiltersMobile(!showFiltersMobile)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <SlidersHorizontal size={16} />
            Filters
          </button>
        </div>
      </form>

      {/* Filter Panels */}
      <div style={{
        display: showFiltersMobile ? 'block' : 'none',
        marginBottom: '2rem',
        padding: '1.5rem',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--bg-surface-card)',
        border: '1px solid var(--border-subtle)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1.05rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={18} color="var(--primary)" /> Refine Filter Criteria
          </h3>
          <button 
            type="button" 
            onClick={handleResetFilters} 
            className="btn btn-outline btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <RefreshCw size={13} /> Reset All
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Report Type</label>
            <select className="form-select" value={reportType} onChange={(e) => setReportType(e.target.value)}>
              <option value="">All Types (Lost &amp; Found)</option>
              <option value="lost">Lost Reports</option>
              <option value="found">Found Reports</option>
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Category</label>
            <select className="form-select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.category_id} value={c.category_id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Lifecycle Status</label>
            <select className="form-select" value={lifecycleStatus} onChange={(e) => setLifecycleStatus(e.target.value)}>
              <option value="">All Active Statuses</option>
              <option value="open">Open</option>
              <option value="matched">Matched</option>
              <option value="claimed">Claimed</option>
              <option value="returned">Returned</option>
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Primary Colour</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. Black, Silver, Navy" 
              value={colour} 
              onChange={(e) => setColour(e.target.value)} 
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Approximate Location</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. Science Library, Student Union" 
              value={location} 
              onChange={(e) => setLocation(e.target.value)} 
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Date From</label>
            <input 
              type="date" 
              className="form-input" 
              value={dateFrom} 
              onChange={(e) => setDateFrom(e.target.value)} 
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Date To</label>
            <input 
              type="date" 
              className="form-input" 
              value={dateTo} 
              onChange={(e) => setDateTo(e.target.value)} 
            />
          </div>
        </div>

        <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button type="button" onClick={() => setShowFiltersMobile(false)} className="btn btn-outline btn-sm">
            Close Filters
          </button>
          <button type="button" onClick={handleApplyFilters} className="btn btn-primary btn-sm">
            Apply Filters
          </button>
        </div>
      </div>

      {/* Results Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.92rem', color: 'var(--text-secondary)' }}>
          Showing <strong>{reports.length}</strong> of <strong>{total}</strong> verified items
        </div>

        {/* Quick Type Filter Pills */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={`btn btn-sm ${reportType === '' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setReportType(''); setPage(1); }}
          >
            All
          </button>
          <button
            className={`btn btn-sm ${reportType === 'lost' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setReportType('lost'); setPage(1); }}
          >
            Lost Only
          </button>
          <button
            className={`btn btn-sm ${reportType === 'found' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setReportType('found'); setPage(1); }}
          >
            Found Only
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      {/* Results Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
          <p>Searching verified database...</p>
        </div>
      ) : reports.length > 0 ? (
        <div className="grid-cards">
          {reports.map((report) => (
            <ReportCard key={report.report_id} report={report} />
          ))}
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 1.5rem' }}>
          <h3 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '0.5rem' }}>No Reports Match Your Search</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto 1.5rem' }}>
            Try broadening your search keywords, adjusting date ranges, or removing specific color/location filters.
          </p>
          <button onClick={handleResetFilters} className="btn btn-secondary btn-sm">
            Clear All Filters
          </button>
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{ marginTop: '3rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem' }}>
          <button
            className="btn btn-secondary btn-sm"
            disabled={page <= 1}
            onClick={() => {
              setPage((p) => Math.max(1, p - 1));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            style={{ opacity: page <= 1 ? 0.5 : 1, cursor: page <= 1 ? 'not-allowed' : 'pointer' }}
          >
            <ChevronLeft size={16} /> Previous
          </button>

          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Page {page} of {totalPages}
          </span>

          <button
            className="btn btn-secondary btn-sm"
            disabled={page >= totalPages}
            onClick={() => {
              setPage((p) => Math.min(totalPages, p + 1));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            style={{ opacity: page >= totalPages ? 0.5 : 1, cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
};
