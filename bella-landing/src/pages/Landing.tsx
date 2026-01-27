import { useEffect, useState } from 'react';
import { Link } from 'react-router';

import { Box, Button, Container, Grid, Stack, Typography } from '@mui/material';

import { Icon } from '@iconify/react';

import couple1 from '../assets/couple1.png';
import couple2 from '../assets/couple2.png';
import couple3 from '../assets/couple3.png';

const coupleImages = [couple1, couple2, couple3];

const Landing = () => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % coupleImages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Hero Section with integrated header */}
      <Box
        sx={{
          minHeight: { xs: '100dvh', md: 'auto' },
          flexGrow: 1,
          background: [
            'radial-gradient(at 0% 0%, #E3F2FD 0%, transparent 60%)',
            'radial-gradient(at 100% 0%, #EDE7F6 0%, transparent 60%)',
            'radial-gradient(at 100% 100%, #FFF3E0 0%, transparent 60%)',
            'radial-gradient(at 0% 100%, #E0F2F1 0%, transparent 60%)',
            'radial-gradient(at 50% 50%, #F5F7FA 0%, transparent 100%)',
            '#ffffff',
          ].join(', '),
          display: 'flex',
          flexDirection: 'column',
          justifyContent: { xs: 'center', md: 'flex-start' },
          py: { xs: 4, md: 3 },
        }}
      >
        {/* Header - top-aligned or centered based on preference, but here we center the whole Box content */}
        <Container
          maxWidth="lg"
          sx={{
            mb: { xs: 4, md: 4 },
            pt: { xs: 2, md: 0 },
            px: '37px !important', // Force 30px padding
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                color: '#1a1a1a',
                letterSpacing: '-1px',
                fontFamily: 'Plus Jakarta Sans',
                fontSize: { xs: '1.8rem', md: '2.2rem' },
              }}
            >
              Belle
            </Typography>

            {/* Header CTA with arrow */}
            <Box
              component="a"
              href="https://apps.apple.com/app/belle"
              target="_blank"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                color: '#1a1a1a',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.95rem',
                transition: 'all 0.2s ease',
                '&:hover': {
                  gap: 1.5,
                },
              }}
            >
              <span>Get the app</span>
              <Icon icon="mdi:arrow-right" width={20} />
            </Box>
          </Box>
        </Container>

        {/* Main Hero Content */}
        <Container
          maxWidth="lg"
          sx={{
            flexGrow: 1,
            display: 'flex',
            alignItems: 'center',
            pt: { xs: 4, md: 0 },
            px: '37px !important', // Force 30px padding
          }}
        >
          <Grid container spacing={{ xs: 3, md: 6 }} sx={{ alignItems: 'center' }}>
            {/* Left Content */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Stack spacing={{ xs: 4, md: 2.5 }}>
                <Typography
                  variant="h1"
                  sx={{
                    fontSize: { xs: '2.5rem', md: '3.8rem' },
                    fontWeight: 800,
                    lineHeight: 1.1,
                    color: '#1a1a1a',
                    letterSpacing: '-1.2px',
                    fontFamily: 'Plus Jakarta Sans',
                  }}
                >
                  Find your perfect{' '}
                  <Box component="span" sx={{ color: '#0047AB' }}>
                    match
                  </Box>{' '}
                  with Belle
                </Typography>

                <Typography
                  variant="h5"
                  sx={{
                    color: '#555',
                    fontWeight: 400,
                    maxWidth: 480,
                    lineHeight: 1.6,
                    fontSize: { xs: '1rem', md: '1.2rem' },
                  }}
                >
                  The dating app that matches you on what truly matters. Discover meaningful
                  connections and meet someone special today.
                </Typography>

                <Box sx={{ pt: 1.5 }}>
                  <Typography variant="body2" sx={{ mb: 2, color: '#666', maxWidth: 420 }}>
                    By clicking Join, you agree to our{' '}
                    <Link to="/privacy" style={{ color: '#1a1a1a', textDecoration: 'underline' }}>
                      Privacy Policy
                    </Link>{' '}
                    and{' '}
                    <Link to="/cookies" style={{ color: '#1a1a1a', textDecoration: 'underline' }}>
                      Cookie Policy
                    </Link>
                    .
                  </Typography>

                  <Button
                    component="a"
                    href="https://apps.apple.com/app/belle"
                    target="_blank"
                    variant="contained"
                    size="large"
                    sx={{
                      bgcolor: '#0047AB',
                      color: 'white',
                      fontWeight: 700,
                      px: 8,
                      py: 2,
                      fontSize: '1.1rem',
                      borderRadius: 0,
                      textTransform: 'none',
                      boxShadow: '0 8px 24px rgba(0, 71, 171, 0.25)',
                      '&:hover': {
                        bgcolor: '#003380',
                        boxShadow: '0 12px 32px rgba(0, 71, 171, 0.35)',
                      },
                    }}
                  >
                    Join Belle
                  </Button>
                </Box>

                <Box sx={{ pt: 1.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#1a1a1a', mb: 1.5 }}>
                    Download on iOS
                  </Typography>
                  <Box
                    component="a"
                    href="https://apps.apple.com/app/belle"
                    target="_blank"
                    sx={{ display: 'inline-block' }}
                  >
                    <Box
                      component="img"
                      src="https://upload.wikimedia.org/wikipedia/commons/3/3c/Download_on_the_App_Store_Badge.svg"
                      sx={{ height: 44 }}
                      alt="Download on the App Store"
                    />
                  </Box>
                </Box>
              </Stack>
            </Grid>

            {/* Right - Rotating Couple Images */}
            <Grid
              size={{ xs: 12, md: 6 }}
              sx={{ display: { xs: 'none', md: 'flex' }, justifyContent: 'center' }}
            >
              <Box
                sx={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: { xs: 450, md: 650 },
                  height: { xs: 450, md: 750 },
                }}
              >
                {coupleImages.map((img, index) => (
                  <Box
                    key={index}
                    component="img"
                    src={img}
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      opacity: currentImageIndex === index ? 1 : 0,
                      transform: currentImageIndex === index ? 'scale(1)' : 'scale(0.95)',
                      transition: 'opacity 0.8s ease-in-out, transform 0.8s ease-in-out',
                    }}
                    alt={`Happy friends ${index + 1}`}
                  />
                ))}
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Footer */}
      <Box sx={{ bgcolor: '#1a1a1a', color: 'white', py: { xs: 4, md: 5 } }}>
        <Container maxWidth="lg" sx={{ px: '37px !important' }}>
          <Grid container spacing={4}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Button
                component="a"
                href="https://apps.apple.com/app/belle"
                target="_blank"
                variant="contained"
                fullWidth
                sx={{
                  bgcolor: '#0047AB',
                  fontWeight: 600,
                  py: 1.5,
                  borderRadius: 0,
                  textTransform: 'none',
                  maxWidth: 200,
                  '&:hover': { bgcolor: '#003380' },
                }}
              >
                Join Belle
              </Button>
              <Typography variant="body2" sx={{ mt: 4, color: '#888' }}>
                © Belle 2026
              </Typography>
            </Grid>

            <Grid size={{ xs: 6, md: 4 }}>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 700,
                  mb: 2.5,
                  color: '#fff',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                Legal
              </Typography>
              <Stack spacing={1.5}>
                <Typography
                  component={Link}
                  to="/privacy"
                  variant="body2"
                  sx={{
                    color: '#aaa',
                    textDecoration: 'none',
                    display: 'block',
                    '&:hover': { color: 'white' },
                  }}
                >
                  Privacy Policy
                </Typography>
                <Typography
                  component={Link}
                  to="/cookies"
                  variant="body2"
                  sx={{
                    color: '#aaa',
                    textDecoration: 'none',
                    display: 'block',
                    '&:hover': { color: 'white' },
                  }}
                >
                  Cookie Policy
                </Typography>
              </Stack>
            </Grid>

            <Grid size={{ xs: 6, md: 4 }}>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 700,
                  mb: 2.5,
                  color: '#fff',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                Follow
              </Typography>
              <Stack spacing={1.5}>
                {['Instagram', 'Twitter', 'Facebook'].map((item) => (
                  <Typography
                    key={item}
                    component="a"
                    href="#"
                    variant="body2"
                    sx={{
                      color: '#aaa',
                      textDecoration: 'none',
                      display: 'block',
                      '&:hover': { color: 'white' },
                    }}
                  >
                    {item}
                  </Typography>
                ))}
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </Box>
  );
};

export default Landing;
