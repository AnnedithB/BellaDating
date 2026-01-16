import { GraphQLContext } from '../types';
import { GraphQLError } from 'graphql';

export const matchResolvers = {
  Query: {
    myPendingMatches: async (_: any, __: any, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }

      const { queuingService } = context.dataSources as any;
      const matches = await queuingService.getPendingMatches(context.auth.user.id);

      // Transform matches to GraphQL format
      return matches.map((match: any) => ({
        id: match.id,
        user1Id: match.user1Id,
        user2Id: match.user2Id,
        status: match.status,
        totalScore: match.totalScore,
        ageScore: match.ageScore,
        locationScore: match.locationScore,
        interestScore: match.interestScore,
        languageScore: match.languageScore,
        ethnicityScore: match.ethnicityScore,
        genderCompatScore: match.genderCompatScore,
        relationshipIntentScore: match.relationshipIntentScore,
        familyPlansScore: match.familyPlansScore,
        religionScore: match.religionScore,
        educationScore: match.educationScore,
        politicalScore: match.politicalScore,
        lifestyleScore: match.lifestyleScore,
        premiumBonus: match.premiumBonus,
        acceptedAt: match.acceptedAt,
        rejectedAt: match.rejectedAt,
        createdAt: match.createdAt,
        updatedAt: match.updatedAt,
      }));
    },

    myMatchHistory: async (_: any, { limit = 20, offset = 0 }: { limit?: number; offset?: number }, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }

      const { queuingService } = context.dataSources as any;
      const matches = await queuingService.getMatchHistory(context.auth.user.id, limit, offset);

      // Transform matches to GraphQL format
      return matches.map((match: any) => ({
        id: match.id,
        user1Id: match.user1Id,
        user2Id: match.user2Id,
        status: match.status,
        totalScore: match.totalScore,
        ageScore: match.ageScore,
        locationScore: match.locationScore,
        interestScore: match.interestScore,
        languageScore: match.languageScore,
        ethnicityScore: match.ethnicityScore,
        genderCompatScore: match.genderCompatScore,
        relationshipIntentScore: match.relationshipIntentScore,
        familyPlansScore: match.familyPlansScore,
        religionScore: match.religionScore,
        educationScore: match.educationScore,
        politicalScore: match.politicalScore,
        lifestyleScore: match.lifestyleScore,
        premiumBonus: match.premiumBonus,
        acceptedAt: match.acceptedAt,
        rejectedAt: match.rejectedAt,
        createdAt: match.createdAt,
        updatedAt: match.updatedAt,
      }));
    },
  },

  Mutation: {
    acceptMatch: async (_: any, { matchId }: { matchId: string }, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }

      const { queuingService, interactionService, communicationService, notificationService } = context.dataSources as any;

      // Accept the match
      const match = await queuingService.acceptMatch(matchId, context.auth.user.id);

      if (!match) {
        throw new GraphQLError('Match not found', { extensions: { code: 'NOT_FOUND' } });
      }

      // Mark match notifications as acted upon
      try {
        await notificationService.markMatchActionTaken(matchId, context.auth.user.id);
      } catch (error) {
        console.error('Error marking notification as acted upon:', error);
        // Don't fail the match acceptance if notification update fails
      }

      // Determine partner ID
      const partnerId = match.user1Id === context.auth.user.id ? match.user2Id : match.user1Id;

      // Create chat room - always try to get/create one
      let chatRoomId: string | null = null;
      try {
        chatRoomId = await communicationService.createOrGetRoom(context.auth.user.id, partnerId);
        console.log('[acceptMatch] Chat room created/found:', chatRoomId);
      } catch (error: any) {
        console.error('[acceptMatch] Error creating chat room:', {
          error: error.message,
          response: error.response?.data,
          status: error.response?.status
        });
        // Don't use fallback - log the error but don't fail the match acceptance
        // The room will be created when the user sends the first message
        // This way we don't create invalid roomIds
        console.warn('[acceptMatch] Chat room creation failed, will be created on first message');
      }

      // Create interaction session (supports video/voice calls)
      let session: any = null;
      try {
        // Use 'VOICE' type for matches (can be upgraded to VIDEO later)
        // Pass chatRoomId to link interaction session with chat room
        // Interaction service now handles existing rooms by returning them
        session = await interactionService.startSession(context.auth.user.id, partnerId, 'VOICE', chatRoomId);
        console.log('[acceptMatch] Session created/retrieved successfully:', session?.id);
      } catch (error: any) {
        console.error('[acceptMatch] Error creating interaction session:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status
        });
        // Don't fail the match acceptance if session creation fails
        // The match is still accepted, just no session is created
      }

      // Transform match to GraphQL format
      return {
        id: match.id,
        user1Id: match.user1Id,
        user2Id: match.user2Id,
        status: match.status,
        totalScore: match.totalScore,
        ageScore: match.ageScore,
        locationScore: match.locationScore,
        interestScore: match.interestScore,
        languageScore: match.languageScore,
        ethnicityScore: match.ethnicityScore,
        genderCompatScore: match.genderCompatScore,
        relationshipIntentScore: match.relationshipIntentScore,
        familyPlansScore: match.familyPlansScore,
        religionScore: match.religionScore,
        educationScore: match.educationScore,
        politicalScore: match.politicalScore,
        lifestyleScore: match.lifestyleScore,
        premiumBonus: match.premiumBonus,
        acceptedAt: match.acceptedAt,
        rejectedAt: match.rejectedAt,
        createdAt: match.createdAt,
        updatedAt: match.updatedAt,
        session: session,
        chatRoomId: chatRoomId,
      };
    },

    declineMatch: async (_: any, { matchId }: { matchId: string }, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }

      const { queuingService, notificationService } = context.dataSources as any;

      // Decline the match
      const match = await queuingService.declineMatch(matchId, context.auth.user.id);

      if (!match) {
        throw new GraphQLError('Match not found', { extensions: { code: 'NOT_FOUND' } });
      }

      // Mark match notifications as acted upon
      try {
        await notificationService.markMatchActionTaken(matchId, context.auth.user.id);
      } catch (error) {
        console.error('Error marking notification as acted upon:', error);
        // Don't fail the match decline if notification update fails
      }

      // Transform match to GraphQL format
      return {
        id: match.id,
        user1Id: match.user1Id,
        user2Id: match.user2Id,
        status: match.status,
        totalScore: match.totalScore,
        ageScore: match.ageScore,
        locationScore: match.locationScore,
        interestScore: match.interestScore,
        languageScore: match.languageScore,
        ethnicityScore: match.ethnicityScore,
        genderCompatScore: match.genderCompatScore,
        relationshipIntentScore: match.relationshipIntentScore,
        familyPlansScore: match.familyPlansScore,
        religionScore: match.religionScore,
        educationScore: match.educationScore,
        politicalScore: match.politicalScore,
        lifestyleScore: match.lifestyleScore,
        premiumBonus: match.premiumBonus,
        acceptedAt: match.acceptedAt,
        rejectedAt: match.rejectedAt,
        createdAt: match.createdAt,
        updatedAt: match.updatedAt,
      };
    },

    createMatchFromSuggestion: async (_: any, { userId: suggestedUserId }: { userId: string }, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }

      const { queuingService, interactionService, communicationService, notificationService } = context.dataSources as any;

      // Create the match immediately
      const match = await queuingService.createMatchFromSuggestion(context.auth.user.id, suggestedUserId);

      if (!match) {
        throw new GraphQLError('Failed to create match', { extensions: { code: 'INTERNAL_SERVER_ERROR' } });
      }

      // Create notification for the matched user
      try {
        await notificationService.createNotification({
          userId: suggestedUserId,
          title: 'New Match!',
          message: `${context.auth.user.name || 'Someone'} matched with you!`,
          type: 'NEW_MATCH',
          data: {
            matchId: match.id,
            matchedUserId: context.auth.user.id
          }
        });
      } catch (error) {
        console.error('Error creating match notification:', error);
        // Don't fail the match creation if notification fails
      }

      // Create chat room
      let chatRoomId: string | null = null;
      try {
        chatRoomId = await communicationService.createOrGetRoom(context.auth.user.id, suggestedUserId);
      } catch (error) {
        console.error('Error creating chat room:', error);
      }

      // Create interaction session
      let session: any = null;
      try {
        session = await interactionService.startSession(context.auth.user.id, suggestedUserId, 'VOICE', chatRoomId);
      } catch (error) {
        console.error('Error creating interaction session:', error);
      }

      // Transform match to GraphQL format
      return {
        id: match.id,
        user1Id: match.user1Id,
        user2Id: match.user2Id,
        status: match.status,
        totalScore: match.totalScore,
        ageScore: match.ageScore,
        locationScore: match.locationScore,
        interestScore: match.interestScore,
        languageScore: match.languageScore,
        ethnicityScore: match.ethnicityScore,
        genderCompatScore: match.genderCompatScore,
        relationshipIntentScore: match.relationshipIntentScore,
        familyPlansScore: match.familyPlansScore,
        religionScore: match.religionScore,
        educationScore: match.educationScore,
        politicalScore: match.politicalScore,
        lifestyleScore: match.lifestyleScore,
        premiumBonus: match.premiumBonus,
        acceptedAt: match.acceptedAt,
        rejectedAt: match.rejectedAt,
        createdAt: match.createdAt,
        updatedAt: match.updatedAt,
        session: session,
        chatRoomId: chatRoomId,
      };
    },
  },

  MatchAttempt: {
    user1: async (match: any, _: any, context: GraphQLContext) => {
      try {
        const user = await context.dataSources.userLoader.load(match.user1Id);
        if (!user) {
          console.error(`User1 not found for match ${match.id}: ${match.user1Id}`);
          // Return a minimal user object to avoid null error
          return {
            id: match.user1Id,
            name: 'Unknown User',
            email: '',
            profilePicture: null,
            isOnline: false,
            bio: null,
            age: null,
            gender: null,
            interests: [],
            location: null,
            isActive: false,
            isVerified: false,
            isPhotoVerified: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }
        return user;
      } catch (error) {
        console.error(`Error loading user1 for match ${match.id}:`, error);
        // Return a minimal user object to avoid null error
        return {
          id: match.user1Id,
          name: 'Unknown User',
          email: '',
          profilePicture: null,
          isOnline: false,
          bio: null,
          age: null,
          gender: null,
          interests: [],
          location: null,
          isActive: false,
          isVerified: false,
          isPhotoVerified: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
    },

    user2: async (match: any, _: any, context: GraphQLContext) => {
      try {
        const user = await context.dataSources.userLoader.load(match.user2Id);
        if (!user) {
          console.error(`User2 not found for match ${match.id}: ${match.user2Id}`);
          // Return a minimal user object to avoid null error
          return {
            id: match.user2Id,
            name: 'Unknown User',
            email: '',
            profilePicture: null,
            isOnline: false,
            bio: null,
            age: null,
            gender: null,
            interests: [],
            location: null,
            isActive: false,
            isVerified: false,
            isPhotoVerified: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }
        return user;
      } catch (error) {
        console.error(`Error loading user2 for match ${match.id}:`, error);
        // Return a minimal user object to avoid null error
        return {
          id: match.user2Id,
          name: 'Unknown User',
          email: '',
          profilePicture: null,
          isOnline: false,
          bio: null,
          age: null,
          gender: null,
          interests: [],
          location: null,
          isActive: false,
          isVerified: false,
          isPhotoVerified: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
    },

    session: async (match: any, _: any, context: GraphQLContext) => {
      // If match is accepted, try to find the session
      if (match.status === 'ACCEPTED') {
        const { interactionService } = context.dataSources as any;
        try {
          const sessions = await interactionService.getUserSessions(match.user1Id, 100, 0);
          // Find session with the other user
          const session = sessions.find((s: any) =>
            (s.user1Id === match.user1Id && s.user2Id === match.user2Id) ||
            (s.user1Id === match.user2Id && s.user2Id === match.user1Id)
          );
          return session || null;
        } catch (error) {
          console.error('Error fetching session for match:', error);
          return null;
        }
      }
      return null;
    },
  },
};

