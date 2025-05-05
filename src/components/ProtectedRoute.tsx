import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth0();
  
  console.log('ProtectedRoute - Auth State:', {
    isAuthenticated,
    isLoading,
    user,
    path: window.location.pathname
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading…</div>;
  }
  if (!isAuthenticated) {
    console.log('ProtectedRoute - Not authenticated, redirecting to login');
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
} 