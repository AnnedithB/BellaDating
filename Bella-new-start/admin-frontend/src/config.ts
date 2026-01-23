import { mainDrawerWidth } from 'lib/constants';

export const fontFamilies = ['Plus Jakarta Sans', 'Roboto', 'Inter', 'Poppins'] as const;

export type FontFamily = (typeof fontFamilies)[number];

export interface Config {
  assetsDir: string;
  sidenavCollapsed: boolean;
  openNavbarDrawer: boolean;
  drawerWidth: number;
  fontFamily: FontFamily;
}

export const initialConfig: Config = {
  assetsDir: import.meta.env.VITE_ASSET_BASE_URL ?? '',
  sidenavCollapsed: false,
  openNavbarDrawer: false,
  drawerWidth: mainDrawerWidth.full,
  fontFamily: fontFamilies[0],
};

// Default credentials for development only
// In production, these should be empty or removed
export const defaultAuthCredentials = {
  email: import.meta.env.VITE_DEFAULT_ADMIN_EMAIL || '',
  password: import.meta.env.VITE_DEFAULT_ADMIN_PASSWORD || '',
};
