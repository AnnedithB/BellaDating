/**
 * Shared TypeScript type definitions for Real-time Connect
 */

// ===========================================
// USER TYPES
// ===========================================

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  emailVerified: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
}

export interface Profile {
  id: string;
  userId: string;
  displayName: string;
  shortBio?: string;
  photos: string[];
  videos: string[];
  intent: Intent;
  age?: number;
  locationCity?: string;
  locationCountry?: string;
  preferences: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSession {
  id: string;
  userId: string;
  socketId?: string;
  status: UserStatus;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export type UserRole = 'male' | 'female' | 'admin';
export type UserStatus = 'online' | 'offline' | 'in-call' | 'queuing';
export type Intent = 'casual' | 'friends' | 'serious' | 'networking';

// ===========================================
// INTERACTION TYPES
// ===========================================

export interface InteractionLog {
  id: string;
  user1Id: string;
  user2Id: string;
  roomId: string;
  interactionType: InteractionType;
  startedAt: Date;
  endedAt?: Date;
  durationSeconds: number;
  outcome: InteractionOutcome;
  femaleUserId?: string;
  metadata: Record<string, any>;
}

export interface Connection {
  id: string;
  user1Id: string;
  user2Id: string;
  interactionLogId: string;
  femaleUserId: string;
  connectionType: ConnectionType;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface VideoRequest {
  id: string;
  connectionId: string;
  requesterUserId: string;
  approverUserId: string;
  status: VideoRequestStatus;
  requestedAt: Date;
  respondedAt?: Date;
  expiresAt: Date;
  metadata: Record<string, any>;
}

export type InteractionType = 'voice_call' | 'video_call';
export type InteractionOutcome = 'no_action' | 'female_connected' | 'both_left' | 'timeout';
export type ConnectionType = 'chat_only' | 'video_enabled';
export type VideoRequestStatus = 'pending' | 'approved' | 'rejected' | 'expired';

// ===========================================
// COMMUNICATION TYPES
// ===========================================

export interface ChatRoom {
  id: string;
  connectionId: string;
  roomName: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  chatRoomId: string;
  senderUserId: string;
  content: string;
  messageType: MessageType;
  metadata: Record<string, any>;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageReadStatus {
  id: string;
  messageId: string;
  userId: string;
  readAt: Date;
}

export type MessageType = 'text' | 'image' | 'video' | 'voice' | 'system';

// ===========================================
// API RESPONSE TYPES
// ===========================================

export interface ApiResponse<T = any> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
  code?: string;
  details?: Record<string, any>;
  meta: {
    timestamp: string;
    requestId: string;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore?: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

// ===========================================
// AUTHENTICATION TYPES
// ===========================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface AuthResponse {
  user: User;
  token: string;
  expiresIn: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

// ===========================================
// WEBSOCKET TYPES
// ===========================================

export interface SocketUser {
  userId: string;
  socketId: string;
  status: UserStatus;
  connectedAt: Date;
}

// Queue Service WebSocket Events
export interface QueueEvents {
  authenticate: (data: { token: string }) => void;
  'join-queue': (data: { intent: Intent }) => void;
  'leave-queue': () => void;
  'update-status': (data: { status: UserStatus }) => void;
}

export interface QueueEmitEvents {
  authenticated: (data: { userId: string; status: UserStatus }) => void;
  'queue-joined': (data: { intent: Intent; position: number; estimatedWaitTime: number }) => void;
  'queue-left': (data: { reason: string }) => void;
  'status-updated': (data: { status: UserStatus; timestamp: string }) => void;
  error: (data: { code: string; message: string }) => void;
}

// Interaction Service WebSocket Events
export interface InteractionEvents {
  authenticate: (data: { token: string }) => void;
  offer: (data: { roomId: string; offer: any }) => void;
  answer: (data: { roomId: string; answer: any }) => void;
  'ice-candidate': (data: { roomId: string; candidate: any }) => void;
  'leave-room': (data: { roomId: string }) => void;
}

export interface InteractionEmitEvents {
  'found-match': (data: MatchFoundEvent) => void;
  'offer-received': (data: { roomId: string; offer: any; from: string }) => void;
  'answer-received': (data: { roomId: string; answer: any; from: string }) => void;
  'ice-candidate-received': (data: { roomId: string; candidate: any; from: string }) => void;
  'call-ended': (data: CallEndedEvent) => void;
  'peer-left': (data: { roomId: string; userId: string }) => void;
  error: (data: { code: string; message: string }) => void;
}

// Communication Service WebSocket Events
export interface CommunicationEvents {
  authenticate: (data: { token: string }) => void;
  'join-room': (data: { roomName: string }) => void;
  'leave-room': (data: { roomName: string }) => void;
  'send-message': (data: SendMessageEvent) => void;
  'typing-start': (data: { roomName: string }) => void;
  'typing-stop': (data: { roomName: string }) => void;
}

export interface CommunicationEmitEvents {
  'room-joined': (data: { roomName: string; partnerId: string }) => void;
  'message-received': (data: MessageReceivedEvent) => void;
  'typing-indicator': (data: { roomName: string; userId: string; isTyping: boolean }) => void;
  'user-online': (data: { roomName: string; userId: string }) => void;
  'user-offline': (data: { roomName: string; userId: string }) => void;
  error: (data: { code: string; message: string }) => void;
}

// ===========================================
// EVENT PAYLOAD TYPES
// ===========================================

export interface MatchFoundEvent {
  roomId: string;
  partnerId: string;
  partnerProfile: {
    displayName: string;
    photos: string[];
    age?: number;
  };
  callDuration: number;
  interactionLogId: string;
}

export interface CallEndedEvent {
  roomId: string;
  reason: 'timeout' | 'user_left' | 'error';
  duration: number;
  interactionLogId: string;
}

export interface SendMessageEvent {
  roomName: string;
  content: string;
  messageType: MessageType;
  metadata?: Record<string, any>;
}

export interface MessageReceivedEvent {
  roomName: string;
  message: {
    id: string;
    senderId: string;
    content: string;
    messageType: MessageType;
    metadata: Record<string, any>;
    createdAt: string;
  };
}

// ===========================================
// QUEUE TYPES
// ===========================================

export interface QueuedUser {
  userId: string;
  socketId: string;
  intent: Intent;
  profile: {
    displayName: string;
    photos: string[];
    age?: number;
  };
  queuedAt: Date;
}

export interface QueueStatus {
  userStatus: UserStatus;
  queuePosition?: number;
  estimatedWaitTime?: number;
  intent?: Intent;
  totalInQueue: number;
}

// ===========================================
// FILE UPLOAD TYPES
// ===========================================

export interface FileUploadRequest {
  file: {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    buffer: any; // Buffer type
  };
  type: 'photo' | 'video';
}

export interface FileUploadResponse {
  url: string;
  type: 'photo' | 'video';
  uploadedAt: string;
}

// ===========================================
// ERROR TYPES
// ===========================================

export interface ErrorDetails {
  field?: string;
  code?: string;
  message: string;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: ErrorDetails[];
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: ErrorDetails[]
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    // Capture stack trace if available (Node.js specific)
    if (typeof (Error as any).captureStackTrace === 'function') {
      (Error as any).captureStackTrace(this, this.constructor);
    }
  }
}

// ===========================================
// UTILITY TYPES
// ===========================================

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequireOnly<T, K extends keyof T> = Partial<T> & Pick<T, K>;

// Database entity creation types (without auto-generated fields)
export type CreateUser = Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'lastLogin'>;
export type CreateProfile = Omit<Profile, 'id' | 'createdAt' | 'updatedAt'>;
export type CreateInteractionLog = Omit<InteractionLog, 'id'>;
export type CreateConnection = Omit<Connection, 'id' | 'createdAt' | 'updatedAt'>;
export type CreateMessage = Omit<Message, 'id' | 'createdAt' | 'updatedAt'>;

// Update types (all fields optional except ID)
export type UpdateUser = Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>> & { id: string };
export type UpdateProfile = Partial<Omit<Profile, 'id' | 'userId' | 'createdAt' | 'updatedAt'>> & { id: string };
export type UpdateConnection = Partial<Omit<Connection, 'id' | 'createdAt' | 'updatedAt'>> & { id: string };

// ===========================================
// SERVICE COMMUNICATION TYPES
// ===========================================

export interface ServiceHealthCheck {
  service: string;
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  details?: Record<string, any>;
}

export interface InterServiceRequest<T = any> {
  data: T;
  requestId: string;
  timestamp: string;
  source: string;
}

export interface InterServiceResponse<T = any> {
  data?: T;
  success: boolean;
  error?: string;
  requestId: string;
  timestamp: string;
}

// ===========================================
// INTERNATIONALIZATION TYPES
// ===========================================

export interface ISupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
  region: string;
  direction: 'ltr' | 'rtl';
  flag: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  numberFormat: string;
  currency: string;
}

export interface ICulturalPreferences {
  dateFormat?: string;
  timeFormat?: '12h' | '24h';
  numberFormat?: string;
  currency?: string;
  direction?: 'ltr' | 'rtl';
  firstDayOfWeek?: number; // 0 = Sunday, 1 = Monday
  measurementSystem?: 'metric' | 'imperial';
  paperSize?: 'A4' | 'Letter';
}

export interface ILocalizationContext {
  language: string;
  region: string;
  direction: 'ltr' | 'rtl';
  locale: string;
  culturalPreferences: ICulturalPreferences;
  supportedLanguage?: ISupportedLanguage;
}

export interface ITranslationConfig {
  fallbackLng: string;
  debug: boolean;
  interpolation: {
    escapeValue: boolean;
    format?: (value: any, format: string | undefined, lng: string | undefined) => string;
  };
  detection: {
    order: string[];
    caches: string[];
    lookupQuerystring?: string;
    lookupCookie?: string;
    lookupLocalStorage?: string;
    lookupSessionStorage?: string;
    cookieMinutes?: number;
    cookieDomain?: string;
  };
  backend: {
    loadPath: string;
    addPath?: string;
    allowMultiLoading?: boolean;
    crossDomain?: boolean;
    withCredentials?: boolean;
    overrideMimeType?: boolean;
    requestOptions?: RequestInit;
  };
  react: {
    bindI18n?: string;
    bindI18nStore?: string;
    transEmptyNodeValue?: string;
    transSupportBasicHtmlNodes?: boolean;
    transKeepBasicHtmlNodesFor?: string[];
    useSuspense?: boolean;
  };
  saveMissing?: boolean;
  saveMissingTo?: string;
  missingKeyHandler?: (lng: readonly string[], ns: string, key: string, fallbackValue: string) => void;
}

export interface IFormattingOptions {
  number?: Intl.NumberFormatOptions;
  currency?: {
    currency?: string;
    options?: Intl.NumberFormatOptions;
  };
  date?: Intl.DateTimeFormatOptions;
  time?: Intl.DateTimeFormatOptions;
  relativeTime?: Intl.RelativeTimeFormatOptions;
}

export interface ITranslationNamespace {
  [key: string]: string | ITranslationNamespace;
}

export interface ILanguageResource {
  [namespace: string]: ITranslationNamespace;
}

export interface ITranslationResources {
  [language: string]: ILanguageResource;
}