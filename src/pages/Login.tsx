import { useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { Navigate } from 'react-router-dom';

export default function Login() {
  const { loginWithRedirect, isAuthenticated, user, isLoading } = useAuth0();
  
  console.log('Login - Auth State:', {
    isAuthenticated,
    isLoading,
    user,
    path: window.location.pathname
  });
  
  useEffect(() => {
    if (!isAuthenticated) {
      console.log('Login - Not authenticated, redirecting to Auth0');
      loginWithRedirect();
    }
  }, [isAuthenticated, loginWithRedirect]);

  if (isAuthenticated) {
    console.log('Login - Already authenticated, redirecting to home');
    return <Navigate to="/" replace />;
  }

  return <div className="flex items-center justify-center h-screen">Redirecting to login…</div>;
} 