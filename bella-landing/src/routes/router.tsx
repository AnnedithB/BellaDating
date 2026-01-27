import App from 'App';
import Loading from 'components/Loading';

import { Suspense, lazy } from 'react';
import { RouteObject, createBrowserRouter } from 'react-router';

const Landing = lazy(() => import('pages/Landing'));
const Billing = lazy(() => import('pages/Billing'));
const Privacy = lazy(() => import('pages/Privacy'));
const CookiePolicy = lazy(() => import('pages/CookiePolicy'));

export const routes: RouteObject[] = [
  {
    element: <App />,
    children: [
      {
        path: '/',
        element: (
          <Suspense fallback={<Loading />}>
            <Landing />
          </Suspense>
        ),
      },
      {
        path: '/billing',
        element: (
          <Suspense fallback={<Loading />}>
            <Billing />
          </Suspense>
        ),
      },
      {
        path: '/privacy',
        element: (
          <Suspense fallback={<Loading />}>
            <Privacy />
          </Suspense>
        ),
      },
      {
        path: '/cookies',
        element: (
          <Suspense fallback={<Loading />}>
            <CookiePolicy />
          </Suspense>
        ),
      },
    ],
  },
];

const router = createBrowserRouter(routes, {
  basename: import.meta.env.MODE === 'production' ? import.meta.env.VITE_BASENAME : '/',
});

export default router;
