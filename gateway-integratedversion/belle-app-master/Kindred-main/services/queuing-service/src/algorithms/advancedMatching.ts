import { PrismaClient } from '@prisma/client';
import { createLogger } from '../utils/logger';

const prisma = new PrismaClient();
const logger = createLogger('matching-algorithm');

export interface MatchingScore {
  totalScore: number;
  ageScore: number;
  locationScore: number;
  interestScore: number;
  languageScore: number;
  ethnicityScore: number;
}

export interface UserMatchData {
  userId: string;
  age?: number;
  latitude?: number;
  longitude?: number;
  interests: string[];
  languages: string[];
  ethnicity?: string;
  preferences: {
    minAge: number;
    maxAge: number;
    maxRadius: number;
    preferredInterests: string[];
    preferredLanguages: string[];
    preferredEthnicities: string[];
    ethnicityImportance: number;
    ageWeight: number;
    locationWeight: number;
    interestWeight: number;
    languageWeight: number;
  };
}

export class AdvancedMatchingAlgorithm {
  
  /**
   * Calculate compatibility score between two users
   */
  static calculateMatchScore(user1: UserMatchData, user2: UserMatchData): MatchingScore {
    const ageScore = this.calculateAgeScore(user1, user2);
    const locationScore = this.calculateLocationScore(user1, user2);
    const interestScore = this.calculateInterestScore(user1, user2);
    const languageScore = this.calculateLanguageScore(user1, user2);
    const ethnicityScore = this.calculateEthnicityScore(user1, user2);

    // Calculate weighted total score
    const totalScore = this.calculateWeightedScore(
      user1,
      user2,
      ageScore,
      locationScore,
      interestScore,
      languageScore,
      ethnicityScore
    );

    return {
      totalScore,
      ageScore,
      locationScore,
      interestScore,
      languageScore,
      ethnicityScore
    };
  }

  /**
   * Calculate age compatibility score (0.0 to 1.0)
   */
  private static calculateAgeScore(user1: UserMatchData, user2: UserMatchData): number {
    if (!user1.age || !user2.age) return 0.5; // Neutral score if age unknown

    // Check if users are within each other's preferred age ranges
    const user1InUser2Range = user2.age >= user1.preferences.minAge && user2.age <= user1.preferences.maxAge;
    const user2InUser1Range = user1.age >= user2.preferences.minAge && user1.age <= user2.preferences.maxAge;

    if (!user1InUser2Range || !user2InUser1Range) return 0.0;

    // Calculate closeness in age (bonus for similar ages)
    const ageDifference = Math.abs(user1.age - user2.age);
    const maxAgeDifference = Math.max(
      user1.preferences.maxAge - user1.preferences.minAge,
      user2.preferences.maxAge - user2.preferences.minAge
    );

    return Math.max(0, 1 - (ageDifference / maxAgeDifference));
  }

  /**
   * Calculate location compatibility score (0.0 to 1.0)
   */
  private static calculateLocationScore(user1: UserMatchData, user2: UserMatchData): number {
    if (!user1.latitude || !user1.longitude || !user2.latitude || !user2.longitude) {
      return 0.3; // Neutral score if location unknown
    }

    const distance = this.calculateDistance(
      user1.latitude,
      user1.longitude,
      user2.latitude,
      user2.longitude
    );

    const maxRadius = Math.min(user1.preferences.maxRadius, user2.preferences.maxRadius);
    
    if (distance > maxRadius) return 0.0;

    // Score decreases with distance
    return Math.max(0, 1 - (distance / maxRadius));
  }

  /**
   * Calculate interest compatibility score (0.0 to 1.0)
   */
  private static calculateInterestScore(user1: UserMatchData, user2: UserMatchData): number {
    const user1Interests = new Set(user1.interests);
    const user2Interests = new Set(user2.interests);
    const user1Preferred = new Set(user1.preferences.preferredInterests);
    const user2Preferred = new Set(user2.preferences.preferredInterests);

    // Common interests between users
    const commonInterests = new Set([...user1Interests].filter(x => user2Interests.has(x)));
    
    // Preferred interests match
    const user1PreferredMatch = [...user1Preferred].filter(x => user2Interests.has(x)).length;
    const user2PreferredMatch = [...user2Preferred].filter(x => user1Interests.has(x)).length;

    // Calculate score based on common interests and preferences
    const totalInterests = Math.max(user1Interests.size + user2Interests.size, 1);
    const commonScore = (commonInterests.size * 2) / totalInterests;
    
    const totalPreferred = Math.max(user1Preferred.size + user2Preferred.size, 1);
    const preferredScore = (user1PreferredMatch + user2PreferredMatch) / totalPreferred;

    return Math.min(1, (commonScore * 0.6 + preferredScore * 0.4));
  }

  /**
   * Calculate language compatibility score (0.0 to 1.0)
   */
  private static calculateLanguageScore(user1: UserMatchData, user2: UserMatchData): number {
    const user1Languages = new Set(user1.languages);
    const user2Languages = new Set(user2.languages);
    const user1Preferred = new Set(user1.preferences.preferredLanguages);
    const user2Preferred = new Set(user2.preferences.preferredLanguages);

    // Common languages
    const commonLanguages = new Set([...user1Languages].filter(x => user2Languages.has(x)));
    
    if (commonLanguages.size === 0) return 0.0; // No common language = no communication

    // Preferred languages match
    const user1PreferredMatch = [...user1Preferred].filter(x => user2Languages.has(x)).length;
    const user2PreferredMatch = [...user2Preferred].filter(x => user1Languages.has(x)).length;

    const hasCommonLanguage = commonLanguages.size > 0 ? 0.7 : 0;
    const preferredBonus = Math.min(0.3, (user1PreferredMatch + user2PreferredMatch) * 0.15);

    return Math.min(1, hasCommonLanguage + preferredBonus);
  }

  /**
   * Calculate ethnicity compatibility score with prioritization model
   * ETHICAL IMPLEMENTATION: Boosts preferred matches but doesn't exclude others
   */
  private static calculateEthnicityScore(user1: UserMatchData, user2: UserMatchData): number {
    // Base score is always 0.5 (neutral) to ensure no exclusion
    let score = 0.5;

    if (!user1.ethnicity || !user2.ethnicity) return score;

    // Apply preference bonuses (not penalties)
    const user1Preferred = user1.preferences.preferredEthnicities;
    const user2Preferred = user2.preferences.preferredEthnicities;

    let bonus = 0;

    // User1's ethnicity matches User2's preferences
    if (user2Preferred.includes(user1.ethnicity)) {
      bonus += user2.preferences.ethnicityImportance * 0.25;
    }

    // User2's ethnicity matches User1's preferences
    if (user1Preferred.includes(user2.ethnicity)) {
      bonus += user1.preferences.ethnicityImportance * 0.25;
    }

    // Same ethnicity bonus (small)
    if (user1.ethnicity === user2.ethnicity) {
      bonus += 0.1;
    }

    return Math.min(1, score + bonus);
  }

  /**
   * Calculate weighted total score based on user preferences
   */
  private static calculateWeightedScore(
    user1: UserMatchData,
    user2: UserMatchData,
    ageScore: number,
    locationScore: number,
    interestScore: number,
    languageScore: number,
    ethnicityScore: number
  ): number {
    // Average the weights from both users
    const avgAgeWeight = (user1.preferences.ageWeight + user2.preferences.ageWeight) / 2;
    const avgLocationWeight = (user1.preferences.locationWeight + user2.preferences.locationWeight) / 2;
    const avgInterestWeight = (user1.preferences.interestWeight + user2.preferences.interestWeight) / 2;
    const avgLanguageWeight = (user1.preferences.languageWeight + user2.preferences.languageWeight) / 2;

    return (
      ageScore * avgAgeWeight +
      locationScore * avgLocationWeight +
      interestScore * avgInterestWeight +
      languageScore * avgLanguageWeight +
      ethnicityScore * 0.05 // Ethnicity has minimal weight in total score
    );
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  private static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Find best matches for a user from the queue
   */
  static async findBestMatches(
    targetUserId: string,
    candidateUserIds: string[],
    maxMatches: number = 10
  ): Promise<Array<{ userId: string; score: MatchingScore }>> {
    try {
      // Get target user's data and preferences
      const targetData = await this.getUserMatchData(targetUserId);
      if (!targetData) return [];

      // Get candidate users' data
      const candidatePromises = candidateUserIds.map(id => this.getUserMatchData(id));
      const candidatesData = await Promise.all(candidatePromises);

      // Calculate scores for all candidates
      const matches = candidatesData
        .filter(candidate => candidate !== null)
        .map(candidate => ({
          userId: candidate!.userId,
          score: this.calculateMatchScore(targetData, candidate!)
        }))
        .filter(match => match.score.totalScore > 0.3) // Minimum compatibility threshold
        .sort((a, b) => b.score.totalScore - a.score.totalScore)
        .slice(0, maxMatches);

      return matches;
    } catch (error) {
      logger.error('Error finding best matches:', error as Error);
      return [];
    }
  }

  /**
   * Get user match data and preferences
   */
  private static async getUserMatchData(userId: string): Promise<UserMatchData | null> {
    try {
      // This would typically fetch from user-service API
      // For now, we'll fetch from the queue entry and preferences
      const queueEntry = await prisma.queueEntry.findFirst({
        where: { userId }
      });

      const preferences = await prisma.userMatchingPreferences.findUnique({
        where: { userId }
      });

      if (!queueEntry) return null;

      return {
        userId,
        age: queueEntry.age || undefined,
        latitude: queueEntry.latitude || undefined,
        longitude: queueEntry.longitude || undefined,
        interests: queueEntry.interests as string[],
        languages: queueEntry.languages as string[],
        ethnicity: queueEntry.ethnicity || undefined,
        preferences: {
          minAge: preferences?.minAge || 18,
          maxAge: preferences?.maxAge || 65,
          maxRadius: preferences?.maxRadius || 50,
          preferredInterests: (preferences?.preferredInterests as string[]) || [],
          preferredLanguages: (preferences?.preferredLanguages as string[]) || [],
          preferredEthnicities: (preferences?.preferredEthnicities as string[]) || [],
          ethnicityImportance: preferences?.ethnicityImportance || 0.0,
          ageWeight: preferences?.ageWeight || 0.3,
          locationWeight: preferences?.locationWeight || 0.4,
          interestWeight: preferences?.interestWeight || 0.2,
          languageWeight: preferences?.languageWeight || 0.1
        }
      };
    } catch (error) {
      logger.error(`Error getting user match data for ${userId}:`, error as Error);
      return null;
    }
  }
}