import { GraphQLContext } from '../types';
import { GraphQLError } from 'graphql';

export const messageResolvers = {
  Query: {
    sessionMessages: async (_: any, { sessionId, limit = 50, offset = 0 }: { sessionId: string; limit?: number; offset?: number }, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      
      const { communicationService } = context.dataSources as any;
      return await communicationService.getMessages(sessionId, limit, offset);
    },
    
    messageHistory: async (_: any, { userId, limit = 50, offset = 0 }: { userId?: string; limit?: number; offset?: number }, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      
      const targetUserId = userId || context.auth.user.id;
      const { communicationService } = context.dataSources as any;
      return await communicationService.getMessageHistory(targetUserId, limit, offset);
    },
  },
  
  Mutation: {
    sendMessage: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      
      const { communicationService, moderationService, historyService } = context.dataSources as any;
      
      // Moderate content before sending
      const moderationResult = await moderationService.moderateContent(input.content, 'message');
      
      if (moderationResult.blocked) {
        throw new Error('Message blocked by content moderation');
      }
      
      const messageData = {
        ...input,
        senderId: context.auth.user.id,
      };
      
      const message = await communicationService.sendMessage(messageData);
      
      // Log the interaction
      await historyService.logInteraction({
        type: 'message_sent',
        userId: context.auth.user.id,
        sessionId: input.sessionId,
        metadata: {
          messageId: message.id,
          messageType: input.messageType,
        },
      });
      
      return message;
    },
    
    markMessageAsRead: async (_: any, { messageId }: { messageId: string }, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      
      const { communicationService } = context.dataSources as any;
      return await communicationService.markMessageAsRead(messageId);
    },
    
    markSessionAsRead: async (_: any, { sessionId }: { sessionId: string }, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      
      // This would mark all messages in the session as read
      const { communicationService } = context.dataSources as any;
      const messages = await communicationService.getMessages(sessionId);
      
      await Promise.all(
        messages.map((message: any) => 
          communicationService.markMessageAsRead(message.id)
        )
      );
      
      return true;
    },
  },
  
  ChatMessage: {
    session: async (message: any, _: any, context: GraphQLContext) => {
      return await context.dataSources.sessionLoader.load(message.sessionId);
    },
    
    sender: async (message: any, _: any, context: GraphQLContext) => {
      return await context.dataSources.userLoader.load(message.senderId);
    },
    
    isDelivered: (message: any) => {
      return !!message.deliveredAt;
    },
    
    isRead: (message: any) => {
      return !!message.readAt;
    },
  },
};