import { PrismaClient } from '@prisma/client';
import { createLogger } from '../utils/logger';
import { 
  DatingGender, 
  RelationshipIntent, 
  FamilyPlans, 
  Religion, 
  EducationLevel, 
  PoliticalView, 
  LifestyleHabit,
  DatingProfile,
  DatingCompatibilityScore
} from '../types/dating';

const prisma = new PrismaClient();
const logger = createLogger('dating-matching-algorithm');

export interface DatingMatchingScore {
  totalScore: number;
  // Basic compatibility scores
  ageScore: number;
  locationScore: number;
  interestScore: number;
  languageScore: number;
  ethnicityScore: number;
  // Dating-specific compatibility scores
  genderCompatScore: number;
  relationshipIntentScore: number;
  familyPlansScore: number;
  religionScore: number;
  educationScore: number;
  politicalScore: number;
  lifestyleScore: number;
  premiumBonus: number;
}

export interface DatingUserMatchData {
  userId: string;
  age?: number;
  latitude?: number;
  longitude?: number;
  interests: string[];
  languages: string[];
  ethnicity?: string;
  
  // Dating-specific attributes
  gender?: 'MAN' | 'WOMAN' | 'NONBINARY';
  relationshipIntents: string[];
  familyPlans?: string;
  religion?: string;
  educationLevel?: string;
  politicalViews?: string;
  exercise?: string;
  smoking?: string;
  drinking?: string;
  isPremiumUser: boolean;
  
  preferences: {
    // Basic preferences
    minAge: number;
    maxAge: number;
    maxRadius: number;
    preferredInterests: string[];
    preferredLanguages: string[];
    preferredEthnicities: string[];
    ethnicityImportance: number;
    
    // Dating-specific preferences
    preferredGenders: string[];
    preferredRelationshipIntents: string[];
    preferredFamilyPlans: string[];
    preferredReligions: string[];
    preferredEducationLevels: string[];
    preferredPoliticalViews: string[];
    preferredExerciseHabits: string[];
    preferredSmokingHabits: string[];
    preferredDrinkingHabits: string[];
    preferredMinAge?: number;
    preferredMaxAge?: number;
    
    // Matching weights
    ageWeight: number;
    locationWeight: number;
    interestWeight: number;
    languageWeight: number;
    genderWeight: number;
    relationshipIntentWeight: number;
    lifestyleWeight: number;
  };
}

export class DatingMatchingAlgorithm {
  
  /**
   * Calculate comprehensive dating compatibility score between two users
   */
  static calculateDatingMatchScore(user1: DatingUserMatchData, user2: DatingUserMatchData): DatingMatchingScore {
    // Basic compatibility scores
    const ageScore = this.calculateAgeScore(user1, user2);
    const locationScore = this.calculateLocationScore(user1, user2);
    const interestScore = this.calculateInterestScore(user1, user2);
    const languageScore = this.calculateLanguageScore(user1, user2);
    const ethnicityScore = this.calculateEthnicityScore(user1, user2);
    
    // Dating-specific compatibility scores
    const genderCompatScore = this.calculateGenderCompatScore(user1, user2);
    const relationshipIntentScore = this.calculateRelationshipIntentScore(user1, user2);
    const familyPlansScore = this.calculateFamilyPlansScore(user1, user2);
    const religionScore = this.calculateReligionScore(user1, user2);
    const educationScore = this.calculateEducationScore(user1, user2);
    const politicalScore = this.calculatePoliticalScore(user1, user2);
    const lifestyleScore = this.calculateLifestyleScore(user1, user2);
    const premiumBonus = this.calculatePremiumBonus(user1, user2);

    // Calculate weighted total score
    const totalScore = this.calculateWeightedDatingScore(
      user1,
      user2,
      {
        ageScore,
        locationScore,
        interestScore,
        languageScore,
        ethnicityScore,
        genderCompatScore,
        relationshipIntentScore,
        familyPlansScore,
        religionScore,
        educationScore,
        politicalScore,
        lifestyleScore,
        premiumBonus
      }
    );

    return {
      totalScore,
      ageScore,
      locationScore,
      interestScore,
      languageScore,
      ethnicityScore,
      genderCompatScore,
      relationshipIntentScore,
      familyPlansScore,
      religionScore,
      educationScore,
      politicalScore,
      lifestyleScore,
      premiumBonus
    };
  }

  /**
   * Calculate gender compatibility score - CRITICAL for dating matches
   */
  private static calculateGenderCompatScore(user1: DatingUserMatchData, user2: DatingUserMatchData): number {
    if (!user1.gender || !user2.gender) return 0.0; // No match if gender unknown
    
    // Check if each user's gender is in the other's preferred genders
    const user1PreferredGenders = new Set(user1.preferences.preferredGenders);
    const user2PreferredGenders = new Set(user2.preferences.preferredGenders);
    
    const user1AcceptsUser2 = user1PreferredGenders.size === 0 || user1PreferredGenders.has(user2.gender);
    const user2AcceptsUser1 = user2PreferredGenders.size === 0 || user2PreferredGenders.has(user1.gender);
    
    // Both must accept each other's gender for any compatibility
    if (!user1AcceptsUser2 || !user2AcceptsUser1) return 0.0;
    
    return 1.0; // Perfect match if mutual gender acceptance
  }

  /**
   * Calculate relationship intent compatibility score
   */
  private static calculateRelationshipIntentScore(user1: DatingUserMatchData, user2: DatingUserMatchData): number {
    const user1Intents = new Set(user1.relationshipIntents);
    const user2Intents = new Set(user2.relationshipIntents);
    const user1Preferred = new Set(user1.preferences.preferredRelationshipIntents);
    const user2Preferred = new Set(user2.preferences.preferredRelationshipIntents);

    // Find overlapping intents
    const commonIntents = new Set([...user1Intents].filter(x => user2Intents.has(x)));
    
    if (commonIntents.size === 0) return 0.0; // No common relationship goals
    
    // Check preference matches
    let preferenceScore = 0.5; // Base score for having common intents
    
    // Bonus for preferred intent matches
    const user1PreferredMatch = [...user1Preferred].some(x => user2Intents.has(x));
    const user2PreferredMatch = [...user2Preferred].some(x => user1Intents.has(x));
    
    if (user1PreferredMatch) preferenceScore += 0.25;
    if (user2PreferredMatch) preferenceScore += 0.25;
    
    return Math.min(1.0, preferenceScore);
  }

  /**
   * Calculate family plans compatibility score
   */
  private static calculateFamilyPlansScore(user1: DatingUserMatchData, user2: DatingUserMatchData): number {
    if (!user1.familyPlans || !user2.familyPlans) return 0.5; // Neutral if unknown
    
    const user1Preferred = new Set(user1.preferences.preferredFamilyPlans);
    const user2Preferred = new Set(user2.preferences.preferredFamilyPlans);
    
    // Direct compatibility matrix for family plans
    const compatibilityMatrix: { [key: string]: { [key: string]: number } } = {
      'HAS_KIDS_WANTS_MORE': {
        'HAS_KIDS_WANTS_MORE': 1.0,
        'HAS_KIDS_DOESNT_WANT_MORE': 0.3,
        'DOESNT_HAVE_KIDS_WANTS_KIDS': 0.8,
        'DOESNT_HAVE_KIDS_DOESNT_WANT_KIDS': 0.1,
        'NOT_SURE_YET': 0.6
      },
      'HAS_KIDS_DOESNT_WANT_MORE': {
        'HAS_KIDS_WANTS_MORE': 0.3,
        'HAS_KIDS_DOESNT_WANT_MORE': 1.0,
        'DOESNT_HAVE_KIDS_WANTS_KIDS': 0.2,
        'DOESNT_HAVE_KIDS_DOESNT_WANT_KIDS': 0.9,
        'NOT_SURE_YET': 0.5
      },
      'DOESNT_HAVE_KIDS_WANTS_KIDS': {
        'HAS_KIDS_WANTS_MORE': 0.8,
        'HAS_KIDS_DOESNT_WANT_MORE': 0.2,
        'DOESNT_HAVE_KIDS_WANTS_KIDS': 1.0,
        'DOESNT_HAVE_KIDS_DOESNT_WANT_KIDS': 0.1,
        'NOT_SURE_YET': 0.7
      },
      'DOESNT_HAVE_KIDS_DOESNT_WANT_KIDS': {
        'HAS_KIDS_WANTS_MORE': 0.1,
        'HAS_KIDS_DOESNT_WANT_MORE': 0.9,
        'DOESNT_HAVE_KIDS_WANTS_KIDS': 0.1,
        'DOESNT_HAVE_KIDS_DOESNT_WANT_KIDS': 1.0,
        'NOT_SURE_YET': 0.4
      },
      'NOT_SURE_YET': {
        'HAS_KIDS_WANTS_MORE': 0.6,
        'HAS_KIDS_DOESNT_WANT_MORE': 0.5,
        'DOESNT_HAVE_KIDS_WANTS_KIDS': 0.7,
        'DOESNT_HAVE_KIDS_DOESNT_WANT_KIDS': 0.4,
        'NOT_SURE_YET': 0.8
      }
    };
    
    let baseScore = compatibilityMatrix[user1.familyPlans]?.[user2.familyPlans] || 0.5;
    
    // Apply preference bonuses
    if (user1Preferred.size > 0 && user1Preferred.has(user2.familyPlans)) {
      baseScore = Math.min(1.0, baseScore + 0.2);
    }
    if (user2Preferred.size > 0 && user2Preferred.has(user1.familyPlans)) {
      baseScore = Math.min(1.0, baseScore + 0.2);
    }
    
    return baseScore;
  }

  /**
   * Calculate religion compatibility score
   */
  private static calculateReligionScore(user1: DatingUserMatchData, user2: DatingUserMatchData): number {
    if (!user1.religion || !user2.religion) return 0.6; // Neutral if unknown
    
    const user1Preferred = new Set(user1.preferences.preferredReligions);
    const user2Preferred = new Set(user2.preferences.preferredReligions);
    
    let score = 0.5; // Base neutral score
    
    // Same religion bonus
    if (user1.religion === user2.religion) {
      score += 0.3;
    }
    
    // Preference matches
    if (user1Preferred.size > 0 && user1Preferred.has(user2.religion)) {
      score += 0.2;
    }
    if (user2Preferred.size > 0 && user2Preferred.has(user1.religion)) {
      score += 0.2;
    }
    
    // Compatible religion pairs (higher tolerance)
    const compatiblePairs = new Set([
      'AGNOSTIC-ATHEIST', 'ATHEIST-AGNOSTIC',
      'SPIRITUAL-AGNOSTIC', 'AGNOSTIC-SPIRITUAL',
      'CHRISTIAN-CATHOLIC', 'CATHOLIC-CHRISTIAN'
    ]);
    
    const pair1 = `${user1.religion}-${user2.religion}`;
    const pair2 = `${user2.religion}-${user1.religion}`;
    
    if (compatiblePairs.has(pair1) || compatiblePairs.has(pair2)) {
      score = Math.max(score, 0.7);
    }
    
    return Math.min(1.0, score);
  }

  /**
   * Calculate education level compatibility score
   */
  private static calculateEducationScore(user1: DatingUserMatchData, user2: DatingUserMatchData): number {
    if (!user1.educationLevel || !user2.educationLevel) return 0.6; // Neutral if unknown
    
    const user1Preferred = new Set(user1.preferences.preferredEducationLevels);
    const user2Preferred = new Set(user2.preferences.preferredEducationLevels);
    
    // Education level hierarchy for compatibility
    const educationHierarchy: { [key: string]: number } = {
      'HIGH_SCHOOL': 1,
      'IN_COLLEGE': 2,
      'UNDERGRADUATE': 3,
      'IN_GRAD_SCHOOL': 4,
      'POSTGRADUATE': 5
    };
    
    const user1Level = educationHierarchy[user1.educationLevel] || 0;
    const user2Level = educationHierarchy[user2.educationLevel] || 0;
    
    let score = 0.5; // Base score
    
    // Same level bonus
    if (user1Level === user2Level) {
      score += 0.3;
    } else {
      // Proximity bonus (closer levels = higher score)
      const levelDifference = Math.abs(user1Level - user2Level);
      const proximityBonus = Math.max(0, 0.2 - (levelDifference * 0.05));
      score += proximityBonus;
    }
    
    // Preference matches
    if (user1Preferred.size > 0 && user1Preferred.has(user2.educationLevel)) {
      score += 0.2;
    }
    if (user2Preferred.size > 0 && user2Preferred.has(user1.educationLevel)) {
      score += 0.2;
    }
    
    return Math.min(1.0, score);
  }

  /**
   * Calculate political views compatibility score
   */
  private static calculatePoliticalScore(user1: DatingUserMatchData, user2: DatingUserMatchData): number {
    if (!user1.politicalViews || !user2.politicalViews) return 0.6; // Neutral if unknown
    
    const user1Preferred = new Set(user1.preferences.preferredPoliticalViews);
    const user2Preferred = new Set(user2.preferences.preferredPoliticalViews);
    
    // Political compatibility matrix
    const politicalCompatibility: { [key: string]: { [key: string]: number } } = {
      'LIBERAL': {
        'LIBERAL': 1.0,
        'MODERATE': 0.7,
        'CONSERVATIVE': 0.2,
        'APOLITICAL': 0.6,
        'OTHER': 0.5
      },
      'MODERATE': {
        'LIBERAL': 0.7,
        'MODERATE': 1.0,
        'CONSERVATIVE': 0.7,
        'APOLITICAL': 0.8,
        'OTHER': 0.6
      },
      'CONSERVATIVE': {
        'LIBERAL': 0.2,
        'MODERATE': 0.7,
        'CONSERVATIVE': 1.0,
        'APOLITICAL': 0.6,
        'OTHER': 0.5
      },
      'APOLITICAL': {
        'LIBERAL': 0.6,
        'MODERATE': 0.8,
        'CONSERVATIVE': 0.6,
        'APOLITICAL': 1.0,
        'OTHER': 0.7
      },
      'OTHER': {
        'LIBERAL': 0.5,
        'MODERATE': 0.6,
        'CONSERVATIVE': 0.5,
        'APOLITICAL': 0.7,
        'OTHER': 0.8
      }
    };
    
    let baseScore = politicalCompatibility[user1.politicalViews]?.[user2.politicalViews] || 0.5;
    
    // Apply preference bonuses
    if (user1Preferred.size > 0 && user1Preferred.has(user2.politicalViews)) {
      baseScore = Math.min(1.0, baseScore + 0.2);
    }
    if (user2Preferred.size > 0 && user2Preferred.has(user1.politicalViews)) {
      baseScore = Math.min(1.0, baseScore + 0.2);
    }
    
    return baseScore;
  }

  /**
   * Calculate lifestyle compatibility score (exercise, smoking, drinking)
   */
  private static calculateLifestyleScore(user1: DatingUserMatchData, user2: DatingUserMatchData): number {
    let totalScore = 0;
    let componentCount = 0;
    
    // Exercise compatibility
    if (user1.exercise && user2.exercise) {
      totalScore += this.calculateLifestyleComponentScore(
        user1.exercise,
        user2.exercise,
        user1.preferences.preferredExerciseHabits,
        user2.preferences.preferredExerciseHabits
      );
      componentCount++;
    }
    
    // Smoking compatibility
    if (user1.smoking && user2.smoking) {
      totalScore += this.calculateLifestyleComponentScore(
        user1.smoking,
        user2.smoking,
        user1.preferences.preferredSmokingHabits,
        user2.preferences.preferredSmokingHabits
      );
      componentCount++;
    }
    
    // Drinking compatibility
    if (user1.drinking && user2.drinking) {
      totalScore += this.calculateLifestyleComponentScore(
        user1.drinking,
        user2.drinking,
        user1.preferences.preferredDrinkingHabits,
        user2.preferences.preferredDrinkingHabits
      );
      componentCount++;
    }
    
    return componentCount > 0 ? totalScore / componentCount : 0.6; // Average or neutral
  }

  /**
   * Helper method for individual lifestyle component scoring
   */
  private static calculateLifestyleComponentScore(
    user1Habit: string,
    user2Habit: string,
    user1Preferred: string[],
    user2Preferred: string[]
  ): number {
    // Lifestyle compatibility matrix
    const lifestyleCompatibility: { [key: string]: { [key: string]: number } } = {
      'FREQUENTLY': {
        'FREQUENTLY': 1.0,
        'SOCIALLY': 0.7,
        'RARELY': 0.3,
        'NEVER': 0.1
      },
      'SOCIALLY': {
        'FREQUENTLY': 0.7,
        'SOCIALLY': 1.0,
        'RARELY': 0.8,
        'NEVER': 0.4
      },
      'RARELY': {
        'FREQUENTLY': 0.3,
        'SOCIALLY': 0.8,
        'RARELY': 1.0,
        'NEVER': 0.9
      },
      'NEVER': {
        'FREQUENTLY': 0.1,
        'SOCIALLY': 0.4,
        'RARELY': 0.9,
        'NEVER': 1.0
      }
    };
    
    let baseScore = lifestyleCompatibility[user1Habit]?.[user2Habit] || 0.5;
    
    // Apply preference bonuses
    const user1PreferredSet = new Set(user1Preferred);
    const user2PreferredSet = new Set(user2Preferred);
    
    if (user1PreferredSet.size > 0 && user1PreferredSet.has(user2Habit)) {
      baseScore = Math.min(1.0, baseScore + 0.2);
    }
    if (user2PreferredSet.size > 0 && user2PreferredSet.has(user1Habit)) {
      baseScore = Math.min(1.0, baseScore + 0.2);
    }
    
    return baseScore;
  }

  /**
   * Calculate premium user bonus
   */
  private static calculatePremiumBonus(user1: DatingUserMatchData, user2: DatingUserMatchData): number {
    let bonus = 0;
    
    // Premium users get priority in matching
    if (user1.isPremiumUser) bonus += 0.1;
    if (user2.isPremiumUser) bonus += 0.1;
    
    // Extra bonus if both are premium (exclusive premium matching)
    if (user1.isPremiumUser && user2.isPremiumUser) bonus += 0.15;
    
    return Math.min(0.25, bonus); // Cap at 25% bonus
  }

  /**
   * Calculate age compatibility score with dating-specific logic
   */
  private static calculateAgeScore(user1: DatingUserMatchData, user2: DatingUserMatchData): number {
    if (!user1.age || !user2.age) return 0.5; // Neutral score if age unknown

    // Use dating-specific age preferences if available
    const user1MinAge = user1.preferences.preferredMinAge || user1.preferences.minAge;
    const user1MaxAge = user1.preferences.preferredMaxAge || user1.preferences.maxAge;
    const user2MinAge = user2.preferences.preferredMinAge || user2.preferences.minAge;
    const user2MaxAge = user2.preferences.preferredMaxAge || user2.preferences.maxAge;

    // Check if users are within each other's preferred age ranges
    const user1InUser2Range = user2.age >= user1MinAge && user2.age <= user1MaxAge;
    const user2InUser1Range = user1.age >= user2MinAge && user1.age <= user2MaxAge;

    if (!user1InUser2Range || !user2InUser1Range) return 0.0;

    // Calculate closeness in age (bonus for similar ages)
    const ageDifference = Math.abs(user1.age - user2.age);
    const maxAgeDifference = Math.max(user1MaxAge - user1MinAge, user2MaxAge - user2MinAge);

    return Math.max(0, 1 - (ageDifference / maxAgeDifference));
  }

  /**
   * Calculate location compatibility score (same as original)
   */
  private static calculateLocationScore(user1: DatingUserMatchData, user2: DatingUserMatchData): number {
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
   * Calculate interest compatibility score (same as original)
   */
  private static calculateInterestScore(user1: DatingUserMatchData, user2: DatingUserMatchData): number {
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
   * Calculate language compatibility score (same as original)
   */
  private static calculateLanguageScore(user1: DatingUserMatchData, user2: DatingUserMatchData): number {
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
   * Calculate ethnicity compatibility score (same as original)
   */
  private static calculateEthnicityScore(user1: DatingUserMatchData, user2: DatingUserMatchData): number {
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
   * Calculate weighted total score with dating-specific weights
   */
  private static calculateWeightedDatingScore(
    user1: DatingUserMatchData,
    user2: DatingUserMatchData,
    scores: {
      ageScore: number;
      locationScore: number;
      interestScore: number;
      languageScore: number;
      ethnicityScore: number;
      genderCompatScore: number;
      relationshipIntentScore: number;
      familyPlansScore: number;
      religionScore: number;
      educationScore: number;
      politicalScore: number;
      lifestyleScore: number;
      premiumBonus: number;
    }
  ): number {
    // Average the weights from both users
    const avgAgeWeight = (user1.preferences.ageWeight + user2.preferences.ageWeight) / 2;
    const avgLocationWeight = (user1.preferences.locationWeight + user2.preferences.locationWeight) / 2;
    const avgInterestWeight = (user1.preferences.interestWeight + user2.preferences.interestWeight) / 2;
    const avgLanguageWeight = (user1.preferences.languageWeight + user2.preferences.languageWeight) / 2;
    const avgGenderWeight = (user1.preferences.genderWeight + user2.preferences.genderWeight) / 2;
    const avgRelationshipWeight = (user1.preferences.relationshipIntentWeight + user2.preferences.relationshipIntentWeight) / 2;
    const avgLifestyleWeight = (user1.preferences.lifestyleWeight + user2.preferences.lifestyleWeight) / 2;

    // Calculate base weighted score
    const baseScore = (
      scores.ageScore * avgAgeWeight +
      scores.locationScore * avgLocationWeight +
      scores.interestScore * avgInterestWeight +
      scores.languageScore * avgLanguageWeight +
      scores.genderCompatScore * avgGenderWeight +
      scores.relationshipIntentScore * avgRelationshipWeight +
      scores.lifestyleScore * avgLifestyleWeight +
      scores.ethnicityScore * 0.02 + // Minimal weight for ethnicity
      scores.familyPlansScore * 0.08 + // Family plans important for long-term
      scores.religionScore * 0.05 + // Religion moderate importance
      scores.educationScore * 0.03 + // Education lower importance
      scores.politicalScore * 0.03   // Political views lower importance
    );

    // Add premium bonus
    return Math.min(1.0, baseScore + scores.premiumBonus);
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
   * Find best dating matches for a user from the queue with premium prioritization
   */
  static async findBestDatingMatches(
    targetUserId: string,
    candidateUserIds: string[],
    maxMatches: number = 10,
    intent: string = 'CASUAL'
  ): Promise<Array<{ userId: string; score: DatingMatchingScore }>> {
    try {
      // Get target user's data and preferences
      const targetData = await this.getDatingUserMatchData(targetUserId);
      if (!targetData) return [];

      // Filter candidates by intent if it's dating-specific
      let filteredCandidates = candidateUserIds;
      if (intent === 'SERIOUS' || intent === 'CASUAL') {
        // For dating intents, we can apply more specific filters
        // This would be implemented based on your specific intent logic
      }

      // Get candidate users' data
      const candidatePromises = filteredCandidates.map(id => this.getDatingUserMatchData(id));
      const candidatesData = await Promise.all(candidatePromises);

      // Calculate scores for all candidates
      const matches = candidatesData
        .filter(candidate => candidate !== null)
        .map(candidate => ({
          userId: candidate!.userId,
          score: this.calculateDatingMatchScore(targetData, candidate!)
        }))
        .filter(match => {
          // Higher minimum threshold for dating matches
          const minScore = match.score.genderCompatScore > 0 ? 0.4 : 0.0; // Must have gender compatibility
          return match.score.totalScore > minScore;
        })
        .sort((a, b) => {
          // Sort by total score, but prioritize premium users
          const aIsPremium = candidatesData.find(c => c?.userId === a.userId)?.isPremiumUser || false;
          const bIsPremium = candidatesData.find(c => c?.userId === b.userId)?.isPremiumUser || false;
          
          if (aIsPremium && !bIsPremium) return -1;
          if (!aIsPremium && bIsPremium) return 1;
          
          return b.score.totalScore - a.score.totalScore;
        })
        .slice(0, maxMatches);

      return matches;
    } catch (error) {
      logger.error('Error finding best dating matches:', error as Error);
      return [];
    }
  }

  /**
   * Get dating-specific user match data and preferences
   */
  private static async getDatingUserMatchData(userId: string): Promise<DatingUserMatchData | null> {
    try {
      // Fetch from queue entry and preferences
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
        
        // Dating-specific attributes
        gender: queueEntry.gender as 'MAN' | 'WOMAN' | 'NONBINARY' || undefined,
        relationshipIntents: queueEntry.relationshipIntents as string[],
        familyPlans: queueEntry.familyPlans || undefined,
        religion: queueEntry.religion || undefined,
        educationLevel: queueEntry.educationLevel || undefined,
        politicalViews: queueEntry.politicalViews || undefined,
        exercise: queueEntry.exercise || undefined,
        smoking: queueEntry.smoking || undefined,
        drinking: queueEntry.drinking || undefined,
        isPremiumUser: queueEntry.isPremiumUser,
        
        preferences: {
          // Basic preferences
          minAge: preferences?.minAge || 18,
          maxAge: preferences?.maxAge || 65,
          maxRadius: preferences?.maxRadius || 50,
          preferredInterests: (preferences?.preferredInterests as string[]) || [],
          preferredLanguages: (preferences?.preferredLanguages as string[]) || [],
          preferredEthnicities: (preferences?.preferredEthnicities as string[]) || [],
          ethnicityImportance: preferences?.ethnicityImportance || 0.0,
          
          // Dating-specific preferences
          preferredGenders: (preferences?.preferredGenders as string[]) || [],
          preferredRelationshipIntents: (preferences?.preferredRelationshipIntents as string[]) || [],
          preferredFamilyPlans: (preferences?.preferredFamilyPlans as string[]) || [],
          preferredReligions: (preferences?.preferredReligions as string[]) || [],
          preferredEducationLevels: (preferences?.preferredEducationLevels as string[]) || [],
          preferredPoliticalViews: (preferences?.preferredPoliticalViews as string[]) || [],
          preferredExerciseHabits: (preferences?.preferredExerciseHabits as string[]) || [],
          preferredSmokingHabits: (preferences?.preferredSmokingHabits as string[]) || [],
          preferredDrinkingHabits: (preferences?.preferredDrinkingHabits as string[]) || [],
          preferredMinAge: preferences?.preferredMinAge || undefined,
          preferredMaxAge: preferences?.preferredMaxAge || undefined,
          
          // Matching weights
          ageWeight: preferences?.ageWeight || 0.15,
          locationWeight: preferences?.locationWeight || 0.20,
          interestWeight: preferences?.interestWeight || 0.10,
          languageWeight: preferences?.languageWeight || 0.05,
          genderWeight: preferences?.genderWeight || 0.25,
          relationshipIntentWeight: preferences?.relationshipIntentWeight || 0.15,
          lifestyleWeight: preferences?.lifestyleWeight || 0.10
        }
      };
    } catch (error) {
      logger.error(`Error getting dating user match data for ${userId}:`, error as Error);
      return null;
    }
  }
}