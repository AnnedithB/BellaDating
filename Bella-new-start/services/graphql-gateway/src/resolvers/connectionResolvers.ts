import { GraphQLContext } from '../types';
import { GraphQLError } from 'graphql';

export const connectionResolvers = {
  Query: {
    myConnections: async (_: any, __: any, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }
      
      // TODO: Implement actual connection fetching from user-service
      // For now, return empty array to satisfy non-nullable requirement
      return [];
    },
    
    connectionSuggestions: async (_: any, { limit = 10 }: { limit?: number }, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }
      
      // TODO: Implement connection suggestions
      return [];
    },
  },
  
  Mutation: {
    sendConnectionRequest: async (_: any, { userId }: { userId: string }, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }
      
      // TODO: Implement connection request sending
      throw new GraphQLError('Not implemented', {
        extensions: { code: 'NOT_IMPLEMENTED' }
      });
    },
    
    respondToConnectionRequest: async (_: any, { connectionId, accept }: { connectionId: string; accept: boolean }, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }
      
      // TODO: Implement connection request response
      throw new GraphQLError('Not implemented', {
        extensions: { code: 'NOT_IMPLEMENTED' }
      });
    },
    
    removeConnection: async (_: any, { connectionId }: { connectionId: string }, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }
      
      // For now, connections are managed through interaction sessions
      // Ending a session effectively removes the connection
      const { interactionService } = context.dataSources as any;
      try {
        // Try to end the session if connectionId is actually a sessionId
        await interactionService.endSession(connectionId);
        return true;
      } catch (error: any) {
        console.error('[removeConnection] Error:', error.message);
        // Return true anyway to allow unmatch flow to continue
        return true;
      }
    },
  },
  
  Connection: {
    user1: async (connection: any, _: any, context: GraphQLContext) => {
      return await context.dataSources.userLoader.load(connection.user1Id);
    },
    
    user2: async (connection: any, _: any, context: GraphQLContext) => {
      return await context.dataSources.userLoader.load(connection.user2Id);
    },
  },
};

