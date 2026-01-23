import { GraphQLContext } from '../types';
import { GraphQLError } from 'graphql';

export const notificationResolvers = {
  Query: {
    notifications: async (_: any, { limit = 20, offset = 0 }: { limit?: number; offset?: number }, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }

      try {
        const { notificationService } = context.dataSources as any;
        return await notificationService.getNotifications(context.auth.user.id, limit, offset);
      } catch (error) {
        console.error('Error fetching notifications:', error);
        return []; // Return empty array on error
      }
    },

    unreadNotifications: async (_: any, __: any, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }

      try {
        const { notificationService } = context.dataSources as any;
        return await notificationService.getUnreadNotifications(context.auth.user.id);
      } catch (error) {
        console.error('Error fetching unread notifications:', error);
        return []; // Return empty array on error
      }
    },
  },
  
  Mutation: {
    markNotificationAsRead: async (_: any, { notificationId }: { notificationId: string }, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }

      try {
        const { notificationService } = context.dataSources as any;
        await notificationService.markNotificationAsRead(notificationId, context.auth.user.id);
        return true;
      } catch (error) {
        console.error('Error marking notification as read:', error);
        return false;
      }
    },
    
    markAllNotificationsAsRead: async (_: any, __: any, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }

      try {
        const { notificationService } = context.dataSources as any;
        await notificationService.markAllNotificationsAsRead(context.auth.user.id);
        return true;
      } catch (error) {
        console.error('Error marking all notifications as read:', error);
        return false;
      }
    },
  },
  
  Notification: {
    user: async (notification: any, _: any, context: GraphQLContext) => {
      return await context.dataSources.userLoader.load(notification.userId);
    },
  },
};