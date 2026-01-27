import { setAuthToken } from 'config/api';

import { useState } from 'react';

import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { Icon } from '@iconify/react';

interface SignInModalProps {
  open: boolean;
  onClose: () => void;
  onSignIn: () => void;
}

const SignInModal = ({ open, onClose, onSignIn }: SignInModalProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Demo: Simulate sign in
    setTimeout(() => {
      // For demo, just set a mock token
      setAuthToken('demo-token-12345', true);
      setLoading(false);
      onSignIn();
      onClose();
      setEmail('');
      setPassword('');
    }, 500);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <Box sx={{ position: 'relative' }}>
        <IconButton
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            zIndex: 1,
          }}
        >
          <Icon icon="mdi:close" />
        </IconButton>
        <DialogTitle>
          <Typography variant="h5" fontWeight={700}>
            Sign in to your account
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={1}>
            Enter your credentials to access your billing information
          </Typography>
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Stack spacing={3}>
              <TextField
                label="Email address"
                type="email"
                fullWidth
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
              <TextField
                label="Password"
                type="password"
                fullWidth
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
              />
              <Box display="flex" justifyContent="flex-end">
                <Button variant="text" size="small" sx={{ textTransform: 'none' }}>
                  Forgot password?
                </Button>
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={onClose} variant="outlined" fullWidth>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading || !email || !password}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </DialogActions>
        </form>
        <Divider sx={{ mx: 3 }} />
        <Box sx={{ px: 3, py: 2 }}>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Demo mode: Use any email and password to sign in
          </Typography>
        </Box>
      </Box>
    </Dialog>
  );
};

export default SignInModal;
