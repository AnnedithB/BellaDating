import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { config } from '../utils/config';

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
}

export class SocketService {
  private io: Server;
  private prisma: PrismaClient;
  private connectedUsers: Map<string, SocketUser> = new Map();

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

  private handleUserConnection(socket: AuthenticatedSocket): void {
    if (!socket.userId) return;

    const user: SocketUser = {
      userId: socket.userId,
      socketId: socket.id,
      isOnline: true,
      isTyping: false,
      lastSeen: new Date()
    };

    this.connectedUsers.set(socket.userId, user);

    // Notify other users that this user is online
    socket.broadcast.emit('user:online', {
      userId: socket.userId,
      isOnline: true
    });
  }

  private setupSocketEvents(socket: AuthenticatedSocket): void {
    // Join conversation room
    socket.on('conversation:join', (data: { conversationId: string }) => {
      this.handleJoinConversation(socket, data.conversationId);
    });

    // Leave conversation room
    socket.on('conversation:leave', (data: { conversationId: string }) => {
      this.handleLeaveConversation(socket, data.conversationId);
    });

    // Typing indicators
    socket.on('typing:start', (data: { conversationId: string }) => {
      this.handleTypingStart(socket, data.conversationId);
    });

    socket.on('typing:stop', (data: { conversationId: string }) => {
      this.handleTypingStop(socket, data.conversationId);
    });

    // Message events
    socket.on('message:send', (data: any) => {
      this.handleMessageSend(socket, data);
    });

    // Voice note events
    socket.on('voice:start', (data: { conversationId: string }) => {
      this.handleVoiceStart(socket, data.conversationId);
    });

    socket.on('voice:stop', (data: { conversationId: string }) => {
      this.handleVoiceStop(socket, data.conversationId);
    });

    // Disconnect handler
    socket.on('disconnect', () => {
      this.handleUserDisconnection(socket);
    });
  }

  private async handleJoinConversation(socket: AuthenticatedSocket, conversationId: string): Promise<void> {
    try {
      if (!socket.userId) return;

      // Verify user is participant in conversation
      const participant = await this.prisma.userRoom.findFirst({
        where: {
          roomId: conversationId,
          userId: socket.userId
        }
      });

      if (!participant) {
        socket.emit('error', { message: 'Access denied to this conversation' });
        return;
      }

      // Join the room
      socket.join(`conversation:${conversationId}`);

      // Update user's current room
      const user = this.connectedUsers.get(socket.userId);
      if (user) {
        user.currentRoomId = conversationId;
        this.connectedUsers.set(socket.userId, user);
      }

      // Notify other participants
      socket.to(`conversation:${conversationId}`).emit('user:joined', {
        userId: socket.userId,
        conversationId
      });

      logger.info('User joined conversation', {
        userId: socket.userId,
        conversationId
      });
    } catch (error) {
      logger.error('Error joining conversation:', error);
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

  private handleTypingStart(socket: AuthenticatedSocket, conversationId: string): void {
    if (!socket.userId) return;

    const user = this.connectedUsers.get(socket.userId);
    if (user) {
      user.isTyping = true;
      user.typingInRoom = conversationId;
      this.connectedUsers.set(socket.userId, user);
    }

    socket.to(`conversation:${conversationId}`).emit('typing:start', {
      userId: socket.userId,
      conversationId
    });
  }

  private handleTypingStop(socket: AuthenticatedSocket, conversationId: string): void {
    if (!socket.userId) return;

    const user = this.connectedUsers.get(socket.userId);
    if (user) {
      user.isTyping = false;
      user.typingInRoom = undefined;
      this.connectedUsers.set(socket.userId, user);
    }

    socket.to(`conversation:${conversationId}`).emit('typing:stop', {
      userId: socket.userId,
      conversationId
    });
  }

  private async handleMessageSend(socket: AuthenticatedSocket, data: any): Promise<void> {
    try {
      if (!socket.userId) return;

      const { conversationId, content, type = 'TEXT', metadata, replyToId } = data;

      // Verify user is participant in conversation
      const participant = await this.prisma.userRoom.findFirst({
        where: {
          roomId: conversationId,
          userId: socket.userId
        }
      });

      if (!participant) {
        socket.emit('error', { message: 'Access denied to this conversation' });
        return;
      }

      // Map the type to MessageType enum
      const messageType = this.mapMessageType(type);

      // Save message to database
      const message = await this.prisma.message.create({
        data: {
          roomId: conversationId,
          senderId: socket.userId,
          content,
          messageType,
          metadata: metadata || undefined,
          replyToId: replyToId || undefined,
          voiceUrl: metadata?.voiceUrl,
          voiceDuration: metadata?.voiceDuration,
          voiceSize: metadata?.voiceSize,
          imageUrl: metadata?.imageUrl,
          imageWidth: metadata?.imageWidth,
          imageHeight: metadata?.imageHeight,
          imageSize: metadata?.imageSize
        }
      });

      // Update room's lastActivity
      await this.prisma.chatRoom.update({
        where: { roomId: conversationId },
        data: { lastActivity: new Date() }
      });

      // Broadcast message to conversation participants
      socket.to(`conversation:${conversationId}`).emit('message:received', {
        id: message.id,
        messageId: message.messageId,
        senderId: socket.userId,
        conversationId,
        content,
        type: messageType,
        metadata,
        replyToId,
        timestamp: message.timestamp
      });

      // Send confirmation to sender
      socket.emit('message:sent', {
        id: message.id,
        messageId: message.messageId,
        conversationId,
        timestamp: message.timestamp
      });

      logger.info('Message sent and saved via socket', {
        messageId: message.messageId,
        senderId: socket.userId,
        conversationId,
        type: messageType
      });
    } catch (error) {
      logger.error('Error handling message send:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  }

  private mapMessageType(type: string): 'TEXT' | 'VOICE' | 'IMAGE' | 'EMOJI' | 'SYSTEM' | 'FILE' | 'LOCATION' | 'STICKER' {
    const typeMap: Record<string, 'TEXT' | 'VOICE' | 'IMAGE' | 'EMOJI' | 'SYSTEM' | 'FILE' | 'LOCATION' | 'STICKER'> = {
      'TEXT': 'TEXT',
      'VOICE': 'VOICE',
      'IMAGE': 'IMAGE',
      'EMOJI': 'EMOJI',
      'SYSTEM': 'SYSTEM',
      'FILE': 'FILE',
      'LOCATION': 'LOCATION',
      'STICKER': 'STICKER'
    };
    return typeMap[type.toUpperCase()] || 'TEXT';
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

  private handleUserDisconnection(socket: AuthenticatedSocket): void {
    if (!socket.userId) return;

    const user = this.connectedUsers.get(socket.userId);
    if (user) {
      user.isOnline = false;
      user.lastSeen = new Date();
      this.connectedUsers.set(socket.userId, user);

      // Notify other users that this user is offline
      socket.broadcast.emit('user:offline', {
        userId: socket.userId,
        isOnline: false,
        lastSeen: user.lastSeen
      });

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

  // Public methods for external use
  public emitToUser(userId: string, event: string, data: any): void {
    const user = this.connectedUsers.get(userId);
    if (user && user.isOnline) {
      this.io.to(user.socketId).emit(event, data);
    }
  }

  public emitToConversation(conversationId: string, event: string, data: any, excludeUserId?: string): void {
    const room = `conversation:${conversationId}`;
    if (excludeUserId) {
      const user = this.connectedUsers.get(excludeUserId);
      if (user) {
        this.io.to(room).except(user.socketId).emit(event, data);
      }
    } else {
      this.io.to(room).emit(event, data);
    }
  }

  public getUserStatus(userId: string): SocketUser | undefined {
    return this.connectedUsers.get(userId);
  }

  public getOnlineUsers(): SocketUser[] {
    return Array.from(this.connectedUsers.values()).filter(user => user.isOnline);
  }
}