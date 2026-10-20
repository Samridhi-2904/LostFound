import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { ProtectedRoute } from './components/layout/ProtectedRoute';

import { HomePage } from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { ReportDetailPage } from './pages/ReportDetailPage';
import { ReportFormPage } from './pages/ReportFormPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { StaffDashboardPage } from './pages/StaffDashboardPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { NotFoundPage } from './pages/NotFoundPage';

/**
 * Redirects authenticated users away from landing/login/register to dashboard.
 * Shows children (public page) only if user is NOT logged in.
 */
const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '40px', height: '40px',
            border: '3px solid rgba(99, 102, 241, 0.2)',
            borderTopColor: 'var(--primary)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }} />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    if (user?.role === 'admin') {
      return <Navigate to="/admin/dashboard" replace />;
    }
    if (user?.role === 'staff') {
      return <Navigate to="/staff/dashboard" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app-container">
          <Navbar />
          <main className="main-content">
            <Routes>
              {/* Public-only routes: redirect to dashboard if already logged in */}
              <Route path="/" element={
                <PublicOnlyRoute>
                  <HomePage />
                </PublicOnlyRoute>
              } />
              <Route path="/login" element={
                <PublicOnlyRoute>
                  <LoginPage />
                </PublicOnlyRoute>
              } />
              <Route path="/register" element={
                <PublicOnlyRoute>
                  <RegisterPage />
                </PublicOnlyRoute>
              } />

              {/* Public Routes (accessible to everyone) */}
              <Route path="/search" element={<SearchPage />} />
              <Route path="/reports/:id" element={<ReportDetailPage />} />

              {/* Protected Member Routes */}
              <Route path="/report/lost" element={<ReportFormPage initialType="lost" />} />
              <Route path="/report/found" element={<ReportFormPage initialType="found" />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/notifications"
                element={
                  <ProtectedRoute>
                    <NotificationsPage />
                  </ProtectedRoute>
                }
              />

              {/* Protected Staff Routes */}
              <Route
                path="/staff/dashboard"
                element={
                  <ProtectedRoute requireStaff>
                    <StaffDashboardPage />
                  </ProtectedRoute>
                }
              />

              {/* Protected Admin Routes */}
              <Route
                path="/admin/dashboard"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminDashboardPage />
                  </ProtectedRoute>
                }
              />

              {/* 404 Catch All */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
