import { GraphQLContext } from '../types';
import { GraphQLError } from 'graphql';

export const queueResolvers = {
  Query: {
    queueStatus: async (_: any, __: any, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      
      const { queuingService } = context.dataSources as any;
      return await queuingService.getQueueStatus(context.auth.user.id);
    },
    
    queueStatistics: async (_: any, __: any, context: GraphQLContext) => {
      const { queuingService } = context.dataSources as any;
      return await queuingService.getQueueStatistics();
    },
  },
  
  Mutation: {
    joinQueue: async (_: any, { preferences }: { preferences?: any }, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }

      const { queuingService, historyService, userService } = context.dataSources as any;

      // Fetch user's profile to get their actual gender and other info
      let userProfile = null;
      try {
        userProfile = await userService.getUserProfile(context.auth.user.id);
        console.log('[joinQueue resolver] Got user profile:', JSON.stringify(userProfile, null, 2));
      } catch (error) {
        console.error('[joinQueue resolver] Error fetching user profile:', error);
      }

      const queueStatus = await queuingService.joinQueue(context.auth.user.id, preferences, userProfile);

      // Log the queue join action (don't await to avoid blocking)
      historyService.logUserAction({
        type: 'queue_joined',
        userId: context.auth.user.id,
        metadata: { preferences },
      }).catch((err: any) => console.error('Failed to log queue join:', err));

      return queueStatus;
    },
    
    leaveQueue: async (_: any, __: any, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      
      const { queuingService, historyService } = context.dataSources as any;
      
      const result = await queuingService.leaveQueue(context.auth.user.id);

      // Log the queue leave action (don't await to avoid blocking)
      historyService.logUserAction({
        type: 'queue_left',
        userId: context.auth.user.id,
      }).catch((err: any) => console.error('Failed to log queue leave:', err));

      return result;
    },
    
    updateQueuePreferences: async (_: any, { preferences }: { preferences: any }, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      
      const { queuingService } = context.dataSources as any;
      return await queuingService.updatePreferences(context.auth.user.id, preferences);
    },
  },
  
  QueueStatus: {
    user: async (queueStatus: any, _: any, context: GraphQLContext) => {
      return await context.dataSources.userLoader.load(queueStatus.userId);
    },
  },
};