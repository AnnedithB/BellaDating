import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import DataLoader from 'dataloader';

export class APIDataSource {
  protected http: AxiosInstance;
  protected context?: any;
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.http = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  initialize(context: any) {
    this.context = context;

    // Recreate axios instance with auth header if token exists
    const token = context?.auth?.token;
    this.http = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });
  }
  
  protected async get(path: string, params?: any) {
    try {
      const response = await this.http.get(path, { params });
      return response.data;
    } catch (error) {
      console.error(`API Error (GET ${path}):`, error);
      throw error;
    }
  }
  
  protected async post(path: string, data?: any) {
    try {
      const response = await this.http.post(path, data);
      return response.data;
    } catch (error) {
      console.error(`API Error (POST ${path}):`, error);
      throw error;
    }
  }
  
  protected async put(path: string, data?: any) {
    try {
      const response = await this.http.put(path, data);
      return response.data;
    } catch (error) {
      console.error(`API Error (PUT ${path}):`, error);
      throw error;
    }
  }
  
  protected async delete(path: string) {
    try {
      const response = await this.http.delete(path);
      return response.data;
    } catch (error) {
      console.error(`API Error (DELETE ${path}):`, error);
      throw error;
    }
  }
}

export class UserService extends APIDataSource {
  constructor() {
    super(config.services.user);
  }

  async getUser(id: string) {
    // User service doesn't have a /users/:id endpoint
    // Profile data comes from /profile (authenticated)
    return null;
  }

  async getUsers(limit = 20, offset = 0) {
    return this.get('/users', { limit, offset });
  }

  async searchUsers(query: string, limit = 20) {
    return this.get('/users/search', { query, limit });
  }

  async createUser(userData: any) {
    return this.post('/users', userData);
  }

  async updateUser(id: string, userData: any) {
    return this.put(`/users/${id}`, userData);
  }

  async deleteUser(id: string) {
    return this.delete(`/users/${id}`);
  }

  async getUserProfile(userId: string) {
    // User service profile routes are at /profile (with auth)
    try {
      const response = await this.get('/profile');
      console.log('[getUserProfile] Raw response:', JSON.stringify(response, null, 2));
      const profile = response.data?.profile || null;

      if (profile) {
        console.log('[getUserProfile] Profile photos:', profile.photos);
        console.log('[getUserProfile] Profile shortBio:', profile.shortBio);
        console.log('[getUserProfile] Profile displayName:', profile.displayName);
        console.log('[getUserProfile] Profile gender:', profile.gender);
        console.log('[getUserProfile] Profile age:', profile.age);

        // Map backend profile fields to GraphQL UserProfile schema
        const mappedProfile = {
          id: profile.id,
          userId: profile.userId || profile.user_id || userId,
          displayName: profile.displayName || profile.display_name || null,
          bio: profile.shortBio || profile.bio || null,
          location: profile.locationCity || profile.location || null,
          interests: profile.preferences?.interests || profile.interests || [],
          profilePicture: profile.photos?.[0] || profile.profilePicture || null,
          photos: profile.photos || [], // Include all photos
          gender: profile.gender || null, // User's gender (MAN, WOMAN, NONBINARY)
          age: profile.age || null, // User's age
          isPublic: profile.isPublic ?? true,
          showAge: profile.showAge ?? true,
          showLocation: profile.showLocation ?? true,
          createdAt: profile.createdAt || profile.created_at,
          updatedAt: profile.updatedAt || profile.updated_at,
        };
        console.log('[getUserProfile] Mapped profile:', JSON.stringify(mappedProfile, null, 2));
        return mappedProfile;
      }
      return null;
    } catch (error) {
      console.error(`Error getting profile for ${userId}:`, error);
      return null;
    }
  }

  async updateProfile(userId: string, profileData: any) {
    // Map frontend fields to backend expected fields
    const mappedData: any = {};

    // Only set displayName if name has a value (not empty string)
    if (profileData.name !== undefined && profileData.name.trim() !== '') {
      mappedData.displayName = profileData.name.trim();
    }
    if (profileData.bio !== undefined) {
      mappedData.shortBio = profileData.bio;
    }
    if (profileData.location !== undefined && profileData.location.trim() !== '') {
      mappedData.locationCity = profileData.location.trim();
    }
    if (profileData.interests !== undefined && Array.isArray(profileData.interests) && profileData.interests.length > 0) {
      mappedData.preferences = { ...mappedData.preferences, interests: profileData.interests };
    }
    if (profileData.profilePicture !== undefined && profileData.profilePicture !== '') {
      // Photos are stored as an array in backend
      mappedData.photos = [profileData.profilePicture];
    }
    if (profileData.age !== undefined) {
      mappedData.age = profileData.age;
    }
    if (profileData.gender !== undefined) {
      mappedData.gender = profileData.gender;
    }

    // Pass through any other fields that match backend schema (only if they have values)
    const passthroughFields = ['displayName', 'shortBio', 'intent', 'locationCity', 'locationCountry'];
    passthroughFields.forEach(field => {
      if (profileData[field] !== undefined && profileData[field] !== '' && mappedData[field] === undefined) {
        mappedData[field] = profileData[field];
      }
    });

    // Don't send empty update
    if (Object.keys(mappedData).length === 0) {
      console.log('No valid fields to update');
      return { data: { profile: {} } };
    }

    return this.put('/profile', mappedData);
  }

  async reportUser(reportData: any) {
    return this.post('/reports', reportData);
  }

  async blockUser(userId: string, targetUserId: string) {
    return this.post(`/users/${userId}/block`, { targetUserId });
  }

  async getConnections(userId: string) {
    try {
      const response = await this.get('/connections');
      console.log('[getConnections] Raw response:', JSON.stringify(response, null, 2));
      return response?.data?.connections || [];
    } catch (error) {
      console.error(`Error getting connections for ${userId}:`, error);
      return [];
    }
  }
}

export class InteractionService extends APIDataSource {
  constructor() {
    super(config.services.interaction);
  }

  async getSession(id: string) {
    try {
      const response = await this.get(`/api/interactions/${id}`);
      return response.data || response;
    } catch (error) {
      console.error(`Error getting session ${id}:`, error);
      return null;
    }
  }

  async getUserSessions(userId: string, limit = 20, offset = 0) {
    try {
      const page = Math.floor(offset / limit) + 1;
      const response = await this.get(`/api/interactions/user/${userId}`, { page, limit });
      // Map the response to match the expected format
      const data = response.data || response;
      return data.interactions || [];
    } catch (error) {
      console.error(`Error getting user sessions for ${userId}:`, error);
      return [];
    }
  }

  async startSession(user1Id: string, user2Id: string, type: string) {
    return this.post('/api/interactions', { user1Id, user2Id, callType: type });
  }

  async endSession(sessionId: string) {
    return this.put(`/api/interactions/${sessionId}/end`);
  }

  async getSessionMessages(sessionId: string, limit = 50, offset = 0) {
    // Messages are handled by communication-service, not interaction-service
    return [];
  }
}

export class CommunicationService extends APIDataSource {
  constructor() {
    super(config.services.communication);
  }
  
  async sendMessage(messageData: any) {
    return this.post('/messages', messageData);
  }
  
  async getMessages(sessionId: string, limit = 50, offset = 0) {
    return this.get(`/messages/${sessionId}`, { limit, offset });
  }
  
  async markMessageAsRead(messageId: string) {
    return this.put(`/messages/${messageId}/read`);
  }
  
  async getMessageHistory(userId: string, limit = 50, offset = 0) {
    return this.get(`/messages/history/${userId}`, { limit, offset });
  }
}

export class QueuingService extends APIDataSource {
  constructor() {
    super(config.services.queuing);
  }

  async joinQueue(userId: string, preferences: any, userProfile: any) {
    // Queuing service expects: userId, intent, gender (user's own gender - required)
    // plus optional: age, latitude, longitude, interests, languages, ethnicity

    // Map user's gender to DatingGender enum (MAN, WOMAN, NONBINARY)
    const mapGenderToDatingGender = (gender: string | null | undefined): string => {
      if (!gender) return 'NONBINARY'; // Default if not set
      const upperGender = gender.toUpperCase();
      switch (upperGender) {
        case 'MALE':
        case 'MAN':
        case 'M':
          return 'MAN';
        case 'FEMALE':
        case 'WOMAN':
        case 'F':
          return 'WOMAN';
        case 'NONBINARY':
        case 'NON-BINARY':
        case 'OTHER':
        default:
          return 'NONBINARY';
      }
    };

    const queueData = {
      userId,
      intent: preferences?.intent || 'CASUAL',
      // Use user's actual gender from their profile, NOT their preference
      gender: mapGenderToDatingGender(userProfile?.gender),
      age: userProfile?.age || preferences?.ageRange?.min || 18,
      interests: userProfile?.interests || preferences?.interests || [],
      languages: preferences?.languages || [],
    };

    console.log('[joinQueue] Sending to queuing service:', JSON.stringify(queueData, null, 2));

    try {
      const response = await this.post('/api/queue/join', queueData);
      console.log('[joinQueue] Response from queuing service:', JSON.stringify(response, null, 2));

      // Map queuing service response to GraphQL QueueStatus type
      // Queuing service returns: { status: 'success', data: { userId, intent } }
      // GraphQL expects: { userId, status, position, estimatedWaitTime, joinedAt }
      if (response?.status === 'success') {
        return {
          userId: response.data?.userId || userId,
          status: 'WAITING',
          position: null, // Will be fetched by getQueueStatus
          estimatedWaitTime: null,
          preferences: preferences,
          joinedAt: new Date().toISOString(),
        };
      }

      // If failed, throw an error
      throw new Error(response?.message || 'Failed to join queue');
    } catch (error: any) {
      // Check if user is already in queue - if so, return their current status
      if (error?.response?.status === 400) {
        console.log('[joinQueue] Got 400, checking if user already in queue...');
        const status = await this.getQueueStatus(userId);
        if (status) {
          console.log('[joinQueue] User already in queue, returning current status');
          return status;
        }
      }
      throw error;
    }
  }

  async leaveQueue(userId: string): Promise<boolean> {
    const response = await this.post('/api/queue/leave', { userId });
    // GraphQL schema expects Boolean!, so return true if successful
    return response?.status === 'success';
  }

  async getQueueStatus(userId: string) {
    const response = await this.get(`/api/queue/status/${userId}`);
    console.log('[getQueueStatus] Response:', JSON.stringify(response, null, 2));

    // Map response to GraphQL QueueStatus type
    // Queuing service returns: { status: 'success', data: { inQueue, position, totalInQueue, ... } }
    const data = response?.data || {};

    if (!data.inQueue) {
      return null; // User not in queue
    }

    return {
      userId,
      status: 'WAITING',
      position: data.position || null,
      estimatedWaitTime: data.totalInQueue ? data.totalInQueue * 30 : null, // Rough estimate: 30s per person
      joinedAt: data.enteredAt || new Date().toISOString(),
    };
  }

  async updatePreferences(userId: string, preferences: any) {
    return this.put(`/api/queue/preferences/${userId}`, preferences);
  }

  async getQueueStatistics() {
    return this.get('/api/queue/stats');
  }
}

export class NotificationService extends APIDataSource {
  constructor() {
    super(config.services.notification);
  }

  async getNotifications(userId: string, limit = 20, offset = 0) {
    try {
      // Notification service routes are at /api/notifications/user/:userId
      const response = await this.get(`/api/notifications/user/${userId}`, { limit, offset });
      console.log('[getNotifications] Raw response:', JSON.stringify(response, null, 2));
      return response?.data?.notifications || [];
    } catch (error) {
      console.error(`Error getting notifications for ${userId}:`, error);
      return [];
    }
  }

  async getUnreadNotifications(userId: string) {
    try {
      const response = await this.get(`/api/notifications/user/${userId}/unread`);
      console.log('[getUnreadNotifications] Raw response:', JSON.stringify(response, null, 2));
      return response?.data?.notifications || [];
    } catch (error) {
      console.error(`Error getting unread notifications for ${userId}:`, error);
      return [];
    }
  }

  async markNotificationAsRead(notificationId: string, userId: string) {
    return this.put(`/api/notifications/${notificationId}/read`, { userId });
  }

  async markAllNotificationsAsRead(userId: string) {
    return this.put(`/api/notifications/user/${userId}/read-all`);
  }

  async sendNotification(notificationData: any) {
    return this.post('/api/notifications/send', notificationData);
  }
}

export class AnalyticsService extends APIDataSource {
  constructor() {
    super(config.services.analytics);
  }
  
  async getAnalytics(period: string) {
    return this.get('/analytics', { period });
  }
  
  async getUserAnalytics(userId: string) {
    return this.get(`/analytics/user/${userId}`);
  }
  
  async trackEvent(eventData: any) {
    return this.post('/analytics/track', eventData);
  }
}

export class HistoryService extends APIDataSource {
  constructor() {
    super(config.services.history);
  }
  
  async logInteraction(interactionData: any) {
    return this.post('/interactions/log', interactionData);
  }
  
  async getInteractionHistory(userId: string, limit = 50, offset = 0) {
    return this.get(`/interactions/history/${userId}`, { limit, offset });
  }
  
  async logUserAction(actionData: any) {
    return this.post('/actions/log', actionData);
  }
}

export class ModerationService extends APIDataSource {
  constructor() {
    super(config.services.moderation);
  }
  
  async moderateContent(content: string, type: string) {
    return this.post('/moderate', { content, type });
  }
  
  async getModerationHistory(limit = 50, offset = 0) {
    return this.get('/moderation/history', { limit, offset });
  }
  
  async reportContent(reportData: any) {
    return this.post('/moderation/report', reportData);
  }
}

// Data Loaders for efficient batching - now accepts context for auth
export function createDataLoaders(context?: any) {
  const userService = new UserService();
  const interactionService = new InteractionService();
  const communicationService = new CommunicationService();
  const notificationService = new NotificationService();

  // Initialize all services with auth context
  if (context) {
    [userService, interactionService, communicationService, notificationService]
      .forEach(ds => ds.initialize(context));
  }

  return {
    userLoader: new DataLoader(async (ids: readonly string[]) => {
      const users = await Promise.all(
        ids.map(id => userService.getUser(id).catch(() => null))
      );
      return users;
    }),

    profileLoader: new DataLoader(async (userIds: readonly string[]) => {
      const profiles = await Promise.all(
        userIds.map(userId => userService.getUserProfile(userId).catch(() => null))
      );
      return profiles;
    }),

    sessionLoader: new DataLoader(async (sessionIds: readonly string[]) => {
      const sessions = await Promise.all(
        sessionIds.map(id => interactionService.getSession(id).catch(() => null))
      );
      return sessions;
    }),

    messageLoader: new DataLoader(async (sessionIds: readonly string[]) => {
      const messageLists = await Promise.all(
        sessionIds.map(sessionId =>
          communicationService.getMessages(sessionId, 50, 0).catch(() => [])
        )
      );
      return messageLists;
    }),

    notificationLoader: new DataLoader(async (userIds: readonly string[]) => {
      const notificationLists = await Promise.all(
        userIds.map(userId =>
          notificationService.getNotifications(userId, 20, 0).catch(() => [])
        )
      );
      return notificationLists;
    }),
  };
}

// Create new data sources for each request (to avoid shared state issues)
export function createDataSources(context?: any) {
  const userService = new UserService();
  const interactionService = new InteractionService();
  const communicationService = new CommunicationService();
  const queuingService = new QueuingService();
  const notificationService = new NotificationService();
  const analyticsService = new AnalyticsService();
  const historyService = new HistoryService();
  const moderationService = new ModerationService();

  // Initialize all with context if provided
  if (context) {
    [userService, interactionService, communicationService, queuingService,
     notificationService, analyticsService, historyService, moderationService]
      .forEach(ds => ds.initialize(context));
  }

  return {
    userService,
    interactionService,
    communicationService,
    queuingService,
    notificationService,
    analyticsService,
    historyService,
    moderationService,
  };
}

// Legacy export for backwards compatibility
export const dataSources = createDataSources();