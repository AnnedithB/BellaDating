/**
 * Utility function to merge base preferences (from Edit Profile) with filter preferences (from Discovery filters)
 * Filter preferences override base preferences when explicitly set
 */

export interface BasePreferences {
  preferredGenders?: string[];
  preferredMinAge?: number | null;
  preferredMaxAge?: number | null;
  preferredInterests?: string[];
  preferredLanguages?: string[];
  maxRadius?: number | null;
  maxDistance?: number | null;
  location?: string | null;
  preferredEducationLevels?: string[];
  preferredFamilyPlans?: string[];
  preferredReligions?: string[];
  preferredPoliticalViews?: string[];
  preferredDrinkingHabits?: string[];
  preferredSmokingHabits?: string[];
  preferredRelationshipIntents?: string[];
}

export interface FilterPreferences {
  ageRange?: {
    min?: number;
    max?: number;
  } | null;
  genderPreference?: string | null;
  interests?: string[] | null;
  languages?: string[] | null;
  maxDistance?: number | null;
  location?: string | null;
  preferredEducationLevels?: string[] | null;
  preferredFamilyPlans?: string[] | null;
  preferredReligions?: string[] | null;
  preferredPoliticalViews?: string[] | null;
  preferredDrinkingHabits?: string[] | null;
  preferredSmokingHabits?: string[] | null;
  preferredRelationshipIntents?: string[] | null;
}

export interface MergedPreferences {
  ageRange?: {
    min: number;
    max: number;
  };
  genderPreference?: string | null;
  interests?: string[];
  languages?: string[];
  maxDistance?: number;
  location?: string | null;
  preferredEducationLevels?: string[];
  preferredFamilyPlans?: string[];
  preferredReligions?: string[];
  preferredPoliticalViews?: string[];
  preferredDrinkingHabits?: string[];
  preferredSmokingHabits?: string[];
  preferredRelationshipIntents?: string[];
}

/**
 * Merges base preferences with filter preferences
 * Filter preferences override base preferences when set (not null/undefined/empty)
 * 
 * @param basePreferences - Base preferences from user profile (Edit Profile)
 * @param filterPreferences - Filter preferences from Discovery screen
 * @returns Merged preferences object
 */
export function mergePreferences(
  basePreferences: BasePreferences,
  filterPreferences?: FilterPreferences | null
): MergedPreferences {
  // If no filter preferences provided, use base preferences
  if (!filterPreferences) {
    return {
      ageRange: basePreferences.preferredMinAge !== null && basePreferences.preferredMaxAge !== null
        ? {
            min: basePreferences.preferredMinAge || 18,
            max: basePreferences.preferredMaxAge || 65,
          }
        : undefined,
      genderPreference: basePreferences.preferredGenders && basePreferences.preferredGenders.length > 0
        ? basePreferences.preferredGenders[0] // Use first preferred gender as default
        : null,
      interests: basePreferences.preferredInterests || [],
      languages: basePreferences.preferredLanguages || [],
      maxDistance: basePreferences.maxDistance || basePreferences.maxRadius || undefined,
      location: basePreferences.location || null,
      preferredEducationLevels: basePreferences.preferredEducationLevels || [],
      preferredFamilyPlans: basePreferences.preferredFamilyPlans || [],
      preferredReligions: basePreferences.preferredReligions || [],
      preferredPoliticalViews: basePreferences.preferredPoliticalViews || [],
      preferredDrinkingHabits: basePreferences.preferredDrinkingHabits || [],
      preferredSmokingHabits: basePreferences.preferredSmokingHabits || [],
      preferredRelationshipIntents: basePreferences.preferredRelationshipIntents || [],
    };
  }

  const merged: MergedPreferences = {};

  // Age Range: Use filter if set, otherwise use base
  if (filterPreferences.ageRange && 
      filterPreferences.ageRange.min !== undefined && 
      filterPreferences.ageRange.max !== undefined) {
    merged.ageRange = {
      min: filterPreferences.ageRange.min,
      max: filterPreferences.ageRange.max,
    };
  } else if (basePreferences.preferredMinAge !== null && 
             basePreferences.preferredMaxAge !== null) {
    merged.ageRange = {
      min: basePreferences.preferredMinAge || 18,
      max: basePreferences.preferredMaxAge || 65,
    };
  }

  // Gender Preference: Use filter if set, otherwise use base
  if (filterPreferences.genderPreference !== null && 
      filterPreferences.genderPreference !== undefined) {
    merged.genderPreference = filterPreferences.genderPreference;
  } else if (basePreferences.preferredGenders && basePreferences.preferredGenders.length > 0) {
    merged.genderPreference = basePreferences.preferredGenders[0];
  } else {
    merged.genderPreference = null;
  }

  // Interests: Use filter if array has items, otherwise use base
  if (filterPreferences.interests && 
      Array.isArray(filterPreferences.interests) && 
      filterPreferences.interests.length > 0) {
    merged.interests = filterPreferences.interests;
  } else {
    merged.interests = basePreferences.preferredInterests || [];
  }

  // Languages: Use filter if array has items, otherwise use base
  if (filterPreferences.languages && 
      Array.isArray(filterPreferences.languages) && 
      filterPreferences.languages.length > 0) {
    merged.languages = filterPreferences.languages;
  } else {
    merged.languages = basePreferences.preferredLanguages || [];
  }

  // Max Distance: Use filter if set, otherwise use base
  if (filterPreferences.maxDistance !== null && 
      filterPreferences.maxDistance !== undefined) {
    merged.maxDistance = filterPreferences.maxDistance;
  } else if (basePreferences.maxDistance !== null && 
             basePreferences.maxDistance !== undefined) {
    merged.maxDistance = basePreferences.maxDistance;
  } else if (basePreferences.maxRadius !== null && 
             basePreferences.maxRadius !== undefined) {
    merged.maxDistance = basePreferences.maxRadius;
  }

  // Location: Use filter if set, otherwise use base
  if (filterPreferences.location !== null && 
      filterPreferences.location !== undefined) {
    merged.location = filterPreferences.location;
  } else {
    merged.location = basePreferences.location || null;
  }

  // Advanced preferences: Use filter if set, otherwise use base
  if (filterPreferences.preferredEducationLevels && 
      Array.isArray(filterPreferences.preferredEducationLevels) && 
      filterPreferences.preferredEducationLevels.length > 0) {
    merged.preferredEducationLevels = filterPreferences.preferredEducationLevels;
  } else {
    merged.preferredEducationLevels = basePreferences.preferredEducationLevels || [];
  }

  if (filterPreferences.preferredFamilyPlans && 
      Array.isArray(filterPreferences.preferredFamilyPlans) && 
      filterPreferences.preferredFamilyPlans.length > 0) {
    merged.preferredFamilyPlans = filterPreferences.preferredFamilyPlans;
  } else {
    merged.preferredFamilyPlans = basePreferences.preferredFamilyPlans || [];
  }

  if (filterPreferences.preferredReligions && 
      Array.isArray(filterPreferences.preferredReligions) && 
      filterPreferences.preferredReligions.length > 0) {
    merged.preferredReligions = filterPreferences.preferredReligions;
  } else {
    merged.preferredReligions = basePreferences.preferredReligions || [];
  }

  if (filterPreferences.preferredPoliticalViews && 
      Array.isArray(filterPreferences.preferredPoliticalViews) && 
      filterPreferences.preferredPoliticalViews.length > 0) {
    merged.preferredPoliticalViews = filterPreferences.preferredPoliticalViews;
  } else {
    merged.preferredPoliticalViews = basePreferences.preferredPoliticalViews || [];
  }

  if (filterPreferences.preferredDrinkingHabits && 
      Array.isArray(filterPreferences.preferredDrinkingHabits) && 
      filterPreferences.preferredDrinkingHabits.length > 0) {
    merged.preferredDrinkingHabits = filterPreferences.preferredDrinkingHabits;
  } else {
    merged.preferredDrinkingHabits = basePreferences.preferredDrinkingHabits || [];
  }

  if (filterPreferences.preferredSmokingHabits && 
      Array.isArray(filterPreferences.preferredSmokingHabits) && 
      filterPreferences.preferredSmokingHabits.length > 0) {
    merged.preferredSmokingHabits = filterPreferences.preferredSmokingHabits;
  } else {
    merged.preferredSmokingHabits = basePreferences.preferredSmokingHabits || [];
  }

  if (filterPreferences.preferredRelationshipIntents && 
      Array.isArray(filterPreferences.preferredRelationshipIntents) && 
      filterPreferences.preferredRelationshipIntents.length > 0) {
    merged.preferredRelationshipIntents = filterPreferences.preferredRelationshipIntents;
  } else {
    merged.preferredRelationshipIntents = basePreferences.preferredRelationshipIntents || [];
  }

  return merged;
}

