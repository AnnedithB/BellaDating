import { GraphQLContext } from '../types';
import { GraphQLError } from 'graphql';
import { mergePreferences } from '../utils/preferenceMerger';

export const queueResolvers = {
  Query: {
    queueStatus: async (_: any, __: any, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      
      const { queuingService } = context.dataSources as any;
      return await queuingService.getQueueStatus(context.auth.user.id);
    },
    
    queueStatistics: async (_: any, __: any, context: GraphQLContext) => {
      const { queuingService } = context.dataSources as any;
      return await queuingService.getQueueStatistics();
    },

    discoverProfiles: async (_: any, { preferences, limit = 10 }: { preferences?: any; limit?: number }, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }

      const { queuingService } = context.dataSources as any;
      const result = await queuingService.discoverProfiles(context.auth.user.id, preferences, limit);
      const profiles = Array.isArray(result) ? result : (result?.profiles && Array.isArray(result.profiles) ? result.profiles : []);

      // Transform to GraphQL SuggestedProfile format
      return profiles.map((profile: any) => {
        const user = profile.user ?? profile;
        // Ensure required User fields exist (email is non-nullable in schema)
        const normalizedUser = {
          id: user.id,
          email: user.email ?? '',
          name: user.name ?? null,
          profilePicture: user.profilePicture ?? null,
          photos: user.photos ?? [],
          bio: user.bio ?? null,
          age: user.age ?? null,
          gender: user.gender ?? null,
          interests: user.interests ?? [],
          location: user.location ?? null,
          isOnline: user.isOnline ?? false,
          isActive: user.isActive ?? true,
          isVerified: user.isVerified ?? false,
          isPhotoVerified: user.isPhotoVerified ?? false,
          createdAt: user.createdAt ?? new Date().toISOString(),
          updatedAt: user.updatedAt ?? new Date().toISOString(),
          educationLevel: user.educationLevel ?? null,
          religion: user.religion ?? null,
          familyPlans: user.familyPlans ?? null,
        };

        return {
          user: normalizedUser,
          compatibilityScore: profile.compatibilityScore ?? 0,
          matchReasons: profile.matchReasons || [],
          distance: profile.distance
        };
      });
    },
  },
  
  Mutation: {
    joinQueue: async (_: any, { preferences: filterPreferences }: { preferences?: any }, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      
      const { queuingService, historyService, userService } = context.dataSources as any;
      
      // Fetch user profile to get basic info (intent, gender, age, location) and base preferences
      let userProfile: any = null;
      try {
        const profileResponse = await (userService as any).client.get('/profile');
        userProfile = profileResponse.data.data?.profile;
      } catch (error) {
        console.error('Error fetching user profile for queue join:', error);
      }
      
      // Fetch base preferences from user profile (Edit Profile page)
      const basePreferences = await userService.getBasePreferences(context.auth.user.id);
      
      // Merge base preferences with filter preferences (filters override base when set)
      const mergedPreferences = mergePreferences(basePreferences, filterPreferences);
      
      // Validate required fields before joining queue
      if (!userProfile?.gender) {
        throw new GraphQLError(
          'Please complete your profile by setting your gender before joining the queue. Go to Edit Profile to add your gender.',
          { 
            extensions: { 
              code: 'VALIDATION_ERROR',
              field: 'gender'
            } 
          }
        );
      }

      // Map connectionType to intent (same mapping as in userResolvers)
      const intentMap: { [key: string]: string } = {
        'Dating': 'CASUAL',
        'Friendship': 'FRIENDS',
        'Friends': 'FRIENDS', // Support both for backwards compatibility
        'Serious': 'SERIOUS',
        'Networking': 'NETWORKING',
      };
      
      // Get intent from connectionType in merged preferences, or from userProfile, or default
      // mergedPreferences is typed as any, so we can access connectionType
      const mergedPrefs = mergedPreferences as any;
      let intent = 'CASUAL'; // Default
      if (mergedPrefs?.connectionType && intentMap[mergedPrefs.connectionType]) {
        intent = intentMap[mergedPrefs.connectionType];
      } else if (userProfile?.intent && ['CASUAL', 'FRIENDS', 'SERIOUS', 'NETWORKING'].includes(userProfile.intent)) {
        intent = userProfile.intent;
      }
      
      console.log('[QueueResolver] Intent mapping:', {
        connectionType: mergedPrefs?.connectionType,
        userProfileIntent: userProfile?.intent,
        finalIntent: intent
      });

      // Prepare queue data with user info and merged preferences
      const queueData: any = {
        userId: context.auth.user.id,
        intent: intent,
        gender: userProfile.gender, // Now guaranteed to be set
        age: userProfile?.age || null,
        latitude: userProfile?.latitude || null,
        longitude: userProfile?.longitude || null,
        interests: mergedPreferences.interests || [],
        languages: mergedPreferences.languages || [],
        ethnicity: userProfile?.ethnicity || null,
        // Pass merged preferences for matching algorithm to use (includes all advanced fields)
        preferences: {
          ...mergedPreferences,
          // Include all advanced preference fields
          preferredEducationLevels: mergedPreferences.preferredEducationLevels || [],
          preferredFamilyPlans: mergedPreferences.preferredFamilyPlans || [],
          preferredReligions: mergedPreferences.preferredReligions || [],
          preferredPoliticalViews: mergedPreferences.preferredPoliticalViews || [],
          preferredDrinkingHabits: mergedPreferences.preferredDrinkingHabits || [],
          preferredSmokingHabits: mergedPreferences.preferredSmokingHabits || [],
          preferredRelationshipIntents: mergedPreferences.preferredRelationshipIntents || [],
        },
      };
      
      console.log('[QueueResolver] Joining queue with data:', {
        userId: queueData.userId,
        intent: queueData.intent,
        gender: queueData.gender,
        age: queueData.age,
        interestsCount: queueData.interests?.length || 0,
      });
      
      // Pass queue data to queuing service
      let queueStatus;
      try {
        queueStatus = await queuingService.joinQueue(context.auth.user.id, queueData);
      } catch (error: any) {
        console.error('Error in queuingService.joinQueue:', error);
        // If joinQueue fails, throw a proper GraphQL error
        throw new GraphQLError(
          error.message || 'Failed to join queue',
          { extensions: { code: 'INTERNAL_SERVER_ERROR', originalError: error } }
        );
      }
      
      // Ensure queueStatus is valid
      if (!queueStatus) {
        console.error('joinQueue returned undefined/null');
        throw new GraphQLError('Failed to join queue: Invalid response from queuing service', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' }
        });
      }
      
      // Log the queue join action with both base and filter preferences for debugging
      historyService.logUserAction({
        type: 'queue_joined',
        userId: context.auth.user.id,
        metadata: { 
          basePreferences,
          filterPreferences,
          mergedPreferences,
        },
      }).catch((err: any) => {
        console.error('Failed to log queue join action:', err);
        // Don't throw - logging failure shouldn't break the request
      });
      
      return queueStatus;
    },
    
    leaveQueue: async (_: any, __: any, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      
      const { queuingService, historyService } = context.dataSources as any;
      
      const result = await queuingService.leaveQueue(context.auth.user.id);
      
      // Log the queue leave action (don't fail if logging fails)
      historyService.logUserAction({
        type: 'queue_left',
        userId: context.auth.user.id,
      }).catch((err: any) => {
        console.error('Failed to log queue leave action:', err);
      });
      
      // Ensure we always return a boolean (required by GraphQL schema Boolean!)
      return result === true;
    },
    
    updateQueuePreferences: async (_: any, { preferences }: { preferences: any }, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      
      const { queuingService } = context.dataSources as any;
      return await queuingService.updatePreferences(context.auth.user.id, preferences);
    },

    skipMatch: async (_: any, { sessionId }: { sessionId?: string }, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      
      const { queuingService, historyService } = context.dataSources as any;
      
      const result = await queuingService.skipMatch(context.auth.user.id, sessionId);
      
      // Log the skip action
      historyService.logUserAction({
        type: 'match_skipped',
        userId: context.auth.user.id,
        metadata: { sessionId },
      }).catch((err: any) => console.error('Failed to log match skip:', err));
      
      return result;
    },
  },
  
  QueueStatus: {
    user: async (queueStatus: any, _: any, context: GraphQLContext) => {
      return await context.dataSources.userLoader.load(queueStatus.userId);
    },
  },
};