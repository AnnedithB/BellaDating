export interface User {
  id: string;
  email: string;
  username: string;
  name?: string;
  bio?: string;
  age?: number;
  gender?: string;
  interests?: string[];
  location?: string;
  profilePicture?: string;
  isOnline: boolean;
  lastSeen?: Date;
  isActive: boolean;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  id: string;
  userId: string;
  displayName?: string;
  bio?: string;
  location?: string;
  interests: string[];
  profilePicture?: string;
  isPublic: boolean;
  showAge: boolean;
  showLocation: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface InteractionSession {
  id: string;
  user1Id: string;
  user2Id: string;
  type: string;
  status: string;
  startedAt: Date;
  endedAt?: Date;
  metadata?: any;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  senderId: string;
  content: string;
  messageType: string;
  metadata?: any;
  sentAt: Date;
  deliveredAt?: Date;
  readAt?: Date;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  data?: any;
  read: boolean;
  createdAt: Date;
}

export interface UserReport {
  id: string;
  reporterId: string;
  reportedUserId: string;
  sessionId?: string;
  reason: string;
  description?: string;
  status: string;
  priority: string;
  createdAt: Date;
}

export interface QueueStatus {
  userId: string;
  status: string;
  position?: number;
  estimatedWaitTime?: number;
  preferences?: any;
  joinedAt: Date;
}

export interface Connection {
  id: string;
  user1Id: string;
  user2Id: string;
  connectionType: string;
  status: string;
  matchScore?: number;
  createdAt: Date;
}

export interface AuthContext {
  user?: User;
  token?: string;
}

export interface DataLoaders {
  userLoader: any;
  profileLoader: any;
  sessionLoader: any;
  messageLoader: any;
  notificationLoader: any;
}

export interface GraphQLContext {
  auth: AuthContext;
  dataSources: DataLoaders & {
    userService: any;
    interactionService: any;
    communicationService: any;
    queuingService: any;
    notificationService: any;
    analyticsService: any;
    historyService: any;
    moderationService: any;
  };
}