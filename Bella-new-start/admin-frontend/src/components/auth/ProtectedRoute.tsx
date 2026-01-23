import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Box, CircularProgress } from '@mui/material';
import paths from 'routes/paths';
import { tokenStorage } from 'services/api';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      const token = tokenStorage.getToken();

      // If no token, redirect to login
      if (!token) {
        navigate(paths.login, { replace: true, state: { from: location.pathname } });
      } else {
        setChecking(false);
      }
    };

    checkAuth();
  }, [navigate, location.pathname]);

  if (checking) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
