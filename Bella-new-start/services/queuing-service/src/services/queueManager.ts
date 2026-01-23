import { PrismaClient, DatingGender } from '@prisma/client';
import Redis from 'ioredis';
import axios from 'axios';
import { AdvancedMatchingAlgorithm } from '../algorithms/advancedMatching';
import { createLogger } from '../utils/logger';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const logger = createLogger('queue-manager');

export interface QueueUserData {
  userId: string;
  intent: 'CASUAL' | 'FRIENDS' | 'SERIOUS' | 'NETWORKING';
  gender: DatingGender;
  age?: number;
  latitude?: number;
  longitude?: number;
  interests: string[];
  languages: string[];
  ethnicity?: string;
  mergedPreferences?: any; // Merged preferences (base + filter) for matching algorithm
}

export class QueueManager {
  private static matchingInterval: NodeJS.Timeout | null = null;
  private static readonly QUEUE_KEY = 'matching_queue';
  private static readonly ACTIVE_CALLS_KEY = 'active_calls'; // Redis key for tracking users in active calls
  private static readonly MATCH_BATCH_SIZE = parseInt(process.env.MATCH_BATCH_SIZE || '50');
  private static readonly MATCHING_INTERVAL = parseInt(process.env.MATCHING_INTERVAL_SECONDS || '5') * 1000;

  /**
   * Start the matching process
   */
  static startMatching() {
    if (this.matchingInterval) return;

    logger.info('Starting queue matching process');
    this.matchingInterval = setInterval(async () => {
      try {
        await this.processMatching();
      } catch (error) {
        logger.error('Error in matching process:', error as Error);
      }
    }, this.MATCHING_INTERVAL);
  }

  /**
   * Stop the matching process
   */
  static stopMatching() {
    if (this.matchingInterval) {
      clearInterval(this.matchingInterval);
      this.matchingInterval = null;
      logger.info('Stopped queue matching process');
    }
  }

  /**
   * Add user to queue
   */
  static async addUserToQueue(userData: QueueUserData): Promise<{ success: boolean; message?: string; error?: any }> {
    try {
      // Check if user is already in queue - if so, remove old entry and re-add with new data
      const existingEntry = await prisma.queueEntry.findFirst({
        where: {
          userId: userData.userId,
          status: 'WAITING'
        }
      });

      if (existingEntry) {
        logger.info(`User ${userData.userId} already in queue, removing old entry and re-adding`);
        // Remove from database
        await prisma.queueEntry.delete({
          where: { id: existingEntry.id }
        });
        // Remove from Redis
        await redis.zrem(this.QUEUE_KEY, userData.userId);
      }

      // Validate gender enum
      if (!userData.gender || !['MAN', 'WOMAN', 'NONBINARY'].includes(userData.gender)) {
        logger.error(`Invalid gender value: ${userData.gender}`);
        return { success: false, message: `Invalid gender value: ${userData.gender}. Must be MAN, WOMAN, or NONBINARY` };
      }

      // Validate intent enum
      const validIntents = ['CASUAL', 'FRIENDS', 'SERIOUS', 'NETWORKING'];
      if (!userData.intent || !validIntents.includes(userData.intent)) {
        logger.error(`Invalid intent value: ${userData.intent}`);
        return { 
          success: false, 
          message: `Invalid intent value: ${userData.intent}. Must be one of: ${validIntents.join(', ')}` 
        };
      }

      // Log the data being sent to Prisma
      logger.info('Creating queue entry', {
        userId: userData.userId,
        intent: userData.intent,
        gender: userData.gender,
        hasAge: userData.age !== null && userData.age !== undefined,
        hasLocation: userData.latitude !== null && userData.longitude !== null,
      });

      // Create queue entry
      const queueEntry = await prisma.queueEntry.create({
        data: {
          userId: userData.userId,
          intent: userData.intent as any, // Cast to Intent enum
          gender: userData.gender as DatingGender,
          age: userData.age,
          latitude: userData.latitude,
          longitude: userData.longitude,
          interests: userData.interests || [],
          languages: userData.languages || [],
          ethnicity: userData.ethnicity,
          status: 'WAITING',
          priority: 0,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
        }
      });

      // Add to Redis queue for faster processing
      await redis.zadd(this.QUEUE_KEY, Date.now(), userData.userId);

      // Clean up stale active call status - if user is joining queue, they're not in an active call
      const wasInCall = await this.isUserInActiveCall(userData.userId);
      if (wasInCall) {
        logger.info(`Cleaning up stale active call status for user ${userData.userId} (rejoining queue)`);
        await this.removeUserFromActiveCall(userData.userId);
      }

      // Sync preferences to UserMatchingPreferences if provided
      if ((userData as any).mergedPreferences) {
        try {
          await QueueManager.syncUserMatchingPreferences(userData.userId, (userData as any).mergedPreferences);
        } catch (prefError: any) {
          logger.warn(`Failed to sync preferences for user ${userData.userId}:`, prefError);
          // Don't fail queue join if preference sync fails
        }
      }

      logger.info(`User ${userData.userId} added to queue`, { queueEntryId: queueEntry.id });
      
      // Try to find a match immediately (don't wait for interval)
      // This is non-blocking - we don't await it so the response returns quickly
      this.tryImmediateMatch(userData.userId).catch((error) => {
        logger.error(`Error in immediate match attempt for user ${userData.userId}:`, error);
        // Don't fail queue join if immediate matching fails
      });
      
      return { success: true };
    } catch (error: any) {
      logger.error(`Error adding user ${userData.userId} to queue:`, {
        error: error,
        message: error.message,
        code: error.code,
        meta: error.meta,
        stack: error.stack,
        userData: {
          userId: userData.userId,
          intent: userData.intent,
          gender: userData.gender,
          hasAge: userData.age !== null && userData.age !== undefined,
        }
      });
      
      const errorMessage = error.message || 'Unknown error occurred';
      const errorCode = error.code || 'UNKNOWN_ERROR';
      
      // Provide more specific error messages for common Prisma errors
      let userFriendlyMessage = `Database error: ${errorMessage}`;
      if (error.code === 'P2002') {
        userFriendlyMessage = 'User is already in queue';
      } else if (error.code === 'P2003') {
        userFriendlyMessage = 'Invalid reference in database';
      } else if (error.message?.includes('Invalid value for enum')) {
        userFriendlyMessage = `Invalid enum value: ${error.message}`;
      }
      
      return { 
        success: false, 
        message: userFriendlyMessage,
        error: { 
          code: errorCode, 
          message: errorMessage,
          meta: error.meta,
          details: error.toString()
        }
      };
    }
  }

  /**
   * Remove user from queue
   */
  static async removeUserFromQueue(userId: string): Promise<boolean> {
    try {
      // Update database
      await prisma.queueEntry.updateMany({
        where: {
          userId,
          status: 'WAITING'
        },
        data: {
          status: 'REMOVED'
        }
      });

      // Remove from Redis queue
      await redis.zrem(this.QUEUE_KEY, userId);

      logger.info(`User ${userId} removed from queue`);
      return true;
    } catch (error) {
      logger.error(`Error removing user ${userId} from queue:`, error as Error);
      return false;
    }
  }

  /**
   * Get queue status for user
   */
  static async getQueueStatus(userId: string) {
    try {
      const queueEntry = await prisma.queueEntry.findFirst({
        where: {
          userId,
          status: 'WAITING'
        }
      });

      if (!queueEntry) {
        // Return status with userId even when not in queue (required by GraphQL schema)
        return { 
          userId,
          inQueue: false,
          status: 'NOT_IN_QUEUE',
          position: null,
          totalInQueue: 0,
          enteredAt: null,
          attempts: 0,
          intent: null
        };
      }

      // Get position in queue
      const position = await redis.zrank(this.QUEUE_KEY, userId);
      const totalInQueue = await redis.zcard(this.QUEUE_KEY);

      return {
        userId,
        inQueue: true,
        status: 'WAITING',
        position: position !== null ? position + 1 : null,
        totalInQueue,
        enteredAt: queueEntry.enteredAt,
        attempts: queueEntry.attempts,
        intent: queueEntry.intent
      };
    } catch (error) {
      logger.error(`Error getting queue status for ${userId}:`, error as Error);
      // Return status with userId even on error (required by GraphQL schema)
      return { 
        userId,
        inQueue: false, 
        status: 'ERROR',
        position: null,
        totalInQueue: 0,
        enteredAt: null,
        attempts: 0,
        intent: null,
        error: 'Unable to check queue status' 
      };
    }
  }

  /**
   * Sync user preferences to UserMatchingPreferences table
   */
  static async syncUserMatchingPreferences(userId: string, preferences: any) {
    try {
      // Normalize gender preference coming from various frontends ("Men"/"Women"/"Everyone"/etc)
      const normalizePreferredGenders = (genderPref: any): string[] => {
        if (!genderPref) return [];
        const raw = String(genderPref).trim();
        if (!raw) return [];
        const lower = raw.toLowerCase();
        if (lower === 'everyone' || lower === 'any' || lower === 'all') return [];
        if (lower === 'men' || lower === 'man' || lower === 'male') return ['MAN'];
        if (lower === 'women' || lower === 'woman' || lower === 'female') return ['WOMAN'];
        if (lower === 'nonbinary' || lower === 'non-binary' || lower === 'nb') return ['NONBINARY'];
        // If already enum-like (MAN/WOMAN/NONBINARY), keep it
        const upper = raw.toUpperCase();
        if (upper === 'MAN' || upper === 'WOMAN' || upper === 'NONBINARY') return [upper];
        return [];
      };

      const normalizeGenderArray = (genders: any): string[] => {
        if (!Array.isArray(genders)) return [];
        return genders
          .map((g) => String(g || '').trim().toUpperCase())
          .filter((g) => g === 'MAN' || g === 'WOMAN' || g === 'NONBINARY');
      };

      const ageMin =
        preferences?.ageRange?.min ??
        preferences?.preferredMinAge ??
        preferences?.minAge ??
        preferences?.ageMin ??
        18;

      const ageMax =
        preferences?.ageRange?.max ??
        preferences?.preferredMaxAge ??
        preferences?.maxAge ??
        preferences?.ageMax ??
        65;

      const preferredGendersFromArray = normalizeGenderArray(preferences?.preferredGenders);
      const preferredGendersFromLabel = normalizePreferredGenders(
        preferences?.genderPreference ?? preferences?.interestedIn
      );

      const matchingPrefs: any = {
        minAge: ageMin,
        maxAge: ageMax,
        // Some callers send maxDistance, others maxRadius
        maxRadius: preferences?.maxDistance ?? preferences?.maxRadius ?? 50,
        // Some callers send interests, others preferredInterests
        preferredInterests: preferences?.interests ?? preferences?.preferredInterests ?? [],
        // Some callers send preferredGenders[], others genderPreference label
        preferredGenders:
          preferredGendersFromArray.length > 0 ? preferredGendersFromArray : preferredGendersFromLabel,
        preferredRelationshipIntents: preferences.preferredRelationshipIntents || preferences.lookingFor || [],
        preferredFamilyPlans: preferences.preferredFamilyPlans || [],
        preferredReligions: preferences.preferredReligions || [],
        preferredEducationLevels: preferences.preferredEducationLevels || [],
        preferredPoliticalViews: preferences.preferredPoliticalViews || [],
        preferredExerciseHabits: preferences.preferredExerciseHabits || [],
        preferredSmokingHabits: preferences.preferredSmokingHabits || [],
        preferredDrinkingHabits: preferences.preferredDrinkingHabits || [],
        preferredMinAge: preferences?.preferredMinAge ?? ageMin,
        preferredMaxAge: preferences?.preferredMaxAge ?? ageMax,
      };

      await prisma.userMatchingPreferences.upsert({
        where: { userId },
        update: matchingPrefs,
        create: {
          userId,
          ...matchingPrefs,
        },
      });

      logger.info(`Synced matching preferences for user ${userId}`);
    } catch (error: any) {
      logger.error(`Error syncing matching preferences for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Try to find a match immediately for a newly joined user
   */
  private static async tryImmediateMatch(userId: string): Promise<void> {
    try {
      // Get the user's queue entry
      const userEntry = await prisma.queueEntry.findFirst({
        where: {
          userId,
          status: 'WAITING'
        }
      });

      if (!userEntry) {
        logger.debug(`User ${userId} not found in queue for immediate matching`);
        return;
      }

      // Skip if user is in an active call
      if (await this.isUserInActiveCall(userId)) {
        logger.debug(`User ${userId} is in active call, skipping immediate match`);
        return;
      }

      // Get other users in queue with same intent, excluding those in active calls
      const otherEntries = await prisma.queueEntry.findMany({
        where: {
          intent: userEntry.intent,
          status: 'WAITING',
          userId: { not: userId }
        }
      });

      // Filter out users in active calls
      const availableCandidates: string[] = [];
      for (const entry of otherEntries) {
        const isInCall = await this.isUserInActiveCall(entry.userId);
        if (!isInCall) {
          availableCandidates.push(entry.userId);
        }
      }

      if (availableCandidates.length === 0) {
        logger.debug(`No available candidates for immediate match with user ${userId}`);
        return;
      }

      // Try to find a match
      const matches = await AdvancedMatchingAlgorithm.findBestMatches(
        userId,
        availableCandidates,
        1 // Just need the best match
      );

      if (matches.length > 0 && matches[0].score.totalScore >= 0.1) {
        const bestMatch = matches[0];
        logger.info(`Immediate match found for ${userId} with ${bestMatch.userId}, score: ${bestMatch.score.totalScore}`);
        // Create call session instead of match for Omegle-style flow
        await this.createCallSession(userId, bestMatch.userId, bestMatch.score);
      }
    } catch (error) {
      logger.error(`Error in tryImmediateMatch for user ${userId}:`, error as Error);
    }
  }

  /**
   * Process matching for users in queue
   */
  private static async processMatching() {
    try {
      // Get users to process from Redis queue
      const userIds = await redis.zrange(this.QUEUE_KEY, 0, this.MATCH_BATCH_SIZE - 1);
      
      if (userIds.length < 2) {
        logger.debug('Not enough users in queue for matching');
        return;
      }

      logger.info(`Processing matching for ${userIds.length} users`);

      // Group users by intent and gender for efficient matching
      const queueEntries = await prisma.queueEntry.findMany({
        where: {
          userId: { in: userIds },
          status: 'WAITING'
        }
      });

      logger.info(`Found ${queueEntries.length} queue entries in database`, {
        userIds: queueEntries.map(e => ({ userId: e.userId, intent: e.intent, gender: e.gender }))
      });

      // Group by intent for better matching
      const intentGroups = this.groupByIntent(queueEntries);
      
      logger.info(`Grouped into ${Object.keys(intentGroups).length} intent groups:`, {
        groups: Object.entries(intentGroups).map((entry) => {
          const [intent, users] = entry;
          const usersArray = users as any[];
          return {
            intent,
            userCount: usersArray.length,
            userIds: usersArray.map((u: any) => u.userId)
          };
        })
      });

      // Process each intent group
      for (const [intent, users] of Object.entries(intentGroups)) {
        try {
          const usersArray = users as any[];
          logger.info(`[processMatching] About to process intent group ${intent} with ${usersArray.length} users`);
          logger.info(`[processMatching] Users in group:`, usersArray.map((u: any) => ({ userId: u.userId, gender: u.gender })));
          await this.processIntentGroup(intent, usersArray);
          logger.info(`[processMatching] Finished processing intent group ${intent}`);
        } catch (error) {
          logger.error(`[processMatching] Error processing intent group ${intent}:`, error as Error);
          logger.error(`[processMatching] Error stack:`, (error as Error).stack);
        }
      }

      // Clean up expired entries
      await this.cleanupExpiredEntries();

    } catch (error) {
      logger.error('Error in processMatching:', error as Error);
    }
  }

  /**
   * Group queue entries by intent
   */
  private static groupByIntent(entries: any[]) {
    return entries.reduce((groups, entry) => {
      const intent = entry.intent;
      if (!groups[intent]) groups[intent] = [];
      groups[intent].push(entry);
      return groups;
    }, {} as Record<string, any[]>);
  }

  /**
   * Check if user is in an active call
   */
  private static async isUserInActiveCall(userId: string): Promise<boolean> {
    try {
      const isActive = await redis.sismember(this.ACTIVE_CALLS_KEY, userId);
      return isActive === 1;
    } catch (error) {
      logger.error(`Error checking active call status for user ${userId}:`, error as Error);
      return false; // Default to false on error to allow matching
    }
  }

  /**
   * Mark user as in active call
   */
  static async markUserInActiveCall(userId: string): Promise<void> {
    try {
      await redis.sadd(this.ACTIVE_CALLS_KEY, userId);
      logger.info(`Marked user ${userId} as in active call`);
    } catch (error) {
      logger.error(`Error marking user ${userId} as in active call:`, error as Error);
    }
  }

  /**
   * Remove user from active calls
   */
  static async removeUserFromActiveCall(userId: string): Promise<void> {
    try {
      await redis.srem(this.ACTIVE_CALLS_KEY, userId);
      logger.info(`Removed user ${userId} from active calls`);
    } catch (error) {
      logger.error(`Error removing user ${userId} from active calls:`, error as Error);
    }
  }

  /**
   * Process matching within an intent group
   */
  private static async processIntentGroup(intent: string, users: any[]) {
    try {
      logger.info(`Processing intent group ${intent} with ${users.length} users`);
      
      // Separate by gender for female-centric matching
      const males = users.filter(u => u.gender === DatingGender.MAN);
      const females = users.filter(u => u.gender === DatingGender.WOMAN);
      const others = users.filter(u => u.gender === DatingGender.NONBINARY);

      logger.info(`Intent group ${intent} breakdown: ${females.length} females, ${males.length} males, ${others.length} others`);

      // Prioritize female users (they get matched first)
      const prioritizedUsers = [...females, ...others, ...males];
      
      logger.info(`Prioritized users for intent ${intent}: ${prioritizedUsers.length} total`);

      logger.info(`Starting matching loop for intent ${intent}, ${prioritizedUsers.length} users`);
      logger.info(`Loop will run ${prioritizedUsers.length - 1} times (i from 0 to ${prioritizedUsers.length - 2})`);
      
      for (let i = 0; i < prioritizedUsers.length - 1; i++) {
        const user1 = prioritizedUsers[i];
        logger.info(`[processIntentGroup] Loop iteration ${i + 1}: Processing user ${user1.userId} (${user1.gender})`);
        
        // Skip if user already matched
        const currentEntry = await prisma.queueEntry.findFirst({
          where: { userId: user1.userId, status: 'WAITING' }
        });
        
        logger.info(`[processIntentGroup] User ${user1.userId} currentEntry check: ${currentEntry ? 'FOUND' : 'NOT FOUND'}`);
        
        if (!currentEntry) {
          logger.info(`[processIntentGroup] Skipping user ${user1.userId} - not in WAITING status`);
          continue;
        }

        // Skip if user is in an active call
        const isInCall = await this.isUserInActiveCall(user1.userId);
        logger.info(`[processIntentGroup] User ${user1.userId} isInActiveCall check: ${isInCall}`);
        
        if (isInCall) {
          logger.info(`[processIntentGroup] Skipping user ${user1.userId} - currently in active call`);
          continue;
        }

        // Find potential matches for this user, filtering out users in active calls
        const candidateUsers = prioritizedUsers.slice(i + 1);
        logger.debug(`User ${user1.userId} has ${candidateUsers.length} potential candidates`);
        
        const availableCandidates: string[] = [];
        
        for (const candidate of candidateUsers) {
          const isInCall = await this.isUserInActiveCall(candidate.userId);
          if (!isInCall) {
            availableCandidates.push(candidate.userId);
          }
        }

        logger.info(`User ${user1.userId} has ${availableCandidates.length} available candidates (after filtering active calls)`);

        if (availableCandidates.length === 0) {
          logger.debug(`No available candidates for user ${user1.userId} (all in active calls)`);
          continue;
        }

        logger.info(`[processIntentGroup] Finding matches for user ${user1.userId} among ${availableCandidates.length} candidates: ${availableCandidates.join(', ')}`);
        
        let matches: any[] = [];
        try {
          matches = await AdvancedMatchingAlgorithm.findBestMatches(
            user1.userId,
            availableCandidates,
            5
          );
          logger.info(`[processIntentGroup] Found ${matches.length} potential matches for user ${user1.userId}`);
        } catch (matchError) {
          logger.error(`[processIntentGroup] Error in findBestMatches for user ${user1.userId}:`, matchError as Error);
          logger.error(`[processIntentGroup] Error stack:`, (matchError as Error).stack);
          continue; // Skip this user if matching fails
        }

        if (matches.length > 0) {
          const bestMatch = matches[0];
          
          // Log match attempt with detailed scores
          logger.info(`Match attempt for ${user1.userId} with ${bestMatch.userId}:`, {
            totalScore: bestMatch.score.totalScore,
            ageScore: bestMatch.score.ageScore,
            locationScore: bestMatch.score.locationScore,
            interestScore: bestMatch.score.interestScore,
            languageScore: bestMatch.score.languageScore,
            ethnicityScore: bestMatch.score.ethnicityScore,
            threshold: 0.1
          });
          
          // Ensure minimum compatibility score
          // Lowered threshold to 0.1 to allow more calls
          // Gender compatibility is not required - users choose who they want to date
          if (bestMatch.score.totalScore >= 0.1) {
            logger.info(`✅ Creating audio call between ${user1.userId} and ${bestMatch.userId} with score ${bestMatch.score.totalScore}`);
            // Create audio call session (NOT a match yet - matching happens when user clicks heart)
            await this.createCallSession(user1.userId, bestMatch.userId, bestMatch.score);
          } else {
            logger.warn(`❌ Compatibility score ${bestMatch.score.totalScore} below threshold 0.1 for ${user1.userId} and ${bestMatch.userId}`, {
              scores: bestMatch.score
            });
          }
        } else {
          logger.debug(`No matches found for user ${user1.userId} in intent group ${intent} (${availableCandidates.length} candidates checked)`);
        }

        // Update attempt count
        await prisma.queueEntry.update({
          where: { id: user1.id },
          data: {
            attempts: user1.attempts + 1,
            lastMatchAttempt: new Date()
          }
        });
      }
    } catch (error) {
      logger.error(`Error processing intent group ${intent}:`, error as Error);
    }
  }

  /**
   * Create an audio call session between two users (without creating a match)
   * This is for the Omegle-style flow where users see each other's profiles
   * and can then choose to match by clicking the heart button
   */
  private static async createCallSession(user1Id: string, user2Id: string, score: any) {
    try {
      // Remove both users from queue (they're now in a call)
      await prisma.queueEntry.updateMany({
        where: {
          userId: { in: [user1Id, user2Id] },
          status: 'WAITING'
        },
        data: { status: 'MATCHED' } // Using MATCHED status to indicate they're in a call
      });

      // Remove from Redis queue
      await redis.zrem(this.QUEUE_KEY, user1Id, user2Id);

      // Mark both users as in active calls
      await this.markUserInActiveCall(user1Id);
      await this.markUserInActiveCall(user2Id);

      // Automatically create VOICE interaction session
      let session = null;
      try {
        const interactionServiceUrl = process.env.INTERACTION_SERVICE_URL || 'http://localhost:3003';
        const response = await axios.post(`${interactionServiceUrl}/api/interactions`, {
          user1Id,
          user2Id,
          callType: 'VOICE',
          status: 'INITIATED'
        });

        if (response.data.status === 'success' && response.data.data) {
          session = response.data.data;
          logger.info(`Created VOICE session for call: ${session.id}`, {
            sessionId: session.id,
            roomId: session.roomId
          });
        } else {
          logger.error(`Interaction service returned unexpected response:`, response.data);
        }
      } catch (sessionError: any) {
        logger.error(`Failed to create interaction session for call:`, sessionError);
        logger.error(`Session error details:`, {
          message: sessionError.message,
          response: sessionError.response?.data,
          status: sessionError.response?.status
        });
        // Don't continue if session creation fails - we need sessionId and roomId
        throw new Error(`Failed to create interaction session: ${sessionError.message}`);
      }

      // Only emit call session event if we have sessionId and roomId
      if (session?.id && session?.roomId) {
        await this.emitCallSessionEvent(user1Id, user2Id, session.id, session.roomId);
      } else {
        logger.error(`Cannot emit call session event - missing sessionId or roomId`, {
          sessionId: session?.id,
          roomId: session?.roomId
        });
        throw new Error('Session created but missing sessionId or roomId');
      }

      logger.info(`Call session created between ${user1Id} and ${user2Id}`, {
        sessionId: session?.id,
        roomId: session?.roomId
      });

    } catch (error) {
      logger.error(`Error creating call session between ${user1Id} and ${user2Id}:`, error as Error);
    }
  }

  /**
   * Create a match between two users (called when user clicks heart button)
   * This creates a PROPOSED match that the other user needs to accept
   */
  private static async createMatch(user1Id: string, user2Id: string, score: any) {
    try {
      // Create match attempt record with PROPOSED status (waiting for other user to accept)
      const matchAttempt = await prisma.matchAttempt.create({
        data: {
          user1Id,
          user2Id,
          totalScore: score.totalScore,
          ageScore: score.ageScore,
          locationScore: score.locationScore,
          interestScore: score.interestScore,
          languageScore: score.languageScore,
          ethnicityScore: score.ethnicityScore,
          // Dating-specific scores with defaults
          genderCompatScore: score.genderCompatScore || 0,
          relationshipIntentScore: score.relationshipIntentScore || 0,
          familyPlansScore: score.familyPlansScore || 0,
          religionScore: score.religionScore || 0,
          educationScore: score.educationScore || 0,
          politicalScore: score.politicalScore || 0,
          lifestyleScore: score.lifestyleScore || 0,
          premiumBonus: score.premiumBonus || 0,
          status: 'PROPOSED', // User needs to accept
          algorithm: 'advanced_v1'
        }
      });

      // Emit match event with session details (this will trigger WebSocket events)
      await this.emitMatchEvent(user1Id, user2Id, matchAttempt.id, score.totalScore);

      logger.info(`Match proposed between ${user1Id} and ${user2Id}`, {
        matchAttemptId: matchAttempt.id,
        score: score.totalScore
      });

    } catch (error) {
      logger.error(`Error creating match between ${user1Id} and ${user2Id}:`, error as Error);
    }
  }

  /**
   * Emit call session event (for audio calls without matches)
   */
  public static async emitCallSessionEvent(user1Id: string, user2Id: string, sessionId?: string, roomId?: string) {
    try {
      // Publish to Redis for other services to pick up
      const callData = {
        user1Id,
        user2Id,
        sessionId,
        roomId,
        timestamp: new Date().toISOString()
      };

      await redis.publish('call:found', JSON.stringify(callData));
      logger.info(`Emitted call:found event for ${user1Id} and ${user2Id}`);
    } catch (error) {
      logger.error('Error emitting call session event:', error as Error);
    }
  }

  /**
   * Emit match event to other services
   */
  public static async emitMatchEvent(user1Id: string, user2Id: string, matchId: string, score: number, session?: any) {
    try {
      // Publish to Redis for other services to pick up
      const matchData = {
        user1Id,
        user2Id,
        matchId,
        score,
        sessionId: session?.id || null,
        roomId: session?.roomId || null,
        timestamp: new Date().toISOString()
      };

      const message = JSON.stringify(matchData);
      console.log('[QueueManager] Publishing match event to Redis:', {
        channel: 'user_matched',
        matchId,
        user1Id,
        user2Id,
        score,
        sessionId: session?.id,
        roomId: session?.roomId,
        messageLength: message.length
      });
      
      const subscribers = await redis.publish('user_matched', message);
      console.log(`[QueueManager] Match event published to ${subscribers} subscriber(s)`);
      logger.info('Match event emitted', { ...matchData, subscribers });
    } catch (error) {
      console.error('[QueueManager] Error emitting match event:', error);
      logger.error('Error emitting match event:', error as Error);
    }
  }

  /**
   * Clean up expired queue entries
   */
  private static async cleanupExpiredEntries() {
    try {
      const now = new Date();
      
      // Get expired entries
      const expiredEntries = await prisma.queueEntry.findMany({
        where: {
          status: 'WAITING',
          expiresAt: { lt: now }
        }
      });

      if (expiredEntries.length > 0) {
        const userIds = expiredEntries.map((e: any) => e.userId);
        
        // Update status in database
        await prisma.queueEntry.updateMany({
          where: {
            id: { in: expiredEntries.map((e: any) => e.id) }
          },
          data: { status: 'EXPIRED' }
        });

        // Remove from Redis queue
        if (userIds.length > 0) {
          await redis.zrem(this.QUEUE_KEY, ...userIds);
        }

        logger.info(`Cleaned up ${expiredEntries.length} expired queue entries`);
      }
    } catch (error) {
      logger.error('Error cleaning up expired entries:', error as Error);
    }
  }

  /**
   * Skip current match and find next one
   * Also automatically re-queues the partner user
   */
  static async skipMatch(userId: string, sessionId?: string): Promise<{ success: boolean; message?: string }> {
    try {
      // Remove user from active calls
      await this.removeUserFromActiveCall(userId);

      let partnerUserId: string | null = null;

      // End the current interaction session if sessionId is provided
      // Also fetch session details to get partner's userId
      if (sessionId) {
        try {
          const interactionServiceUrl = process.env.INTERACTION_SERVICE_URL || 'http://localhost:3003';
          
          // First, get the session to find the partner
          try {
            const sessionResponse = await axios.get(`${interactionServiceUrl}/api/interactions/${sessionId}`, {
              timeout: 5000,
              headers: {
                'x-internal-request': 'true'
              }
            });
            
            // Handle different response formats: { data: { data: {...} } } or { data: {...} }
            const session = sessionResponse.data?.data?.data || sessionResponse.data?.data || sessionResponse.data;
            if (session && (session.user1Id || session.user2Id)) {
              // Find the partner's userId
              if (session.user1Id === userId) {
                partnerUserId = session.user2Id;
              } else if (session.user2Id === userId) {
                partnerUserId = session.user1Id;
              }
              if (partnerUserId) {
                logger.info(`Found partner ${partnerUserId} for user ${userId} in session ${sessionId}`);
              }
            }
          } catch (fetchError: any) {
            logger.warn(`Failed to fetch session ${sessionId} to find partner:`, fetchError.message);
            // Continue even if we can't find the partner
          }
          
          // End the session
          await axios.patch(`${interactionServiceUrl}/api/interactions/${sessionId}`, {
            status: 'COMPLETED',
            endedAt: new Date().toISOString()
          }, {
            headers: {
              'x-internal-request': 'true'
            }
          });
          logger.info(`Ended interaction session ${sessionId} for user ${userId}`);
        } catch (sessionError: any) {
          logger.warn(`Failed to end interaction session ${sessionId}:`, sessionError);
          // Continue even if session ending fails
        }
      }

      // Helper function to re-queue a user
      const reQueueUser = async (targetUserId: string): Promise<boolean> => {
        try {
          // Check if user has queue entry data to re-queue
          const queueEntry = await prisma.queueEntry.findFirst({
            where: {
              userId: targetUserId,
              status: { in: ['MATCHED', 'WAITING'] }
            },
            orderBy: { updatedAt: 'desc' }
          });

          if (queueEntry) {
            // Validate gender is not null
            if (!queueEntry.gender) {
              logger.warn(`Cannot re-queue user ${targetUserId} - gender is null`);
              return false;
            }

            // Remove from active calls
            await this.removeUserFromActiveCall(targetUserId);

            // Re-add user to queue with same preferences
            const queueData: QueueUserData = {
              userId: queueEntry.userId,
              intent: queueEntry.intent as any,
              gender: queueEntry.gender, // Now guaranteed to be non-null
              age: queueEntry.age || undefined,
              latitude: queueEntry.latitude || undefined,
              longitude: queueEntry.longitude || undefined,
              interests: (queueEntry.interests as any[]) || [],
              languages: (queueEntry.languages as any[]) || [],
              ethnicity: queueEntry.ethnicity || undefined
            };

            const result = await this.addUserToQueue(queueData);
            if (result.success) {
              logger.info(`User ${targetUserId} re-queued after skipping match`);
              return true;
            }
          } else {
            logger.info(`User ${targetUserId} skipped match but was not re-queued (no queue entry found)`);
          }
          return false;
        } catch (error) {
          logger.error(`Error re-queuing user ${targetUserId}:`, error as Error);
          return false;
        }
      };

      // Re-queue the calling user
      const userReQueued = await reQueueUser(userId);

      // Re-queue the partner if we found them
      if (partnerUserId) {
        logger.info(`Re-queuing partner ${partnerUserId} after user ${userId} skipped match`);
        await reQueueUser(partnerUserId);
      }

      if (userReQueued) {
        return { success: true, message: 'Match skipped, searching for next match' };
      }

      return { success: true, message: 'Match skipped' };
    } catch (error) {
      logger.error(`Error skipping match for user ${userId}:`, error as Error);
      return { success: false, message: 'Failed to skip match' };
    }
  }

  /**
   * Get queue statistics
   */
  static async getQueueStats() {
    try {
      const totalWaiting = await prisma.queueEntry.count({
        where: { status: 'WAITING' }
      });

      const byIntent = await prisma.queueEntry.groupBy({
        by: ['intent'],
        where: { status: 'WAITING' },
        _count: { id: true }
      });

      const byGender = await prisma.queueEntry.groupBy({
        by: ['gender'],
        where: { status: 'WAITING' },
        _count: { id: true }
      });

      const totalMatches = await prisma.matchAttempt.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      });

      return {
        totalWaiting,
        byIntent: byIntent.reduce((acc: any, item: any) => ({ ...acc, [item.intent]: item._count.id }), {}),
        byGender: byGender.reduce((acc: any, item: any) => ({ ...acc, [item.gender]: item._count.id }), {}),
        totalMatchesToday: totalMatches
      };
    } catch (error) {
      logger.error('Error getting queue stats:', error as Error);
      return null;
    }
  }
}