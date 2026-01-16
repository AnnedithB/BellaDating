import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role?: string;
  };
  body: any;
  params: any;
  query: any;
  file?: any;
}

export interface AuthenticatedSocket {
  userId: string;
  email: string;
  role?: string;
}

export interface SocketUser {
  userId: string;
  socketId: string;
  isOnline: boolean;
  currentRoomId?: string;
  isTyping: boolean;
  typingInRoom?: string;
  lastSeen: Date;
}

export interface MessageData {
  messageId: string;
  roomId: string;
  senderId: string;
  content: string;
  messageType: 'TEXT' | 'VOICE' | 'IMAGE' | 'EMOJI' | 'SYSTEM';
  voiceUrl?: string;
  voiceDuration?: number;
  imageUrl?: string;
  replyToId?: string;
  timestamp: Date;
  metadata?: any;
}

export interface TypingData {
  roomId: string;
  userId: string;
  isTyping: boolean;
}

export interface RoomJoinData {
  roomId: string;
  userId?: string; // For private rooms with specific user
}

export interface MessageDeliveryUpdate {
  messageId: string;
  status: 'delivered' | 'read';
  timestamp: Date;
}

export interface VoiceNoteUpload {
  file: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
}