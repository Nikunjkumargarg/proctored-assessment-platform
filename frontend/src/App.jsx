import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import AssessmentDetailPage from './pages/admin/AssessmentDetailPage';
import SubmissionDetailPage from './pages/admin/SubmissionDetailPage';
import CandidateDashboard from './pages/candidate/CandidateDashboard';
import AttemptPage from './pages/candidate/AttemptPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute role="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/assessments/:id"
            element={
              <ProtectedRoute role="admin">
                <AssessmentDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/attempts/:id"
            element={
              <ProtectedRoute role="admin">
                <SubmissionDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/candidate"
            element={
              <ProtectedRoute role="candidate">
                <CandidateDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/candidate/attempts/:id"
            element={
              <ProtectedRoute role="candidate">
                <AttemptPage />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
