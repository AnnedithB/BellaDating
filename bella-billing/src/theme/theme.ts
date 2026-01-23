import CssBaseline from '@mui/material/CssBaseline';
import { createTheme } from '@mui/material/styles';

import { paletteOptions } from './palette';
import shadows from './shadows';
import { typography } from './typography';

export const themeOverrides = {
  cssVariables: { colorSchemeSelector: 'data-belle-color-scheme', cssVarPrefix: 'belle' },
  shadows: shadows as [
    'none',
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ],
  typography,
  palette: paletteOptions,
};

const theme = createTheme(themeOverrides);

export default theme;

export { CssBaseline };
