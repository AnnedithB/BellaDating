import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { config } from '../utils/config';
import axios from 'axios';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  email?: string;
}

interface SocketUser {
  userId: string;
  socketId: string;
  isOnline: boolean;
  currentRoomId?: string;
  isTyping: boolean;
  typingInRoom?: string;
  lastSeen: Date;
  showOnlineStatus: boolean;
  sendReadReceipts: boolean;
}

export class SocketService {
  private io: Server;
  private prisma: PrismaClient;
  private connectedUsers: Map<string, SocketUser> = new Map();
  private activeCalls: Map<string, { fromUserId: string; toUserId: string; createdAt: Date; callerName?: string }> = new Map();
  private pendingHeartMatches: Map<string, { fromUserId: string; toUserId: string; roomId: string; sessionId?: string; timeoutId: NodeJS.Timeout; createdAt: Date }> = new Map();
  private pendingVideoRequests: Map<string, { fromUserId: string; toUserId: string; roomId: string; sessionId?: string; createdAt: Date }> = new Map();

  private static readonly HEART_MATCH_TIMEOUT_MS = 15000;

  private async logActivity(
    userId: string,
    type: string,
    title: string,
    description?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const activity = await this.prisma.activity.create({
        data: {
          userId,
          type: type as any,
          title,
          description: description || null,
          metadata: metadata || null,
        },
      });

      this.io.to(`user:${userId}`).emit('activity:created', activity);
    } catch (error) {
      logger.error('Failed to log activity', { userId, type, error });
    }
  }

  public async logActivityForUsers(
    userIds: string[],
    type: string,
    title: string,
    description?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await Promise.all(
      userIds.map((userId) =>
        this.logActivity(userId, type, title, description, metadata)
      )
    );
  }

  constructor(io: Server, prisma: PrismaClient) {
    this.io = io;
    this.prisma = prisma;
    this.setupSocketHandlers();
  }

  private setupSocketHandlers(): void {
    this.io.use(this.authenticateSocket.bind(this));

    this.io.on('connection', (socket: AuthenticatedSocket) => {
      logger.info('User connected', {
        socketId: socket.id,
        userId: socket.userId
      });

      this.handleUserConnection(socket);
      this.setupSocketEvents(socket);
    });
  }

  private async fetchUserSettings(userId: string): Promise<{ showOnlineStatus: boolean; sendReadReceipts: boolean }> {
    try {
      const response = await axios.get(`${config.services.userService}/profile/internal/users/${userId}`, {
        headers: {
          'x-internal-request': 'true'
        },
        timeout: 5000
      });
      const user = response.data?.data?.user;
      const privacySettings = user?.privacySettings || {};
      return {
        showOnlineStatus: privacySettings.showOnlineStatus !== false,
        sendReadReceipts: privacySettings.sendReadReceipts !== false
      };
    } catch (error) {
      logger.warn('Failed to fetch user privacy settings, using defaults', { userId, error });
      return {
        showOnlineStatus: true,
        sendReadReceipts: true
      };
    }
  }

  public authenticateSocket(socket: AuthenticatedSocket, next: (err?: Error) => void): void {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, config.jwtSecret) as any;
      socket.userId = decoded.userId;
      socket.email = decoded.email;

      next();
    } catch (error) {
      logger.error('Socket authentication failed:', error);
      next(new Error('Invalid authentication token'));
    }
  }

  public handleConnection(socket: AuthenticatedSocket): void {
    logger.info('User connected', {
      socketId: socket.id,
      userId: socket.userId
    });

    this.handleUserConnection(socket);
    this.setupSocketEvents(socket);
  }

  private async handleUserConnection(socket: AuthenticatedSocket): Promise<void> {
    if (!socket.userId) return;

    const settings = await this.fetchUserSettings(socket.userId);

    // Join a per-user room so we can emit direct notifications (calls, etc.) reliably
    // A user can have multiple sockets (web + mobile), emitting to the room reaches all of them.
    socket.join(`user:${socket.userId}`);

    const user: SocketUser = {
      userId: socket.userId,
      socketId: socket.id,
      isOnline: true,
      isTyping: false,
      lastSeen: new Date(),
      showOnlineStatus: settings.showOnlineStatus,
      sendReadReceipts: settings.sendReadReceipts
    };

    this.connectedUsers.set(socket.userId, user);

    const onlineUsers = this.getOnlineUsers();
    const onlineUserIds = onlineUsers
      .filter(u => u.showOnlineStatus)
      .filter(u => u.userId !== socket.userId) // Exclude self
      .map(u => ({
        userId: u.userId,
        isOnline: true
      }));

    if (onlineUserIds.length > 0) {
      socket.emit('users:online', {
        users: onlineUserIds
      });
    }

    // Notify all users (including the newly connected one) that this user is online
    // This ensures bidirectional status updates
    if (user.showOnlineStatus) {
      this.io.emit('user:online', {
        userId: socket.userId,
        isOnline: true
      });
    }
  }

  private setupSocketEvents(socket: AuthenticatedSocket): void {
    // Join conversation room
    socket.on('conversation:join', (data: { conversationId: string }) => {
      logger.info('Received conversation:join event', {
        socketId: socket.id,
        userId: socket.userId,
        conversationId: data?.conversationId
      });
      this.handleJoinConversation(socket, data.conversationId);
    });

    // Leave conversation room
    socket.on('conversation:leave', (data: { conversationId: string }) => {
      this.handleLeaveConversation(socket, data.conversationId);
    });

    // Typing indicators
    socket.on('typing:start', (data: { conversationId: string; sessionId?: string }) => {
      this.handleTypingStart(socket, data.conversationId, data.sessionId);
    });

    socket.on('typing:stop', (data: { conversationId: string; sessionId?: string }) => {
      this.handleTypingStop(socket, data.conversationId, data.sessionId);
    });

    // Message events
    socket.on('message:send', (data: any) => {
      this.handleMessageSend(socket, data);
    });

    // Privacy settings updates
    socket.on('privacy:settings:update', (data: { showOnlineStatus?: boolean; sendReadReceipts?: boolean }) => {
      this.handlePrivacySettingsUpdate(socket, data);
    });

    // Call signaling events (for UI notifications / accept-decline-ignore)
    socket.on('call:request', (data: { toUserId: string; callerName?: string; callerProfilePicture?: string; conversationId?: string; sessionId?: string; callType?: string }) => {
      this.handleCallRequest(socket, data);
    });

    socket.on('call:response', (data: { callId: string; response: 'accept' | 'decline' | 'ignore'; responderName?: string }) => {
      this.handleCallResponse(socket, data);
    });

    // Call heart matching (during active call)
    socket.on('call:heart:request', (data: { toUserId: string; roomId: string; sessionId?: string }) => {
      this.handleCallHeartRequest(socket, data);
    });

    socket.on('call:heart:accept', (data: { fromUserId?: string; roomId: string; sessionId?: string; toUserId?: string }) => {
      this.handleCallHeartAccept(socket, data);
    });

    // Video upgrade flow (during active call)
    socket.on('call:video:request', (data: { toUserId: string; roomId: string; sessionId?: string }) => {
      this.handleCallVideoRequest(socket, data);
    });

    socket.on('call:video:accept', (data: { fromUserId?: string; roomId: string; sessionId?: string; toUserId?: string }) => {
      this.handleCallVideoAccept(socket, data);
    });

    socket.on('call:video:decline', (data: { fromUserId?: string; roomId: string; sessionId?: string; toUserId?: string }) => {
      this.handleCallVideoDecline(socket, data);
    });

    // Voice note events
    socket.on('voice:start', (data: { conversationId: string }) => {
      this.handleVoiceStart(socket, data.conversationId);
    });

    socket.on('voice:stop', (data: { conversationId: string }) => {
      this.handleVoiceStop(socket, data.conversationId);
    });

    // Unmatch events
    socket.on('match:unmatch', (data: { toUserId?: string; roomId?: string; sessionId?: string }) => {
      this.handleMatchUnmatch(socket, data);
    });

    // Skip/Next events - notify the other user when one user skips
    socket.on('match:skip', (data: { toUserId?: string; roomId?: string; sessionId?: string }) => {
      this.handleMatchSkip(socket, data);
    });

    // Disconnect handler
    socket.on('disconnect', () => {
      this.handleUserDisconnection(socket);
    });
  }

  private getHeartRequestKey(roomId: string, fromUserId: string, toUserId: string): string {
    return `${roomId}:${fromUserId}:${toUserId}`;
  }

  private clearHeartRequestsForRoom(roomId: string): void {
    Array.from(this.pendingHeartMatches.keys()).forEach((key) => {
      if (key.startsWith(`${roomId}:`)) {
        const entry = this.pendingHeartMatches.get(key);
        if (entry?.timeoutId) {
          clearTimeout(entry.timeoutId);
        }
        this.pendingHeartMatches.delete(key);
      }
    });
  }

  private async handleCallHeartRequest(
    socket: AuthenticatedSocket,
    data: { toUserId: string; roomId: string; sessionId?: string }
  ): Promise<void> {
    try {
      if (!socket.userId) return;
      const toUserId = data?.toUserId;
      const roomId = data?.roomId;
      const sessionId = data?.sessionId;

      if (!toUserId || !roomId) {
        logger.warn('call:heart:request missing toUserId/roomId', { fromUserId: socket.userId, socketId: socket.id, data });
        return;
      }

      const fromUserId = socket.userId;

      // Clear any existing heart request for this room
      this.clearHeartRequestsForRoom(roomId);

      const timeoutId = setTimeout(() => {
        this.handleCallHeartTimeout(roomId, fromUserId, toUserId, sessionId);
      }, SocketService.HEART_MATCH_TIMEOUT_MS);

      const key = this.getHeartRequestKey(roomId, fromUserId, toUserId);
      this.pendingHeartMatches.set(key, {
        fromUserId,
        toUserId,
        roomId,
        sessionId,
        timeoutId,
        createdAt: new Date()
      });

      const payload = {
        roomId,
        sessionId,
        fromUserId,
        toUserId,
        timestamp: new Date().toISOString()
      };

      this.io.to(`user:${toUserId}`).emit('call:heart:incoming', payload);
      this.io.to(`user:${fromUserId}`).emit('call:heart:pending', payload);

      await Promise.all([
        this.logActivity(
          fromUserId,
          'HEART_REQUESTED',
          'Heart request sent',
          'You sent a heart request during the call.',
          { partnerId: toUserId, roomId, sessionId }
        ),
        this.logActivity(
          toUserId,
          'HEART_REQUESTED',
          'Heart request received',
          'You received a heart request during the call.',
          { partnerId: fromUserId, roomId, sessionId }
        )
      ]);
    } catch (error) {
      logger.error('Error handling call:heart:request', error as Error);
    }
  }

  private async handleCallHeartAccept(
    socket: AuthenticatedSocket,
    data: { fromUserId?: string; roomId: string; sessionId?: string; toUserId?: string }
  ): Promise<void> {
    try {
      if (!socket.userId) return;
      const roomId = data?.roomId;
      if (!roomId) {
        logger.warn('call:heart:accept missing roomId', { fromUserId: socket.userId, socketId: socket.id, data });
        return;
      }

      const accepterId = socket.userId;
      let fromUserId = data?.fromUserId;
      let toUserId = data?.toUserId || accepterId;
      let sessionId = data?.sessionId;

      if (!fromUserId) {
        const pending = Array.from(this.pendingHeartMatches.values()).find(
          (entry) => entry.roomId === roomId && entry.toUserId === accepterId
        );
        if (pending) {
          fromUserId = pending.fromUserId;
          toUserId = pending.toUserId;
          sessionId = pending.sessionId;
        }
      }

      if (!fromUserId) {
        logger.warn('call:heart:accept could not resolve requester', { roomId, accepterId });
        return;
      }

      const key = this.getHeartRequestKey(roomId, fromUserId, toUserId);
      const existing = this.pendingHeartMatches.get(key);
      if (existing?.timeoutId) {
        clearTimeout(existing.timeoutId);
      }
      this.pendingHeartMatches.delete(key);

      const payload = {
        roomId,
        sessionId,
        fromUserId,
        toUserId,
        acceptedBy: accepterId,
        timestamp: new Date().toISOString()
      };

      this.io.to(`user:${fromUserId}`).emit('call:heart:accepted', payload);
      this.io.to(`user:${toUserId}`).emit('call:heart:accepted', payload);

      await Promise.all([
        this.logActivity(
          fromUserId,
          'HEART_ACCEPTED',
          'Heart accepted',
          'Your heart request was accepted.',
          { partnerId: toUserId, roomId, sessionId }
        ),
        this.logActivity(
          toUserId,
          'HEART_ACCEPTED',
          'Heart accepted',
          'You accepted a heart request.',
          { partnerId: fromUserId, roomId, sessionId }
        )
      ]);
    } catch (error) {
      logger.error('Error handling call:heart:accept', error as Error);
    }
  }

  private handleCallHeartTimeout(roomId: string, fromUserId: string, toUserId: string, sessionId?: string): void {
    const key = this.getHeartRequestKey(roomId, fromUserId, toUserId);
    const existing = this.pendingHeartMatches.get(key);
    if (existing?.timeoutId) {
      clearTimeout(existing.timeoutId);
    }
    this.pendingHeartMatches.delete(key);

    const payload = {
      roomId,
      sessionId,
      fromUserId,
      toUserId,
      timestamp: new Date().toISOString()
    };

    this.io.to(`user:${fromUserId}`).emit('call:heart:expired', payload);
    this.io.to(`user:${toUserId}`).emit('call:heart:expired', payload);

    Promise.all([
      this.logActivity(
        fromUserId,
        'HEART_EXPIRED',
        'Heart request expired',
        'Your heart request expired.',
        { partnerId: toUserId, roomId, sessionId }
      ),
      this.logActivity(
        toUserId,
        'HEART_EXPIRED',
        'Heart request expired',
        'You did not respond to a heart request.',
        { partnerId: fromUserId, roomId, sessionId }
      )
    ]).catch(() => {});
  }

  private getVideoRequestKey(roomId: string, fromUserId: string, toUserId: string): string {
    return `${roomId}:${fromUserId}:${toUserId}`;
  }

  private async handleCallVideoRequest(
    socket: AuthenticatedSocket,
    data: { toUserId: string; roomId: string; sessionId?: string }
  ): Promise<void> {
    try {
      if (!socket.userId) return;
      const toUserId = data?.toUserId;
      const roomId = data?.roomId;
      const sessionId = data?.sessionId;

      if (!toUserId || !roomId) {
        logger.warn('call:video:request missing toUserId/roomId', { fromUserId: socket.userId, socketId: socket.id, data });
        return;
      }

      const fromUserId = socket.userId;
      const key = this.getVideoRequestKey(roomId, fromUserId, toUserId);
      this.pendingVideoRequests.set(key, {
        fromUserId,
        toUserId,
        roomId,
        sessionId,
        createdAt: new Date()
      });

      const payload = {
        roomId,
        sessionId,
        fromUserId,
        toUserId,
        timestamp: new Date().toISOString()
      };

      this.io.to(`user:${toUserId}`).emit('call:video:incoming', payload);
      this.io.to(`user:${fromUserId}`).emit('call:video:pending', payload);

      await Promise.all([
        this.logActivity(
          fromUserId,
          'VIDEO_REQUESTED',
          'Video request sent',
          'You requested to start a video call.',
          { partnerId: toUserId, roomId, sessionId }
        ),
        this.logActivity(
          toUserId,
          'VIDEO_REQUESTED',
          'Video request received',
          'You received a video call request.',
          { partnerId: fromUserId, roomId, sessionId }
        )
      ]);
    } catch (error) {
      logger.error('Error handling call:video:request', error as Error);
    }
  }

  private async handleCallVideoAccept(
    socket: AuthenticatedSocket,
    data: { fromUserId?: string; roomId: string; sessionId?: string; toUserId?: string }
  ): Promise<void> {
    try {
      if (!socket.userId) return;
      const roomId = data?.roomId;
      if (!roomId) {
        logger.warn('call:video:accept missing roomId', { fromUserId: socket.userId, socketId: socket.id, data });
        return;
      }

      const accepterId = socket.userId;
      let fromUserId = data?.fromUserId;
      let toUserId = data?.toUserId || accepterId;
      let sessionId = data?.sessionId;

      if (!fromUserId) {
        const pending = Array.from(this.pendingVideoRequests.values()).find(
          (entry) => entry.roomId === roomId && entry.toUserId === accepterId
        );
        if (pending) {
          fromUserId = pending.fromUserId;
          toUserId = pending.toUserId;
          sessionId = pending.sessionId;
        }
      }

      if (!fromUserId) {
        logger.warn('call:video:accept could not resolve requester', { roomId, accepterId });
        return;
      }

      const key = this.getVideoRequestKey(roomId, fromUserId, toUserId);
      this.pendingVideoRequests.delete(key);

      const payload = {
        roomId,
        sessionId,
        fromUserId,
        toUserId,
        acceptedBy: accepterId,
        timestamp: new Date().toISOString()
      };

      this.io.to(`user:${fromUserId}`).emit('call:video:accepted', payload);
      this.io.to(`user:${toUserId}`).emit('call:video:accepted', payload);

      await Promise.all([
        this.logActivity(
          fromUserId,
          'VIDEO_ACCEPTED',
          'Video request accepted',
          'Your video request was accepted.',
          { partnerId: toUserId, roomId, sessionId }
        ),
        this.logActivity(
          toUserId,
          'VIDEO_ACCEPTED',
          'Video request accepted',
          'You accepted a video request.',
          { partnerId: fromUserId, roomId, sessionId }
        )
      ]);
    } catch (error) {
      logger.error('Error handling call:video:accept', error as Error);
    }
  }

  private async handleCallVideoDecline(
    socket: AuthenticatedSocket,
    data: { fromUserId?: string; roomId: string; sessionId?: string; toUserId?: string }
  ): Promise<void> {
    try {
      if (!socket.userId) return;
      const roomId = data?.roomId;
      if (!roomId) {
        logger.warn('call:video:decline missing roomId', { fromUserId: socket.userId, socketId: socket.id, data });
        return;
      }

      const declinerId = socket.userId;
      let fromUserId = data?.fromUserId;
      let toUserId = data?.toUserId || declinerId;
      let sessionId = data?.sessionId;

      if (!fromUserId) {
        const pending = Array.from(this.pendingVideoRequests.values()).find(
          (entry) => entry.roomId === roomId && entry.toUserId === declinerId
        );
        if (pending) {
          fromUserId = pending.fromUserId;
          toUserId = pending.toUserId;
          sessionId = pending.sessionId;
        }
      }

      if (!fromUserId) {
        logger.warn('call:video:decline could not resolve requester', { roomId, declinerId });
        return;
      }

      const key = this.getVideoRequestKey(roomId, fromUserId, toUserId);
      this.pendingVideoRequests.delete(key);

      const payload = {
        roomId,
        sessionId,
        fromUserId,
        toUserId,
        declinedBy: declinerId,
        timestamp: new Date().toISOString()
      };

      this.io.to(`user:${fromUserId}`).emit('call:video:declined', payload);
      this.io.to(`user:${toUserId}`).emit('call:video:declined', payload);

      await Promise.all([
        this.logActivity(
          fromUserId,
          'VIDEO_DECLINED',
          'Video request declined',
          'Your video request was declined.',
          { partnerId: toUserId, roomId, sessionId }
        ),
        this.logActivity(
          toUserId,
          'VIDEO_DECLINED',
          'Video request declined',
          'You declined a video request.',
          { partnerId: fromUserId, roomId, sessionId }
        )
      ]);
    } catch (error) {
      logger.error('Error handling call:video:decline', error as Error);
    }
  }

  private async handleCallRequest(
    socket: AuthenticatedSocket,
    data: { toUserId: string; callerName?: string; callerProfilePicture?: string; sessionId?: string; conversationId?: string; callType?: string }
  ): Promise<void> {
    try {
      if (!socket.userId) return;
      const toUserId = data?.toUserId;
      if (!toUserId) {
        logger.warn('call:request missing toUserId', { fromUserId: socket.userId, socketId: socket.id });
        return;
      }

      const callId = crypto.randomUUID();
      this.activeCalls.set(callId, {
        fromUserId: socket.userId,
        toUserId,
        createdAt: new Date(),
        callerName: data?.callerName
      });

      const payload = {
        callId,
        callerId: socket.userId,
        callerName: data?.callerName,
        callerProfilePicture: data?.callerProfilePicture,
        sessionId: data?.sessionId, // Pass through the chat session ID
        conversationId: data?.conversationId || data?.sessionId, // Include conversationId for chat list status
        callType: data?.callType || 'VIDEO', // Include call type (VOICE or VIDEO)
        toUserId,
        createdAt: new Date().toISOString(),
      };

      logger.info('Relaying call request', payload);

      // Create notification for the callee
      try {
        await axios.post(`${config.services.notificationService}/internal/send-notification`, {
          userId: toUserId, // Notify the callee
          type: 'CALL_REQUEST',
          title: 'Incoming Video Call',
          body: `${data?.callerName || 'Someone'} is calling you`,
          data: {
            callId,
            callerId: socket.userId,
            callerName: data?.callerName,
            callerProfilePicture: data?.callerProfilePicture,
            sessionId: data?.sessionId,
            type: 'CALL_REQUEST'
          },
          priority: 'HIGH'
        });
        logger.info(`Created CALL_REQUEST notification for user ${toUserId}, call ${callId}`);
      } catch (logError) {
        logger.error('Failed to create call request notification:', logError);
      }

      // Emit to callee user-room so they get it regardless of current screen
      this.io.to(`user:${toUserId}`).emit('call:request', payload);
    } catch (error) {
      logger.error('Error handling call:request', error as Error);
    }
  }

  private async handleCallResponse(
    socket: AuthenticatedSocket,
    data: { callId: string; response: 'accept' | 'decline' | 'ignore'; responderName?: string }
  ): Promise<void> {
    try {
      if (!socket.userId) return;
      const callId = data?.callId;
      const response = data?.response;
      if (!callId || !response) {
        logger.warn('call:response missing callId/response', { fromUserId: socket.userId, socketId: socket.id, data });
        return;
      }

      const call = this.activeCalls.get(callId);
      if (!call) {
        logger.warn('call:response for unknown callId', { callId, fromUserId: socket.userId, response });
        return;
      }

      // Only callee should be responding; still relay to caller for UI purposes.
      const payload = {
        callId,
        response,
        fromUserId: socket.userId,
        toUserId: call.fromUserId,
        createdAt: new Date().toISOString(),
      };

      logger.info('Relaying call response', payload);
      this.io.to(`user:${call.fromUserId}`).emit('call:response', payload);

      // Log activity to notification service for all responses
      if (response === 'accept' || response === 'decline' || response === 'ignore') {
        const responderName = data.responderName || 'Someone';
        let activityTitle = '';
        let activityBody = '';
        let notificationType = '';

        if (response === 'accept') {
          activityTitle = 'Call Accepted';
          activityBody = `${responderName} accepted your call`;
          notificationType = 'CALL_ACCEPTED';
        } else if (response === 'decline') {
          activityTitle = 'Call Declined';
          activityBody = `${responderName} declined your call`;
          notificationType = 'CALL_DECLINED';
        } else if (response === 'ignore') {
          activityTitle = 'Call Ignored';
          activityBody = `${responderName} ignored your call`;
          notificationType = 'CALL_DECLINED'; // Use same type as decline for consistency
        }

        try {
          await axios.post(`${config.services.notificationService}/internal/send-notification`, {
            userId: call.fromUserId, // Notify the caller
            type: notificationType,
            title: activityTitle,
            body: activityBody,
            data: {
              matcherId: socket.userId, // The person who responded (callee)
              name: responderName,
              callId: callId,
              response: response
            }
          });
          logger.info(`Logged ${response} activity for call ${callId}`);
        } catch (logError) {
          logger.error('Failed to log call activity:', logError);
        }
      }

      // Clean up call on terminal responses
      if (response === 'accept' || response === 'decline' || response === 'ignore') {
        this.activeCalls.delete(callId);
      }
    } catch (error) {
      logger.error('Error handling call:response', error as Error);
    }
  }

  private async handleJoinConversation(socket: AuthenticatedSocket, conversationId: string): Promise<void> {
    try {
      if (!socket.userId) {
        logger.warn('Join conversation attempted without userId', { conversationId });
        return;
      }

      logger.info('Attempting to join conversation', {
        userId: socket.userId,
        conversationId
      });

      let resolvedRoomId = conversationId;
      let accessGranted = false;

      // Step 1: Try to find userRoom with conversationId as roomId
      const participant = await this.prisma.userRoom.findFirst({
        where: {
          roomId: conversationId,
          userId: socket.userId
        }
      });

      if (participant) {
        logger.info('Found userRoom entry', {
          userId: socket.userId,
          conversationId,
          roomId: conversationId
        });
        accessGranted = true;
        resolvedRoomId = conversationId;
      } else {
        // Step 2: Check if conversationId is a ChatRoom roomId
        const chatRoom = await this.prisma.chatRoom.findFirst({
          where: {
            OR: [
              { roomId: conversationId },
              { id: conversationId }
            ]
          }
        });

        if (chatRoom) {
          // Verify user is a participant in this chat room
          const isParticipant =
            chatRoom.participant1Id === socket.userId ||
            chatRoom.participant2Id === socket.userId;

          if (isParticipant) {
            logger.info('Found ChatRoom entry, user is participant', {
              userId: socket.userId,
              conversationId,
              resolvedRoomId: chatRoom.roomId
            });
            accessGranted = true;
            resolvedRoomId = chatRoom.roomId;
          } else {
            logger.warn('ChatRoom found but user is not a participant', {
              userId: socket.userId,
              conversationId,
              chatRoomId: chatRoom.id,
              participant1: chatRoom.participant1Id,
              participant2: chatRoom.participant2Id
            });
          }
        } else {
          // Step 3: conversationId might be a sessionId (interaction.id)
          // Since we don't have direct access to Interaction service/database,
          // we'll allow the join but log a warning
          // The backend already emits to both roomId and sessionId rooms, so this should work
          // For security, we'll allow authenticated users to join by sessionId
          // The message emission will verify access through the message service
          logger.info('No userRoom or ChatRoom found, allowing join (may be sessionId)', {
            userId: socket.userId,
            conversationId
          });
          accessGranted = true;
          resolvedRoomId = conversationId;
        }
      }

      if (!accessGranted) {
        logger.warn('Access denied to conversation', {
          userId: socket.userId,
          conversationId
        });
        socket.emit('error', { message: 'Access denied to this conversation' });
        return;
      }

      // Join the room with resolved roomId
      const roomName = `conversation:${resolvedRoomId}`;
      socket.join(roomName);

      // Always also join with original conversationId in case it's different (sessionId vs roomId)
      // This ensures we receive messages regardless of which ID the backend uses
      if (resolvedRoomId !== conversationId) {
        const originalRoomName = `conversation:${conversationId}`;
        socket.join(originalRoomName);
        logger.info('Joined both resolved roomId and original conversationId', {
          userId: socket.userId,
          resolvedRoomId,
          originalConversationId: conversationId,
          resolvedRoom: roomName,
          originalRoom: originalRoomName
        });
      } else {
        // Even if they're the same, log to confirm join
        logger.info('Joined conversation room', {
          userId: socket.userId,
          conversationId,
          roomName
        });
      }

      // Update user's current room
      const user = this.connectedUsers.get(socket.userId);
      if (user) {
        user.currentRoomId = resolvedRoomId;
        this.connectedUsers.set(socket.userId, user);
      }

      // Notify other participants
      socket.to(roomName).emit('user:joined', {
        userId: socket.userId,
        conversationId: resolvedRoomId
      });

      // Log socket count in room for debugging
      try {
        const room = this.io.sockets.adapter.rooms.get(roomName);
        const socketCount = room ? room.size : 0;
        logger.info('User joined conversation', {
          userId: socket.userId,
          conversationId: resolvedRoomId,
          originalConversationId: conversationId,
          roomName,
          socketCount
        });
      } catch (err) {
        // If we can't get room info, just log the join
        logger.info('User joined conversation', {
          userId: socket.userId,
          conversationId: resolvedRoomId,
          originalConversationId: conversationId,
          roomName
        });
      }
    } catch (error) {
      logger.error('Error joining conversation:', {
        error,
        userId: socket.userId,
        conversationId
      });
      socket.emit('error', { message: 'Failed to join conversation' });
    }
  }

  private handleLeaveConversation(socket: AuthenticatedSocket, conversationId: string): void {
    if (!socket.userId) return;

    socket.leave(`conversation:${conversationId}`);

    // Update user's current room
    const user = this.connectedUsers.get(socket.userId);
    if (user && user.currentRoomId === conversationId) {
      user.currentRoomId = undefined;
      this.connectedUsers.set(socket.userId, user);
    }

    // Notify other participants
    socket.to(`conversation:${conversationId}`).emit('user:left', {
      userId: socket.userId,
      conversationId
    });

    logger.info('User left conversation', {
      userId: socket.userId,
      conversationId
    });
  }

  private handleTypingStart(socket: AuthenticatedSocket, conversationId: string, sessionId?: string): void {
    if (!socket.userId) return;

    const user = this.connectedUsers.get(socket.userId);
    if (user) {
      user.isTyping = true;
      user.typingInRoom = conversationId;
      this.connectedUsers.set(socket.userId, user);
    }

    const targets = new Set<string>([conversationId, sessionId].filter(Boolean) as string[]);
    targets.forEach((targetId) => {
      socket.to(`conversation:${targetId}`).emit('typing:start', {
        userId: socket.userId,
        conversationId: targetId
      });
    });
  }

  private handleTypingStop(socket: AuthenticatedSocket, conversationId: string, sessionId?: string): void {
    if (!socket.userId) return;

    const user = this.connectedUsers.get(socket.userId);
    if (user) {
      user.isTyping = false;
      user.typingInRoom = undefined;
      this.connectedUsers.set(socket.userId, user);
    }

    const targets = new Set<string>([conversationId, sessionId].filter(Boolean) as string[]);
    targets.forEach((targetId) => {
      socket.to(`conversation:${targetId}`).emit('typing:stop', {
        userId: socket.userId,
        conversationId: targetId
      });
    });
  }

  private async handleMessageSend(socket: AuthenticatedSocket, data: any): Promise<void> {
    try {
      if (!socket.userId) return;

      const { conversationId, content, type = 'TEXT', metadata } = data;

      const sessionId = metadata?.sessionId;
      const targets = new Set<string>([conversationId, sessionId].filter(Boolean) as string[]);
      targets.forEach((targetId) => {
        // Broadcast message to conversation participants
        socket.to(`conversation:${targetId}`).emit('message:received', {
          senderId: socket.userId,
          conversationId: targetId,
          content,
          type,
          metadata,
          timestamp: new Date()
        });
      });

      logger.info('Message sent via socket', {
        senderId: socket.userId,
        conversationId,
        type
      });
    } catch (error) {
      logger.error('Error handling message send:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  }

  private handleVoiceStart(socket: AuthenticatedSocket, conversationId: string): void {
    if (!socket.userId) return;

    socket.to(`conversation:${conversationId}`).emit('voice:started', {
      userId: socket.userId,
      conversationId
    });
  }

  private handleVoiceStop(socket: AuthenticatedSocket, conversationId: string): void {
    if (!socket.userId) return;

    socket.to(`conversation:${conversationId}`).emit('voice:stopped', {
      userId: socket.userId,
      conversationId
    });
  }

  private handlePrivacySettingsUpdate(
    socket: AuthenticatedSocket,
    data: { showOnlineStatus?: boolean; sendReadReceipts?: boolean }
  ): void {
    if (!socket.userId) return;
    const user = this.connectedUsers.get(socket.userId);
    if (!user) return;

    const previousShowOnline = user.showOnlineStatus;
    user.showOnlineStatus = data.showOnlineStatus !== undefined ? data.showOnlineStatus : user.showOnlineStatus;
    user.sendReadReceipts = data.sendReadReceipts !== undefined ? data.sendReadReceipts : user.sendReadReceipts;
    this.connectedUsers.set(socket.userId, user);

    if (previousShowOnline !== user.showOnlineStatus) {
      if (user.showOnlineStatus) {
        this.io.emit('user:online', {
          userId: socket.userId,
          isOnline: true
        });
      } else {
        const lastSeen = new Date();
        this.io.emit('user:offline', {
          userId: socket.userId,
          isOnline: false,
          lastSeen
        });
      }
    }
  }

  private handleUserDisconnection(socket: AuthenticatedSocket): void {
    if (!socket.userId) return;

    const user = this.connectedUsers.get(socket.userId);
    if (user) {
      const lastSeen = new Date();
      user.isOnline = false;
      user.lastSeen = lastSeen;

      // Check if user has other active connections
      // If not, remove from map and notify others
      const hasOtherConnections = Array.from(this.io.sockets.sockets.values()).some(
        (s: any) => (s as AuthenticatedSocket).userId === socket.userId && s.id !== socket.id
      );

      if (!hasOtherConnections) {
        // User is completely offline, remove from map
        this.connectedUsers.delete(socket.userId);

        // Notify all users that this user is offline
        if (user.showOnlineStatus) {
          this.io.emit('user:offline', {
            userId: socket.userId,
            isOnline: false,
            lastSeen: lastSeen
          });
        }
      } else {
        // User has other connections, just update status
        this.connectedUsers.set(socket.userId, user);
      }

      // If user was typing, stop typing indicator
      if (user.isTyping && user.typingInRoom) {
        socket.to(`conversation:${user.typingInRoom}`).emit('typing:stop', {
          userId: socket.userId,
          conversationId: user.typingInRoom
        });
      }
    }

    logger.info('User disconnected', {
      socketId: socket.id,
      userId: socket.userId
    });
  }

  private async handleMatchUnmatch(
    socket: AuthenticatedSocket,
    data: { toUserId?: string; roomId?: string; sessionId?: string }
  ): Promise<void> {
    try {
      if (!socket.userId) return;

      const fromUserId = socket.userId;
      let toUserId = data?.toUserId;
      const roomId = data?.roomId;
      const sessionId = data?.sessionId;

      if (!toUserId && roomId) {
        const room = await this.prisma.chatRoom.findUnique({
          where: { roomId }
        });
        if (room) {
          toUserId = room.participant1Id === fromUserId ? room.participant2Id : room.participant1Id;
        }
      }

      if (!toUserId) {
        logger.warn('match:unmatch missing toUserId', { fromUserId, data });
        return;
      }

      if (roomId) {
        this.clearHeartRequestsForRoom(roomId);
      }

      const payload = {
        fromUserId,
        toUserId,
        roomId,
        sessionId,
        timestamp: new Date().toISOString()
      };

      this.io.to(`user:${fromUserId}`).emit('match:unmatched', payload);
      this.io.to(`user:${toUserId}`).emit('match:unmatched', payload);

      await Promise.all([
        axios.post(`${config.services.notificationService}/internal/send-notification`, {
          userId: fromUserId,
          type: 'UNMATCHED',
          title: 'Unmatched',
          body: 'You unmatched with your chat partner.',
          data: { partnerId: toUserId, roomId, sessionId }
        }),
        axios.post(`${config.services.notificationService}/internal/send-notification`, {
          userId: toUserId,
          type: 'UNMATCHED',
          title: 'Unmatched',
          body: 'Your chat partner unmatched you.',
          data: { partnerId: fromUserId, roomId, sessionId }
        })
      ]);
    } catch (error) {
      logger.error('Error handling match:unmatch', error as Error);
    }
  }

  private async handleMatchSkip(
    socket: AuthenticatedSocket,
    data: { toUserId?: string; roomId?: string; sessionId?: string }
  ): Promise<void> {
    try {
      if (!socket.userId) return;

      const fromUserId = socket.userId;
      let toUserId = data?.toUserId;
      const roomId = data?.roomId;
      const sessionId = data?.sessionId;

      // If toUserId not provided, try to find from roomId
      if (!toUserId && roomId) {
        const room = await this.prisma.chatRoom.findUnique({
          where: { roomId }
        });
        if (room) {
          toUserId = room.participant1Id === fromUserId ? room.participant2Id : room.participant1Id;
        }
      }

      if (!toUserId) {
        logger.warn('match:skip missing toUserId', { fromUserId, data });
        return;
      }

      // Clear any pending heart requests for this room
      if (roomId) {
        this.clearHeartRequestsForRoom(roomId);
      }

      const payload = {
        fromUserId,
        toUserId,
        roomId,
        sessionId,
        timestamp: new Date().toISOString()
      };

      // Emit skip event to the other user so they know to move to next match
      this.io.to(`user:${toUserId}`).emit('match:skipped', payload);

      logger.info('match:skip handled', { fromUserId, toUserId, roomId, sessionId });
    } catch (error) {
      logger.error('Error handling match:skip', error as Error);
    }
  }

  // Public methods for external use
  public emitToUser(userId: string, event: string, data: any): void {
    const user = this.connectedUsers.get(userId);
    if (user && user.isOnline) {
      this.io.to(user.socketId).emit(event, data);
    }
  }

  public emitToConversation(conversationId: string, event: string, data: any, excludeUserId?: string): void {
    const room = `conversation:${conversationId}`;
    const socketsInRoom = this.io.sockets.adapter.rooms.get(room);
    const socketCount = socketsInRoom ? socketsInRoom.size : 0;

    logger.info('Emitting to conversation room', {
      room,
      conversationId,
      event,
      socketCount,
      excludeUserId,
      hasData: !!data
    });

    if (excludeUserId) {
      const user = this.connectedUsers.get(excludeUserId);
      if (user) {
        this.io.to(room).except(user.socketId).emit(event, data);
        logger.info('Emitted to room excluding sender', {
          room,
          excludedSocketId: user.socketId,
          excludedUserId: excludeUserId
        });
      } else {
        // If user not found in connectedUsers, emit to all in room
        this.io.to(room).emit(event, data);
        logger.warn('Excluded user not found in connectedUsers, emitting to all in room', {
          room,
          excludeUserId
        });
      }
    } else {
      this.io.to(room).emit(event, data);
      logger.info('Emitted to all in room', { room, socketCount });
    }
  }

  public getUserStatus(userId: string): SocketUser | undefined {
    return this.connectedUsers.get(userId);
  }

  public getOnlineUsers(): SocketUser[] {
    return Array.from(this.connectedUsers.values()).filter(user => user.isOnline);
  }
}