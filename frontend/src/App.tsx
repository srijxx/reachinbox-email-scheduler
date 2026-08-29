import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './hooks/useAuth';
import { DashboardLayout } from './layouts/DashboardLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ScheduledEmailsPage } from './pages/ScheduledEmailsPage';
import { SentEmailsPage } from './pages/SentEmailsPage';
import { ComposePage } from './pages/ComposePage';
import { SearchPage } from './pages/SearchPage';
import { SlackPage } from './pages/SlackPage';
import { PageLoader } from './components/ui/LoadingSpinner';

export default function App() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <PageLoader />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1f2937',
            color: '#f3f4f6',
            border: '1px solid #374151',
            borderRadius: '12px',
            fontSize: '14px',
          },
          success: {
            iconTheme: { primary: '#10b981', secondary: '#1f2937' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#1f2937' },
          },
        }}
      />
      <Routes>
        {/* Public */}
        <Route
          path="/login"
          element={<LoginPage user={user} loading={loading} />}
        />

        {/* Protected */}
        {user ? (
          <Route
            element={<DashboardLayout user={user} onLogout={logout} />}
          >
            <Route path="/dashboard" element={<DashboardPage user={user} />} />
            <Route path="/scheduled" element={<ScheduledEmailsPage />} />
            <Route path="/sent" element={<SentEmailsPage />} />
            <Route path="/compose" element={<ComposePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/slack" element={<SlackPage />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Route>
        ) : (
          <>
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        )}

        {/* Catch all */}
        <Route
          path="*"
          element={<Navigate to={user ? '/dashboard' : '/login'} replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}
