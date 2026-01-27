import { Box, Container, Typography } from '@mui/material';

const Privacy = () => {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#fafafa', py: 8 }}>
      <Container maxWidth="md">
        <Typography variant="h3" sx={{ fontWeight: 800, mb: 4, fontFamily: 'Plus Jakarta Sans' }}>
          Privacy Policy
        </Typography>

        <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.8 }}>
          Last updated: January 2026
        </Typography>

        <Typography variant="h5" sx={{ fontWeight: 700, mt: 4, mb: 2 }}>
          1. Information We Collect
        </Typography>
        <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.8 }}>
          We collect information you provide directly to us, such as when you create an account,
          update your profile, use interactive features, or contact us for support.
        </Typography>

        <Typography variant="h5" sx={{ fontWeight: 700, mt: 4, mb: 2 }}>
          2. How We Use Your Information
        </Typography>
        <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.8 }}>
          We use the information we collect to provide, maintain, and improve our services, to
          process transactions, and to communicate with you.
        </Typography>

        <Typography variant="h5" sx={{ fontWeight: 700, mt: 4, mb: 2 }}>
          3. Information Sharing
        </Typography>
        <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.8 }}>
          We do not share your personal information with third parties except as described in this
          privacy policy or with your consent.
        </Typography>

        <Typography variant="h5" sx={{ fontWeight: 700, mt: 4, mb: 2 }}>
          4. Data Security
        </Typography>
        <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.8 }}>
          We take reasonable measures to help protect your personal information from loss, theft,
          misuse, and unauthorized access.
        </Typography>

        <Typography variant="h5" sx={{ fontWeight: 700, mt: 4, mb: 2 }}>
          5. Contact Us
        </Typography>
        <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.8 }}>
          If you have any questions about this Privacy Policy, please contact us at
          privacy@belle.app
        </Typography>
      </Container>
    </Box>
  );
};

export default Privacy;
