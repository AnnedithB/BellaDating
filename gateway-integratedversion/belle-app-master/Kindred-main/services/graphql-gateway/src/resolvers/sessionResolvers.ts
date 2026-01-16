import { GraphQLContext } from '../types';
import { GraphQLError } from 'graphql';

export const sessionResolvers = {
  Query: {
    myActiveSessions: async (_: any, __: any, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }
      
      const { interactionService } = context.dataSources as any;
      return await interactionService.getUserSessions(context.auth.user.id);
    },
    
    session: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      return await context.dataSources.sessionLoader.load(id);
    },
    
    sessionHistory: async (_: any, { limit = 20, offset = 0 }: { limit?: number; offset?: number }, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      
      const { interactionService } = context.dataSources as any;
      return await interactionService.getUserSessions(context.auth.user.id, limit, offset);
    },
  },
  
  Mutation: {
    startSession: async (_: any, { partnerId }: { partnerId: string }, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      
      const { interactionService } = context.dataSources as any;
      return await interactionService.startSession(context.auth.user.id, partnerId, 'chat');
    },
    
    endSession: async (_: any, { sessionId }: { sessionId: string }, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      
      const { interactionService } = context.dataSources as any;
      return await interactionService.endSession(sessionId);
    },
  },
  
  InteractionSession: {
    user1: async (session: any, _: any, context: GraphQLContext) => {
      return await context.dataSources.userLoader.load(session.user1Id);
    },
    
    user2: async (session: any, _: any, context: GraphQLContext) => {
      return await context.dataSources.userLoader.load(session.user2Id);
    },
    
    messages: async (session: any, _: any, context: GraphQLContext) => {
      return await context.dataSources.messageLoader.load(session.id);
    },
    
    duration: (session: any) => {
      if (session.endedAt && session.startedAt) {
        return Math.floor((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 1000);
      }
      return null;
    },
  },
};