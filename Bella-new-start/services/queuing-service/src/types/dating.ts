// Dating-specific type definitions for enhanced matching

export type DatingGender = 'MAN' | 'WOMAN' | 'NONBINARY';

export type RelationshipIntent = 
  | 'LONG_TERM' 
  | 'CASUAL_DATES' 
  | 'MARRIAGE' 
  | 'INTIMACY' 
  | 'INTIMACY_NO_COMMITMENT' 
  | 'LIFE_PARTNER' 
  | 'ETHICAL_NON_MONOGAMY';

export type FamilyPlans = 
  | 'HAS_KIDS_WANTS_MORE' 
  | 'HAS_KIDS_DOESNT_WANT_MORE' 
  | 'DOESNT_HAVE_KIDS_WANTS_KIDS' 
  | 'DOESNT_HAVE_KIDS_DOESNT_WANT_KIDS' 
  | 'NOT_SURE_YET';

export type Religion = 
  | 'AGNOSTIC' 
  | 'ATHEIST' 
  | 'BUDDHIST' 
  | 'CATHOLIC' 
  | 'CHRISTIAN' 
  | 'HINDU' 
  | 'JEWISH' 
  | 'MUSLIM' 
  | 'SPIRITUAL' 
  | 'OTHER';

export type EducationLevel = 
  | 'HIGH_SCHOOL' 
  | 'IN_COLLEGE' 
  | 'UNDERGRADUATE' 
  | 'IN_GRAD_SCHOOL' 
  | 'POSTGRADUATE';

export type PoliticalView = 
  | 'LIBERAL' 
  | 'MODERATE' 
  | 'CONSERVATIVE' 
  | 'APOLITICAL' 
  | 'OTHER';

export type LifestyleHabit = 
  | 'FREQUENTLY' 
  | 'SOCIALLY' 
  | 'RARELY' 
  | 'NEVER';

export interface DatingPreferences {
  // Basic preferences
  minAge: number;
  maxAge: number;
  maxRadius: number;
  preferredInterests: string[];
  preferredLanguages: string[];
  preferredEthnicities: string[];
  ethnicityImportance: number;
  
  // Dating-specific preferences
  preferredGenders: DatingGender[];
  preferredRelationshipIntents: RelationshipIntent[];
  preferredFamilyPlans: FamilyPlans[];
  preferredReligions: Religion[];
  preferredEducationLevels: EducationLevel[];
  preferredPoliticalViews: PoliticalView[];
  preferredExerciseHabits: LifestyleHabit[];
  preferredSmokingHabits: LifestyleHabit[];
  preferredDrinkingHabits: LifestyleHabit[];
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
}

export interface DatingProfile {
  userId: string;
  age?: number;
  latitude?: number;
  longitude?: number;
  interests: string[];
  languages: string[];
  ethnicity?: string;
  
  // Dating-specific attributes
  gender?: DatingGender;
  relationshipIntents: RelationshipIntent[];
  familyPlans?: FamilyPlans;
  religion?: Religion;
  educationLevel?: EducationLevel;
  politicalViews?: PoliticalView;
  exercise?: LifestyleHabit;
  smoking?: LifestyleHabit;
  drinking?: LifestyleHabit;
  isPremiumUser: boolean;
  
  preferences: DatingPreferences;
}

export interface DatingCompatibilityScore {
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

export interface DatingMatch {
  userId: string;
  matchId: string;
  compatibility: {
    totalScore: number;
    breakdown: {
      ageCompatibility: number;
      locationCompatibility: number;
      interestCompatibility: number;
      genderCompatibility: number;
      relationshipIntentCompatibility: number;
      lifestyleCompatibility: number;
      premiumBonus: number;
    };
  };
}

export interface DatingMatchingRequest {
  userId: string;
  intent?: string;
  maxMatches?: number;
}

export interface DatingMatchingResponse {
  status: 'success' | 'error';
  data?: {
    matches: DatingMatch[];
    algorithm: string;
    timestamp: string;
  };
  message?: string;
}