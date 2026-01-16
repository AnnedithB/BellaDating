import { GraphQLError } from 'graphql';

export const userResolvers = {
  Query: {
    me: async (_: any, __: any, context: any) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      
      // Fetch fresh profile data from user service to get latest updates
      const { userService } = context.dataSources;
      const profile = await userService.getProfile();
      
      if (!profile) {
        // Fallback to context user if profile fetch fails
        return context.auth.user;
      }
      
      // Transform profile data to User format
      // The profile response includes both profile and user fields
      const photos = Array.isArray(profile.photos) ? profile.photos : 
                    (typeof profile.photos === 'string' ? JSON.parse(profile.photos || '[]') : []);
      
      const interests = (profile.preferences as any)?.interests || [];
      const location = profile.locationCity && profile.locationCountry
        ? `${profile.locationCity}, ${profile.locationCountry}`
        : profile.locationCity || profile.locationCountry || null;
      
      const userData = {
        id: context.auth.user.id,
        email: context.auth.user.email,
        name: profile.displayName || null,
        bio: profile.shortBio || null,
        age: profile.age || null,
        gender: profile.gender || null,
        interests: interests,
        location: location,
        profilePicture: photos.length > 0 ? photos[0] : null,
        photos: photos,
        isOnline: false, // Should be fetched from presence service
        isActive: context.auth.user.isActive ?? true,
        isVerified: false, // Should be fetched from user service
        isPhotoVerified: profile.isPhotoVerified !== undefined ? profile.isPhotoVerified : (context.auth.user.isPhotoVerified ?? false),
        createdAt: context.auth.user.createdAt || new Date().toISOString(),
        updatedAt: profile.updatedAt || context.auth.user.updatedAt || new Date().toISOString(),
      };
      
      console.log('[GraphQL me resolver] Returning user data:', {
        name: userData.name,
        bio: userData.bio,
        location: userData.location,
        interests: userData.interests,
        age: userData.age,
        photosCount: userData.photos.length,
      });
      
      return userData;
    },
    
    user: async (_: any, { id }: { id: string }, context: any) => {
      return await context.dataSources.userLoader.load(id);
    },
    
    users: async (_: any, { limit = 20, offset = 0 }: { limit?: number; offset?: number }, context: any) => {
      const { userService } = context.dataSources;
      return await userService.getUsers(limit, offset);
    },
    
    searchUsers: async (_: any, { query, limit = 20 }: { query: string; limit?: number }, context: any) => {
      const { userService } = context.dataSources;
      return await userService.searchUsers(query, limit);
    },

    myDiscoveryPreferences: async (_: any, __: any, context: any) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      
      try {
        const { userService } = context.dataSources;
        const profile = await userService.getProfile();
        
        if (!profile) {
          // Return default preferences if no profile exists
          return {
            id: `pref-${context.auth.user.id}`,
            userId: context.auth.user.id,
            ageMin: 18,
            ageMax: 65,
            maxDistance: 50,
            interestedIn: 'Everyone',
            connectionType: 'Dating',
            lookingFor: ['Dating'],
            interests: [],
            preferredEducationLevels: [],
            preferredFamilyPlans: [],
            preferredHasKids: [],
            preferredReligions: [],
            preferredPoliticalViews: [],
            preferredDrinkingHabits: [],
            preferredSmokingHabits: [],
            heightMin: 140,
            heightMax: 220,
            updatedAt: new Date().toISOString(),
          };
        }
        
        // Extract preferences from profile
        const preferences = profile.preferences || {};
        const profileIntent = profile.intent || 'Dating';
        
        // Map intent back to connectionType for frontend
        const intentToConnectionType: { [key: string]: string } = {
          'CASUAL': 'Dating',
          'FRIENDS': 'Friendship',
          'SERIOUS': 'Serious',
          'NETWORKING': 'Networking',
        };
        
        // Map profile data to DiscoveryPreferences format
        return {
          id: `pref-${context.auth.user.id}`,
          userId: context.auth.user.id,
          ageMin: preferences.ageMin || preferences.preferredMinAge || 18,
          ageMax: preferences.ageMax || preferences.preferredMaxAge || 65,
          maxDistance: preferences.maxDistance || preferences.maxRadius || 50,
          interestedIn: preferences.interestedIn || (profile.preferredGenders && profile.preferredGenders.length > 0 
            ? profile.preferredGenders.join(', ') 
            : 'Everyone'),
          connectionType: preferences.connectionType || intentToConnectionType[profileIntent] || 'Dating',
          lookingFor: preferences.lookingFor || (profile.preferredRelationshipIntents && profile.preferredRelationshipIntents.length > 0
            ? profile.preferredRelationshipIntents
            : ['Dating']),
          interests: preferences.interests || (profile.interests || []),
          preferredEducationLevels: preferences.preferredEducationLevels || profile.preferredEducationLevels || [],
          preferredFamilyPlans: preferences.preferredFamilyPlans || profile.preferredFamilyPlans || [],
          preferredHasKids: preferences.preferredHasKids || profile.preferredHasKids || [],
          preferredReligions: preferences.preferredReligions || profile.preferredReligions || [],
          preferredPoliticalViews: preferences.preferredPoliticalViews || profile.preferredPoliticalViews || [],
          preferredDrinkingHabits: preferences.preferredDrinkingHabits || profile.preferredDrinkingHabits || [],
          preferredSmokingHabits: preferences.preferredSmokingHabits || profile.preferredSmokingHabits || [],
          heightMin: preferences.heightMin || 140,
          heightMax: preferences.heightMax || 220,
          updatedAt: profile.updatedAt || new Date().toISOString(),
        };
      } catch (error: any) {
        console.error('Error fetching discovery preferences:', error);
        // Return defaults on error
        return {
          id: `pref-${context.auth.user.id}`,
          userId: context.auth.user.id,
          ageMin: 18,
          ageMax: 65,
          maxDistance: 50,
          interestedIn: 'Everyone',
          connectionType: 'Dating',
          lookingFor: ['Dating'],
          updatedAt: new Date().toISOString(),
        };
      }
    },

    myPrivacySettings: async (_: any, __: any, context: any) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }

      const { userService } = context.dataSources;
      const profile = await userService.getProfile();
      const preferences = profile?.preferences || {};
      const privacySettings = preferences.privacySettings || {};

      return {
        showOnlineStatus: privacySettings.showOnlineStatus !== false,
        sendReadReceipts: privacySettings.sendReadReceipts !== false
      };
    },

    myNotificationSettings: async (_: any, __: any, context: any) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }

      const { userService } = context.dataSources;
      const profile = await userService.getProfile();
      const preferences = profile?.preferences || {};
      const notificationSettings = preferences.notificationSettings || {};

      return {
        all: notificationSettings.all !== false,
        newMatches: notificationSettings.newMatches !== false,
        newMessages: notificationSettings.newMessages !== false,
        appPromotions: notificationSettings.appPromotions === true
      };
    },
  },
  
  Mutation: {
    register: async (_: any, { input }: { input: any }, context: any) => {
      try {
        const { userService } = context.dataSources;
        const result = await userService.register(input);
        
        if (!result || !result.user) {
          throw new GraphQLError('Registration failed: Invalid response from user service', {
            extensions: { code: 'INTERNAL_SERVER_ERROR' }
          });
        }
        
        // Ensure user has all required fields
        const user = {
          ...result.user,
          createdAt: result.user.createdAt || new Date().toISOString(),
          updatedAt: result.user.updatedAt || new Date().toISOString(),
          isActive: result.user.isActive ?? true,
          interests: result.user.interests ?? [],
          isOnline: result.user.isOnline ?? false,
          isVerified: result.user.isVerified ?? false,
          isPhotoVerified: result.user.isPhotoVerified ?? false,
        };
        
        if (!result.token) {
          throw new GraphQLError('Registration failed: No token received', {
            extensions: { code: 'INTERNAL_SERVER_ERROR' }
          });
        }
        
        return {
          token: result.token,
          user,
          expiresIn: '7d',
        };
      } catch (error: any) {
        console.error('Register resolver error:', error);
        if (error instanceof GraphQLError) {
          throw error;
        }
        throw new GraphQLError(error.message || 'Registration failed', {
          extensions: { code: 'INTERNAL_SERVER_ERROR', originalError: error.message }
        });
      }
    },

    login: async (_: any, { email, password }: { email: string; password: string }, context: any) => {
      try {
        const { userService } = context.dataSources;
        const result = await userService.login(email, password);
        
        if (!result || !result.user) {
          throw new GraphQLError('Login failed: Invalid response from user service', {
            extensions: { code: 'INTERNAL_SERVER_ERROR' }
          });
        }
        
        // Ensure user has all required fields
        const user = {
          ...result.user,
          createdAt: result.user.createdAt || new Date().toISOString(),
          updatedAt: result.user.updatedAt || new Date().toISOString(),
          isActive: result.user.isActive ?? true,
          interests: result.user.interests ?? [],
          isOnline: result.user.isOnline ?? false,
          isVerified: result.user.isVerified ?? false,
          isPhotoVerified: result.user.isPhotoVerified ?? false,
        };
        
        if (!result.token) {
          throw new GraphQLError('Login failed: No token received', {
            extensions: { code: 'INTERNAL_SERVER_ERROR' }
          });
        }
        
        return {
          token: result.token,
          user,
          expiresIn: '7d',
        };
      } catch (error: any) {
        console.error('Login resolver error:', error);
        if (error instanceof GraphQLError) {
          throw error;
        }
        throw new GraphQLError(error.message || 'Login failed', {
          extensions: { code: 'INTERNAL_SERVER_ERROR', originalError: error.message }
        });
      }
    },

    socialLogin: async (_: any, { input }: { input: any }, context: any) => {
      try {
        const { userService } = context.dataSources;
        
        // Verify the social token and get user info
        let userInfo: any = {};
        
        if (input.provider === 'google') {
          // Verify Google token by fetching user info
          if (!input.accessToken) {
            throw new GraphQLError('Google access token is required', {
              extensions: { code: 'BAD_REQUEST' }
            });
          }
          
          try {
            const userInfoResponse = await fetch(
              `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${input.accessToken}`
            );
            
            if (!userInfoResponse.ok) {
              throw new GraphQLError('Invalid Google token', {
                extensions: { code: 'UNAUTHENTICATED' }
              });
            }
            
            userInfo = await userInfoResponse.json();
          } catch (fetchError: any) {
            throw new GraphQLError('Failed to verify Google token', {
              extensions: { code: 'UNAUTHENTICATED', originalError: fetchError.message }
            });
          }
        } else if (input.provider === 'apple') {
          // For Apple, we'll use the email and name from the input
          // In production, you should verify the Apple ID token server-side
          userInfo = {
            email: input.email,
            name: input.name,
            id: input.appleUserId,
          };
        } else {
          throw new GraphQLError('Invalid provider. Must be "google" or "apple"', {
            extensions: { code: 'BAD_REQUEST' }
          });
        }

        // Find or create user
        const email = input.email || userInfo.email;
        if (!email) {
          throw new GraphQLError('Email is required for social login', {
            extensions: { code: 'BAD_REQUEST' }
          });
        }

        // Find or create user
        // For social login, we'll always try to register first
        // If user exists, registration will fail, and we'll need to handle that
        // In production, you should add a dedicated social login endpoint to user service
        const registerInput = {
          email: email.toLowerCase(),
          password: `social-${input.provider}-${Math.random().toString(36).slice(2)}`, // Random password for social users
          name: input.name || userInfo.name || email.split('@')[0],
        };
        
        let result;
        try {
          // Try to register (will fail if user exists)
          result = await userService.register(registerInput);
        } catch (registerError: any) {
          // User might already exist - check error message
          if (registerError.message?.includes('already exists') || registerError.message?.includes('email') || registerError.response?.status === 409) {
            // User exists - we need to generate a token for them
            // For now, we'll create a temporary solution: register will fail, so we need another approach
            // TODO: Add a social login endpoint to user service that handles existing users
            throw new GraphQLError('User already exists. Please use email/password login or implement social login endpoint in user service.', {
              extensions: { code: 'USER_EXISTS' }
            });
          }
          throw registerError;
        }

        if (!result || !result.user) {
          throw new GraphQLError('Social login failed: Invalid response from user service', {
            extensions: { code: 'INTERNAL_SERVER_ERROR' }
          });
        }

        // Ensure user has all required fields
        const user = {
          ...result.user,
          createdAt: result.user.createdAt || new Date().toISOString(),
          updatedAt: result.user.updatedAt || new Date().toISOString(),
          isActive: result.user.isActive ?? true,
          interests: result.user.interests ?? [],
          isOnline: result.user.isOnline ?? false,
          isVerified: result.user.isVerified ?? false,
          isPhotoVerified: result.user.isPhotoVerified ?? false,
        };

        if (!result.token) {
          throw new GraphQLError('Social login failed: No token received', {
            extensions: { code: 'INTERNAL_SERVER_ERROR' }
          });
        }

        return {
          token: result.token,
          user,
          expiresIn: '7d',
        };
      } catch (error: any) {
        console.error('Social login resolver error:', error);
        if (error instanceof GraphQLError) {
          throw error;
        }
        throw new GraphQLError(error.message || 'Social login failed', {
          extensions: { code: 'INTERNAL_SERVER_ERROR', originalError: error.message }
        });
      }
    },

    logout: async (_: any, __: any, context: any) => {
      // Logout is typically handled client-side by removing the token
      // Optionally call user-service logout endpoint if token is provided
      if (context.auth.token) {
        try {
          const { userService } = context.dataSources;
          await userService.logout();
        } catch (error) {
          // Don't fail logout if service call fails - client-side cleanup is sufficient
          console.error('Logout service call failed:', error);
        }
      }
      return true;
    },

    updateProfile: async (_: any, { input }: { input: any }, context: any) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      
      const { userService } = context.dataSources;
      return await userService.updateUser(context.auth.user.id, input);
    },
    
    updateProfileSettings: async (_: any, { input }: { input: any }, context: any) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      
      const { userService } = context.dataSources;
      return await userService.updateProfile(context.auth.user.id, input);
    },
    
    blockUser: async (_: any, { userId }: { userId: string }, context: any) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      
      const { userService } = context.dataSources;
      return await userService.blockUser(context.auth.user.id, userId);
    },
    
    reportUser: async (_: any, { input }: { input: any }, context: any) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      
      const { userService } = context.dataSources;
      const reportData = {
        ...input,
        reporterId: context.auth.user.id,
      };
      return await userService.reportUser(reportData);
    },

    verifyPhoto: async (_: any, { selfieImage }: { selfieImage: string }, context: any) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      
      const { userService } = context.dataSources;
      return await userService.verifyPhoto(selfieImage);
    },

    updateDiscoveryPreferences: async (_: any, { input }: { input: any }, context: any) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      
      try {
        const { userService } = context.dataSources;
        
        // Get current profile to merge preferences
        const profile = await userService.getProfile();
        const existingPreferences = profile?.preferences || {};
        
        // Map DiscoveryPreferencesInput to profile preferences format
        const preferencesUpdate: any = {
          ...existingPreferences,
        };
        
        if (input.ageMin !== undefined) {
          preferencesUpdate.ageMin = input.ageMin;
          preferencesUpdate.preferredMinAge = input.ageMin;
        }
        if (input.ageMax !== undefined) {
          preferencesUpdate.ageMax = input.ageMax;
          preferencesUpdate.preferredMaxAge = input.ageMax;
        }
        if (input.maxDistance !== undefined) {
          preferencesUpdate.maxDistance = input.maxDistance;
          preferencesUpdate.maxRadius = input.maxDistance;
        }
        if (input.interestedIn !== undefined) {
          preferencesUpdate.interestedIn = input.interestedIn;
          // Update preferredGenders based on interestedIn
          if (input.interestedIn === 'Everyone' || input.interestedIn === 'Any') {
            // Clear preferredGenders or set to all genders when "Everyone" is selected
            preferencesUpdate.preferredGenders = []; // Empty means no preference (all genders)
          } else {
            // Map specific gender selection
            const genderMap: { [key: string]: string[] } = {
              'Men': ['MAN'],
              'Women': ['WOMAN'],
              'Non-binary': ['NONBINARY'],
            };
            if (genderMap[input.interestedIn]) {
              preferencesUpdate.preferredGenders = genderMap[input.interestedIn];
            }
          }
        }
        if (input.connectionType !== undefined) {
          preferencesUpdate.connectionType = input.connectionType;
        }
        if (input.lookingFor !== undefined) {
          preferencesUpdate.lookingFor = input.lookingFor;
          // Also update preferredRelationshipIntents
          if (Array.isArray(input.lookingFor) && input.lookingFor.length > 0) {
            preferencesUpdate.preferredRelationshipIntents = input.lookingFor;
          }
        }
        if (input.interests !== undefined) {
          preferencesUpdate.interests = Array.isArray(input.interests) ? input.interests : [];
        }
        if (input.preferredEducationLevels !== undefined) {
          preferencesUpdate.preferredEducationLevels = Array.isArray(input.preferredEducationLevels) ? input.preferredEducationLevels : [];
        }
        if (input.preferredFamilyPlans !== undefined) {
          preferencesUpdate.preferredFamilyPlans = Array.isArray(input.preferredFamilyPlans) ? input.preferredFamilyPlans : [];
        }
        if (input.preferredHasKids !== undefined) {
          preferencesUpdate.preferredHasKids = Array.isArray(input.preferredHasKids) ? input.preferredHasKids : [];
        }
        if (input.preferredReligions !== undefined) {
          preferencesUpdate.preferredReligions = Array.isArray(input.preferredReligions) ? input.preferredReligions : [];
        }
        if (input.preferredPoliticalViews !== undefined) {
          preferencesUpdate.preferredPoliticalViews = Array.isArray(input.preferredPoliticalViews) ? input.preferredPoliticalViews : [];
        }
        if (input.preferredDrinkingHabits !== undefined) {
          preferencesUpdate.preferredDrinkingHabits = Array.isArray(input.preferredDrinkingHabits) ? input.preferredDrinkingHabits : [];
        }
        if (input.preferredSmokingHabits !== undefined) {
          preferencesUpdate.preferredSmokingHabits = Array.isArray(input.preferredSmokingHabits) ? input.preferredSmokingHabits : [];
        }
        if (input.heightMin !== undefined) {
          preferencesUpdate.heightMin = input.heightMin;
        }
        if (input.heightMax !== undefined) {
          preferencesUpdate.heightMax = input.heightMax;
        }
        
        // Map connectionType to intent for profile update
        const intentMap: { [key: string]: string } = {
          'Dating': 'CASUAL',
          'Friendship': 'FRIENDS',
          'Friends': 'FRIENDS', // Support both for backwards compatibility
          'Serious': 'SERIOUS',
          'Networking': 'NETWORKING',
        };
        const intent = input.connectionType && intentMap[input.connectionType] 
          ? intentMap[input.connectionType] 
          : profile?.intent;
        
        // Build profile update payload
        const profileUpdate: any = {
          preferences: preferencesUpdate,
        };
        
        // Log what we're sending
        console.log('[updateDiscoveryPreferences] Profile update payload:', JSON.stringify(profileUpdate, null, 2));
        console.log('[updateDiscoveryPreferences] Preferences update:', JSON.stringify(preferencesUpdate, null, 2));
        
        if (input.interests !== undefined) {
          profileUpdate.interests = Array.isArray(input.interests) ? input.interests : [];
        }
        
        // Add intent if it changed and is valid
        // Only update intent if connectionType was explicitly provided
        if (input.connectionType && intent && intent !== profile?.intent) {
          // Validate intent value before updating
          const validIntents = ['CASUAL', 'FRIENDS', 'SERIOUS', 'NETWORKING'];
          if (validIntents.includes(intent.toUpperCase())) {
            profileUpdate.intent = intent.toUpperCase();
          } else {
            console.warn(`Invalid intent value: ${intent}, skipping intent update`);
          }
        }

        try {
          await userService.updateProfile('', profileUpdate);
        } catch (updateError: any) {
          console.error('Profile update error:', updateError);
          // Re-throw with better error message
          const updateErrorMessage = updateError.response?.data?.message || 
                                    updateError.response?.data?.error?.message ||
                                    updateError.message || 
                                    'Failed to update profile';
          throw new Error(updateErrorMessage);
        }
        
        // Sync preferences to UserMatchingPreferences table for matching algorithm
        try {
          const { queuingService } = context.dataSources;
          const synced = await queuingService.syncMatchingPreferences(context.auth.user.id, preferencesUpdate);
          if (!synced) {
            // IMPORTANT: we must not claim preferences were saved if matching DB wasn't updated
            throw new Error('Failed to sync preferences to matching database (queuing-service)');
          }
        } catch (syncError: any) {
          console.error('Error syncing preferences to matching table:', syncError);
          // This should be visible to the client, otherwise users will get "preferences not found"
          throw syncError;
        }
        
        // Small delay to ensure database is fully updated
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Fetch updated profile to return
        const updatedProfile = await userService.getProfile();
        const updatedPrefs = updatedProfile?.preferences || preferencesUpdate;
        
        // Map intent back to connectionType for frontend
        const intentToConnectionType: { [key: string]: string } = {
          'CASUAL': 'Dating',
          'FRIENDS': 'Friendship',
          'SERIOUS': 'Serious',
          'NETWORKING': 'Networking',
        };
        
        // Use input values as primary source, fallback to updated profile
        // This ensures we return what was actually saved, not stale data
        const returnPrefs = {
          id: `pref-${context.auth.user.id}`,
          userId: context.auth.user.id,
          ageMin: input.ageMin !== undefined ? input.ageMin : (updatedPrefs.ageMin || 18),
          ageMax: input.ageMax !== undefined ? input.ageMax : (updatedPrefs.ageMax || 65),
          maxDistance: input.maxDistance !== undefined ? input.maxDistance : (updatedPrefs.maxDistance || 50),
          interestedIn: input.interestedIn !== undefined ? input.interestedIn : (updatedPrefs.interestedIn || 'Everyone'),
          connectionType: input.connectionType !== undefined ? input.connectionType : (updatedPrefs.connectionType || intentToConnectionType[updatedProfile?.intent || 'CASUAL'] || 'Dating'),
          lookingFor: input.lookingFor !== undefined ? input.lookingFor : (updatedPrefs.lookingFor || ['Dating']),
          interests: input.interests !== undefined ? input.interests : (updatedPrefs.interests || updatedProfile?.interests || []),
          preferredEducationLevels: input.preferredEducationLevels !== undefined ? input.preferredEducationLevels : (updatedPrefs.preferredEducationLevels || updatedProfile?.preferredEducationLevels || []),
          preferredFamilyPlans: input.preferredFamilyPlans !== undefined ? input.preferredFamilyPlans : (updatedPrefs.preferredFamilyPlans || updatedProfile?.preferredFamilyPlans || []),
          preferredHasKids: input.preferredHasKids !== undefined ? input.preferredHasKids : (updatedPrefs.preferredHasKids || updatedProfile?.preferredHasKids || []),
          preferredReligions: input.preferredReligions !== undefined ? input.preferredReligions : (updatedPrefs.preferredReligions || updatedProfile?.preferredReligions || []),
          preferredPoliticalViews: input.preferredPoliticalViews !== undefined ? input.preferredPoliticalViews : (updatedPrefs.preferredPoliticalViews || updatedProfile?.preferredPoliticalViews || []),
          preferredDrinkingHabits: input.preferredDrinkingHabits !== undefined ? input.preferredDrinkingHabits : (updatedPrefs.preferredDrinkingHabits || updatedProfile?.preferredDrinkingHabits || []),
          preferredSmokingHabits: input.preferredSmokingHabits !== undefined ? input.preferredSmokingHabits : (updatedPrefs.preferredSmokingHabits || updatedProfile?.preferredSmokingHabits || []),
          heightMin: input.heightMin !== undefined ? input.heightMin : (updatedPrefs.heightMin || 140),
          heightMax: input.heightMax !== undefined ? input.heightMax : (updatedPrefs.heightMax || 220),
          updatedAt: updatedProfile?.updatedAt || new Date().toISOString(),
        };
        
        console.log('[updateDiscoveryPreferences] Returning preferences:', JSON.stringify(returnPrefs, null, 2));
        
        return returnPrefs;
      } catch (error: any) {
        console.error('Error updating discovery preferences:', error);
        const errorMessage = error.response?.data?.message || 
                            error.response?.data?.error?.message ||
                            error.response?.data?.error || 
                            error.message || 
                            'Failed to update discovery preferences';
        throw new GraphQLError(errorMessage, {
          extensions: { code: 'INTERNAL_SERVER_ERROR', originalError: error.message }
        });
      }
    },

    updatePrivacySettings: async (_: any, { input }: { input: any }, context: any) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }

      const { userService } = context.dataSources;
      const profile = await userService.getProfile();
      const preferences = profile?.preferences || {};

      const updatedPreferences = {
        ...preferences,
        privacySettings: {
          ...(preferences.privacySettings || {}),
          showOnlineStatus: input.showOnlineStatus,
          sendReadReceipts: input.sendReadReceipts
        }
      };

      await userService.updateProfile('', { preferences: updatedPreferences });

      return {
        showOnlineStatus: input.showOnlineStatus,
        sendReadReceipts: input.sendReadReceipts
      };
    },

    updateNotificationSettings: async (_: any, { input }: { input: any }, context: any) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }

      const { userService } = context.dataSources;
      const profile = await userService.getProfile();
      const preferences = profile?.preferences || {};

      const updatedPreferences = {
        ...preferences,
        notificationSettings: {
          ...(preferences.notificationSettings || {}),
          all: input.all,
          newMatches: input.newMatches,
          newMessages: input.newMessages,
          appPromotions: input.appPromotions
        }
      };

      await userService.updateProfile('', { preferences: updatedPreferences });

      return {
        all: input.all,
        newMatches: input.newMatches,
        newMessages: input.newMessages,
        appPromotions: input.appPromotions
      };
    },
  },
  
  User: {
    // Provide default values for required fields
    isActive: (user: any) => user.isActive ?? true,
    interests: (user: any) => user.interests ?? [],
    isOnline: (user: any) => user.isOnline ?? false,
    isVerified: (user: any) => user.isVerified ?? false,
    isPhotoVerified: (user: any) => user.isPhotoVerified ?? user.isVerified ?? false,
    createdAt: (user: any) => user.createdAt ?? new Date().toISOString(),
    updatedAt: (user: any) => user.updatedAt ?? new Date().toISOString(),
    photos: async (user: any, _: any, context: any) => {
      // If photos are already on the user object, return them
      if (user.photos && Array.isArray(user.photos)) {
        return user.photos;
      }
      // Otherwise, try to get from profile
      try {
        // Try to get profile from userService
        if (context.dataSources.userService) {
          const profile = await context.dataSources.userService.getProfile();
          return profile?.photos || [];
        }
        // Fallback: try profileLoader
        if (context.dataSources.profileLoader) {
          const profile = await context.dataSources.profileLoader.load(user.id);
          return profile?.photos || [];
        }
      } catch (error) {
        console.error('Error fetching photos for user:', error);
      }
      return [];
    },
    sessions: async () => [], // Default empty array
    messages: async () => [], // Default empty array
    notifications: async () => [], // Default empty array
    connections: async () => [], // Default empty array
    
    profile: async (user: any, _: any, context: any) => {
      // Fetch fresh profile data
      const { userService } = context.dataSources;
      const profile = await userService.getProfile();
      
      if (!profile) {
        return null;
      }
      
      // Transform to UserProfile format
      const photos = Array.isArray(profile.photos) ? profile.photos : 
                    (typeof profile.photos === 'string' ? JSON.parse(profile.photos || '[]') : []);
      
      return {
        id: profile.id || user.id,
        userId: user.id,
        displayName: profile.displayName || null,
        bio: profile.shortBio || null,
        location: profile.locationCity && profile.locationCountry
          ? `${profile.locationCity}, ${profile.locationCountry}`
          : profile.locationCity || profile.locationCountry || null,
        interests: (profile.preferences as any)?.interests || [],
        profilePicture: photos.length > 0 ? photos[0] : null,
        isPublic: true, // Default
        showAge: true, // Default
        showLocation: true, // Default
        createdAt: profile.createdAt || new Date().toISOString(),
        updatedAt: profile.updatedAt || new Date().toISOString(),
      };
    },
    
    // Profile fields resolvers - fetch from profile if not already on user object
    educationLevel: async (user: any, _: any, context: any) => {
      // If already on user object (from discoverProfiles or other sources), return it
      if (user.educationLevel !== undefined) {
        return user.educationLevel;
      }
      // Otherwise, fetch from user's profile
      try {
        const { userService } = context.dataSources;
        // Fetch profile for the user being resolved, not the current user
        const userData = await userService.getUser(user.id);
        return userData?.educationLevel || null;
      } catch (error) {
        return null;
      }
    },
    
    religion: async (user: any, _: any, context: any) => {
      // If already on user object (from discoverProfiles or other sources), return it
      if (user.religion !== undefined) {
        return user.religion;
      }
      // Otherwise, fetch from user's profile
      try {
        const { userService } = context.dataSources;
        // Fetch profile for the user being resolved, not the current user
        const userData = await userService.getUser(user.id);
        return userData?.religion || null;
      } catch (error) {
        return null;
      }
    },
    
    familyPlans: async (user: any, _: any, context: any) => {
      // If already on user object (from discoverProfiles or other sources), return it
      if (user.familyPlans !== undefined) {
        return user.familyPlans;
      }
      // Otherwise, fetch from user's profile
      try {
        const { userService } = context.dataSources;
        // Fetch profile for the user being resolved, not the current user
        const userData = await userService.getUser(user.id);
        return userData?.familyPlans || null;
      } catch (error) {
        return null;
      }
    },
    
    hasKids: async (user: any, _: any, context: any) => {
      if (user.hasKids !== undefined) {
        return user.hasKids;
      }
      try {
        const { userService } = context.dataSources;
        const userData = await userService.getUser(user.id);
        return userData?.hasKids || null;
      } catch (error) {
        return null;
      }
    },
    
    languages: async (user: any, _: any, context: any) => {
      if (user.languages !== undefined) {
        return Array.isArray(user.languages) ? user.languages : [];
      }
      try {
        const { userService } = context.dataSources;
        const userData = await userService.getUser(user.id);
        return Array.isArray(userData?.languages) ? userData.languages : [];
      } catch (error) {
        return [];
      }
    },
    
    ethnicity: async (user: any, _: any, context: any) => {
      if (user.ethnicity !== undefined) {
        return user.ethnicity;
      }
      try {
        const { userService } = context.dataSources;
        const userData = await userService.getUser(user.id);
        return userData?.ethnicity || null;
      } catch (error) {
        return null;
      }
    },
    
    politicalViews: async (user: any, _: any, context: any) => {
      if (user.politicalViews !== undefined) {
        return user.politicalViews;
      }
      try {
        const { userService } = context.dataSources;
        const userData = await userService.getUser(user.id);
        return userData?.politicalViews || null;
      } catch (error) {
        return null;
      }
    },
    
    exercise: async (user: any, _: any, context: any) => {
      if (user.exercise !== undefined) {
        return user.exercise;
      }
      try {
        const { userService } = context.dataSources;
        const userData = await userService.getUser(user.id);
        return userData?.exercise || null;
      } catch (error) {
        return null;
      }
    },
    
    smoking: async (user: any, _: any, context: any) => {
      if (user.smoking !== undefined) {
        return user.smoking;
      }
      try {
        const { userService } = context.dataSources;
        const userData = await userService.getUser(user.id);
        return userData?.smoking || null;
      } catch (error) {
        return null;
      }
    },
    
    drinking: async (user: any, _: any, context: any) => {
      if (user.drinking !== undefined) {
        return user.drinking;
      }
      try {
        const { userService } = context.dataSources;
        const userData = await userService.getUser(user.id);
        return userData?.drinking || null;
      } catch (error) {
        return null;
      }
    },
    
  },
  
  UserProfile: {
    user: async (profile: any, _: any, context: any) => {
      return await context.dataSources.userLoader.load(profile.userId);
    },
  },
};