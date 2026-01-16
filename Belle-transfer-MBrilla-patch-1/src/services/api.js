import { config } from './config';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'user_data';

// Token management
export const tokenStorage = {
  async getToken() {
    try {
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  },

  async setToken(token) {
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } catch (error) {
      console.error('Error saving token:', error);
    }
  },

  async removeToken() {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch (error) {
      console.error('Error removing token:', error);
    }
  },

  async getUser() {
    try {
      const userData = await SecureStore.getItemAsync(USER_KEY);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  },

  async setUser(user) {
    try {
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    } catch (error) {
      console.error('Error saving user:', error);
    }
  },

  async removeUser() {
    try {
      await SecureStore.deleteItemAsync(USER_KEY);
    } catch (error) {
      console.error('Error removing user:', error);
    }
  },

  async clear() {
    await this.removeToken();
    await this.removeUser();
  },
};

// GraphQL client
class GraphQLClient {
  constructor() {
    this.url = config.GRAPHQL_URL;
  }

  async request(query, variables = {}, requireAuth = false) {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (requireAuth) {
      const token = await tokenStorage.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables }),
      });

      const json = await response.json();

      if (json.errors) {
        const error = json.errors[0];
        throw new Error(error.message || 'GraphQL Error');
      }

      return json.data;
    } catch (error) {
      console.error('GraphQL request failed:', error);
      throw error;
    }
  }
}

export const graphqlClient = new GraphQLClient();

// Auth API
export const authAPI = {
  async login(email, password) {
    const query = `
      mutation Login($email: String!, $password: String!) {
        login(email: $email, password: $password) {
          token
          user {
            id
            email
            username
            name
            bio
            age
            gender
            interests
            location
            profilePicture
            isOnline
            isActive
            isVerified
            createdAt
          }
          expiresIn
        }
      }
    `;

    const data = await graphqlClient.request(query, { email, password });

    // Store token and user
    await tokenStorage.setToken(data.login.token);
    await tokenStorage.setUser(data.login.user);

    return data.login;
  },

  async register(input) {
    const query = `
      mutation Register($input: UserInput!) {
        register(input: $input) {
          token
          user {
            id
            email
            username
            name
            isActive
            createdAt
          }
          expiresIn
        }
      }
    `;

    const data = await graphqlClient.request(query, { input });

    // Store token and user
    await tokenStorage.setToken(data.register.token);
    await tokenStorage.setUser(data.register.user);

    return data.register;
  },

  async logout() {
    try {
      const query = `
        mutation {
          logout
        }
      `;
      await graphqlClient.request(query, {}, true);
    } catch (error) {
      console.error('Logout API error:', error);
    }

    // Clear local storage regardless
    await tokenStorage.clear();
  },

  async getCurrentUser() {
    const query = `
      query {
        me {
          id
          email
          username
          name
          bio
          age
          gender
          interests
          location
          profilePicture
          isOnline
          isActive
          isVerified
          createdAt
          updatedAt
        }
      }
    `;

    const data = await graphqlClient.request(query, {}, true);
    return data.me;
  },

  async refreshToken() {
    const query = `
      mutation {
        refreshToken {
          token
          user {
            id
            email
            username
          }
          expiresIn
        }
      }
    `;

    const data = await graphqlClient.request(query, {}, true);
    await tokenStorage.setToken(data.refreshToken.token);
    return data.refreshToken;
  },

  async forgotPassword(email) {
    const query = `
      mutation ForgotPassword($email: String!) {
        forgotPassword(email: $email) {
          success
          message
        }
      }
    `;

    const data = await graphqlClient.request(query, { email });
    return data.forgotPassword;
  },

  async resetPassword(token, password) {
    const query = `
      mutation ResetPassword($token: String!, $password: String!) {
        resetPassword(token: $token, password: $password) {
          success
          message
        }
      }
    `;

    const data = await graphqlClient.request(query, { token, password });
    return data.resetPassword;
  },
};

// User/Profile API
export const userAPI = {
  async getProfile() {
    const query = `
      query {
        me {
          id
          email
          username
          name
          bio
          age
          gender
          interests
          location
          profilePicture
          photos
          isOnline
          isActive
          isVerified
          profile {
            displayName
            bio
            location
            interests
            profilePicture
            isPublic
            showAge
            showLocation
          }
        }
      }
    `;

    const data = await graphqlClient.request(query, {}, true);
    const user = data.me;
    // Normalize: use profile.displayName as name if name is empty
    if (user && (!user.name || user.name === '') && user.profile?.displayName) {
      user.name = user.profile.displayName;
    }
    // Also normalize profilePicture from nested profile
    if (user && !user.profilePicture && user.profile?.profilePicture) {
      user.profilePicture = user.profile.profilePicture;
    }
    return user;
  },

  async updateProfile(input) {
    const query = `
      mutation UpdateProfile($input: UserUpdateInput!) {
        updateProfile(input: $input) {
          id
          name
          bio
          age
          gender
          interests
          location
          profilePicture
        }
      }
    `;

    const data = await graphqlClient.request(query, { input }, true);
    return data.updateProfile;
  },

  async updateProfileSettings(input) {
    const query = `
      mutation UpdateProfileSettings($input: ProfileUpdateInput!) {
        updateProfileSettings(input: $input) {
          id
          displayName
          bio
          location
          interests
          isPublic
          showAge
          showLocation
        }
      }
    `;

    const data = await graphqlClient.request(query, { input }, true);
    return data.updateProfileSettings;
  },

  async getUser(userId) {
    const query = `
      query GetUser($id: ID!) {
        user(id: $id) {
          id
          email
          username
          name
          bio
          age
          gender
          interests
          location
          profilePicture
          isOnline
          lastSeen
          isVerified
        }
      }
    `;

    const data = await graphqlClient.request(query, { id: userId }, true);
    return data.user;
  },

  async blockUser(userId) {
    const query = `
      mutation BlockUser($userId: ID!) {
        blockUser(userId: $userId)
      }
    `;

    const data = await graphqlClient.request(query, { userId }, true);
    return data.blockUser;
  },

  async unblockUser(userId) {
    const query = `
      mutation UnblockUser($userId: ID!) {
        unblockUser(userId: $userId)
      }
    `;

    const data = await graphqlClient.request(query, { userId }, true);
    return data.unblockUser;
  },

  async reportUser(input) {
    const query = `
      mutation ReportUser($input: ReportInput!) {
        reportUser(input: $input) {
          id
          reason
          status
          createdAt
        }
      }
    `;

    const data = await graphqlClient.request(query, { input }, true);
    return data.reportUser;
  },
};

// Queue/Matching API
export const queueAPI = {
  async joinQueue(preferences = {}) {
    const query = `
      mutation JoinQueue($preferences: QueuePreferences) {
        joinQueue(preferences: $preferences) {
          userId
          status
          position
          estimatedWaitTime
          joinedAt
        }
      }
    `;

    const data = await graphqlClient.request(query, { preferences }, true);
    return data.joinQueue;
  },

  async leaveQueue() {
    const query = `
      mutation {
        leaveQueue
      }
    `;

    const data = await graphqlClient.request(query, {}, true);
    return data.leaveQueue;
  },

  async getQueueStatus() {
    const query = `
      query {
        queueStatus {
          userId
          status
          position
          estimatedWaitTime
          joinedAt
        }
      }
    `;

    const data = await graphqlClient.request(query, {}, true);
    return data.queueStatus;
  },

  async updateQueuePreferences(preferences) {
    const query = `
      mutation UpdateQueuePreferences($preferences: QueuePreferences!) {
        updateQueuePreferences(preferences: $preferences) {
          userId
          status
          position
          estimatedWaitTime
        }
      }
    `;

    const data = await graphqlClient.request(query, { preferences }, true);
    return data.updateQueuePreferences;
  },
};

// Chat/Messages API
export const chatAPI = {
  async getSessionMessages(sessionId, limit = 50, offset = 0) {
    const query = `
      query GetSessionMessages($sessionId: ID!, $limit: Int, $offset: Int) {
        sessionMessages(sessionId: $sessionId, limit: $limit, offset: $offset) {
          id
          sessionId
          senderId
          content
          messageType
          sentAt
          deliveredAt
          readAt
          isDelivered
          isRead
          voiceUrl
          voiceDuration
          imageUrl
          sender {
            id
            username
            profilePicture
          }
        }
      }
    `;

    const data = await graphqlClient.request(query, { sessionId, limit, offset }, true);
    return data.sessionMessages;
  },

  async sendMessage(input) {
    const query = `
      mutation SendMessage($input: MessageInput!) {
        sendMessage(input: $input) {
          id
          sessionId
          senderId
          content
          messageType
          sentAt
          isDelivered
          isRead
        }
      }
    `;

    const data = await graphqlClient.request(query, { input }, true);
    return data.sendMessage;
  },

  async markMessageAsRead(messageId) {
    const query = `
      mutation MarkMessageAsRead($messageId: ID!) {
        markMessageAsRead(messageId: $messageId)
      }
    `;

    const data = await graphqlClient.request(query, { messageId }, true);
    return data.markMessageAsRead;
  },

  async markSessionAsRead(sessionId) {
    const query = `
      mutation MarkSessionAsRead($sessionId: ID!) {
        markSessionAsRead(sessionId: $sessionId)
      }
    `;

    const data = await graphqlClient.request(query, { sessionId }, true);
    return data.markSessionAsRead;
  },

  /**
   * Upload a voice note to the server
   * @param {string} fileUri - Local URI of the recorded audio file
   * @param {string} conversationId - The chat room/session ID
   * @param {number} duration - Duration of the voice note in seconds
   * @returns {Promise<object>} The created message with voice note data
   */
  async uploadVoiceNote(fileUri, conversationId, duration) {
    const token = await tokenStorage.getToken();

    // Create FormData for multipart upload
    const formData = new FormData();

    // Get file extension and determine mime type
    const extension = fileUri.split('.').pop().toLowerCase();
    const mimeTypeMap = {
      'm4a': 'audio/x-m4a',
      'mp4': 'audio/mp4',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'webm': 'audio/webm',
      'ogg': 'audio/ogg',
      'caf': 'audio/x-caf', // iOS native format
    };
    const mimeType = mimeTypeMap[extension] || 'audio/mp4';

    // Append the file
    formData.append('voiceNote', {
      uri: fileUri,
      name: `voice_note_${Date.now()}.${extension}`,
      type: mimeType,
    });

    // Append metadata
    formData.append('conversationId', conversationId);
    formData.append('duration', String(Math.round(duration)));

    const response = await fetch(`${config.COMMUNICATION_SERVICE_URL}/api/upload/voice-note`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        // Don't set Content-Type - fetch will set it with boundary for FormData
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to upload voice note');
    }

    const data = await response.json();

    if (data.status !== 'success') {
      throw new Error(data.message || 'Voice note upload failed');
    }

    return data.data;
  },
};

// Sessions API
export const sessionAPI = {
  async getActiveSessions() {
    const query = `
      query {
        myActiveSessions {
          id
          user1Id
          user2Id
          type
          status
          startedAt
          user1 {
            id
            username
            profilePicture
            isOnline
          }
          user2 {
            id
            username
            profilePicture
            isOnline
          }
        }
      }
    `;

    const data = await graphqlClient.request(query, {}, true);
    return data.myActiveSessions;
  },

  async getSession(sessionId) {
    const query = `
      query GetSession($id: ID!) {
        session(id: $id) {
          id
          user1Id
          user2Id
          type
          status
          startedAt
          endedAt
          duration
          user1 {
            id
            username
            name
            profilePicture
            isOnline
          }
          user2 {
            id
            username
            name
            profilePicture
            isOnline
          }
        }
      }
    `;

    const data = await graphqlClient.request(query, { id: sessionId }, true);
    return data.session;
  },

  async getSessionHistory(limit = 20, offset = 0) {
    const query = `
      query GetSessionHistory($limit: Int, $offset: Int) {
        sessionHistory(limit: $limit, offset: $offset) {
          id
          user1Id
          user2Id
          type
          status
          startedAt
          endedAt
          duration
          user1 {
            id
            username
            profilePicture
          }
          user2 {
            id
            username
            profilePicture
          }
        }
      }
    `;

    const data = await graphqlClient.request(query, { limit, offset }, true);
    return data.sessionHistory;
  },

  async startSession(partnerId) {
    const query = `
      mutation StartSession($partnerId: ID!) {
        startSession(partnerId: $partnerId) {
          id
          user1Id
          user2Id
          type
          status
          startedAt
        }
      }
    `;

    const data = await graphqlClient.request(query, { partnerId }, true);
    return data.startSession;
  },

  async endSession(sessionId) {
    const query = `
      mutation EndSession($sessionId: ID!) {
        endSession(sessionId: $sessionId)
      }
    `;

    const data = await graphqlClient.request(query, { sessionId }, true);
    return data.endSession;
  },
};

// Notifications API
export const notificationAPI = {
  async getNotifications(limit = 20, offset = 0) {
    const query = `
      query GetNotifications($limit: Int, $offset: Int) {
        notifications(limit: $limit, offset: $offset) {
          id
          userId
          title
          message
          type
          data
          read
          createdAt
        }
      }
    `;

    const data = await graphqlClient.request(query, { limit, offset }, true);
    return data.notifications;
  },

  async getUnreadNotifications() {
    const query = `
      query {
        unreadNotifications {
          id
          userId
          title
          message
          type
          data
          read
          createdAt
        }
      }
    `;

    const data = await graphqlClient.request(query, {}, true);
    return data.unreadNotifications;
  },

  async markNotificationAsRead(notificationId) {
    const query = `
      mutation MarkNotificationAsRead($notificationId: ID!) {
        markNotificationAsRead(notificationId: $notificationId)
      }
    `;

    const data = await graphqlClient.request(query, { notificationId }, true);
    return data.markNotificationAsRead;
  },

  async markAllNotificationsAsRead() {
    const query = `
      mutation {
        markAllNotificationsAsRead
      }
    `;

    const data = await graphqlClient.request(query, {}, true);
    return data.markAllNotificationsAsRead;
  },
};

// Upload API - S3 presigned URL based uploads
export const uploadAPI = {
  async getPresignedUrl(fileType) {
    const token = await tokenStorage.getToken();
    const response = await fetch(`${config.USER_SERVICE_URL}/profile/upload/presigned`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ fileType }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get upload URL');
    }

    const data = await response.json();
    return data.data; // { uploadUrl, publicUrl, key, expiresIn }
  },

  async uploadFileToS3(uploadUrl, fileUri, contentType) {
    // Read file and upload to S3 using presigned URL
    const response = await fetch(fileUri);
    const blob = await response.blob();

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: blob,
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload file to S3');
    }

    return true;
  },

  async uploadPhoto(fileUri) {
    // Determine content type from URI
    const extension = fileUri.split('.').pop().toLowerCase();
    const contentTypeMap = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
    };
    const contentType = contentTypeMap[extension] || 'image/jpeg';

    // Get presigned URL
    const { uploadUrl, publicUrl } = await this.getPresignedUrl(contentType);

    // Upload to S3
    await this.uploadFileToS3(uploadUrl, fileUri, contentType);

    // Return the public URL for the uploaded file
    return publicUrl;
  },
};

// Discovery Preferences API
export const preferencesAPI = {
  async getDiscoveryPreferences() {
    const query = `
      query {
        myDiscoveryPreferences {
          id
          userId
          ageMin
          ageMax
          maxDistance
          interestedIn
          connectionType
          lookingFor
          showOnDiscovery
          updatedAt
        }
      }
    `;

    const data = await graphqlClient.request(query, {}, true);
    return data.myDiscoveryPreferences;
  },

  async updateDiscoveryPreferences(input) {
    const query = `
      mutation UpdateDiscoveryPreferences($input: DiscoveryPreferencesInput!) {
        updateDiscoveryPreferences(input: $input) {
          id
          userId
          ageMin
          ageMax
          maxDistance
          interestedIn
          connectionType
          lookingFor
          showOnDiscovery
          updatedAt
        }
      }
    `;

    const data = await graphqlClient.request(query, { input }, true);
    return data.updateDiscoveryPreferences;
  },
};

// Connections API
export const connectionAPI = {
  async getConnections() {
    const query = `
      query {
        myConnections {
          id
          user1Id
          user2Id
          connectionType
          status
          matchScore
          createdAt
          user1 {
            id
            username
            name
            profilePicture
            isOnline
          }
          user2 {
            id
            username
            name
            profilePicture
            isOnline
          }
        }
      }
    `;

    const data = await graphqlClient.request(query, {}, true);
    return data.myConnections;
  },

  async sendConnectionRequest(userId) {
    const query = `
      mutation SendConnectionRequest($userId: ID!) {
        sendConnectionRequest(userId: $userId) {
          id
          status
          createdAt
        }
      }
    `;

    const data = await graphqlClient.request(query, { userId }, true);
    return data.sendConnectionRequest;
  },

  async respondToConnectionRequest(connectionId, accept) {
    const query = `
      mutation RespondToConnectionRequest($connectionId: ID!, $accept: Boolean!) {
        respondToConnectionRequest(connectionId: $connectionId, accept: $accept) {
          id
          status
        }
      }
    `;

    const data = await graphqlClient.request(query, { connectionId, accept }, true);
    return data.respondToConnectionRequest;
  },

  async removeConnection(connectionId) {
    const query = `
      mutation RemoveConnection($connectionId: ID!) {
        removeConnection(connectionId: $connectionId)
      }
    `;

    const data = await graphqlClient.request(query, { connectionId }, true);
    return data.removeConnection;
  },

  async getConnectionSuggestions(limit = 10) {
    const query = `
      query GetConnectionSuggestions($limit: Int) {
        connectionSuggestions(limit: $limit) {
          id
          username
          name
          bio
          age
          interests
          profilePicture
          isOnline
        }
      }
    `;

    const data = await graphqlClient.request(query, { limit }, true);
    return data.connectionSuggestions;
  },
};

// Subscription API
export const subscriptionAPI = {
  async getPlans() {
    const query = `
      query {
        subscriptionPlans {
          id
          name
          displayName
          description
          monthlyPrice
          yearlyPrice
          yearlySavings
          features
          popular
        }
      }
    `;

    const data = await graphqlClient.request(query, {}, true);
    return data.subscriptionPlans;
  },

  async getCurrentSubscription() {
    const query = `
      query {
        mySubscription {
          id
          userId
          planId
          plan {
            id
            name
            displayName
          }
          status
          billingCycle
          currentPeriodStart
          currentPeriodEnd
          cancelAt
          createdAt
        }
      }
    `;

    const data = await graphqlClient.request(query, {}, true);
    return data.mySubscription;
  },

  async createSubscription(planId, billingCycle = 'MONTHLY') {
    const query = `
      mutation CreateSubscription($planId: ID!, $billingCycle: String!) {
        createSubscription(planId: $planId, billingCycle: $billingCycle) {
          id
          planId
          status
          billingCycle
          currentPeriodStart
          currentPeriodEnd
        }
      }
    `;

    const data = await graphqlClient.request(query, { planId, billingCycle }, true);
    return data.createSubscription;
  },

  async cancelSubscription() {
    const query = `
      mutation {
        cancelSubscription {
          id
          status
          cancelAt
        }
      }
    `;

    const data = await graphqlClient.request(query, {}, true);
    return data.cancelSubscription;
  },

  async updateSubscription(planId, billingCycle) {
    const query = `
      mutation UpdateSubscription($planId: ID!, $billingCycle: String) {
        updateSubscription(planId: $planId, billingCycle: $billingCycle) {
          id
          planId
          status
          billingCycle
        }
      }
    `;

    const data = await graphqlClient.request(query, { planId, billingCycle }, true);
    return data.updateSubscription;
  },
};

export default {
  config,
  tokenStorage,
  graphqlClient,
  authAPI,
  userAPI,
  queueAPI,
  chatAPI,
  sessionAPI,
  notificationAPI,
  connectionAPI,
  uploadAPI,
  preferencesAPI,
  subscriptionAPI,
};
