import { Server as SocketIOServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { 
  CallRoom, 
  CallParticipant, 
  VideoCallRequest, 
  VideoCallResponse, 
  WebRTCSignal,
  VideoControlEvent,
  CallQualityReport,
  SocketAuthData 
} from '../types';
import { logger } from '../utils/logger';
import { interactionConfig } from '../utils/config';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

export class WebRTCSignalingService {
  private io: SocketIOServer;
  private rooms: Map<string, CallRoom> = new Map();
  private userRooms: Map<string, string> = new Map(); // userId -> roomId
  private prisma: PrismaClient;
  private redis: InstanceType<typeof Redis>;

  constructor(io: SocketIOServer, prisma: PrismaClient) {
    this.io = io;
    this.prisma = prisma;
    this.redis = new Redis(interactionConfig.redis.url);
    
    // Setup Redis adapter for Socket.IO clustering
    const pubClient = new Redis(interactionConfig.redis.url);
    const subClient = pubClient.duplicate();
    this.io.adapter(createAdapter(pubClient, subClient));
    
    this.setupSocketHandlers();
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      logger.info(`Socket connected: ${socket.id}`);
      
      // Authenticate socket connection
      socket.on('authenticate', async (data: SocketAuthData) => {
        try {
          const decoded = jwt.verify(data.token, interactionConfig.jwt.secret) as any;
          socket.data.userId = decoded.userId;
          socket.data.gender = data.gender;
          socket.join(`user:${decoded.userId}`);
          
          logger.info(`Socket authenticated for user: ${decoded.userId}`);
          socket.emit('authenticated', { success: true });
        } catch (error) {
          logger.error('Socket authentication failed:', error);
          socket.emit('authentication-error', { message: 'Invalid token' });
          socket.disconnect();
        }
      });

      // Join call room
      socket.on('join-room', async (roomId: string) => {
        await this.handleJoinRoom(socket, roomId);
      });

      // WebRTC signaling events
      socket.on('webrtc-signal', async (signal: WebRTCSignal) => {
        await this.handleWebRTCSignal(socket, signal);
      });

      // Video control events (female-centric control)
      socket.on('request-video', async (data: VideoControlEvent) => {
        await this.handleVideoRequest(socket, data);
      });

      socket.on('accept-video', async (data: VideoControlEvent) => {
        await this.handleVideoAcceptance(socket, data);
      });

      socket.on('reject-video', async (data: VideoControlEvent) => {
        await this.handleVideoRejection(socket, data);
      });

      // Call quality reporting
      socket.on('quality-report', async (report: CallQualityReport) => {
        await this.handleQualityReport(socket, report);
      });

      // End call
      socket.on('end-call', async (roomId: string) => {
        await this.handleEndCall(socket, roomId);
      });

      // Disconnect handling
      socket.on('disconnect', async () => {
        await this.handleDisconnect(socket);
      });
    });
  }

  private async handleJoinRoom(socket: Socket, roomId: string): Promise<void> {
    try {
      const userId = socket.data.userId;
      const gender = socket.data.gender;
      
      if (!userId || !gender) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      // Get or create room
      let room = this.rooms.get(roomId);
      if (!room) {
        room = {
          id: roomId,
          participants: new Map(),
          status: 'waiting',
          videoEnabled: false,
          videoRequestPending: false,
          createdAt: new Date()
        };
        this.rooms.set(roomId, room);
        
        // Create interaction record
        await this.createInteractionRecord(roomId, userId);
      }

      // Check if room is full
      if (room.participants.size >= 2) {
        socket.emit('error', { message: 'Room is full' });
        return;
      }

      // Add participant to room
      const participant: CallParticipant = {
        userId,
        socketId: socket.id,
        gender,
        hasVideo: false,
        connectionState: 'connecting',
        joinedAt: new Date()
      };

      room.participants.set(userId, participant);
      this.userRooms.set(userId, roomId);
      socket.join(roomId);

      // If this is the second participant, start the call
      if (room.participants.size === 2) {
        room.status = 'active';
        await this.updateInteractionStatus(roomId, 'CONNECTED');
        
        // Notify both participants
        this.io.to(roomId).emit('call-started', {
          roomId,
          participants: Array.from(room.participants.values()).map(p => ({
            userId: p.userId,
            gender: p.gender,
            hasVideo: p.hasVideo
          }))
        });

        logger.info(`Call started in room ${roomId} with 2 participants`);
      }

      socket.emit('joined-room', { roomId, participant });
      
    } catch (error) {
      logger.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  }

  private async handleWebRTCSignal(socket: Socket, signal: WebRTCSignal): Promise<void> {
    try {
      const room = this.rooms.get(signal.roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      // Log the signaling event
      await this.logCallEvent(signal.roomId, signal.type.toUpperCase().replace('-', '_'), signal.userId, {
        hasVideo: signal.hasVideo || false
      });

      // Forward signal to other participant(s)
      socket.to(signal.roomId).emit('webrtc-signal', signal);
      
      logger.info(`WebRTC signal ${signal.type} forwarded in room ${signal.roomId}`);
      
    } catch (error) {
      logger.error('Error handling WebRTC signal:', error);
      socket.emit('error', { message: 'Failed to process signal' });
    }
  }

  private async handleVideoRequest(socket: Socket, data: VideoControlEvent): Promise<void> {
    try {
      const room = this.rooms.get(data.roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      const requestingUser = room.participants.get(data.userId);
      if (!requestingUser) {
        socket.emit('error', { message: 'User not in room' });
        return;
      }

      // Find the female participant (she has the control)
      const femaleParticipant = Array.from(room.participants.values())
        .find(p => p.gender === 'female');
      
      if (!femaleParticipant) {
        socket.emit('error', { message: 'No female participant found for video control' });
        return;
      }

      // Set video request pending
      room.videoRequestedBy = data.userId;
      room.videoRequestPending = true;

      // Log the video request
      await this.logCallEvent(data.roomId, 'VIDEO_REQUESTED', data.userId);

      // Notify the female participant about the video request
      this.io.to(`user:${femaleParticipant.userId}`).emit('video-requested', {
        roomId: data.roomId,
        requestedBy: data.userId,
        timestamp: new Date()
      });

      // Notify the requester that request was sent
      socket.emit('video-request-sent', {
        roomId: data.roomId,
        timestamp: new Date()
      });

      logger.info(`Video request from ${data.userId} sent to female user ${femaleParticipant.userId} in room ${data.roomId}`);
      
    } catch (error) {
      logger.error('Error handling video request:', error);
      socket.emit('error', { message: 'Failed to process video request' });
    }
  }

  private async handleVideoAcceptance(socket: Socket, data: VideoControlEvent): Promise<void> {
    try {
      const room = this.rooms.get(data.roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      const acceptingUser = room.participants.get(data.userId);
      if (!acceptingUser || acceptingUser.gender !== 'female') {
        socket.emit('error', { message: 'Only female participants can accept video requests' });
        return;
      }

      if (!room.videoRequestPending) {
        socket.emit('error', { message: 'No pending video request' });
        return;
      }

      // Enable video for the room
      room.videoEnabled = true;
      room.videoRequestPending = false;

      // Update participants to have video
      room.participants.forEach(participant => {
        participant.hasVideo = true;
      });

      // Update interaction record
      await this.updateInteractionVideoStatus(data.roomId, true, data.userId);

      // Log the video acceptance
      await this.logCallEvent(data.roomId, 'VIDEO_ACCEPTED', data.userId);
      await this.logCallEvent(data.roomId, 'VIDEO_ENABLED', undefined, { enabledBy: data.userId });

      // Notify all participants that video is enabled
      this.io.to(data.roomId).emit('video-enabled', {
        roomId: data.roomId,
        enabledBy: data.userId,
        timestamp: new Date()
      });

      logger.info(`Video enabled in room ${data.roomId} by female user ${data.userId}`);
      
    } catch (error) {
      logger.error('Error handling video acceptance:', error);
      socket.emit('error', { message: 'Failed to accept video request' });
    }
  }

  private async handleVideoRejection(socket: Socket, data: VideoControlEvent): Promise<void> {
    try {
      const room = this.rooms.get(data.roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      const rejectingUser = room.participants.get(data.userId);
      if (!rejectingUser || rejectingUser.gender !== 'female') {
        socket.emit('error', { message: 'Only female participants can reject video requests' });
        return;
      }

      if (!room.videoRequestPending) {
        socket.emit('error', { message: 'No pending video request' });
        return;
      }

      // Clear video request
      room.videoRequestPending = false;
      const requestedBy = room.videoRequestedBy;
      room.videoRequestedBy = undefined;

      // Log the video rejection
      await this.logCallEvent(data.roomId, 'VIDEO_REJECTED', data.userId);

      // Notify all participants that video was rejected
      this.io.to(data.roomId).emit('video-rejected', {
        roomId: data.roomId,
        rejectedBy: data.userId,
        originalRequester: requestedBy,
        timestamp: new Date()
      });

      logger.info(`Video request rejected in room ${data.roomId} by female user ${data.userId}`);
      
    } catch (error) {
      logger.error('Error handling video rejection:', error);
      socket.emit('error', { message: 'Failed to reject video request' });
    }
  }

  private async handleQualityReport(socket: Socket, report: CallQualityReport): Promise<void> {
    try {
      // Store quality report in database
      await this.logCallEvent(report.roomId, 'QUALITY_REPORT', report.userId, {
        connectionQuality: report.connectionQuality,
        audioQuality: report.audioQuality,
        videoQuality: report.videoQuality,
        latency: report.latency,
        packetLoss: report.packetLoss
      });

      logger.info(`Quality report received for room ${report.roomId} from user ${report.userId}`);
      
    } catch (error) {
      logger.error('Error handling quality report:', error);
    }
  }

  private async handleEndCall(socket: Socket, roomId: string): Promise<void> {
    try {
      const room = this.rooms.get(roomId);
      if (!room) {
        return;
      }

      const userId = socket.data.userId;
      
      // End the call for all participants
      room.status = 'ended';
      room.endedAt = new Date();

      // Calculate call duration
      const duration = Math.floor((room.endedAt.getTime() - room.createdAt.getTime()) / 1000);

      // Update interaction record
      await this.updateInteractionEnd(roomId, duration);

      // Log call end event
      await this.logCallEvent(roomId, 'CALL_ENDED', userId);

      // Notify all participants
      this.io.to(roomId).emit('call-ended', {
        roomId,
        endedBy: userId,
        duration,
        timestamp: room.endedAt
      });

      // Clean up
      room.participants.forEach(participant => {
        this.userRooms.delete(participant.userId);
      });
      this.rooms.delete(roomId);

      logger.info(`Call ended in room ${roomId} by user ${userId}, duration: ${duration}s`);
      
    } catch (error) {
      logger.error('Error ending call:', error);
    }
  }

  private async handleDisconnect(socket: Socket): Promise<void> {
    try {
      const userId = socket.data.userId;
      if (!userId) return;

      const roomId = this.userRooms.get(userId);
      if (roomId) {
        await this.handleEndCall(socket, roomId);
      }

      logger.info(`Socket disconnected: ${socket.id}, user: ${userId}`);
      
    } catch (error) {
      logger.error('Error handling disconnect:', error);
    }
  }

  // Database helper methods
  private async createInteractionRecord(roomId: string, initiatorUserId: string): Promise<void> {
    try {
      // In a real implementation, you'd get the second user ID from the queuing service
      await this.prisma.interaction.create({
        data: {
          roomId,
          user1Id: initiatorUserId,
          user2Id: 'placeholder', // This should come from the matching service
          status: 'INITIATED',
          callType: 'VOICE'
        }
      });
    } catch (error) {
      logger.error('Error creating interaction record:', error);
    }
  }

  private async updateInteractionStatus(roomId: string, status: string): Promise<void> {
    try {
      await this.prisma.interaction.update({
        where: { roomId },
        data: { status: status as any }
      });
    } catch (error) {
      logger.error('Error updating interaction status:', error);
    }
  }

  private async updateInteractionVideoStatus(roomId: string, videoEnabled: boolean, enabledBy: string): Promise<void> {
    try {
      await this.prisma.interaction.update({
        where: { roomId },
        data: {
          callType: videoEnabled ? 'VIDEO' : 'VOICE',
          videoRequested: true,
          videoRequestedBy: enabledBy,
          videoRequestedAt: new Date(),
          videoEnabled,
          videoEnabledAt: videoEnabled ? new Date() : null
        }
      });
    } catch (error) {
      logger.error('Error updating interaction video status:', error);
    }
  }

  private async updateInteractionEnd(roomId: string, duration: number): Promise<void> {
    try {
      await this.prisma.interaction.update({
        where: { roomId },
        data: {
          status: 'COMPLETED',
          endedAt: new Date(),
          duration
        }
      });
    } catch (error) {
      logger.error('Error updating interaction end:', error);
    }
  }

  private async logCallEvent(interactionId: string, eventType: string, userId?: string, metadata?: any): Promise<void> {
    try {
      await this.prisma.callEvent.create({
        data: {
          interactionId,
          eventType: eventType as any,
          userId,
          metadata
        }
      });
    } catch (error) {
      logger.error('Error logging call event:', error);
    }
  }

  public getActiveRooms(): CallRoom[] {
    return Array.from(this.rooms.values());
  }

  public getRoomStats() {
    const totalRooms = this.rooms.size;
    const activeRooms = Array.from(this.rooms.values()).filter(room => room.status === 'active').length;
    const videoEnabledRooms = Array.from(this.rooms.values()).filter(room => room.videoEnabled).length;
    
    return {
      totalRooms,
      activeRooms,
      videoEnabledRooms,
      totalParticipants: Array.from(this.rooms.values()).reduce((sum, room) => sum + room.participants.size, 0)
    };
  }
}