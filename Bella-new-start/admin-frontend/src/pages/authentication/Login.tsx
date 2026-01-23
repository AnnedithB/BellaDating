import { defaultAuthCredentials } from 'config';
import LoginForm from 'components/sections/authentications/LoginForm';

const Login = () => {
  // Only use default credentials in development
  const defaultCredential =
    import.meta.env.DEV && defaultAuthCredentials.email && defaultAuthCredentials.password
      ? defaultAuthCredentials
      : undefined;

  return <LoginForm defaultCredential={defaultCredential} />;
};

export default Login;
