import { useEffect, useLayoutEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import { useSettingsContext } from 'providers/SettingsProvider';
import { REFRESH } from 'reducers/SettingsReducer';

const App = () => {
  const { pathname } = useLocation();
  const { configDispatch } = useSettingsContext();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useLayoutEffect(() => {
    configDispatch({ type: REFRESH });
  }, []);

  return <Outlet />;
};

export default App;
