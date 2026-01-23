import axios, { AxiosInstance } from 'axios';
import DataLoader from 'dataloader';
import { config } from '../config';

// Create axios instances for each service
function createServiceClient(baseURL: string, token: string | null): AxiosInstance {
  return axios.create({
    baseURL,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    timeout: 10000,
  });
}

// User Service Data Source
class UserService {
  private client: AxiosInstance;

  constructor(token: string | null) {
    this.client = createServiceClient(config.services.user, token);
  }

  async getUser(id: string) {
    try {
      const response = await this.client.get(`/profile/users/${id}`);
      const userData = response.data.data;

      // Transform the REST API response to match GraphQL User type
      if (userData && userData.user) {
        const sanitized = userData.user;
        return {
          id: sanitized.id,
          email: sanitized.email || '',
          name: sanitized.name || sanitized.displayName || null,
          profilePicture: sanitized.profilePicture || sanitized.avatar || null,
          isOnline: sanitized.isOnline || false,
          bio: sanitized.bio || sanitized.shortBio || null,
          age: sanitized.age || null,
          gender: sanitized.gender || null,
          interests: sanitized.interests || [],
          location: sanitized.location || (sanitized.locationCity ? `${sanitized.locationCity}, ${sanitized.locationCountry}` : sanitized.locationCountry) || null,
          isActive: sanitized.isActive !== undefined ? sanitized.isActive : true,
          isVerified: sanitized.isVerified || false,
          isPhotoVerified: sanitized.isPhotoVerified || sanitized.isVerified || false,
          createdAt: sanitized.createdAt || new Date().toISOString(),
          updatedAt: sanitized.updatedAt || new Date().toISOString(),
          // Profile fields
          educationLevel: sanitized.educationLevel || sanitized.profile?.educationLevel || null,
          religion: sanitized.religion || sanitized.profile?.religion || null,
          familyPlans: sanitized.familyPlans || sanitized.profile?.familyPlans || null,
          hasKids: sanitized.hasKids || sanitized.profile?.hasKids || null,
          languages: sanitized.languages || sanitized.profile?.languages || [],
          ethnicity: sanitized.ethnicity || sanitized.profile?.ethnicity || null,
          politicalViews: sanitized.politicalViews || sanitized.profile?.politicalViews || null,
          exercise: sanitized.exercise || sanitized.profile?.exercise || null,
          smoking: sanitized.smoking || sanitized.profile?.smoking || null,
          drinking: sanitized.drinking || sanitized.profile?.drinking || null,
          photos: sanitized.photos || sanitized.profile?.photos || [],
        };
      }

      return null;
    } catch (error) {
      console.error('UserService.getUser error:', error);
      return null;
    }
  }

  async getUsers(limit: number, offset: number) {
    try {
      const response = await this.client.get('/api/users', { params: { limit, offset } });
      return response.data.data;
    } catch (error) {
      console.error('UserService.getUsers error:', error);
      return [];
    }
  }

  async searchUsers(query: string, limit: number) {
    try {
      const response = await this.client.get('/api/users/search', { params: { q: query, limit } });
      return response.data.data;
    } catch (error) {
      console.error('UserService.searchUsers error:', error);
      return [];
    }
  }

  async updateUser(id: string, input: any) {
    try {
      // Map GraphQL UserUpdateInput to profile endpoint format
      const profileUpdate: any = {};

      // Only include fields that are actually provided and have values
      // Backend validation requires displayName to be non-empty if provided
      if (input.name !== undefined && input.name !== null) {
        const trimmedName = input.name.trim();
        if (trimmedName.length > 0) {
          profileUpdate.displayName = trimmedName;
        }
        // If name is provided but empty, don't send it (backend will reject empty displayName)
      }

      if (input.bio !== undefined && input.bio !== null) {
        const trimmedBio = input.bio.trim();
        // shortBio can be null/empty, so we send it even if empty
        profileUpdate.shortBio = trimmedBio.length > 0 ? trimmedBio : null;
      }

      if (input.age !== undefined && input.age !== null && input.age > 0) {
        profileUpdate.age = input.age;
      }

      if (input.gender !== undefined && input.gender !== null && input.gender.trim() !== '') {
        // Convert to uppercase to match backend enum values
        const genderUpper = input.gender.toUpperCase();
        if (['MAN', 'WOMAN', 'NONBINARY'].includes(genderUpper)) {
          profileUpdate.gender = genderUpper;
        }
      }

      if (input.interests !== undefined && input.interests !== null) {
        // Ensure interests is an array
        const interestsArray = Array.isArray(input.interests) ? input.interests : [];
        // Always send interests, even if empty array (to clear interests)
        // Use 'interests' field directly - backend will merge into preferences
        profileUpdate.interests = interestsArray;
      }

      if (input.location !== undefined && input.location !== null) {
        const locationStr = input.location.trim();
        if (locationStr.length > 0) {
          // Parse location if it's a string like "City, Country"
          if (locationStr.includes(',')) {
            const locationParts = locationStr.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
            if (locationParts.length >= 1) profileUpdate.locationCity = locationParts[0];
            if (locationParts.length >= 2) profileUpdate.locationCountry = locationParts[1];
          } else {
            // Single location value, assume it's a city
            profileUpdate.locationCity = locationStr;
          }
        }
      }

      // Note: profilePicture is handled separately via photo upload endpoint
      // Photos are managed through the /profile/photos endpoint

      // Only send the request if there's something to update
      if (Object.keys(profileUpdate).length === 0) {
        console.warn('No fields to update');
        // Return current user data instead of making an empty request
        const currentUser = await this.getUser(id);
        return currentUser;
      }

      console.log('Sending profile update:', JSON.stringify(profileUpdate, null, 2));

      const response = await this.client.put('/profile', profileUpdate);

      // Map profile response back to User format
      const profile = response.data.data?.profile;
      if (!profile) {
        throw new Error('Profile update failed: No profile data returned');
      }

      return {
        id: id,
        name: profile.displayName,
        bio: profile.shortBio,
        age: profile.age,
        gender: profile.gender,
        interests: profile.preferences?.interests || [],
        location: profile.locationCity && profile.locationCountry
          ? `${profile.locationCity}, ${profile.locationCountry}`
          : profile.locationCity || profile.locationCountry || '',
        profilePicture: profile.photos?.[0] || null,
      };
    } catch (error: any) {
      console.error('UserService.updateUser error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        input: input,
      });
      // Re-throw with more context
      const errorMessage = error.response?.data?.message ||
        error.response?.data?.error?.message ||
        error.response?.data?.error ||
        error.message ||
        'Profile update failed';
      throw new Error(errorMessage);
    }
  }

  async updateProfile(id: string, input: any) {
    try {
      // This is for ProfileUpdateInput (profile settings/preferences)
      // The /profile endpoint accepts preferences and other profile fields
      console.log('[UserService.updateProfile] Sending update:', JSON.stringify(input, null, 2));
      const response = await this.client.put('/profile', input);
      console.log('[UserService.updateProfile] Response:', JSON.stringify(response.data, null, 2));
      return response.data.data?.profile;
    } catch (error: any) {
      console.error('UserService.updateProfile error:', error.response?.data || error.message);
      throw error;
    }
  }

  async register(input: any) {
    try {
      const response = await this.client.post('/auth/register', input);
      console.log('UserService.register response:', JSON.stringify(response.data, null, 2));

      if (response.data && response.data.data) {
        return response.data.data;
      }
      if (response.data && response.data.user && response.data.token) {
        // Handle case where response is directly in data
        return response.data;
      }
      return response.data;
    } catch (error: any) {
      console.error('UserService.register error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
      });
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Registration failed';
      throw new Error(errorMessage);
    }
  }

  async login(email: string, password: string) {
    try {
      const response = await this.client.post('/auth/login', { email, password });
      console.log('UserService.login response:', JSON.stringify(response.data, null, 2));

      if (response.data && response.data.data) {
        return response.data.data;
      }
      if (response.data && response.data.user && response.data.token) {
        // Handle case where response is directly in data
        return response.data;
      }
      return response.data;
    } catch (error: any) {
      console.error('UserService.login error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
      });
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Login failed';
      throw new Error(errorMessage);
    }
  }

  async logout() {
    try {
      const response = await this.client.post('/auth/logout');
      return response.data;
    } catch (error: any) {
      // Don't throw error - logout should always succeed
      console.error('UserService.logout error:', error.response?.data || error.message);
      return { success: true };
    }
  }

  async verifyPhoto(selfieImageBase64: string) {
    try {
      // Extract base64 data (remove data URL prefix if present)
      let base64Data = selfieImageBase64;
      if (base64Data.includes(',')) {
        base64Data = base64Data.split(',')[1];
      } else if (base64Data.startsWith('data:')) {
        // Remove data:image/type;base64, prefix
        base64Data = base64Data.replace(/^data:image\/\w+;base64,/, '');
      }

      // Convert base64 to buffer for multipart upload
      const imageBuffer = Buffer.from(base64Data, 'base64');

      // Use FormData for multipart upload
      const FormData = require('form-data');
      const formData = new FormData();
      formData.append('selfie', imageBuffer, {
        filename: 'selfie.jpg',
        contentType: 'image/jpeg',
      });

      const response = await this.client.post('/profile/verify-photo', formData, {
        headers: {
          ...formData.getHeaders(),
        },
      });

      // Map backend response to GraphQL PhotoVerificationResult format
      const result = response.data.data;
      return {
        success: result.verified || false,
        message: result.message || (result.verified ? 'Photo verified successfully' : 'Photo verification failed'),
        confidence: result.confidence || 0,
        livenessDetected: result.livenessDetected || false,
      };
    } catch (error: any) {
      console.error('UserService.verifyPhoto error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
      });
      const errorMessage = error.response?.data?.message ||
        error.response?.data?.error?.message ||
        error.response?.data?.error ||
        error.message ||
        'Photo verification failed';
      throw new Error(errorMessage);
    }
  }

  /**
   * Get base preferences from user profile (Edit Profile page)
   * These are the default preferences that can be overridden by filter preferences
   */
  async getBasePreferences(userId: string) {
    try {
      const response = await this.client.get('/profile');
      const profileData = response.data.data;

      if (!profileData || !profileData.profile) {
        return {
          preferredGenders: [],
          preferredMinAge: null,
          preferredMaxAge: null,
          preferredInterests: [],
          preferredLanguages: [],
          maxRadius: null,
          maxDistance: null,
          location: null,
        };
      }

      const profile = profileData.profile;
      const preferences = profile.preferences || {};

      // Extract base preferences from profile (all fields)
      return {
        preferredGenders: profile.preferredGenders || [],
        preferredMinAge: preferences.ageMin || profile.preferredMinAge || preferences.preferredMinAge || null,
        preferredMaxAge: preferences.ageMax || profile.preferredMaxAge || preferences.preferredMaxAge || null,
        preferredInterests: preferences.interests || profile.interests || [],
        preferredLanguages: preferences.languages || [],
        maxRadius: preferences.maxRadius || preferences.maxDistance || null,
        maxDistance: preferences.maxDistance || preferences.maxRadius || null,
        location: profile.locationCity && profile.locationCountry
          ? `${profile.locationCity}, ${profile.locationCountry}`
          : profile.locationCity || profile.locationCountry || null,
        // Advanced preferences
        preferredEducationLevels: preferences.preferredEducationLevels || profile.preferredEducationLevels || [],
        preferredFamilyPlans: preferences.preferredFamilyPlans || profile.preferredFamilyPlans || [],
        preferredReligions: preferences.preferredReligions || profile.preferredReligions || [],
        preferredPoliticalViews: preferences.preferredPoliticalViews || profile.preferredPoliticalViews || [],
        preferredDrinkingHabits: preferences.preferredDrinkingHabits || profile.preferredDrinkingHabits || [],
        preferredSmokingHabits: preferences.preferredSmokingHabits || profile.preferredSmokingHabits || [],
        preferredRelationshipIntents: preferences.preferredRelationshipIntents || preferences.lookingFor || profile.preferredRelationshipIntents || [],
      };
    } catch (error: any) {
      console.error('UserService.getBasePreferences error:', error.response?.data || error.message);
      // Return empty preferences on error to allow matching to continue with filter preferences only
      return {
        preferredGenders: [],
        preferredMinAge: null,
        preferredMaxAge: null,
        preferredInterests: [],
        preferredLanguages: [],
        maxRadius: null,
        maxDistance: null,
        location: null,
        preferredEducationLevels: [],
        preferredFamilyPlans: [],
        preferredReligions: [],
        preferredPoliticalViews: [],
        preferredDrinkingHabits: [],
        preferredSmokingHabits: [],
        preferredRelationshipIntents: [],
      };
    }
  }

  async getProfile() {
    try {
      const response = await this.client.get('/profile');
      const profile = response.data.data?.profile || null;

      console.log('[UserService.getProfile] Profile data:', {
        hasProfile: !!profile,
        displayName: profile?.displayName,
        shortBio: profile?.shortBio,
        age: profile?.age,
        locationCity: profile?.locationCity,
        locationCountry: profile?.locationCountry,
        preferences: profile?.preferences,
        photos: Array.isArray(profile?.photos) ? profile.photos.length : 'not array',
      });

      return profile;
    } catch (error: any) {
      console.error('UserService.getProfile error:', error.response?.data || error.message);
      return null;
    }
  }

  async reportUser(reportData: any) {
    try {
      // Map GraphQL ReportInput to user-service format
      // GraphQL uses 'reason', but user-service expects 'reportType'
      const reportTypeMap: { [key: string]: string } = {
        'INAPPROPRIATE_BEHAVIOR': 'inappropriate_behavior',
        'HARASSMENT': 'harassment',
        'SPAM': 'spam',
        'FAKE_PROFILE': 'fake_profile',
        'UNDERAGE': 'underage',
        'INAPPROPRIATE_CONTENT': 'inappropriate_content',
        'VIOLENCE_THREAT': 'violence_threat',
        'OTHER': 'other',
      };

      const reportType = reportTypeMap[reportData.reason?.toUpperCase()] || 'other';
      
      // Ensure description meets minimum length requirement (10 chars)
      const description = reportData.description || 'Reported from chat';
      const finalDescription = description.length >= 10 
        ? description 
        : `${description}. Reported from chat conversation.`.substring(0, 500);

      const payload = {
        reportedUserId: reportData.reportedUserId,
        reportType: reportType,
        description: finalDescription,
        sessionId: reportData.sessionId || null,
        messageId: reportData.messageId || null,
      };

      const response = await this.client.post('/safety/report', payload);
      
      // Map response to GraphQL UserReport format
      const reportResponse = response.data.data || response.data;
      return {
        id: reportResponse.reportId || reportResponse.id,
        reporterId: reportData.reporterId,
        reportedUserId: reportData.reportedUserId,
        sessionId: reportData.sessionId || null,
        reason: reportData.reason,
        description: finalDescription,
        status: reportResponse.status || 'PENDING',
        priority: 'MEDIUM', // Default priority
        createdAt: new Date(),
      };
    } catch (error: any) {
      console.error('UserService.reportUser error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || error.response?.data?.error || 'Failed to report user');
    }
  }

  async blockUser(userId: string, targetUserId: string) {
    try {
      const response = await this.client.post('/safety/block', {
        blockedUserId: targetUserId,
      });
      return response.data.success !== false;
    } catch (error: any) {
      console.error('UserService.blockUser error:', error.response?.data || error.message);
      return false;
    }
  }
}

// Queuing Service Data Source
class QueueService {
  private client: AxiosInstance;

  constructor(token: string | null) {
    this.client = createServiceClient(config.services.queuing, token);
  }

  async getQueueStatus(userId: string) {
    try {
      const response = await this.client.get(`/api/queue/status/${userId}`);
      const status = response.data.data;

      // Ensure userId is always present (required by GraphQL schema)
      if (!status) {
        return {
          userId,
          status: 'NOT_IN_QUEUE',
          position: null,
          estimatedWaitTime: null,
          preferences: null,
          joinedAt: new Date(),
        };
      }

      // Ensure userId is set even if missing from response
      if (!status.userId) {
        status.userId = userId;
      }

      // Map the response to GraphQL QueueStatus format
      return {
        userId: status.userId || userId,
        status: status.status || (status.inQueue ? 'WAITING' : 'NOT_IN_QUEUE'),
        position: status.position,
        estimatedWaitTime: status.position ? status.position * 30 : null, // Rough estimate: 30 seconds per position
        preferences: status.preferences || null,
        joinedAt: status.enteredAt ? new Date(status.enteredAt) : new Date(),
      };
    } catch (error: any) {
      console.error('QueueService.getQueueStatus error:', error);
      // Return a valid QueueStatus object even on error (required by GraphQL schema)
      return {
        userId,
        status: 'ERROR',
        position: null,
        estimatedWaitTime: null,
        preferences: null,
        joinedAt: new Date(),
      };
    }
  }

  async joinQueue(userId: string, queueData: any) {
    try {
      // The queuing service route expects individual fields
      // queueData already contains userId, intent, gender, age, latitude, longitude, interests, languages, ethnicity, and preferences
      const response = await this.client.post('/api/queue/join', queueData);

      if (!response || !response.data) {
        throw new Error('Invalid response from queuing service');
      }

      if (response.data.status !== 'success') {
        throw new Error(response.data.message || 'Failed to join queue');
      }

      // After joining, fetch the full queue status
      // Add a small delay to ensure the queue entry is fully processed
      await new Promise(resolve => setTimeout(resolve, 100));

      let status = null;
      try {
        const statusResponse = await this.client.get(`/api/queue/status/${userId}`);
        if (statusResponse && statusResponse.data && statusResponse.data.data) {
          status = statusResponse.data.data;
        }
      } catch (statusError: any) {
        console.warn('Failed to fetch queue status after join, using default:', statusError.message);
        // Continue with default status
      }

      // Format the response to match GraphQL QueueStatus type
      if (status && status.inQueue) {
        return {
          userId: userId,
          status: 'WAITING',
          position: status.position !== null && status.position !== undefined ? status.position : null,
          estimatedWaitTime: status.position !== null && status.position !== undefined ? status.position * 30 : null, // Rough estimate: 30 seconds per position
          preferences: queueData.preferences || null,
          joinedAt: status.enteredAt ? new Date(status.enteredAt) : new Date(),
        };
      }

      // If status fetch failed or user not in queue, return minimal data (still valid)
      return {
        userId: userId,
        status: 'WAITING',
        position: null,
        estimatedWaitTime: null,
        preferences: queueData.preferences || null,
        joinedAt: new Date(),
      };
    } catch (error: any) {
      console.error('QueueService.joinQueue error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      // Re-throw with more context
      const errorMessage = error.response?.data?.message || error.message || 'Failed to join queue';
      throw new Error(errorMessage);
    }
  }

  async leaveQueue(userId: string) {
    try {
      const response = await this.client.post('/api/queue/leave', { userId });
      // The queuing service returns { status: 'success' } or { status: 'error' }
      return response.data.status === 'success';
    } catch (error: any) {
      console.error('QueueService.leaveQueue error:', error);
      // Return false on error (required by GraphQL schema Boolean!)
      return false;
    }
  }

  async skipMatch(userId: string, sessionId?: string) {
    try {
      const response = await this.client.post('/api/queue/skip', { userId, sessionId });
      return response.data.status === 'success';
    } catch (error: any) {
      console.error('QueueService.skipMatch error:', error);
      return false;
    }
  }

  /**
   * Sync preferences to UserMatchingPreferences table for matching algorithm
   */
  async syncMatchingPreferences(userId: string, preferences: any) {
    try {
      // Map preferences to queuing service format
      // Include all relevant preference fields
      const matchingPrefs: any = {
        maxRadius: preferences.maxDistance || preferences.maxRadius || 50,
        preferredInterests: preferences.interests || [],
        preferredGenders: preferences.preferredGenders || [],
        preferredRelationshipIntents: preferences.preferredRelationshipIntents || preferences.lookingFor || [],
        preferredFamilyPlans: preferences.preferredFamilyPlans || [],
        preferredReligions: preferences.preferredReligions || [],
        preferredEducationLevels: preferences.preferredEducationLevels || [],
        preferredPoliticalViews: preferences.preferredPoliticalViews || [],
        preferredExerciseHabits: preferences.preferredExerciseHabits || [],
        preferredSmokingHabits: preferences.preferredSmokingHabits || [],
        preferredDrinkingHabits: preferences.preferredDrinkingHabits || [],
        // Include age range in multiple formats for compatibility
        preferredMinAge: preferences.ageMin || preferences.preferredMinAge || 18,
        preferredMaxAge: preferences.ageMax || preferences.preferredMaxAge || 65,
        ageRange: {
          min: preferences.ageMin || preferences.preferredMinAge || 18,
          max: preferences.ageMax || preferences.preferredMaxAge || 65
        },
        // Include gender preference for normalization
        genderPreference: preferences.interestedIn || 'Everyone',
      };

      // Only include fields that are defined (not undefined)
      Object.keys(matchingPrefs).forEach(key => {
        if (matchingPrefs[key] === undefined) {
          delete matchingPrefs[key];
        }
      });

      console.log('[QueueService.syncMatchingPreferences] Sending:', JSON.stringify(matchingPrefs, null, 2));

      // Update via dating-preferences endpoint
      const response = await this.client.put(`/api/matching/dating-preferences/${userId}`, matchingPrefs);
      return response.data.status === 'success';
    } catch (error: any) {
      console.error('QueueService.syncMatchingPreferences error:', error);
      // Don't throw - preference sync failure shouldn't break preference saving
      return false;
    }
  }

  /**
   * Get pending matches for a user
   */
  async getPendingMatches(userId: string) {
    try {
      const response = await this.client.get(`/api/matching/pending/${userId}`);
      return response.data.data || [];
    } catch (error: any) {
      console.error('QueueService.getPendingMatches error:', error);
      return [];
    }
  }

  /**
   * Get match history for a user
   */
  async getMatchHistory(userId: string, limit = 20, offset = 0) {
    try {
      const response = await this.client.get(`/api/matching/history/${userId}`, {
        params: { limit, offset }
      });
      return response.data.data?.matches || [];
    } catch (error: any) {
      console.error('QueueService.getMatchHistory error:', error);
      return [];
    }
  }

  /**
   * Get a specific match by ID
   */
  async getMatch(matchId: string) {
    try {
      const response = await this.client.get(`/api/matching/${matchId}`);
      return response.data.data;
    } catch (error: any) {
      console.error('QueueService.getMatch error:', error);
      return null;
    }
  }

  /**
   * Accept a match
   */
  async acceptMatch(matchId: string, userId: string) {
    try {
      console.log(`[QueueService.acceptMatch] Calling: ${this.client.defaults.baseURL}/api/matching/accept/${matchId}`);
      console.log(`[QueueService.acceptMatch] With userId: ${userId}`);

      const response = await this.client.post(`/api/matching/accept/${matchId}`, { userId });
      console.log(`[QueueService.acceptMatch] Response status: ${response.status}`);
      console.log(`[QueueService.acceptMatch] Response data:`, JSON.stringify(response.data, null, 2));

      if (response.data.status === 'error') {
        throw new Error(response.data.message || 'Failed to accept match');
      }

      return response.data.data;
    } catch (error: any) {
      console.error('[QueueService.acceptMatch] Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        fullURL: `${error.config?.baseURL}${error.config?.url}`,
      });

      // Provide more specific error message
      if (error.response?.status === 404) {
        throw new Error(`Match endpoint not found. Please check if the queuing service is running and the endpoint exists.`);
      }

      throw new Error(error.response?.data?.message || error.message || 'Failed to accept match');
    }
  }

  /**
   * Decline a match
   */
  async declineMatch(matchId: string, userId: string) {
    try {
      console.log(`[QueueService.declineMatch] Calling: ${this.client.defaults.baseURL}/api/matching/decline/${matchId}`);
      console.log(`[QueueService.declineMatch] With userId: ${userId}`);

      const response = await this.client.post(`/api/matching/decline/${matchId}`, { userId });
      console.log(`[QueueService.declineMatch] Response status: ${response.status}`);
      console.log(`[QueueService.declineMatch] Response data:`, JSON.stringify(response.data, null, 2));

      if (response.data.status === 'error') {
        throw new Error(response.data.message || 'Failed to decline match');
      }

      return response.data.data;
    } catch (error: any) {
      console.error('[QueueService.declineMatch] Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        fullURL: `${error.config?.baseURL}${error.config?.url}`,
      });

      // Provide more specific error message
      if (error.response?.status === 404) {
        throw new Error(`Match endpoint not found. Please check if the queuing service is running and the endpoint exists.`);
      }

      throw new Error(error.response?.data?.message || error.message || 'Failed to decline match');
    }
  }

  /**
   * Discover profiles from all active users (not just queue)
   */
  async discoverProfiles(userId: string, preferences?: any, limit: number = 10) {
    try {
      const response = await this.client.post('/api/matching/discover-profiles', {
        userId,
        preferences,
        limit,
        minCompatibility: 0.4
      });

      if (response.data.status === 'error') {
        throw new Error(response.data.message || 'Failed to discover profiles');
      }

      const data = response.data.data;
      // Our queuing-service returns { profiles, totalCandidates }, older versions returned an array.
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.profiles)) return data.profiles;
      return [];
    } catch (error: any) {
      console.error('QueueService.discoverProfiles error:', error);
      throw new Error(error.response?.data?.message || error.message || 'Failed to discover profiles');
    }
  }

  /**
   * Create match from suggestion (immediate match creation)
   */
  async createMatchFromSuggestion(userId: string, suggestedUserId: string) {
    try {
      // First, we need to calculate compatibility score
      // Then create a match attempt with status ACCEPTED
      // This is similar to acceptMatch but creates a new match instead of accepting an existing one
      
      // For now, we'll create a match attempt directly
      // In a full implementation, we'd calculate the score first
      const response = await this.client.post('/api/matching/create-from-suggestion', {
        userId,
        targetUserId: suggestedUserId
      });

      if (response.data.status === 'error') {
        throw new Error(response.data.message || 'Failed to create match');
      }

      return response.data.data;
    } catch (error: any) {
      console.error('QueueService.createMatchFromSuggestion error:', error);
      // If endpoint doesn't exist yet, we'll handle it in the resolver
      throw new Error(error.response?.data?.message || error.message || 'Failed to create match from suggestion');
    }
  }
}

// Interaction Service Data Source
class InteractionService {
  private client: AxiosInstance;

  constructor(token: string | null) {
    this.client = createServiceClient(config.services.interaction, token);
  }

  async getUserInteractions(userId: string, page = 1, limit = 10) {
    try {
      const response = await this.client.get(`/api/interactions/user/${userId}`, {
        params: { page, limit },
      });
      return response.data.data.interactions;
    } catch (error) {
      console.error('InteractionService.getUserInteractions error:', error);
      return [];
    }
  }

  async getInteraction(id: string) {
    try {
      const response = await this.client.get(`/api/interactions/${id}`);
      const interaction = response.data.data;
      
      if (!interaction) {
        return null;
      }
      
      // Map Interaction to InteractionSession format (same as getUserSessions)
      return {
        id: interaction.id,
        user1Id: interaction.user1Id,
        user2Id: interaction.user2Id,
        type: interaction.callType?.toLowerCase() || 'voice', // Map callType to type
        status: interaction.status?.toLowerCase() || 'initiated',
        startedAt: interaction.startedAt || interaction.createdAt,
        endedAt: interaction.endedAt || null,
        duration: interaction.duration || null,
        metadata: {
          roomId: interaction.roomId,
          videoEnabled: interaction.videoEnabled || false,
          qualityRating: interaction.qualityRating || null,
        },
      };
    } catch (error) {
      console.error('InteractionService.getInteraction error:', error);
      return null;
    }
  }

  /**
   * Get active sessions for a user
   * Maps Interaction model to InteractionSession GraphQL type
   */
  async getUserSessions(userId: string, limit?: number, offset?: number) {
    try {
      const params: any = {};
      if (limit) params.limit = limit;
      if (offset !== undefined) {
        // Convert offset to page number (assuming limit defaults to 10)
        const pageSize = limit || 10;
        params.page = Math.floor(offset / pageSize) + 1;
      }

      const response = await this.client.get(`/api/interactions/user/${userId}`, { params });
      const interactions = response.data.data?.interactions || [];

      // Filter for active sessions (status: INITIATED, CONNECTING, CONNECTED)
      const activeStatuses = ['INITIATED', 'CONNECTING', 'CONNECTED'];
      const activeSessions = interactions.filter((interaction: any) =>
        activeStatuses.includes(interaction.status) && !interaction.endedAt
      );

      // Transform Interaction to InteractionSession format
      return activeSessions.map((interaction: any) => {
        // Determine which user is the current user and which is the partner
        const isUser1 = interaction.user1Id === userId;
        return {
          id: interaction.id,
          user1Id: interaction.user1Id,
          user2Id: interaction.user2Id,
          type: interaction.callType?.toLowerCase() || 'voice',
          status: interaction.status?.toLowerCase() || 'initiated',
          startedAt: interaction.startedAt || interaction.createdAt,
          endedAt: interaction.endedAt || null,
          duration: interaction.duration || null,
          metadata: {
            roomId: interaction.roomId,
            videoEnabled: interaction.videoEnabled || false,
            qualityRating: interaction.qualityRating || null,
          },
        };
      });
    } catch (error: any) {
      console.error('InteractionService.getUserSessions error:', error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Start a new session
   */
  async startSession(userId: string, partnerId: string, type: string = 'VOICE', roomId?: string) {
    try {
      // Normalize callType - accept 'VIDEO', 'VOICE', 'video', 'voice', 'chat', 'RANDOM_MATCH'
      let callType = 'VOICE';
      if (type && typeof type === 'string') {
        const upperType = type.toUpperCase();
        if (upperType === 'VIDEO' || upperType === 'RANDOM_MATCH') {
          callType = 'VIDEO';
        } else {
          callType = 'VOICE';
        }
      }

      const payload: any = {
        user1Id: userId,
        user2Id: partnerId,
        callType: callType,
        status: 'INITIATED',
      };

      // Only include roomId if provided and not empty
      // Note: The interaction service will generate its own roomId if not provided
      // We avoid passing chatRoomId to prevent unique constraint violations
      if (roomId && roomId.trim() !== '') {
        payload.roomId = roomId;
      }

      console.log('[InteractionService.startSession] Creating session with payload:', {
        user1Id: payload.user1Id,
        user2Id: payload.user2Id,
        callType: payload.callType,
        hasRoomId: !!payload.roomId
      });

      const response = await this.client.post('/api/interactions', payload);

      if (response.data.status === 'error') {
        throw new Error(response.data.message || 'Failed to start session');
      }

      const interaction = response.data.data;
      if (!interaction) {
        throw new Error('Invalid response from interaction service');
      }

      return {
        id: interaction.id,
        user1Id: interaction.user1Id,
        user2Id: interaction.user2Id,
        type: interaction.callType?.toLowerCase() || 'voice',
        status: interaction.status?.toLowerCase() || 'initiated',
        startedAt: interaction.startedAt || interaction.createdAt || new Date().toISOString(),
        endedAt: null,
        duration: null,
        metadata: {
          roomId: interaction.roomId,
          videoEnabled: interaction.videoEnabled || false,
        },
      };
    } catch (error: any) {
      console.error('[InteractionService.startSession] Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        baseURL: error.config?.baseURL
      });
      
      // Provide more specific error message
      const errorMessage = error.response?.data?.message || error.message || 'Internal server error';
      throw new Error(errorMessage);
    }
  }

  /**
   * End a session
   */
  async endSession(sessionId: string) {
    try {
      const response = await this.client.patch(`/api/interactions/${sessionId}`, {
        status: 'COMPLETED',
        endedAt: new Date().toISOString(),
      });
      return response.data.success !== false;
    } catch (error: any) {
      console.error('InteractionService.endSession error:', error.response?.data || error.message);
      // Try to update via PUT if PATCH doesn't work
      try {
        const response = await this.client.put(`/api/interactions/${sessionId}`, {
          status: 'COMPLETED',
          endedAt: new Date().toISOString(),
        });
        return response.data.success !== false;
      } catch (putError: any) {
        console.error('InteractionService.endSession PUT error:', putError.response?.data || putError.message);
        return false;
      }
    }
  }
}

// Communication Service Data Source
class CommunicationService {
  private client: AxiosInstance;

  constructor(token: string | null) {
    this.client = createServiceClient(config.services.communication, token);
  }

  async getMessages(roomId: string, limit = 50, offset = 0) {
    try {
      // Use the correct endpoint: /api/chat/conversations/:roomId/messages
      const response = await this.client.get(`/api/chat/conversations/${roomId}/messages`, { 
        params: { limit, offset } 
      });
      return response.data.data || [];
    } catch (error: any) {
      console.error('CommunicationService.getMessages error:', error.response?.data || error.message);
      return [];
    }
  }

  async sendMessage(input: any) {
    try {
      // The communication service expects roomId, content, type, and metadata
      // Map sessionId to roomId if needed
      const { sessionId, content, messageType, metadata, ...rest } = input;
      const roomId = input.roomId || sessionId; // Use roomId if provided, otherwise use sessionId
      
      const payload = {
        content,
        type: messageType || 'TEXT',
        metadata,
        ...rest
      };
      
      const response = await this.client.post(`/api/chat/conversations/${roomId}/messages`, payload);
      return response.data.data;
    } catch (error: any) {
      console.error('CommunicationService.sendMessage error:', error.response?.data || error.message);
      throw error;
    }
  }

  async markMessageAsRead(messageId: string) {
    try {
      // Note: The communication service doesn't have a direct mark-as-read endpoint
      // This might need to be implemented or we can use a different approach
      // For now, return true to avoid breaking the flow
      return true;
    } catch (error: any) {
      console.error('CommunicationService.markMessageAsRead error:', error.response?.data || error.message);
      return false;
    }
  }

  async getMessageHistory(userId: string, limit = 50, offset = 0) {
    try {
      // Get all conversations for the user, then get messages from each
      const response = await this.client.get('/api/chat/conversations', {
        params: { limit: 100, offset: 0 }
      });
      
      const conversations = response.data.data || [];
      const allMessages: any[] = [];
      
      // Get messages from each conversation
      for (const conversation of conversations.slice(0, 10)) { // Limit to first 10 conversations
        try {
          const messagesResponse = await this.client.get(`/api/chat/conversations/${conversation.roomId}/messages`, {
            params: { limit: 50 }
          });
          const messages = messagesResponse.data.data || [];
          allMessages.push(...messages);
        } catch (err) {
          // Skip conversations that fail
          continue;
        }
      }
      
      // Sort by timestamp and apply limit/offset
      allMessages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return allMessages.slice(offset, offset + limit);
    } catch (error: any) {
      console.error('CommunicationService.getMessageHistory error:', error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Create or get a chat room between two users
   */
  async createOrGetRoom(userId1: string, userId2: string): Promise<string> {
    try {
      // Try to create conversation (the service now checks for existing ones first)
      const response = await this.client.post('/api/chat/conversations', {
        participant2Id: userId2,
        isAnonymous: false
      });

      if (response.data.success && response.data.data) {
        const room = response.data.data;
        const roomId = room.roomId || room.id;
        console.log('[CommunicationService] Room created/found:', roomId);
        return roomId;
      }

      throw new Error('Failed to create conversation - invalid response');
    } catch (error: any) {
      console.error('[CommunicationService] Error creating/getting room:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });

      // If creation fails, try to find existing room via GET
      try {
        console.log('[CommunicationService] Attempting to find existing room via GET...');
        const conversationsResponse = await this.client.get('/api/chat/conversations', {
          params: { limit: 100 }
        });

        if (conversationsResponse.data.success || conversationsResponse.data.data) {
          const conversations = conversationsResponse.data.data || conversationsResponse.data || [];

          // Find existing room with both users
          const existingRoom = conversations.find((room: any) => {
            // Check participant1Id and participant2Id fields
            if ((room.participant1Id === userId1 && room.participant2Id === userId2) ||
              (room.participant1Id === userId2 && room.participant2Id === userId1)) {
              return true;
            }
            // Also check participants array if it exists
            const participants = room.participants || [];
            const userIds = participants.map((p: any) => p.userId || p);
            return userIds.includes(userId1) && userIds.includes(userId2);
          });

          if (existingRoom) {
            const roomId = existingRoom.roomId || existingRoom.id;
            console.log('[CommunicationService] Found existing room:', roomId);
            return roomId;
          }
        }
      } catch (findError: any) {
        console.error('[CommunicationService] Error finding existing room:', {
          message: findError.message,
          status: findError.response?.status
        });
      }

      // Don't use a fallback roomId - the room must exist in the database
      // Throw error so the caller knows room creation failed
      const errorMessage = error.response?.data?.details?.message || error.response?.data?.error || error.message;
      throw new Error(`Failed to create or find room for users ${userId1} and ${userId2}. ${errorMessage}`);
    }
  }
}

// Notification Service Data Source
class NotificationService {
  private client: AxiosInstance;

  constructor(token: string | null) {
    this.client = createServiceClient(config.services.notification, token);
  }

  async getNotifications(userId: string, limit = 20, offset = 0) {
    try {
      console.log(`[NotificationService] Fetching notifications for user ${userId}, limit: ${limit}, offset: ${offset}`);
      console.log(`[NotificationService] Base URL: ${this.client.defaults.baseURL}`);
      const response = await this.client.get(`/api/notifications/user/${userId}`, {
        params: { limit, offset },
      });
      console.log(`[NotificationService] Response status: ${response.status}`);
      console.log(`[NotificationService] Response data keys:`, Object.keys(response.data || {}));
      const notifications = response.data.data?.notifications || [];
      console.log(`[NotificationService] Found ${notifications.length} notifications`);
      if (notifications.length > 0) {
        console.log(`[NotificationService] First notification:`, JSON.stringify(notifications[0], null, 2));
      }
      return notifications;
    } catch (error: any) {
      console.error('[NotificationService] Error getting notifications:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        baseURL: this.client.defaults.baseURL,
        url: error.config?.url,
      });
      return [];
    }
  }

  async getUnreadNotifications(userId: string) {
    try {
      console.log(`[NotificationService] Fetching unread notifications for user ${userId}`);
      const response = await this.client.get(`/api/notifications/user/${userId}`, {
        params: { limit: 100, offset: 0 },
      });
      const allNotifications = response.data.data?.notifications || [];
      const unread = allNotifications.filter((n: any) => !n.read);
      console.log(`[NotificationService] Found ${unread.length} unread notifications`);
      return unread;
    } catch (error: any) {
      console.error('[NotificationService] Error getting unread notifications:', error.response?.data || error.message);
      return [];
    }
  }

  async markAsRead(notificationId: string) {
    try {
      console.log(`[NotificationService] Marking notification ${notificationId} as read`);
      const response = await this.client.patch(`/api/notifications/${notificationId}/read`);
      console.log(`[NotificationService] Mark as read response:`, response.data);
      // Response format: { status: 'success', data: { success: true } }
      const success = response.data.data?.success || response.data.success || false;
      console.log(`[NotificationService] Mark as read result: ${success}`);
      return success;
    } catch (error: any) {
      console.error('[NotificationService] Mark as read error:', error.response?.data || error.message);
      return false;
    }
  }

  async markNotificationAsRead(notificationId: string) {
    return this.markAsRead(notificationId);
  }

  async markAllNotificationsAsRead(userId: string) {
    try {
      const response = await this.client.patch(`/api/notifications/user/${userId}/read-all`);
      return response.data.success || false;
    } catch (error) {
      console.error('NotificationService.markAllNotificationsAsRead error:', error);
      return false;
    }
  }

  async markMatchActionTaken(matchId: string, userId: string) {
    try {
      const response = await this.client.patch(`/api/notifications/match/${matchId}/action-taken`, { userId });
      return response.data.success || false;
    } catch (error) {
      console.error('NotificationService.markMatchActionTaken error:', error);
      return false;
    }
  }

  async deleteAllNotifications(userId: string) {
    try {
      const response = await this.client.delete(`/api/notifications/user/${userId}`);
      return response.data.data?.success || response.data.success || false;
    } catch (error) {
      console.error('NotificationService.deleteAllNotifications error:', error);
      return false;
    }
  }
}

// DataLoader for batching requests
function createUserLoader(userService: UserService) {
  return new DataLoader(async (ids: readonly string[]) => {
    const users = await Promise.all(ids.map((id) => userService.getUser(id)));
    return users;
  });
}

function createNotificationLoader(notificationService: NotificationService) {
  return new DataLoader(async (userIds: readonly string[]) => {
    const notifications = await Promise.all(
      userIds.map((userId) => notificationService.getNotifications(userId))
    );
    return notifications;
  });
}

// History Service Data Source
class HistoryService {
  private client: AxiosInstance;

  constructor(token: string | null) {
    this.client = createServiceClient(config.services.history, token);
  }

  async logUserAction(data: { type: string; userId: string; metadata?: any }) {
    try {
      // Map the type to actionType expected by history service
      // History service expects: LOGIN, LOGOUT, START_SESSION, END_SESSION, SKIP_USER, REPORT_USER,
      // RATE_SESSION, UPDATE_PROFILE, CHANGE_SETTINGS, PURCHASE_PREMIUM, USE_FILTER, SEND_MESSAGE, MAKE_CALL, SCREEN_SHARE
      const actionTypeMap: Record<string, string> = {
        'queue_joined': 'USE_FILTER', // Use closest valid action type
        'queue_left': 'END_SESSION',
      };

      const actionType = actionTypeMap[data.type] || 'UPDATE_PROFILE'; // Default fallback

      const response = await this.client.post('/api/history/actions', {
        userId: data.userId,
        actionType: actionType,
        metadata: data.metadata || {},
      });
      return response.data.data;
    } catch (error: any) {
      console.error('HistoryService.logUserAction error:', error.response?.data || error.message);
      // Don't throw - logging failures shouldn't break the main operation
      return null;
    }
  }

  async logInteraction(data: { sessionId: string; userId: string; metadata?: any }) {
    try {
      const response = await this.client.post('/api/history/interactions', data);
      return response.data.data;
    } catch (error: any) {
      console.error('HistoryService.logInteraction error:', error.response?.data || error.message);
      return null;
    }
  }
}

// Moderation Service Data Source
class ModerationServiceDataSource {
  private client: AxiosInstance;

  constructor(token: string | null) {
    this.client = createServiceClient(config.services.moderation, token);
  }

  async moderateContent(content: string, type: string) {
    try {
      // The moderation service might not have a direct content moderation endpoint
      // For now, return a default "allow" response to avoid breaking message sending
      // In production, this should call the actual moderation API
      return {
        blocked: false,
        flagged: false,
        confidence: 1.0
      };
    } catch (error: any) {
      console.error('ModerationService.moderateContent error:', error.response?.data || error.message);
      // Return allow on error to avoid blocking messages
      return {
        blocked: false,
        flagged: false,
        confidence: 0.5
      };
    }
  }
}

// Create all data sources
export function createDataSources(token: string | null) {
  const userService = new UserService(token);
  const queuingService = new QueueService(token); // Renamed from queueService to queuingService
  const interactionService = new InteractionService(token);
  const communicationService = new CommunicationService(token);
  const notificationService = new NotificationService(token);
  const historyService = new HistoryService(token);
  const moderationService = new ModerationServiceDataSource(token);

  return {
    userService,
    queuingService, // Fixed: renamed to match resolver usage
    interactionService,
    communicationService,
    notificationService,
    historyService, // Added missing history service
    moderationService, // Added moderation service
    userLoader: createUserLoader(userService),
    notificationLoader: createNotificationLoader(notificationService),
  };
}
