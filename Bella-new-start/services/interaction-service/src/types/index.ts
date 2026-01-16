export interface VideoCallRequest {
  roomId: string;
  requestedBy: string;
  timestamp: Date;
}

export interface VideoCallResponse {
  roomId: string;
  accepted: boolean;
  respondedBy: string;
  timestamp: Date;
}

export interface WebRTCSignal {
  roomId: string;
  userId: string;
  type: 'offer' | 'answer' | 'ice-candidate';
  data: any;
  hasVideo?: boolean;
}

export interface CallParticipant {
  userId: string;
  socketId: string;
  gender: 'male' | 'female';
  hasVideo: boolean;
  connectionState: 'connecting' | 'connected' | 'disconnected';
  joinedAt: Date;
}

export interface CallRoom {
  id: string;
  participants: Map<string, CallParticipant>;
  status: 'waiting' | 'active' | 'ended';
  videoEnabled: boolean;
  videoRequestedBy?: string;
  videoRequestPending: boolean;
  createdAt: Date;
  endedAt?: Date;
}

export interface SocketAuthData {
  userId: string;
  gender: 'male' | 'female';
  token: string;
}

export interface VideoControlEvent {
  type: 'request-video' | 'accept-video' | 'reject-video' | 'video-enabled';
  roomId: string;
  userId: string;
  data?: any;
}

export interface CallQualityReport {
  roomId: string;
  userId: string;
  timestamp: Date;
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor';
  audioQuality: number; // 1-5 scale
  videoQuality?: number; // 1-5 scale
  latency: number; // in ms
  packetLoss: number; // percentage
}

export interface InteractionEvent {
  interactionId: string;
  eventType: string;
  userId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}