// Temporarily disabled due to missing @apollo/server dependencies
// To restore: npm install @apollo/server @apollo/server-plugin-drainHttpServer express cors helmet

/*
GraphQL Gateway service is temporarily disabled due to missing dependencies.
Install the following dependencies to restore functionality:
- @apollo/server
- @apollo/server-plugin-drainHttpServer
- express
- cors
- helmet
- @types/express
- @types/cors
*/

// Export a placeholder to prevent import errors
export default {};

export const startServer = () => {
  throw new Error('GraphQL Gateway disabled - missing dependencies. Install @apollo/server first.');
};

export const startWithRetry = () => {
  throw new Error('GraphQL Gateway disabled - missing dependencies. Install @apollo/server first.');
};