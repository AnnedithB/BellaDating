import { Router, Request, Response } from 'express';
import { createLogger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';
import { DatingMatchingAlgorithm } from '../algorithms/datingMatching';
import { 
  DatingGender, 
  RelationshipIntent, 
  FamilyPlans, 
  Religion, 
  EducationLevel, 
  PoliticalView, 
  LifestyleHabit,
  DatingMatchingRequest,
  DatingMatchingResponse
} from '../types/dating';

const router = Router();
const logger = createLogger('matching-routes');
const prisma = new PrismaClient();

// Get user's matching preferences
router.get('/preferences/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const preferences = await prisma.userMatchingPreferences.findUnique({
      where: { userId }
    });

    if (!preferences) {
      // Return default preferences
      res.json({
        status: 'success',
        data: {
          minAge: 18,
          maxAge: 65,
          maxRadius: 50,
          interests: [],
          preferredInterests: [],
          languages: [],
          preferredLanguages: [],
          ethnicity: null,
          preferredEthnicities: [],
          ethnicityImportance: 0.0,
          ageWeight: 0.3,
          locationWeight: 0.4,
          interestWeight: 0.2,
          languageWeight: 0.1
        }
      });
    } else {
      res.json({
        status: 'success',
        data: preferences
      });
    }
  } catch (error) {
    logger.error('Error getting matching preferences:', error as Error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Update user's matching preferences
router.put('/preferences/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const {
      minAge,
      maxAge,
      maxRadius,
      interests,
      preferredInterests,
      languages,
      preferredLanguages,
      ethnicity,
      preferredEthnicities,
      ethnicityImportance,
      ageWeight,
      locationWeight,
      interestWeight,
      languageWeight
    } = req.body;

    // Validation
    if (minAge && (minAge < 18 || minAge > 100)) {
      res.status(400).json({
        status: 'error',
        message: 'Invalid minAge. Must be between 18 and 100'
      });
      return;
    }

    if (maxAge && (maxAge < 18 || maxAge > 100 || (minAge && maxAge < minAge))) {
      res.status(400).json({
        status: 'error',
        message: 'Invalid maxAge. Must be between 18 and 100 and greater than minAge'
      });
      return;
    }

    if (ethnicityImportance && (ethnicityImportance < 0 || ethnicityImportance > 1)) {
      res.status(400).json({
        status: 'error',
        message: 'ethnicityImportance must be between 0.0 and 1.0'
      });
      return;
    }

    // Validate weights sum to reasonable values
    const totalWeight = (ageWeight || 0.3) + (locationWeight || 0.4) + (interestWeight || 0.2) + (languageWeight || 0.1);
    if (totalWeight > 1.2 || totalWeight < 0.8) {
      res.status(400).json({
        status: 'error',
        message: 'Total weight of preferences should sum to approximately 1.0'
      });
      return;
    }

    const preferences = await prisma.userMatchingPreferences.upsert({
      where: { userId },
      update: {
        ...(minAge !== undefined && { minAge }),
        ...(maxAge !== undefined && { maxAge }),
        ...(maxRadius !== undefined && { maxRadius }),
        ...(interests !== undefined && { interests }),
        ...(preferredInterests !== undefined && { preferredInterests }),
        ...(languages !== undefined && { languages }),
        ...(preferredLanguages !== undefined && { preferredLanguages }),
        ...(ethnicity !== undefined && { ethnicity }),
        ...(preferredEthnicities !== undefined && { preferredEthnicities }),
        ...(ethnicityImportance !== undefined && { ethnicityImportance }),
        ...(ageWeight !== undefined && { ageWeight }),
        ...(locationWeight !== undefined && { locationWeight }),
        ...(interestWeight !== undefined && { interestWeight }),
        ...(languageWeight !== undefined && { languageWeight })
      },
      create: {
        userId,
        minAge: minAge || 18,
        maxAge: maxAge || 65,
        maxRadius: maxRadius || 50,
        interests: interests || [],
        preferredInterests: preferredInterests || [],
        languages: languages || [],
        preferredLanguages: preferredLanguages || [],
        ethnicity,
        preferredEthnicities: preferredEthnicities || [],
        ethnicityImportance: ethnicityImportance || 0.0,
        ageWeight: ageWeight || 0.3,
        locationWeight: locationWeight || 0.4,
        interestWeight: interestWeight || 0.2,
        languageWeight: languageWeight || 0.1
      }
    });

    res.json({
      status: 'success',
      message: 'Preferences updated successfully',
      data: preferences
    });
  } catch (error) {
    logger.error('Error updating matching preferences:', error as Error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Update dating-specific preferences
router.put('/dating-preferences/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const {
      // Dating-specific preferences
      preferredGenders,
      preferredRelationshipIntents,
      preferredFamilyPlans,
      preferredReligions,
      preferredEducationLevels,
      preferredPoliticalViews,
      preferredExerciseHabits,
      preferredSmokingHabits,
      preferredDrinkingHabits,
      preferredMinAge,
      preferredMaxAge,
      isPremiumUser,
      premiumExpiry,
      // Dating-specific weights
      genderWeight,
      relationshipIntentWeight,
      lifestyleWeight
    } = req.body;

    // Validation for age preferences
    if (preferredMinAge && (preferredMinAge < 18 || preferredMinAge > 100)) {
      res.status(400).json({
        status: 'error',
        message: 'Invalid preferredMinAge. Must be between 18 and 100'
      });
      return;
    }

    if (preferredMaxAge && (preferredMaxAge < 18 || preferredMaxAge > 100 || (preferredMinAge && preferredMaxAge < preferredMinAge))) {
      res.status(400).json({
        status: 'error',
        message: 'Invalid preferredMaxAge. Must be between 18 and 100 and greater than preferredMinAge'
      });
      return;
    }

    // Validate enum values
    const validGenders = ['MAN', 'WOMAN', 'NONBINARY'];
    const validRelationshipIntents = ['LONG_TERM', 'CASUAL_DATES', 'MARRIAGE', 'INTIMACY', 'INTIMACY_NO_COMMITMENT', 'LIFE_PARTNER', 'ETHICAL_NON_MONOGAMY'];
    const validFamilyPlans = ['HAS_KIDS_WANTS_MORE', 'HAS_KIDS_DOESNT_WANT_MORE', 'DOESNT_HAVE_KIDS_WANTS_KIDS', 'DOESNT_HAVE_KIDS_DOESNT_WANT_KIDS', 'NOT_SURE_YET'];
    const validReligions = ['AGNOSTIC', 'ATHEIST', 'BUDDHIST', 'CATHOLIC', 'CHRISTIAN', 'HINDU', 'JEWISH', 'MUSLIM', 'SPIRITUAL', 'OTHER'];
    const validEducationLevels = ['HIGH_SCHOOL', 'IN_COLLEGE', 'UNDERGRADUATE', 'IN_GRAD_SCHOOL', 'POSTGRADUATE'];
    const validPoliticalViews = ['LIBERAL', 'MODERATE', 'CONSERVATIVE', 'APOLITICAL', 'OTHER'];
    const validLifestyleHabits = ['FREQUENTLY', 'SOCIALLY', 'RARELY', 'NEVER'];

    // Validate arrays
    if (preferredGenders && (!Array.isArray(preferredGenders) || !preferredGenders.every(g => validGenders.includes(g)))) {
      res.status(400).json({ status: 'error', message: 'Invalid preferredGenders' });
      return;
    }

    if (preferredRelationshipIntents && (!Array.isArray(preferredRelationshipIntents) || !preferredRelationshipIntents.every(i => validRelationshipIntents.includes(i)))) {
      res.status(400).json({ status: 'error', message: 'Invalid preferredRelationshipIntents' });
      return;
    }

    const preferences = await prisma.userMatchingPreferences.upsert({
      where: { userId },
      update: {
        // Dating-specific preferences
        ...(preferredGenders !== undefined && { preferredGenders }),
        ...(preferredRelationshipIntents !== undefined && { preferredRelationshipIntents }),
        ...(preferredFamilyPlans !== undefined && { preferredFamilyPlans }),
        ...(preferredReligions !== undefined && { preferredReligions }),
        ...(preferredEducationLevels !== undefined && { preferredEducationLevels }),
        ...(preferredPoliticalViews !== undefined && { preferredPoliticalViews }),
        ...(preferredExerciseHabits !== undefined && { preferredExerciseHabits }),
        ...(preferredSmokingHabits !== undefined && { preferredSmokingHabits }),
        ...(preferredDrinkingHabits !== undefined && { preferredDrinkingHabits }),
        ...(preferredMinAge !== undefined && { preferredMinAge }),
        ...(preferredMaxAge !== undefined && { preferredMaxAge }),
        ...(isPremiumUser !== undefined && { isPremiumUser }),
        ...(premiumExpiry !== undefined && { premiumExpiry: new Date(premiumExpiry) }),
        // Dating-specific weights
        ...(genderWeight !== undefined && { genderWeight }),
        ...(relationshipIntentWeight !== undefined && { relationshipIntentWeight }),
        ...(lifestyleWeight !== undefined && { lifestyleWeight })
      },
      create: {
        userId,
        // Dating-specific preferences with defaults
        preferredGenders: preferredGenders || [],
        preferredRelationshipIntents: preferredRelationshipIntents || [],
        preferredFamilyPlans: preferredFamilyPlans || [],
        preferredReligions: preferredReligions || [],
        preferredEducationLevels: preferredEducationLevels || [],
        preferredPoliticalViews: preferredPoliticalViews || [],
        preferredExerciseHabits: preferredExerciseHabits || [],
        preferredSmokingHabits: preferredSmokingHabits || [],
        preferredDrinkingHabits: preferredDrinkingHabits || [],
        preferredMinAge,
        preferredMaxAge,
        isPremiumUser: isPremiumUser || false,
        premiumExpiry: premiumExpiry ? new Date(premiumExpiry) : null,
        // Dating-specific weights with defaults
        genderWeight: genderWeight || 0.25,
        relationshipIntentWeight: relationshipIntentWeight || 0.15,
        lifestyleWeight: lifestyleWeight || 0.10
      }
    });

    res.json({
      status: 'success',
      message: 'Dating preferences updated successfully',
      data: preferences
    });
  } catch (error) {
    logger.error('Error updating dating preferences:', error as Error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Find dating matches with enhanced algorithm
router.post('/find-dating-matches', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, intent = 'CASUAL', maxMatches = 10 } = req.body;

    if (!userId) {
      res.status(400).json({
        status: 'error',
        message: 'userId is required'
      });
      return;
    }

    // Get candidate user IDs from the queue (excluding the requesting user)
    const candidateEntries = await prisma.queueEntry.findMany({
      where: {
        userId: { not: userId },
        status: 'WAITING',
        intent: intent as any // Type assertion for now
      },
      select: { userId: true },
      take: 100 // Limit candidates for performance
    });

    const candidateUserIds = candidateEntries.map((entry: { userId: string }) => entry.userId);

    // Find matches using the enhanced dating algorithm
    const matches = await DatingMatchingAlgorithm.findBestDatingMatches(
      userId,
      candidateUserIds,
      maxMatches,
      intent
    );

    // Store match attempts in database
    const matchAttempts = await Promise.all(
      matches.map(async (match) => {
        return prisma.matchAttempt.create({
          data: {
            user1Id: userId,
            user2Id: match.userId,
            totalScore: match.score.totalScore,
            ageScore: match.score.ageScore,
            locationScore: match.score.locationScore,
            interestScore: match.score.interestScore,
            languageScore: match.score.languageScore,
            ethnicityScore: match.score.ethnicityScore,
            genderCompatScore: match.score.genderCompatScore,
            relationshipIntentScore: match.score.relationshipIntentScore,
            familyPlansScore: match.score.familyPlansScore,
            religionScore: match.score.religionScore,
            educationScore: match.score.educationScore,
            politicalScore: match.score.politicalScore,
            lifestyleScore: match.score.lifestyleScore,
            premiumBonus: match.score.premiumBonus,
            algorithm: 'dating_v1',
            metadata: {
              intent,
              timestamp: new Date().toISOString()
            }
          }
        });
      })
    );

    res.json({
      status: 'success',
      data: {
        matches: matches.map((match, index) => ({
          userId: match.userId,
          matchId: matchAttempts[index].id,
          compatibility: {
            totalScore: Math.round(match.score.totalScore * 100),
            breakdown: {
              ageCompatibility: Math.round(match.score.ageScore * 100),
              locationCompatibility: Math.round(match.score.locationScore * 100),
              interestCompatibility: Math.round(match.score.interestScore * 100),
              genderCompatibility: Math.round(match.score.genderCompatScore * 100),
              relationshipIntentCompatibility: Math.round(match.score.relationshipIntentScore * 100),
              lifestyleCompatibility: Math.round(match.score.lifestyleScore * 100),
              premiumBonus: Math.round(match.score.premiumBonus * 100)
            }
          }
        })),
        algorithm: 'dating_v1',
        timestamp: new Date().toISOString()
      }
    });

    logger.info(`Found ${matches.length} dating matches for user ${userId} with intent ${intent}`);
  } catch (error) {
    logger.error('Error finding dating matches:', error as Error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Get match history for user
router.get('/history/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const matches = await prisma.matchAttempt.findMany({
      where: {
        OR: [
          { user1Id: userId },
          { user2Id: userId }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string)
    });

    res.json({
      status: 'success',
      data: {
        matches,
        pagination: {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          total: matches.length
        }
      }
    });
  } catch (error) {
    logger.error('Error getting match history:', error as Error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Get matching statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = {
      totalMatches: await prisma.matchAttempt.count(),
      matchesToday: await prisma.matchAttempt.count({
        where: { createdAt: { gte: today } }
      }),
      avgMatchScore: await prisma.matchAttempt.aggregate({
        _avg: { totalScore: true }
      }),
      successfulMatches: await prisma.matchAttempt.count({
        where: { status: 'ACCEPTED' }
      })
    };

    res.json({
      status: 'success',
      data: stats
    });
  } catch (error) {
    logger.error('Error getting matching stats:', error as Error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

export default router;