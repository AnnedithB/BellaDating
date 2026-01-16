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
      // Use interactionService directly instead of sessionLoader
      const { interactionService } = context.dataSources as any;
      return await interactionService.getInteraction(id);
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
    startSession: async (_: any, { partnerId, callType = 'VOICE' }: { partnerId: string; callType?: string }, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      
      const { interactionService, communicationService } = context.dataSources as any;
      // Normalize callType: 'VIDEO' or 'video' -> 'VIDEO', otherwise 'VOICE'
      const normalizedCallType = callType?.toUpperCase() === 'VIDEO' ? 'VIDEO' : 'VOICE';

      // Ensure chat room exists for this pair (so chats persist even without match)
      try {
        await communicationService.createOrGetRoom(context.auth.user.id, partnerId);
      } catch (error: any) {
        console.warn('[startSession] Failed to create chat room, continuing:', error.message);
      }

      return await interactionService.startSession(context.auth.user.id, partnerId, normalizedCallType);
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