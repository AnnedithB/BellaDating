import { Box, Container, Typography } from '@mui/material';

const CookiePolicy = () => {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#fafafa', py: 8 }}>
      <Container maxWidth="md">
        <Typography variant="h3" sx={{ fontWeight: 800, mb: 4, fontFamily: 'Plus Jakarta Sans' }}>
          Cookie Policy
        </Typography>

        <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.8 }}>
          Last updated: January 2026
        </Typography>

        <Typography variant="h5" sx={{ fontWeight: 700, mt: 4, mb: 2 }}>
          1. What Are Cookies
        </Typography>
        <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.8 }}>
          Cookies are small text files that are stored on your device when you visit our website.
          They help us provide you with a better experience.
        </Typography>

        <Typography variant="h5" sx={{ fontWeight: 700, mt: 4, mb: 2 }}>
          2. How We Use Cookies
        </Typography>
        <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.8 }}>
          We use cookies to understand how you use our services, remember your preferences, and
          improve your experience.
        </Typography>

        <Typography variant="h5" sx={{ fontWeight: 700, mt: 4, mb: 2 }}>
          3. Types of Cookies
        </Typography>
        <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.8 }}>
          Essential cookies: Required for basic functionality. Analytics cookies: Help us understand
          usage patterns. Preference cookies: Remember your settings.
        </Typography>

        <Typography variant="h5" sx={{ fontWeight: 700, mt: 4, mb: 2 }}>
          4. Managing Cookies
        </Typography>
        <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.8 }}>
          You can control cookies through your browser settings. Note that disabling cookies may
          affect the functionality of our services.
        </Typography>

        <Typography variant="h5" sx={{ fontWeight: 700, mt: 4, mb: 2 }}>
          5. Contact Us
        </Typography>
        <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.8 }}>
          If you have any questions about our Cookie Policy, please contact us at privacy@belle.app
        </Typography>
      </Container>
    </Box>
  );
};

export default CookiePolicy;
