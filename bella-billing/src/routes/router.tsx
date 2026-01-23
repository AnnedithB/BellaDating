import App from 'App';
import Loading from 'components/Loading';

import { Suspense, lazy } from 'react';
import { RouteObject, createBrowserRouter } from 'react-router';

const Billing = lazy(() => import('pages/Billing'));

export const routes: RouteObject[] = [
  {
    element: <App />,
    children: [
      {
        path: '/',
        element: (
          <Suspense fallback={<Loading />}>
            <Billing />
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
