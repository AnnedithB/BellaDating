// GraphQL Gateway - Main Entry Point
// Re-exports the server and components for programmatic usage

// Export server functions
export { startApolloServer, startApolloServer as startServer } from './server';

// Export schema for potential reuse
export { typeDefs } from './schema';

// Export resolvers for potential reuse
export { resolvers } from './resolvers';

// Default export for simple import
import { startApolloServer } from './server';
export default { startApolloServer };