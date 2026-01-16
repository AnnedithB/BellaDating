import { GraphQLContext } from '../types';
import { GraphQLError } from 'graphql';

export const messageResolvers = {
  Query: {
    sessionMessages: async (_: any, { sessionId, limit = 50, offset = 0 }: { sessionId: string; limit?: number; offset?: number }, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      

      const { communicationService, interactionService } = context.dataSources as any;
      
      // sessionId might be an interaction session ID, we need to get the roomId from it
      // Try to get the interaction to find the roomId
      let roomId = sessionId;
      let resolvedViaInteraction = false;
      
      try {
        const interaction = await interactionService.getInteraction(sessionId);
        if (interaction) {
          // Check if interaction has a roomId
          if (interaction.roomId) {
          roomId = interaction.roomId;
            resolvedViaInteraction = true;
            console.log('[sessionMessages] Resolved roomId from interaction:', { sessionId, roomId });
          } else if (interaction.user1Id && interaction.user2Id) {
            // If no roomId in interaction, try to create/get room for these users
            const user1Id = interaction.user1Id;
            const user2Id = interaction.user2Id;
            const otherUserId = user1Id === context.auth.user.id ? user2Id : (user2Id === context.auth.user.id ? user1Id : null);
            
            if (otherUserId) {
              try {
                roomId = await communicationService.createOrGetRoom(context.auth.user.id, otherUserId);
                resolvedViaInteraction = true;
                console.log('[sessionMessages] Created/got room for interaction:', { sessionId, roomId, user1Id, user2Id });
              } catch (roomError: any) {
                console.warn('[sessionMessages] Failed to create/get room, using sessionId as roomId:', {
                  sessionId,
                  error: roomError.message
                });
                // Continue with sessionId as roomId
              }
            }
          }
        }
      } catch (err: any) {
        // If interaction lookup fails, use sessionId as roomId
        console.warn('[sessionMessages] Could not find interaction, using sessionId as roomId:', {
          sessionId,
          error: err.message
        });
      }
      
      // Fetch messages with better error handling
      let messages: any[] = [];
      try {
        messages = await communicationService.getMessages(roomId, limit, offset);
        console.log('[sessionMessages] Retrieved messages:', {
          sessionId,
          roomId,
          resolvedViaInteraction,
          messageCount: messages.length
        });
      } catch (error: any) {
        console.error('[sessionMessages] Error fetching messages:', {
          sessionId,
          roomId,
          error: error.message,
          status: error.response?.status
        });
        
        // If room doesn't exist and we haven't tried to create it yet, try to create it
        if ((error.response?.status === 404 || error.response?.status === 403) && !resolvedViaInteraction) {
          try {
            // Try to get interaction again to create room
            const interaction = await interactionService.getInteraction(sessionId);
            if (interaction && interaction.user1Id && interaction.user2Id) {
              const user1Id = interaction.user1Id;
              const user2Id = interaction.user2Id;
              const otherUserId = user1Id === context.auth.user.id ? user2Id : (user2Id === context.auth.user.id ? user1Id : null);
              
              if (otherUserId) {
                roomId = await communicationService.createOrGetRoom(context.auth.user.id, otherUserId);
                messages = await communicationService.getMessages(roomId, limit, offset);
                console.log('[sessionMessages] Retried with new roomId:', { sessionId, roomId, messageCount: messages.length });
              }
            }
          } catch (retryError: any) {
            console.error('[sessionMessages] Retry failed:', retryError.message);
            // Return empty array instead of throwing - allows UI to show empty state
            return [];
          }
        } else {
          // Return empty array for other errors to allow UI to handle gracefully
          return [];
        }
      }
      
      // Map messages to GraphQL ChatMessage format
      return messages.map((msg: any) => ({
        id: msg.id || msg.messageId,
        sessionId: sessionId, // Keep the original sessionId
        senderId: msg.senderId,
        content: msg.content || '',
        messageType: msg.messageType || msg.type || 'TEXT',
        metadata: msg.metadata || null,
        sentAt: msg.timestamp || msg.sentAt || new Date(),
        deliveredAt: msg.deliveredAt || null,
        readAt: msg.readAt || null,
        voiceUrl: msg.voiceUrl || null,
        voiceDuration: msg.voiceDuration || null,
        imageUrl: msg.imageUrl || null,
      }));
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
      
      const { communicationService, moderationService, historyService, interactionService } = context.dataSources as any;
      
      // Moderate content before sending (if moderation service is available)
      if (moderationService && typeof moderationService.moderateContent === 'function') {
        try {
          const moderationResult = await moderationService.moderateContent(input.content, 'message');
          
          if (moderationResult && moderationResult.blocked) {
            throw new Error('Message blocked by content moderation');
          }
        } catch (modError: any) {
          // Log moderation error but don't block message sending
          console.error('[sendMessage] Moderation error (allowing message):', modError.message);
        }
      }
      
      // Map sessionId to chat roomId
      // sessionId might be an interaction session ID, so we need to get/create a chat room
      let roomId = input.roomId;
      
      if (!roomId && input.sessionId) {
        try {
          // Try to get the interaction to find the participants
          const interaction = await interactionService.getInteraction(input.sessionId);
          if (interaction && (interaction.user1Id || interaction.user2Id)) {
            // Get or create a chat room for these two users
            const user1Id = interaction.user1Id;
            const user2Id = interaction.user2Id;
            const otherUserId = user1Id === context.auth.user.id ? user2Id : (user2Id === context.auth.user.id ? user1Id : null);
            
            if (otherUserId) {
              // Create or get chat room for these two users
              try {
                roomId = await communicationService.createOrGetRoom(context.auth.user.id, otherUserId);
                console.log('[sendMessage] Created/got chat room:', roomId, 'for users:', context.auth.user.id, otherUserId);
              } catch (roomError: any) {
                console.error('[sendMessage] Failed to create/get room:', {
                  error: roomError.message,
                  userId1: context.auth.user.id,
                  userId2: otherUserId
                });
                // Don't use fallback - room must exist for messages to work
                throw new GraphQLError(
                  `Failed to create chat room: ${roomError.message}`,
                  { extensions: { code: 'INTERNAL_SERVER_ERROR' } }
                );
              }
            } else {
              throw new GraphQLError(
                'Cannot determine other participant in the interaction',
                { extensions: { code: 'BAD_REQUEST' } }
              );
            }
          } else {
            // Interaction not found or invalid
            throw new GraphQLError(
              'Interaction not found or invalid. Cannot send message without a valid chat room.',
              { extensions: { code: 'NOT_FOUND' } }
            );
          }
        } catch (err: any) {
          // If interaction lookup fails, throw error
          console.error('[sendMessage] Could not find interaction:', {
            sessionId: input.sessionId,
            error: err.message
          });
          throw new GraphQLError(
            `Cannot find interaction session: ${err.message}`,
            { extensions: { code: 'NOT_FOUND' } }
          );
        }
      }
      
      if (!roomId) {
        throw new GraphQLError('roomId or sessionId is required', { extensions: { code: 'BAD_REQUEST' } });
      }
      
      const messageData = {
        ...input,
        roomId: roomId,
        senderId: context.auth.user.id,
        metadata: {
          ...(input.metadata || {}),
          sessionId: input.sessionId, // Include sessionId in metadata for dual-room emission
          roomId: roomId
        }
      };
      
      let message;
      try {
        message = await communicationService.sendMessage(messageData);
      } catch (error: any) {
        console.error('[sendMessage] CommunicationService error:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
          roomId: roomId
        });
        
        // If room doesn't exist, try to create it and retry
        if (error.response?.status === 404 || error.response?.status === 500) {
          try {
            if (input.sessionId) {
              const interaction = await interactionService.getInteraction(input.sessionId);
              if (interaction) {
                const user1Id = interaction.user1Id;
                const user2Id = interaction.user2Id;
                const otherUserId = user1Id === context.auth.user.id ? user2Id : user1Id;
                
                if (otherUserId) {
                  roomId = await communicationService.createOrGetRoom(context.auth.user.id, otherUserId);
                  messageData.roomId = roomId;
                  message = await communicationService.sendMessage(messageData);
                  console.log('[sendMessage] Retried with new roomId:', roomId);
                }
              }
            }
          } catch (retryError: any) {
            console.error('[sendMessage] Retry failed:', retryError.message);
            throw new GraphQLError(
              error.response?.data?.message || error.message || 'Failed to send message',
              { extensions: { code: 'INTERNAL_SERVER_ERROR' } }
            );
          }
        } else {
        throw new GraphQLError(
          error.response?.data?.message || error.message || 'Failed to send message',
          { extensions: { code: 'INTERNAL_SERVER_ERROR' } }
        );
        }
      }
      
      // Log the interaction (if history service is available)
      if (historyService && typeof historyService.logInteraction === 'function') {
        try {
          await historyService.logInteraction({
            type: 'message_sent',
            userId: context.auth.user.id,
            sessionId: input.sessionId,
            metadata: {
              messageId: message.id || message.messageId,
              messageType: input.messageType,
            },
          });
        } catch (logError: any) {
          // Log error but don't fail message sending
          console.error('[sendMessage] History logging error:', logError.message);
        }
      }
      
      // Map the response to match GraphQL ChatMessage type
      return {
        id: message.id || message.messageId,
        sessionId: input.sessionId,
        senderId: message.senderId || context.auth.user.id,
        content: message.content || '',
        messageType: message.messageType || message.type || 'TEXT',
        metadata: message.metadata || null,
        sentAt: message.timestamp || message.sentAt || new Date(),
        deliveredAt: message.deliveredAt || null,
        readAt: message.readAt || null,
        voiceUrl: message.voiceUrl || null,
        voiceDuration: message.voiceDuration || null,
        imageUrl: message.imageUrl || null,
      };
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
      const { communicationService, interactionService } = context.dataSources as any;
      
      // Get roomId from sessionId (interaction session)
      let roomId = sessionId;
      try {
        const interaction = await interactionService.getInteraction(sessionId);
        if (interaction && interaction.roomId) {
          roomId = interaction.roomId;
        }
      } catch (err) {
        // If interaction lookup fails, use sessionId as roomId
        console.warn('[markSessionAsRead] Could not find interaction, using sessionId as roomId:', sessionId);
      }
      
      const messages = await communicationService.getMessages(roomId);
      
      // Mark all messages as read (if markMessageAsRead is implemented)
      if (communicationService.markMessageAsRead) {
        await Promise.all(
          messages.map((message: any) => 
            communicationService.markMessageAsRead(message.id || message.messageId)
          )
        );
      }
      
      return true;
    },
    
    deleteMessage: async (_: any, { messageId, roomId }: { messageId: string; roomId: string }, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      
      const { communicationService, interactionService } = context.dataSources as any;
      
      // Resolve sessionId to roomId if roomId looks like a sessionId
      let resolvedRoomId = roomId;
      try {
        // Check if roomId is actually a sessionId (interaction.id)
        const interaction = await interactionService.getInteraction(roomId);
        if (interaction && interaction.roomId) {
          resolvedRoomId = interaction.roomId;
          console.log('[deleteMessage] Resolved roomId from interaction:', { roomId, resolvedRoomId });
        }
      } catch (err: any) {
        // If not found, use roomId as-is (it's probably already a roomId)
        console.log('[deleteMessage] Using roomId as-is (not a sessionId):', roomId);
      }
      
      try {
        const response = await communicationService.client.delete(
          `/api/chat/conversations/${resolvedRoomId}/messages/${messageId}`,
          {
            headers: {
              Authorization: `Bearer ${context.auth.token}`
            }
          }
        );
        
        return response.data.success === true;
      } catch (error: any) {
        console.error('[deleteMessage] Error:', error.response?.data || error.message);
        throw new GraphQLError(
          error.response?.data?.error || 'Failed to delete message',
          { extensions: { code: 'INTERNAL_SERVER_ERROR' } }
        );
      }
    },
    
    clearMessages: async (_: any, { roomId, all }: { roomId: string; all?: boolean }, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      
      const { communicationService, interactionService } = context.dataSources as any;
      
      // Resolve sessionId to roomId if roomId looks like a sessionId
      let resolvedRoomId = roomId;
      try {
        // Check if roomId is actually a sessionId (interaction.id)
        const interaction = await interactionService.getInteraction(roomId);
        if (interaction && interaction.roomId) {
          resolvedRoomId = interaction.roomId;
          console.log('[clearMessages] Resolved roomId from interaction:', { roomId, resolvedRoomId });
        }
      } catch (err: any) {
        // If not found, use roomId as-is (it's probably already a roomId)
        console.log('[clearMessages] Using roomId as-is (not a sessionId):', roomId);
      }
      
      try {
        // Add ?all=true query param if all is true
        const url = `/api/chat/conversations/${resolvedRoomId}/messages${all ? '?all=true' : ''}`;
        const response = await communicationService.client.delete(
          url,
          {
            headers: {
              Authorization: `Bearer ${context.auth.token}`
            }
          }
        );
        
        return response.data.success === true;
      } catch (error: any) {
        console.error('[clearMessages] Error:', error.response?.data || error.message);
        throw new GraphQLError(
          error.response?.data?.error || 'Failed to clear messages',
          { extensions: { code: 'INTERNAL_SERVER_ERROR' } }
        );
      }
    },
  },
  
  ChatMessage: {
    session: async (message: any, _: any, context: GraphQLContext) => {
      // Use interactionService directly instead of sessionLoader
      const { interactionService } = context.dataSources as any;
      return await interactionService.getInteraction(message.sessionId);
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