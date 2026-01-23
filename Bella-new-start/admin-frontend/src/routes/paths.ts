import { documentationPath } from 'lib/constants';

export const rootPaths = {
  root: '/',
  authRoot: 'auth',
};

const paths = {
  root: rootPaths.root,
  users: `/users`,
  moderation: `/moderation`,
  reports: `/moderation/reports`,
  tickets: `/support/tickets`,
  knowledgeBase: `/knowledge-base`,
  settings: `/settings`,
  account: `/account`,
  login: `/${rootPaths.authRoot}/login`,
  signup: `/${rootPaths.authRoot}/sign-up`,
  notifications: `/notifications`,
  documentation: documentationPath,

  404: `/404`,
};

export default paths;
