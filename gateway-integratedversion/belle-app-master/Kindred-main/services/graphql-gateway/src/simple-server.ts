import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { typeDefs } from './schema';
import { resolvers } from './resolvers';
import { config } from './config';
import { createAuthContext } from './auth';
import { createDataSources, createDataLoaders } from './dataSources';
import { GraphQLContext } from './types';

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);

  // Create Apollo Server
  const server = new ApolloServer<GraphQLContext>({
    typeDefs,
    resolvers,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
    introspection: true, // Enable GraphQL Playground in development
  });

  // Start Apollo Server
  await server.start();

  // Apply middleware
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: false, // Disable for GraphQL Playground
    })
  );

  app.use(
    '/graphql',
    cors<cors.CorsRequest>({
      origin: config.cors.origin,
      credentials: config.cors.credentials,
    }),
    express.json(),
    expressMiddleware(server, {
      context: async ({ req }): Promise<GraphQLContext> => {
        // Create auth context from request
        const auth = await createAuthContext(req);

        // Create new data sources for this request, initialized with auth context
        const requestDataSources = createDataSources({ auth });

        // Create data loaders for this request, also with auth context
        const loaders = createDataLoaders({ auth });

        return {
          auth,
          dataSources: {
            ...requestDataSources,
            ...loaders,
          },
        };
      },
    })
  );

  // Health check endpoint
  app.get('/health', (_, res) => {
    res.json({ status: 'ok', service: 'graphql-gateway' });
  });

  // Start the server
  await new Promise<void>((resolve) => {
    httpServer.listen({ port: config.port }, resolve);
  });

  console.log(`🚀 GraphQL Gateway ready at http://localhost:${config.port}/graphql`);
  console.log(`📊 Health check at http://localhost:${config.port}/health`);

  return { app, httpServer, server };
}

// Start with error handling
startServer().catch((error) => {
  console.error('Failed to start GraphQL Gateway:', error);
  process.exit(1);
});

export { startServer };
