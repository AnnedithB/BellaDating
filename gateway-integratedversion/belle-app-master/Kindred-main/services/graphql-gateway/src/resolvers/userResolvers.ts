import { GraphQLContext } from '../types';
import { GraphQLError } from 'graphql';

export const userResolvers = {
  Query: {
    me: async (_: any, __: any, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }

      // Fetch full user profile from user-service instead of just returning JWT payload
      // The JWT only contains basic info (id, email, username, role)
      // We need the full profile data (bio, profilePicture, interests, etc.)
      try {
        const { userService } = context.dataSources as any;
        const profileData = await userService.getUserProfile(context.auth.user.id);

        console.log('[me query] profileData:', JSON.stringify(profileData, null, 2));

        // Merge JWT user info with profile data
        // Profile data has the actual saved values (displayName, bio, photos, etc.)
        const result = {
          ...context.auth.user,
          // Map profile fields to User type fields
          name: profileData?.displayName || context.auth.user.name || context.auth.user.username,
          bio: profileData?.bio || null,
          profilePicture: profileData?.profilePicture || null,
          photos: profileData?.photos || [], // Include all photos
          interests: profileData?.interests || [],
          location: profileData?.location || null,
          // Keep other fields from auth user
          isOnline: true,
          isActive: true,
        };
        console.log('[me query] Returning:', JSON.stringify(result, null, 2));
        return result;
      } catch (error) {
        console.error('Error fetching user profile in me query:', error);
        // Fallback to just auth user if profile fetch fails
        return context.auth.user;
      }
    },
    
    user: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      return await context.dataSources.userLoader.load(id);
    },
    
    users: async (_: any, { limit = 20, offset = 0 }: { limit?: number; offset?: number }, context: GraphQLContext) => {
      const { userService } = context.dataSources as any;
      return await userService.getUsers(limit, offset);
    },
    
    searchUsers: async (_: any, { query, limit = 20 }: { query: string; limit?: number }, context: GraphQLContext) => {
      const { userService } = context.dataSources as any;
      return await userService.searchUsers(query, limit);
    },

    // Connection queries
    myConnections: async (_: any, __: any, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      try {
        const { userService } = context.dataSources as any;
        const connections = await userService.getConnections(context.auth.user.id);
        return connections || [];
      } catch (error) {
        console.error('Error fetching connections:', error);
        return [];
      }
    },

    connectionSuggestions: async (_: any, { limit = 10 }: { limit?: number }, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      // Return empty array for now - suggestions would come from a recommendation engine
      return [];
    },

    // Safety queries - return empty arrays for now
    myReports: async (_: any, __: any, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      return [];
    },

    reportsAgainstMe: async (_: any, __: any, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      return [];
    },
  },
  
  Mutation: {
    updateProfile: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }

      const { userService } = context.dataSources as any;
      // Use updateProfile which calls PUT /profile (correct endpoint)
      // instead of updateUser which calls PUT /users/:id (doesn't exist)
      const result = await userService.updateProfile(context.auth.user.id, input);
      // Return the profile data merged with user info
      return {
        ...context.auth.user,
        ...result?.data?.profile,
        ...input,
        id: context.auth.user.id, // Ensure id is preserved
      };
    },
    
    updateProfileSettings: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      
      const { userService } = context.dataSources as any;
      return await userService.updateProfile(context.auth.user.id, input);
    },
    
    blockUser: async (_: any, { userId }: { userId: string }, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      
      const { userService } = context.dataSources as any;
      return await userService.blockUser(context.auth.user.id, userId);
    },
    
    reportUser: async (_: any, { input }: { input: any }, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      
      const { userService } = context.dataSources as any;
      const reportData = {
        ...input,
        reporterId: context.auth.user.id,
      };
      return await userService.reportUser(reportData);
    },
  },
  
  User: {
    profile: async (user: any, _: any, context: GraphQLContext) => {
      return await context.dataSources.profileLoader.load(user.id);
    },
    
    sessions: async (user: any, _: any, context: GraphQLContext) => {
      const { interactionService } = context.dataSources as any;
      return await interactionService.getUserSessions(user.id);
    },
    
    messages: async (user: any, _: any, context: GraphQLContext) => {
      const { communicationService } = context.dataSources as any;
      return await communicationService.getMessageHistory(user.id);
    },
    
    notifications: async (user: any, _: any, context: GraphQLContext) => {
      return await context.dataSources.notificationLoader.load(user.id);
    },
    
    connections: async (user: any, _: any, context: GraphQLContext) => {
      const { userService } = context.dataSources as any;
      return await userService.getConnections(user.id);
    },
  },
  
  UserProfile: {
    user: async (profile: any, _: any, context: GraphQLContext) => {
      return await context.dataSources.userLoader.load(profile.userId);
    },
  },
};