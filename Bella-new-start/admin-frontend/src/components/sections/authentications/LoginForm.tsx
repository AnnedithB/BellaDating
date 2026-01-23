import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import paths from 'routes/paths';
import { authAPI } from 'services/api';
import PasswordTextField from 'components/common/PasswordTextField';

interface LoginFormProps {
  defaultCredential?: { email: string; password: string };
}
const LoginForm = ({ defaultCredential }: LoginFormProps) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState(defaultCredential?.email || '');
  const [password, setPassword] = useState(defaultCredential?.password || '');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await authAPI.login(email, password);
      if (response.token) {
        // Store admin info if needed
        if (response.admin) {
          localStorage.setItem('admin_info', JSON.stringify(response.admin));
        }
        // Redirect to dashboard
        navigate('/', { replace: true });
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack
      direction="column"
      sx={{
        height: 1,
        alignItems: 'center',
        justifyContent: 'space-between',
        pt: { md: 10 },
        pb: 10,
      }}
    >
      <div />

      <Grid
        container
        sx={{
          maxWidth: '35rem',
          rowGap: 4,
          p: { xs: 3, sm: 5 },
          mb: 5,
        }}
      >
        <Grid size={12}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', sm: 'flex-end' },
            }}
          >
            <Typography variant="h4">Log in</Typography>
            <Typography
              variant="subtitle2"
              sx={{
                color: 'text.secondary',
              }}
            >
              Don&apos;t have an account?
              <Link href={paths.signup} sx={{ ml: 1 }}>
                Sign up
              </Link>
            </Typography>
          </Stack>
        </Grid>

        <Grid size={12}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <Box component="form" noValidate onSubmit={handleSubmit}>
            <Grid container>
              <Grid
                sx={{
                  mb: 3,
                }}
                size={12}
              >
                <TextField
                  fullWidth
                  size="large"
                  id="email"
                  type="email"
                  label="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </Grid>
              <Grid
                sx={{
                  mb: 2.5,
                }}
                size={12}
              >
                <PasswordTextField
                  fullWidth
                  size="large"
                  id="password"
                  label="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </Grid>
              <Grid
                sx={{
                  mb: 6,
                }}
                size={12}
              >
                <Stack
                  spacing={1}
                  sx={{
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        name="checked"
                        color="primary"
                        size="small"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                      />
                    }
                    label={
                      <Typography
                        variant="subtitle2"
                        sx={{
                          color: 'text.secondary',
                        }}
                      >
                        Remember this device
                      </Typography>
                    }
                  />

                  <Link href="#!" variant="subtitle2">
                    Forgot Password?
                  </Link>
                </Stack>
              </Grid>
              <Grid size={12}>
                <Button fullWidth type="submit" size="large" variant="contained" disabled={loading}>
                  {loading ? 'Logging in...' : 'Log in'}
                </Button>
              </Grid>
            </Grid>
          </Box>
        </Grid>
      </Grid>
      <Link href="#!" variant="subtitle2">
        Trouble signing in?
      </Link>
    </Stack>
  );
};

export default LoginForm;
