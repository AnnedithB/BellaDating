import { GraphQLContext } from '../types';
import { GraphQLError } from 'graphql';

export const notificationResolvers = {
  Query: {
    notifications: async (_: any, { limit = 20, offset = 0 }: { limit?: number; offset?: number }, context: GraphQLContext) => {
      console.log(`[NotificationResolver] notifications query called with limit=${limit}, offset=${offset}`);
      console.log(`[NotificationResolver] Context auth user:`, context.auth.user ? context.auth.user.id : 'null');
      
      if (!context.auth.user) {
        console.error('[NotificationResolver] No authenticated user - throwing error');
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      
      try {
        const { notificationService } = context.dataSources as any;
        console.log(`[NotificationResolver] Fetching notifications for user ${context.auth.user.id}`);
        console.log(`[NotificationResolver] NotificationService available:`, !!notificationService);
        const notifications = await notificationService.getNotifications(context.auth.user.id, limit, offset);
        console.log(`[NotificationResolver] Returning ${notifications.length} notifications`);
        if (notifications.length > 0) {
          console.log(`[NotificationResolver] First notification:`, JSON.stringify(notifications[0], null, 2));
        }
        return notifications;
      } catch (error: any) {
        console.error('[NotificationResolver] Error fetching notifications:', error);
        console.error('[NotificationResolver] Error details:', error.message, error.stack);
        // Return empty array instead of throwing to prevent breaking the query
        return [];
      }
    },
    
    unreadNotifications: async (_: any, __: any, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      
      try {
        const { notificationService } = context.dataSources as any;
        console.log(`[NotificationResolver] Fetching unread notifications for user ${context.auth.user.id}`);
        const notifications = await notificationService.getUnreadNotifications(context.auth.user.id);
        console.log(`[NotificationResolver] Returning ${notifications.length} unread notifications`);
        return notifications;
      } catch (error: any) {
        console.error('[NotificationResolver] Error fetching unread notifications:', error);
        return [];
      }
    },
  },
  
  Mutation: {
    markNotificationAsRead: async (_: any, { notificationId }: { notificationId: string }, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      
      const { notificationService } = context.dataSources as any;
      return await notificationService.markNotificationAsRead(notificationId);
    },
    
    markAllNotificationsAsRead: async (_: any, __: any, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      
      const { notificationService } = context.dataSources as any;
      return await notificationService.markAllNotificationsAsRead(context.auth.user.id);
    },
    
    deleteAllNotifications: async (_: any, __: any, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      
      const { notificationService } = context.dataSources as any;
      return await notificationService.deleteAllNotifications(context.auth.user.id);
    },
  },
  
  Notification: {
    user: async (notification: any, _: any, context: GraphQLContext) => {
      return await context.dataSources.userLoader.load(notification.userId);
    },
  },
};