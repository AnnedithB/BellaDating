// Test file to validate the dating matching algorithm logic
import { DatingMatchingAlgorithm } from './src/algorithms/datingMatching';

// Mock test data
const testUser1 = {
  userId: 'user1',
  age: 28,
  latitude: 37.7749,
  longitude: -122.4194,
  interests: ['hiking', 'reading', 'cooking'],
  languages: ['English', 'Spanish'],
  ethnicity: 'Hispanic',
  
  // Dating-specific attributes
  gender: 'MAN' as const,
  relationshipIntents: ['LONG_TERM', 'MARRIAGE'],
  familyPlans: 'DOESNT_HAVE_KIDS_WANTS_KIDS' as const,
  religion: 'CHRISTIAN' as const,
  educationLevel: 'POSTGRADUATE' as const,
  politicalViews: 'MODERATE' as const,
  exercise: 'FREQUENTLY' as const,
  smoking: 'NEVER' as const,
  drinking: 'SOCIALLY' as const,
  isPremiumUser: true,
  
  preferences: {
    // Basic preferences
    minAge: 24,
    maxAge: 35,
    maxRadius: 50,
    preferredInterests: ['hiking', 'travel'],
    preferredLanguages: ['English'],
    preferredEthnicities: ['Hispanic', 'Caucasian'],
    ethnicityImportance: 0.3,
    
    // Dating-specific preferences
    preferredGenders: ['WOMAN'],
    preferredRelationshipIntents: ['LONG_TERM', 'MARRIAGE'],
    preferredFamilyPlans: ['DOESNT_HAVE_KIDS_WANTS_KIDS', 'NOT_SURE_YET'],
    preferredReligions: ['CHRISTIAN', 'CATHOLIC', 'SPIRITUAL'],
    preferredEducationLevels: ['UNDERGRADUATE', 'POSTGRADUATE'],
    preferredPoliticalViews: ['MODERATE', 'CONSERVATIVE'],
    preferredExerciseHabits: ['FREQUENTLY', 'SOCIALLY'],
    preferredSmokingHabits: ['NEVER'],
    preferredDrinkingHabits: ['SOCIALLY', 'RARELY'],
    preferredMinAge: 24,
    preferredMaxAge: 32,
    
    // Matching weights
    ageWeight: 0.15,
    locationWeight: 0.20,
    interestWeight: 0.10,
    languageWeight: 0.05,
    genderWeight: 0.25,
    relationshipIntentWeight: 0.15,
    lifestyleWeight: 0.10
  }
};

const testUser2 = {
  userId: 'user2',
  age: 26,
  latitude: 37.7849,
  longitude: -122.4094,
  interests: ['hiking', 'yoga', 'travel'],
  languages: ['English', 'French'],
  ethnicity: 'Caucasian',
  
  // Dating-specific attributes
  gender: 'WOMAN' as const,
  relationshipIntents: ['LONG_TERM'],
  familyPlans: 'DOESNT_HAVE_KIDS_WANTS_KIDS' as const,
  religion: 'SPIRITUAL' as const,
  educationLevel: 'UNDERGRADUATE' as const,
  politicalViews: 'MODERATE' as const,
  exercise: 'SOCIALLY' as const,
  smoking: 'NEVER' as const,
  drinking: 'RARELY' as const,
  isPremiumUser: false,
  
  preferences: {
    // Basic preferences
    minAge: 25,
    maxAge: 35,
    maxRadius: 40,
    preferredInterests: ['hiking', 'fitness'],
    preferredLanguages: ['English'],
    preferredEthnicities: ['Hispanic', 'Caucasian', 'Mixed'],
    ethnicityImportance: 0.2,
    
    // Dating-specific preferences
    preferredGenders: ['MAN'],
    preferredRelationshipIntents: ['LONG_TERM', 'MARRIAGE'],
    preferredFamilyPlans: ['DOESNT_HAVE_KIDS_WANTS_KIDS'],
    preferredReligions: ['CHRISTIAN', 'SPIRITUAL', 'AGNOSTIC'],
    preferredEducationLevels: ['UNDERGRADUATE', 'POSTGRADUATE'],
    preferredPoliticalViews: ['MODERATE', 'LIBERAL'],
    preferredExerciseHabits: ['FREQUENTLY', 'SOCIALLY'],
    preferredSmokingHabits: ['NEVER'],
    preferredDrinkingHabits: ['SOCIALLY', 'RARELY', 'NEVER'],
    preferredMinAge: 26,
    preferredMaxAge: 35,
    
    // Matching weights
    ageWeight: 0.15,
    locationWeight: 0.20,
    interestWeight: 0.10,
    languageWeight: 0.05,
    genderWeight: 0.25,
    relationshipIntentWeight: 0.15,
    lifestyleWeight: 0.10
  }
};

// Test the matching algorithm
console.log('Testing Dating Matching Algorithm...');
console.log('=====================================');

try {
  const compatibilityScore = DatingMatchingAlgorithm.calculateDatingMatchScore(testUser1, testUser2);
  
  console.log('Compatibility Score Results:');
  console.log(`Total Score: ${(compatibilityScore.totalScore * 100).toFixed(1)}%`);
  console.log('');
  console.log('Detailed Breakdown:');
  console.log(`- Age Compatibility: ${(compatibilityScore.ageScore * 100).toFixed(1)}%`);
  console.log(`- Location Compatibility: ${(compatibilityScore.locationScore * 100).toFixed(1)}%`);
  console.log(`- Interest Compatibility: ${(compatibilityScore.interestScore * 100).toFixed(1)}%`);
  console.log(`- Language Compatibility: ${(compatibilityScore.languageScore * 100).toFixed(1)}%`);
  console.log(`- Gender Compatibility: ${(compatibilityScore.genderCompatScore * 100).toFixed(1)}%`);
  console.log(`- Relationship Intent Compatibility: ${(compatibilityScore.relationshipIntentScore * 100).toFixed(1)}%`);
  console.log(`- Family Plans Compatibility: ${(compatibilityScore.familyPlansScore * 100).toFixed(1)}%`);
  console.log(`- Religion Compatibility: ${(compatibilityScore.religionScore * 100).toFixed(1)}%`);
  console.log(`- Education Compatibility: ${(compatibilityScore.educationScore * 100).toFixed(1)}%`);
  console.log(`- Political Compatibility: ${(compatibilityScore.politicalScore * 100).toFixed(1)}%`);
  console.log(`- Lifestyle Compatibility: ${(compatibilityScore.lifestyleScore * 100).toFixed(1)}%`);
  console.log(`- Premium Bonus: ${(compatibilityScore.premiumBonus * 100).toFixed(1)}%`);
  
  console.log('');
  
  // Test compatibility criteria
  const isGoodMatch = compatibilityScore.totalScore > 0.6;
  const hasGenderCompatibility = compatibilityScore.genderCompatScore > 0;
  const hasRelationshipAlignment = compatibilityScore.relationshipIntentScore > 0.5;
  
  console.log('Match Analysis:');
  console.log(`- Good Overall Match: ${isGoodMatch ? 'YES' : 'NO'}`);
  console.log(`- Gender Compatible: ${hasGenderCompatibility ? 'YES' : 'NO'}`);
  console.log(`- Relationship Goals Aligned: ${hasRelationshipAlignment ? 'YES' : 'NO'}`);
  
  if (isGoodMatch && hasGenderCompatibility) {
    console.log('');
    console.log('✅ MATCH RECOMMENDATION: These users are highly compatible!');
  } else {
    console.log('');
    console.log('❌ MATCH RECOMMENDATION: Low compatibility, not recommended.');
  }
  
} catch (error) {
  console.error('Error testing dating matching algorithm:', error);
}

export { testUser1, testUser2 };