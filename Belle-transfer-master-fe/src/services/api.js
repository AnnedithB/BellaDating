import { config } from './config';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'user_data';

// Check if we're on web platform
const isWeb = Platform.OS === 'web';

// Token management with web fallback
export const tokenStorage = {
  async getToken() {
    try {
      if (isWeb) {
        // Use localStorage on web
        return localStorage.getItem(TOKEN_KEY);
      } else {
        // Use SecureStore on native
        return await SecureStore.getItemAsync(TOKEN_KEY);
      }
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  },

  async setToken(token) {
    try {
      if (isWeb) {
        // Use localStorage on web
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        // Use SecureStore on native
        await SecureStore.setItemAsync(TOKEN_KEY, token);
      }
    } catch (error) {
      console.error('Error saving token:', error);
    }
  },

  async removeToken() {
    try {
      if (isWeb) {
        // Use localStorage on web
        localStorage.removeItem(TOKEN_KEY);
      } else {
        // Use SecureStore on native
        await SecureStore.deleteItemAsync(TOKEN_KEY);
      }
    } catch (error) {
      console.error('Error removing token:', error);
    }
  },

  async getUser() {
    try {
      let userData;
      if (isWeb) {
        // Use localStorage on web
        userData = localStorage.getItem(USER_KEY);
      } else {
        // Use SecureStore on native
        userData = await SecureStore.getItemAsync(USER_KEY);
      }
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  },

  async setUser(user) {
    try {
      const userString = JSON.stringify(user);
      if (isWeb) {
        // Use localStorage on web
        localStorage.setItem(USER_KEY, userString);
      } else {
        // Use SecureStore on native
        await SecureStore.setItemAsync(USER_KEY, userString);
      }
    } catch (error) {
      console.error('Error saving user:', error);
    }
  },

  async removeUser() {
    try {
      if (isWeb) {
        // Use localStorage on web
        localStorage.removeItem(USER_KEY);
      } else {
        // Use SecureStore on native
        await SecureStore.deleteItemAsync(USER_KEY);
      }
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
      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      // Check if response is ok
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[GraphQL] HTTP error response:', {
          status: response.status,
          statusText: response.statusText,
          url: this.url,
          errorText: errorText.substring(0, 200), // Limit error text length
        });
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();

      // Check if response is valid JSON
      if (!json || typeof json !== 'object') {
        console.error('[GraphQL] Invalid JSON response:', json);
        throw new Error('Invalid response from server');
      }

      if (json.errors) {
        const error = json.errors[0];
        const errorMessage = error.message || 'GraphQL Error';
        const errorDetails = error.extensions || {};
        console.error('[GraphQL] GraphQL Error:', {
          message: errorMessage,
          details: errorDetails,
          url: this.url,
        });
        throw new Error(errorMessage);
      }

      // Check if data exists
      if (!json || json.data === undefined || json.data === null) {
        console.error('[GraphQL] Response missing data field:', {
          json,
          url: this.url,
        });
        throw new Error('GraphQL response missing data field');
      }

      return json.data;
    } catch (error) {
      // Always clear timeout on error
      clearTimeout(timeoutId);
      
      // Enhanced error logging for network issues
      const errorInfo = {
        message: error.message,
        url: this.url,
        environment: config.ENVIRONMENT,
        isNetworkError: error.message?.includes('Network') || error.message?.includes('fetch') || error.message?.includes('CONNECTION_REFUSED'),
        isAbortError: error.name === 'AbortError' || error.message?.includes('aborted'),
      };
      
      console.error('[GraphQL] Request failed:', errorInfo);
      
      // Handle timeout/abort errors
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        throw new Error('Request timed out. The server is taking too long to respond. Please try again.');
      }
      
      // Handle connection errors (fetch throws TypeError for connection refused)
      if (error instanceof TypeError || error.message?.includes('Failed to fetch') || error.message?.includes('CONNECTION_REFUSED')) {
        const isLocalhost = this.url.includes('localhost') || this.url.includes('127.0.0.1');
        const errorMsg = isLocalhost
          ? `Network error: Cannot connect to ${this.url}. This appears to be a development URL. Please check your production API configuration.`
          : `Network error: Failed to connect to server. Please check your internet connection and ensure the server is running. URL: ${this.url}`;
        throw new Error(errorMsg);
      }
      
      // Re-throw with more context if it's a network error
      if (error.message && !error.message.includes('GraphQL') && !error.message.includes('HTTP')) {
        // Check if URL is localhost (common issue in production)
        if (this.url.includes('localhost') || this.url.includes('127.0.0.1')) {
          throw new Error(`Network error: Cannot connect to ${this.url}. This appears to be a development URL. Please check your production API configuration.`);
        }
        throw new Error(`Network error: ${error.message}. URL: ${this.url}`);
      }
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
            isPhotoVerified
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
            isPhotoVerified
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
          isPhotoVerified
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
          }
          expiresIn
        }
      }
    `;

    const data = await graphqlClient.request(query, {}, true);
    await tokenStorage.setToken(data.refreshToken.token);
    return data.refreshToken;
  },

  async socialLogin(socialData) {
    const query = `
      mutation SocialLogin($input: SocialLoginInput!) {
        socialLogin(input: $input) {
          token
          user {
            id
            email
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
            isPhotoVerified
            createdAt
          }
          expiresIn
        }
      }
    `;

    const data = await graphqlClient.request(query, { input: socialData }, false);

    // Store token and user
    await tokenStorage.setToken(data.socialLogin.token);
    await tokenStorage.setUser(data.socialLogin.user);

    return data.socialLogin;
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
          isPhotoVerified
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

  async getUserById(userId) {
    const query = `
      query GetUser($id: ID!) {
        user(id: $id) {
          id
          email
          name
          bio
          age
          gender
          profilePicture
          isOnline
          profile {
            displayName
            profilePicture
          }
        }
      }
    `;

    const data = await graphqlClient.request(query, { id: userId }, true);
    const user = data.user;
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
    // Remove profilePicture from input - it's handled separately via photo upload
    const { profilePicture, ...profileInput } = input;
    
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

    const data = await graphqlClient.request(query, { input: profileInput }, true);
    return data.updateProfile;
  },

  async uploadProfilePhoto(fileUri) {
    try {
      const token = await tokenStorage.getToken();
      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }

      // Create FormData for multipart upload
      const formData = new FormData();

      // Determine file extension and mime type
      // Handle different URI formats: blob:, file://, ph:// (iOS Photos), http://, https://
      let extension = 'jpg'; // default
      let mimeType = 'image/jpeg'; // default
      
      // For blob URLs (web), we'll detect the mime type from the blob itself
      if (fileUri.startsWith('blob:')) {
        // For blob URLs, we can't determine extension from URL
        // We'll use jpg as default and let the server handle it
        extension = 'jpg';
        mimeType = 'image/jpeg';
      } else if (fileUri.startsWith('ph://') || fileUri.startsWith('assets-library://')) {
        // iOS Photos library URIs - default to jpg, server will handle
        extension = 'jpg';
        mimeType = 'image/jpeg';
      } else if (fileUri.includes('.')) {
        // Try to extract extension from URI (works for file:// paths)
        // Remove query parameters and fragments first
        const cleanUri = fileUri.split('?')[0].split('#')[0];
        const parts = cleanUri.split('.');
        const lastPart = parts[parts.length - 1];
        // Check if it's a valid extension (not a URL path)
        if (lastPart && lastPart.length <= 5 && !lastPart.includes('/') && !lastPart.includes('\\')) {
          extension = lastPart.toLowerCase();
        }
      }
      
      const mimeTypeMap = {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
        heic: 'image/heic', // iOS format
        heif: 'image/heif', // iOS format
      };
      mimeType = mimeTypeMap[extension] || 'image/jpeg';

      // For web platform, we need to convert the file URI to a File/Blob
      if (isWeb) {
        // On web, expo-image-picker returns a blob URL or we need to fetch it
        let blob;
        try {
          if (fileUri.startsWith('blob:') || fileUri.startsWith('data:')) {
            // Already a blob or data URL
            const response = await fetch(fileUri);
            blob = await response.blob();
            // Try to detect actual mime type from blob
            if (blob.type && blob.type.startsWith('image/')) {
              mimeType = blob.type;
              // Extract extension from mime type
              const typeParts = blob.type.split('/');
              if (typeParts.length > 1) {
                const imgType = typeParts[1];
                if (imgType === 'jpeg') extension = 'jpg';
                else if (imgType === 'png') extension = 'png';
                else if (imgType === 'gif') extension = 'gif';
                else if (imgType === 'webp') extension = 'webp';
              }
            }
          } else if (fileUri.startsWith('http://') || fileUri.startsWith('https://')) {
            // Remote URL
            const response = await fetch(fileUri);
            blob = await response.blob();
            if (blob.type && blob.type.startsWith('image/')) {
              mimeType = blob.type;
            }
          } else {
            // Try to fetch as-is (might be a local file path)
            const response = await fetch(fileUri);
            blob = await response.blob();
            if (blob.type && blob.type.startsWith('image/')) {
              mimeType = blob.type;
            }
          }
        } catch (fetchError) {
          console.error('Error fetching file for upload:', fetchError);
          throw new Error('Failed to read image file. Please try selecting the image again.');
        }
        
        // Create a File object from the blob
        const file = new File([blob], `photo_${Date.now()}.${extension}`, { type: mimeType });
        formData.append('file', file);
      } else {
        // For React Native (iOS & Android), use the standard format
        // iOS handles file:// and ph:// URIs automatically
        // Android handles file:// and content:// URIs automatically
        const fileData = {
          uri: fileUri,
          name: `photo_${Date.now()}.${extension}`,
          type: mimeType,
        };
        formData.append('file', fileData);
      }

      // Append type
      formData.append('type', 'photo');

      // Debug logging
      if (__DEV__) {
        console.log('Uploading photo:', {
          fileUri,
          isWeb,
          mimeType,
          extension,
          url: `${config.API_URL}/profile/upload`,
        });
      }

      // Use GraphQL gateway URL for uploads (it proxies to user-service)
      // This ensures the endpoint is accessible even if user-service port isn't exposed
      const uploadUrl = `${config.API_URL}/profile/upload`;
      
      // Debug: Log the full request details
      if (__DEV__) {
        console.log('Upload request details:', {
          url: uploadUrl,
          method: 'POST',
          hasToken: !!token,
          tokenLength: token?.length,
          formDataKeys: formData._parts ? Object.keys(formData._parts) : 'FormData object',
        });
      }

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          // Don't set Content-Type - fetch will set it with boundary for FormData
        },
        body: formData,
      });

      if (!response.ok) {
        // Try to get detailed error message
        let errorData;
        const responseText = await response.text();
        try {
          errorData = JSON.parse(responseText);
        } catch (e) {
          errorData = { 
            message: `HTTP ${response.status}: ${response.statusText}`,
            rawResponse: responseText.substring(0, 200) // First 200 chars
          };
        }
        
        const errorMessage = errorData.message || 
                           errorData.error?.message || 
                           errorData.error ||
                           errorData.rawResponse ||
                           `Failed to upload photo (${response.status})`;
        
        console.error('Upload error details:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
          responseText: responseText.substring(0, 500),
        });
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (data.status !== 'success') {
        throw new Error(data.message || 'Photo upload failed');
      }

      return data.data.url; // Return the uploaded photo URL
    } catch (error) {
      console.error('Photo upload error:', error);
      throw error;
    }
  },

  async getNotificationSettings() {
    const query = `
      query {
        myNotificationSettings {
          all
          newMatches
          newMessages
          appPromotions
        }
      }
    `;

    const data = await graphqlClient.request(query, {}, true);
    return data.myNotificationSettings;
  },

  async updateNotificationSettings(input) {
    const query = `
      mutation UpdateNotificationSettings($input: NotificationSettingsInput!) {
        updateNotificationSettings(input: $input) {
          all
          newMatches
          newMessages
          appPromotions
        }
      }
    `;

    const data = await graphqlClient.request(query, { input }, true);
    return data.updateNotificationSettings;
  },

  async getPrivacySettings() {
    const query = `
      query {
        myPrivacySettings {
          showOnlineStatus
          sendReadReceipts
        }
      }
    `;

    const data = await graphqlClient.request(query, {}, true);
    return data.myPrivacySettings;
  },

  async updatePrivacySettings(input) {
    const query = `
      mutation UpdatePrivacySettings($input: PrivacySettingsInput!) {
        updatePrivacySettings(input: $input) {
          showOnlineStatus
          sendReadReceipts
        }
      }
    `;

    const data = await graphqlClient.request(query, { input }, true);
    return data.updatePrivacySettings;
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
          name
          bio
          age
          gender
          interests
          location
          profilePicture
          photos
          isOnline
          lastSeen
          isVerified
          isPhotoVerified
          educationLevel
          religion
          familyPlans
          languages
          ethnicity
          politicalViews
          exercise
          smoking
          drinking
          hasKids
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
    
    // Check if joinQueue exists in the response
    if (!data || !data.joinQueue) {
      console.error('joinQueue response missing:', data);
      throw new Error('Invalid response from joinQueue mutation');
    }
    
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

  async skipMatch(sessionId) {
    const query = `
      mutation SkipMatch($sessionId: String) {
        skipMatch(sessionId: $sessionId)
      }
    `;

    const data = await graphqlClient.request(query, { sessionId }, true);
    return data.skipMatch;
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

  async discoverProfiles(preferences = {}, limit = 10) {
    const query = `
      query DiscoverProfiles($preferences: QueuePreferences, $limit: Int) {
        discoverProfiles(preferences: $preferences, limit: $limit) {
          user {
            id
            name
            age
            profilePicture
            photos
            bio
            location
            interests
            gender
            educationLevel
            religion
            familyPlans
          }
          compatibilityScore
          matchReasons
          distance
        }
      }
    `;

    const data = await graphqlClient.request(query, { preferences, limit }, true);
    return data.discoverProfiles || [];
  },
};

// Chat/Messages API
export const chatAPI = {
  async getConversations(limit = 20, offset = 0) {
    const token = await tokenStorage.getToken();
    if (!token) {
      throw new Error('No authentication token found. Please log in again.');
    }

    const response = await fetch(`${config.COMMUNICATION_SERVICE_URL}/api/chat/conversations?limit=${limit}&offset=${offset}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch conversations: ${response.status} ${errorText}`);
    }

    const json = await response.json();
    return json.data || [];
  },

  async getConversationMessages(roomId, limit = 50, offset = 0) {
    const token = await tokenStorage.getToken();
    if (!token) {
      throw new Error('No authentication token found. Please log in again.');
    }

    const response = await fetch(
      `${config.COMMUNICATION_SERVICE_URL}/api/chat/conversations/${roomId}/messages?limit=${limit}&offset=${offset}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch conversation messages: ${response.status} ${errorText}`);
    }

    const json = await response.json();
    return json.data || [];
  },

  async sendConversationMessage({ roomId, content, type = 'TEXT', metadata }) {
    const token = await tokenStorage.getToken();
    if (!token) {
      throw new Error('No authentication token found. Please log in again.');
    }

    const response = await fetch(
      `${config.COMMUNICATION_SERVICE_URL}/api/chat/conversations/${roomId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          type,
          metadata,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to send conversation message: ${response.status} ${errorText}`);
    }

    const json = await response.json();
    return json.data;
  },

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
            name
            profilePicture
          }
        }
      }
    `;

    const data = await graphqlClient.request(query, { sessionId, limit, offset }, true);
    const messages = data.sessionMessages || [];
    

    return messages;
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

  async clearMessages(roomId, all = false) {
    console.log('[chatAPI.clearMessages] Called with:', { roomId, all });
    const query = `
      mutation ClearMessages($roomId: ID!, $all: Boolean) {
        clearMessages(roomId: $roomId, all: $all)
      }
    `;

    try {
      const data = await graphqlClient.request(query, { roomId, all }, true);
      console.log('[chatAPI.clearMessages] Success:', data);
      return data.clearMessages;
    } catch (error) {
      console.error('[chatAPI.clearMessages] Error:', error);
      throw error;
    }
  },

  async deleteMessage(messageId, roomId) {
    const query = `
      mutation DeleteMessage($messageId: ID!, $roomId: ID!) {
        deleteMessage(messageId: $messageId, roomId: $roomId)
      }
    `;

    const data = await graphqlClient.request(query, { messageId, roomId }, true);
    return data.deleteMessage;
  },

  async markMissedCall(roomId) {
    const token = await tokenStorage.getToken();
    if (!token) {
      throw new Error('No authentication token found. Please log in again.');
    }

    const response = await fetch(
      `${config.COMMUNICATION_SERVICE_URL}/api/chat/conversations/${roomId}/missed-call`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`Failed to mark missed call: ${response.status} ${errorText}`);
      return null;
    }

    const json = await response.json();
    return json.data;
  },

  async clearMissedCalls(roomId) {
    const token = await tokenStorage.getToken();
    if (!token) {
      throw new Error('No authentication token found. Please log in again.');
    }

    const response = await fetch(
      `${config.COMMUNICATION_SERVICE_URL}/api/chat/conversations/${roomId}/missed-call`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`Failed to clear missed calls: ${response.status} ${errorText}`);
      return null;
    }

    const json = await response.json();
    return json;
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

    // Note: Upload routes are disabled in communication-service
    // For now, we'll skip voice note upload and show an error
    // TODO: Enable upload routes or implement alternative voice note handling
    throw new Error('Voice note upload is currently unavailable. Please use text messages instead.');
    
    // Original code (commented out until upload routes are enabled):
    /*
    const response = await fetch(`${config.COMMUNICATION_SERVICE_URL}/api/upload/voice-note`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        // Don't set Content-Type - fetch will set it with boundary for FormData
      },
      body: formData,
    });
    */

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
          metadata
          user1 {
            id
            name
            profilePicture
            isOnline
          }
          user2 {
            id
            name
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
          metadata
          user1 {
            id
            name
            profilePicture
            isOnline
          }
          user2 {
            id
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
            name
            profilePicture
          }
          user2 {
            id
            name
            profilePicture
          }
        }
      }
    `;

    const data = await graphqlClient.request(query, { limit, offset }, true);
    return data.sessionHistory;
  },

  async startSession(partnerId, callType = 'VOICE') {
    const query = `
      mutation StartSession($partnerId: ID!, $callType: String) {
        startSession(partnerId: $partnerId, callType: $callType) {
          id
          user1Id
          user2Id
          type
          status
          startedAt
          metadata
        }
      }
    `;

    const data = await graphqlClient.request(query, { partnerId, callType }, true);
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

  async registerDeviceToken(tokenData) {
    // tokenData: { userId, token, platform, appVersion, deviceModel, osVersion }
    try {
      const token = await tokenStorage.getToken();
      const headers = {
        'Content-Type': 'application/json'
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`${config.notificationServiceUrl}/device-tokens`, {
        method: 'POST',
        headers,
        body: JSON.stringify(tokenData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to register device token: ${response.status} ${errorText}`);
      }

      const json = await response.json();
      return json;
    } catch (error) {
      console.warn('[notificationAPI.registerDeviceToken] Error:', error);
      throw error;
    }
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

  async deleteAllNotifications() {
    const query = `
      mutation {
        deleteAllNotifications
      }
    `;

    const data = await graphqlClient.request(query, {}, true);
    return data.deleteAllNotifications;
  },
};

// Activity API (communication-service)
export const activityAPI = {
  async getActivities(limit = 50, offset = 0) {
    const token = await tokenStorage.getToken();
    if (!token) {
      throw new Error('No authentication token found. Please log in again.');
    }

    const response = await fetch(`${config.COMMUNICATION_SERVICE_URL}/api/activity?limit=${limit}&offset=${offset}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Activity fetch failed: ${response.status} ${errorText}`);
    }

    const json = await response.json();
    return json.data || [];
  },

  async logActivity({ type, title, description, metadata }) {
    const token = await tokenStorage.getToken();
    if (!token) {
      throw new Error('No authentication token found. Please log in again.');
    }

    const response = await fetch(`${config.COMMUNICATION_SERVICE_URL}/api/activity/log`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type, title, description, metadata }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Activity log failed: ${response.status} ${errorText}`);
    }

    const json = await response.json();
    return json.data;
  },

  async clearActivities() {
    const token = await tokenStorage.getToken();
    if (!token) {
      throw new Error('No authentication token found. Please log in again.');
    }

    const response = await fetch(`${config.COMMUNICATION_SERVICE_URL}/api/activity/clear`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Activity clear failed: ${response.status} ${errorText}`);
    }

    const json = await response.json();
    return json;
  }
};

// Upload API - S3 presigned URL based uploads
export const uploadAPI = {
  async getPresignedUrl(fileType) {
    const token = await tokenStorage.getToken();
    // Use GraphQL gateway URL (it proxies to user-service)
    const response = await fetch(`${config.API_URL}/profile/upload/presigned`, {
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
          interests
          preferredEducationLevels
          preferredFamilyPlans
          preferredHasKids
          preferredReligions
          preferredPoliticalViews
          preferredDrinkingHabits
          preferredSmokingHabits
          heightMin
          heightMax
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
          interests
          preferredEducationLevels
          preferredFamilyPlans
          preferredHasKids
          preferredReligions
          preferredPoliticalViews
          preferredDrinkingHabits
          preferredSmokingHabits
          heightMin
          heightMax
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
            name
            profilePicture
            isOnline
          }
          user2 {
            id
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

// Verification API
export const verificationAPI = {
  async verifyPhoto(imageUri) {
    try {
      let base64String;

      if (isWeb) {
        // Web platform: use fetch to convert image to base64
        if (imageUri.startsWith('data:')) {
          // Already a data URL, use it directly
          base64String = imageUri;
        } else if (imageUri.startsWith('blob:')) {
          // Blob URL: fetch and convert to base64
          const response = await fetch(imageUri);
          const blob = await response.blob();
          const reader = new FileReader();
          
          base64String = await new Promise((resolve, reject) => {
            reader.onloadend = () => {
              resolve(reader.result);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } else if (imageUri.startsWith('http://') || imageUri.startsWith('https://')) {
          // HTTP URL: fetch and convert to base64
          const response = await fetch(imageUri);
          const blob = await response.blob();
          const reader = new FileReader();
          
          base64String = await new Promise((resolve, reject) => {
            reader.onloadend = () => {
              resolve(reader.result);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } else {
          // Try to fetch as-is (might be a local file path on web)
          const response = await fetch(imageUri);
          const blob = await response.blob();
          const reader = new FileReader();
          
          base64String = await new Promise((resolve, reject) => {
            reader.onloadend = () => {
              resolve(reader.result);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }
      } else {
        // Native platform: use expo-file-system
        const base64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: 'base64',
        });

        // Determine image type
        const imageType = imageUri.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg';
        base64String = `data:${imageType};base64,${base64}`;
      }

      const mutation = `
        mutation VerifyPhoto($selfieImage: String!) {
          verifyPhoto(selfieImage: $selfieImage) {
            success
            message
            confidence
            livenessDetected
          }
        }
      `;

      const data = await graphqlClient.request(mutation, { selfieImage: base64String }, true);
      return data.verifyPhoto;
    } catch (error) {
      console.error('Photo verification error:', error);
      throw error;
    }
  },

  async getVerificationStatus() {
    try {
      const query = `
        query {
          me {
            id
            isPhotoVerified
          }
        }
      `;

      const data = await graphqlClient.request(query, {}, true);
      return {
        isPhotoVerified: data.me?.isPhotoVerified || false,
      };
    } catch (error) {
      console.error('Get verification status error:', error);
      throw error;
    }
  },
};

// Match API
export const matchAPI = {
  async getPendingMatches() {
    const query = `
      query {
        myPendingMatches {
          id
          user1Id
          user2Id
          status
          totalScore
          ageScore
          locationScore
          interestScore
          languageScore
          ethnicityScore
          genderCompatScore
          relationshipIntentScore
          familyPlansScore
          religionScore
          educationScore
          politicalScore
          lifestyleScore
          premiumBonus
          acceptedAt
          rejectedAt
          createdAt
          updatedAt
          user1 {
            id
            name
            profilePicture
            age
            bio
            location
            interests
          }
          user2 {
            id
            name
            profilePicture
            age
            bio
            location
            interests
          }
        }
      }
    `;

    const data = await graphqlClient.request(query, {}, true);
    return data.myPendingMatches;
  },

  async getMatchHistory(limit = 20, offset = 0) {
    const query = `
      query GetMatchHistory($limit: Int, $offset: Int) {
        myMatchHistory(limit: $limit, offset: $offset) {
          id
          user1Id
          user2Id
          status
          totalScore
          ageScore
          locationScore
          interestScore
          languageScore
          ethnicityScore
          genderCompatScore
          relationshipIntentScore
          familyPlansScore
          religionScore
          educationScore
          politicalScore
          lifestyleScore
          premiumBonus
          acceptedAt
          rejectedAt
          createdAt
          updatedAt
          user1 {
            id
            name
            profilePicture
            age
            bio
            location
            interests
          }
          user2 {
            id
            name
            profilePicture
            age
            bio
            location
            interests
          }
          session {
            id
            user1Id
            user2Id
            type
            status
            startedAt
            endedAt
          }
        }
      }
    `;

    const data = await graphqlClient.request(query, { limit, offset }, true);
    return data.myMatchHistory;
  },

  async acceptMatch(matchId) {
    const query = `
      mutation AcceptMatch($matchId: ID!) {
        acceptMatch(matchId: $matchId) {
          id
          user1Id
          user2Id
          status
          totalScore
          acceptedAt
          createdAt
          user1 {
            id
            name
            profilePicture
            age
          }
          user2 {
            id
            name
            profilePicture
            age
          }
          session {
            id
            user1Id
            user2Id
            type
            status
            startedAt
          }
        }
      }
    `;

    const data = await graphqlClient.request(query, { matchId }, true);
    return data.acceptMatch;
  },

  async declineMatch(matchId) {
    const query = `
      mutation DeclineMatch($matchId: ID!) {
        declineMatch(matchId: $matchId) {
          id
          user1Id
          user2Id
          status
          totalScore
          rejectedAt
          createdAt
        }
      }
    `;

    const data = await graphqlClient.request(query, { matchId }, true);
    return data.declineMatch;
  },

  async createMatchFromSuggestion(userId) {
    const query = `
      mutation CreateMatchFromSuggestion($userId: ID!) {
        createMatchFromSuggestion(userId: $userId) {
          id
          user1Id
          user2Id
          status
          totalScore
          acceptedAt
          createdAt
          user1 {
            id
            name
            profilePicture
            age
          }
          user2 {
            id
            name
            profilePicture
            age
          }
          session {
            id
            user1Id
            user2Id
            type
            status
            startedAt
          }
        }
      }
    `;

    const data = await graphqlClient.request(query, { userId }, true);
    return data.createMatchFromSuggestion;
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

// Export config for use in other files
// Support Ticket API
export const supportAPI = {
  // Get admin service URL from config or use default
  getAdminServiceUrl() {
    // Use production URL if API_URL contains the production domain, otherwise use localhost:3009
    if (config.API_URL && config.API_URL.includes('51.20.160.210')) {
      return 'http://51.20.160.210:3009';
    }
    // Extract base URL from API_URL and use port 3009 for admin service
    const baseUrl = config.API_URL.replace(/:\d+$/, '');
    return `${baseUrl}:3009`;
  },

  async submitTicket({ title, description, category, priority = 'MEDIUM', userEmail, userName }) {
    const adminServiceUrl = this.getAdminServiceUrl();
    const token = await tokenStorage.getToken();
    const formData = new FormData();
    
    formData.append('title', title);
    formData.append('description', description);
    formData.append('category', category);
    formData.append('priority', priority);
    formData.append('userEmail', userEmail);
    formData.append('userName', userName);

    const headers = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${adminServiceUrl}/api/customer-support/submit`, {
      method: 'POST',
      body: formData,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to submit ticket' }));
      throw new Error(error.message || 'Failed to submit support ticket');
    }

    return response.json();
  },

  async getMyTickets(userEmail) {
    const adminServiceUrl = this.getAdminServiceUrl();
    const token = await tokenStorage.getToken();
    
    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    // Try to get tickets by email if endpoint exists, otherwise return empty
    // Note: The backend may not have this endpoint yet, so we'll handle gracefully
    try {
      const response = await fetch(`${adminServiceUrl}/api/customer-support/my-tickets?email=${encodeURIComponent(userEmail)}`, {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        return response.json();
      }
      // If 404, endpoint doesn't exist yet - return empty array
      if (response.status === 404) {
        return {
          status: 'success',
          data: [],
        };
      }
      throw new Error('Failed to get tickets');
    } catch (error) {
      // If endpoint doesn't exist or CORS error, return empty array
      console.warn('getMyTickets endpoint not available:', error.message);
      return {
        status: 'success',
        data: [],
      };
    }
  },

  async getTicketStatus(ticketNumber) {
    const adminServiceUrl = this.getAdminServiceUrl();
    const token = await tokenStorage.getToken();
    
    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${adminServiceUrl}/api/customer-support/status/${ticketNumber}`, {
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Ticket not found' }));
      throw new Error(error.message || 'Failed to get ticket status');
    }

    return response.json();
  },

  async respondToTicket(ticketNumber, { content, customerEmail, attachments = [] }) {
    const adminServiceUrl = this.getAdminServiceUrl();
    const token = await tokenStorage.getToken();
    const formData = new FormData();
    
    formData.append('content', content);
    formData.append('customerEmail', customerEmail);
    
    // Add attachments if any
    attachments.forEach((file, index) => {
      formData.append('attachments', {
        uri: file.uri,
        type: file.type || 'image/jpeg',
        name: file.name || `attachment-${index}.jpg`,
      });
    });

    const headers = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${adminServiceUrl}/api/customer-support/${ticketNumber}/respond`, {
      method: 'POST',
      body: formData,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to respond to ticket' }));
      throw new Error(error.message || 'Failed to respond to ticket');
    }

    return response.json();
  },

  async getCategories() {
    const adminServiceUrl = this.getAdminServiceUrl();
    // Categories endpoint is public, no auth required
    
    const response = await fetch(`${adminServiceUrl}/api/customer-support/categories`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // If CORS error or 500, return default categories
      if (response.status === 500 || response.status === 0) {
        console.warn('Failed to fetch categories from server, using defaults');
        return {
          status: 'success',
          data: [
            { value: 'GENERAL', label: 'General Inquiry' },
            { value: 'TECHNICAL', label: 'Technical Issue' },
            { value: 'BILLING', label: 'Billing & Payments' },
            { value: 'ACCOUNT', label: 'Account Issues' },
            { value: 'CONTENT', label: 'Content & Matching' },
            { value: 'SAFETY', label: 'Safety & Security' },
          ],
        };
      }
      throw new Error('Failed to get ticket categories');
    }

    return response.json();
  },

  async getHelpArticles({ category, search, page = 1, limit = 10 } = {}) {
    const adminServiceUrl = this.getAdminServiceUrl();
    const token = await tokenStorage.getToken();
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (search) params.append('search', search);
    params.append('page', page.toString());
    params.append('limit', limit.toString());

    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${adminServiceUrl}/api/customer-support/help/articles?${params.toString()}`, {
      headers,
    });

    if (!response.ok) {
      throw new Error('Failed to get help articles');
    }

    return response.json();
  },
};

export { config };

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
  activityAPI,
  connectionAPI,
  uploadAPI,
  preferencesAPI,
  matchAPI,
  subscriptionAPI,
  supportAPI,
};
