import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-paper text-ink flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-ink" />
        <p className="text-sm font-medium text-muted">Verifying session...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

