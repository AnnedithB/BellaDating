import { TypographyVariantsOptions } from '@mui/material/styles';

export const typography: TypographyVariantsOptions = {
  fontFamily: ['Plus Jakarta Sans', 'Roboto', 'Inter', 'Poppins', 'sans-serif'].join(','),
  h1: {
    fontWeight: 700,
    fontSize: '2.5rem',
    lineHeight: 1.2,
  },
  h2: {
    fontWeight: 700,
    fontSize: '2rem',
    lineHeight: 1.3,
  },
  h3: {
    fontWeight: 600,
    fontSize: '1.75rem',
    lineHeight: 1.4,
  },
  h4: {
    fontWeight: 600,
    fontSize: '1.5rem',
    lineHeight: 1.4,
  },
  h5: {
    fontWeight: 600,
    fontSize: '1.25rem',
    lineHeight: 1.5,
  },
  h6: {
    fontWeight: 600,
    fontSize: '1rem',
    lineHeight: 1.5,
  },
  body1: {
    fontSize: '1rem',
    lineHeight: 1.5,
  },
  body2: {
    fontSize: '0.875rem',
    lineHeight: 1.5,
  },
  button: {
    fontWeight: 600,
    textTransform: 'none',
  },
};
