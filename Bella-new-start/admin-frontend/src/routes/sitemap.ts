import { HTMLAttributeAnchorTarget } from 'react';
import { SxProps } from '@mui/material';
import paths, { rootPaths } from './paths';

export interface SubMenuItem {
  name: string;
  pathName: string;
  key?: string;
  selectionPrefix?: string;
  path?: string;
  target?: HTMLAttributeAnchorTarget;
  active?: boolean;
  icon?: string;
  iconSx?: SxProps;
  items?: SubMenuItem[];
}

export interface MenuItem {
  id: string;
  key?: string; // used for the locale
  subheader?: string;
  icon: string;
  target?: HTMLAttributeAnchorTarget;
  iconSx?: SxProps;
  items: SubMenuItem[];
}

const sitemap: MenuItem[] = [
  {
    id: 'main',
    icon: 'material-symbols:view-quilt-outline',
    items: [
      {
        name: 'Dashboard',
        path: rootPaths.root,
        pathName: 'dashboard',
        icon: 'material-symbols:query-stats-rounded',
        active: true,
      },
      {
        name: 'Users',
        path: paths.users,
        pathName: 'users',
        icon: 'material-symbols:account-box-outline',
        active: true,
      },
      {
        name: 'Moderation',
        path: paths.reports,
        pathName: 'moderation',
        icon: 'material-symbols:shield-outline',
        active: true,
      },
      {
        name: 'Support Tickets',
        path: paths.tickets,
        pathName: 'tickets',
        icon: 'material-symbols:support-agent-outline',
        active: true,
      },
      {
        name: 'Account',
        key: 'account',
        path: paths.account,
        pathName: 'account',
        active: true,
        icon: 'material-symbols:admin-panel-settings-outline-rounded',
      },
    ],
  },
];

export default sitemap;
