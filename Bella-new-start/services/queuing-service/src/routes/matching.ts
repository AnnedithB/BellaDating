import express, { Request, Response } from 'express';
import { QueueManager } from '../services/queueManager';
import { createLogger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const router = express.Router();
const logger = createLogger('matching-routes');
const prisma = new PrismaClient();

// User service URL for fetching profiles
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service:3001';

/**
 * PUT /dating-preferences/:userId
 * Sync user preferences from GraphQL gateway when user saves preferences
 */
router.put('/dating-preferences/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const preferences = req.body;

    logger.info(`Syncing dating preferences for user ${userId}`, { preferences });

    if (!userId) {
      res.status(400).json({
        status: 'error',
        message: 'User ID is required'
      });
      return;
    }

    // Use QueueManager's sync method
    await QueueManager.syncUserMatchingPreferences(userId, preferences);

    res.json({
      status: 'success',
      message: 'Preferences synced successfully'
    });
  } catch (error: any) {
    logger.error('Error syncing dating preferences:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to sync preferences'
    });
  }
});

/**
 * POST /discover-profiles
 * Discover profiles for matching based on user preferences
 */
router.post('/discover-profiles', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, preferences, limit = 10 } = req.body;

    logger.info(`Discovering profiles for user ${userId}`, { preferences, limit });

    if (!userId) {
      res.status(400).json({
        status: 'error',
        message: 'User ID is required'
      });
      return;
    }

    // First, ensure user's preferences are synced
    if (preferences) {
      try {
        await QueueManager.syncUserMatchingPreferences(userId, preferences);
        logger.info(`Auto-synced preferences for user ${userId} during discover`);
      } catch (syncError: any) {
        logger.warn(`Failed to auto-sync preferences for user ${userId}:`, syncError);
        // Continue - user might already have preferences in DB
      }
    }

    // Get user's matching preferences
    const userPrefs = await prisma.userMatchingPreferences.findUnique({
      where: { userId }
    });

    if (!userPrefs) {
      res.status(400).json({
        status: 'error',
        message: 'User preferences not found. Please set your preferences first.'
      });
      return;
    }

    // Find all other users with matching preferences
    const allPrefs = await prisma.userMatchingPreferences.findMany({
      where: {
        userId: { not: userId }
      }
    });

    logger.info(`Found ${allPrefs.length} other users with preferences`);

    // IMPORTANT: We intentionally do NOT exclude previously matched users.
    // Users can re-match / reconnect even if they matched before.
    const filteredPrefs = allPrefs;
    logger.info(`${filteredPrefs.length} candidates (including previously matched users)`);

    // Build candidate list with profile data
    const candidates: any[] = [];
    const token = req.headers.authorization;

    for (const candidatePrefs of filteredPrefs.slice(0, limit * 2)) { // Get extra to account for filtering
      try {
        // Fetch user profile from user service
        const profileResponse = await axios.get(
          `${USER_SERVICE_URL}/profile/users/${candidatePrefs.userId}`,
          { headers: token ? { Authorization: token } : {} }
        );

        if (profileResponse.data?.data?.user) {
          const profile = profileResponse.data.data.user;
          
          // Check age compatibility
          const candidateAge = profile.age || 25;
          const minAge = userPrefs.minAge || 18;
          const maxAge = userPrefs.maxAge || 65;
          
          if (candidateAge < minAge || candidateAge > maxAge) {
            continue;
          }

          // Check gender compatibility
          const candidateGender = profile.gender?.toUpperCase() || 'MAN';
          const preferredGenders = userPrefs.preferredGenders as string[] || [];
          
          if (preferredGenders.length > 0 && !preferredGenders.includes(candidateGender)) {
            continue;
          }

          // Calculate a simple compatibility score
          const score = calculateCompatibilityScore(userPrefs, candidatePrefs, profile);

          candidates.push({
            id: candidatePrefs.userId,
            name: profile.name || profile.displayName || 'User',
            age: candidateAge,
            bio: profile.bio || profile.shortBio || '',
            photos: profile.photos || (profile.profilePicture ? [profile.profilePicture] : []),
            profilePicture: profile.profilePicture || null,
            location: profile.location || '',
            interests: profile.interests || [],
            gender: profile.gender || 'Unknown',
            educationLevel: profile.educationLevel || null,
            religion: profile.religion || null,
            familyPlans: profile.familyPlans || null,
            hasKids: profile.hasKids || null,
            languages: profile.languages || [],
            ethnicity: profile.ethnicity || null,
            politicalViews: profile.politicalViews || null,
            exercise: profile.exercise || null,
            smoking: profile.smoking || null,
            drinking: profile.drinking || null,
            compatibilityScore: score
          });
        }
      } catch (profileError: any) {
        logger.warn(`Failed to fetch profile for ${candidatePrefs.userId}:`, profileError.message);
        // Continue with next candidate
      }
    }

    // Sort by compatibility score and limit
    candidates.sort((a, b) => b.compatibilityScore - a.compatibilityScore);
    const topCandidates = candidates.slice(0, limit);

    logger.info(`Returning ${topCandidates.length} suggested profiles`);

    res.json({
      status: 'success',
      data: {
        profiles: topCandidates,
        totalCandidates: candidates.length
      }
    });
  } catch (error: any) {
    logger.error('Error discovering profiles:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to discover profiles'
    });
  }
});

/**
 * POST /create-from-suggestion
 * Create a match from a suggested profile
 */
router.post('/create-from-suggestion', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, targetUserId, action = 'match' } = req.body;

    logger.info(`Creating match from suggestion: ${userId} -> ${targetUserId} (${action})`);

    if (!userId || !targetUserId) {
      res.status(400).json({
        status: 'error',
        message: 'Both userId and targetUserId are required'
      });
      return;
    }

    // Check for existing match
    const existingMatch = await prisma.matchAttempt.findFirst({
      where: {
        OR: [
          { user1Id: userId, user2Id: targetUserId },
          { user1Id: targetUserId, user2Id: userId }
        ]
      }
    });

    if (existingMatch) {
      // Update existing match if it was in a different state
      if (existingMatch.status === 'PROPOSED' && existingMatch.user2Id === userId) {
        // The target user is accepting a match proposed to them
        const updatedMatch = await prisma.matchAttempt.update({
          where: { id: existingMatch.id },
          data: { 
            status: 'ACCEPTED',
            acceptedAt: new Date()
          }
        });

        // Emit match event to trigger notifications (even if already matched before)
        try {
          await QueueManager.emitMatchEvent(
            updatedMatch.user1Id, 
            updatedMatch.user2Id, 
            updatedMatch.id, 
            updatedMatch.totalScore
          );
          logger.info(`Emitted match event for accepted match ${updatedMatch.id}`);
        } catch (emitError) {
          logger.error('Failed to emit match event:', emitError);
          // Don't fail the request if event emission fails
        }

        res.json({
          status: 'success',
          data: updatedMatch
        });
        return;
      }

      res.json({
        status: 'success',
        data: existingMatch
      });
      return;
    }

    // Create new match in PROPOSED status
    const match = await prisma.matchAttempt.create({
      data: {
        user1Id: userId,
        user2Id: targetUserId,
        status: 'PROPOSED',
        // MatchAttempt requires scoring fields; use a sane default set
        totalScore: 0.75,
        ageScore: 0.5,
        locationScore: 0.5,
        interestScore: 0.5,
        languageScore: 0.5,
        ethnicityScore: 0.0,
        genderCompatScore: 0.5,
        relationshipIntentScore: 0.5,
        familyPlansScore: 0.5,
        religionScore: 0.5,
        educationScore: 0.5,
        politicalScore: 0.5,
        lifestyleScore: 0.5,
        premiumBonus: 0.0,
        metadata: {
          createdVia: 'suggestion',
          action
        }
      }
    });

    logger.info(`Created match ${match.id} between ${userId} and ${targetUserId}`);

    // Emit match event to trigger notifications (even for same profile matches)
    try {
      await QueueManager.emitMatchEvent(userId, targetUserId, match.id, match.totalScore);
      logger.info(`Emitted match event for match ${match.id}`);
    } catch (emitError) {
      logger.error('Failed to emit match event:', emitError);
      // Don't fail the request if event emission fails
    }

    res.json({ status: 'success', data: match });
  } catch (error: any) {
    logger.error('Error creating match from suggestion:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to create match'
    });
  }
});

/**
 * Calculate compatibility score between two users
 */
function calculateCompatibilityScore(userPrefs: any, candidatePrefs: any, candidateProfile: any): number {
  let score = 50; // Base score

  // Age preference match (+20)
  const candidateAge = candidateProfile.age || 25;
  const candidateMinAge = candidatePrefs.minAge || 18;
  const candidateMaxAge = candidatePrefs.maxAge || 65;
  
  // Check if user's age would be acceptable to candidate
  // (This would require user's age, but we don't have it here - simplified)
  score += 10;

  // Interest overlap (+up to 20)
  const userInterests = userPrefs.preferredInterests || [];
  const candidateInterests = candidateProfile.interests || [];
  const commonInterests = userInterests.filter((i: string) => 
    candidateInterests.some((ci: string) => ci.toLowerCase() === i.toLowerCase())
  );
  score += Math.min(commonInterests.length * 5, 20);

  // Same relationship intent (+15)
  const userIntents = userPrefs.preferredRelationshipIntents || [];
  const candidateIntents = candidatePrefs.preferredRelationshipIntents || [];
  if (userIntents.some((i: string) => candidateIntents.includes(i))) {
    score += 15;
  }

  // Location proximity would add more points (not implemented - requires geolocation)
  score += 5;

  return Math.min(score, 100);
}

export default router;
