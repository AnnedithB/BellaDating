import { GraphQLContext } from '../types';
import { GraphQLError } from 'graphql';
import axios from 'axios';
import { config } from '../config';

// Default preferences for new users
const DEFAULT_PREFERENCES = {
  ageMin: 18,
  ageMax: 65,
  maxDistance: 50,
  interestedIn: 'Everyone',
  connectionType: 'Dating',
  lookingFor: ['Dating'],
  showOnDiscovery: true,
};

export const preferencesResolvers = {
  Query: {
    myDiscoveryPreferences: async (_: any, __: any, context: GraphQLContext) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }

      try {
        // Fetch profile from user-service (preferences are part of profile)
        const response = await axios.get(
          `${config.services.user}/profile`,
          {
            headers: {
              Authorization: context.auth.token ? `Bearer ${context.auth.token}` : '',
            },
          }
        );

        // Preferences are returned as part of the profile object
        const prefs = response.data?.data?.profile || response.data?.data || response.data;

        // Map backend preferences to our schema
        return {
          id: `pref_${context.auth.user.id}`,
          userId: context.auth.user.id,
          ageMin: prefs.preferredMinAge ?? DEFAULT_PREFERENCES.ageMin,
          ageMax: prefs.preferredMaxAge ?? DEFAULT_PREFERENCES.ageMax,
          maxDistance: prefs.maxDistance ?? DEFAULT_PREFERENCES.maxDistance,
          interestedIn: mapGendersToInterestedIn(prefs.preferredGenders),
          connectionType: prefs.connectionType ?? DEFAULT_PREFERENCES.connectionType,
          lookingFor: prefs.preferredRelationshipIntents
            ? mapIntentsToLookingFor(prefs.preferredRelationshipIntents)
            : DEFAULT_PREFERENCES.lookingFor,
          showOnDiscovery: prefs.showOnDiscovery ?? DEFAULT_PREFERENCES.showOnDiscovery,
          updatedAt: prefs.updatedAt || new Date().toISOString(),
        };
      } catch (error: any) {
        // If preferences don't exist yet, return defaults
        if (error.response?.status === 404) {
          return {
            id: `pref_${context.auth.user.id}`,
            userId: context.auth.user.id,
            ...DEFAULT_PREFERENCES,
            updatedAt: new Date().toISOString(),
          };
        }
        console.error('Error fetching preferences:', error.message);
        // Return defaults on error
        return {
          id: `pref_${context.auth.user.id}`,
          userId: context.auth.user.id,
          ...DEFAULT_PREFERENCES,
          updatedAt: new Date().toISOString(),
        };
      }
    },
  },

  Mutation: {
    updateDiscoveryPreferences: async (
      _: any,
      { input }: { input: any },
      context: GraphQLContext
    ) => {
      if (!context.auth.user) {
        throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
      }

      try {
        // Map our schema to backend format
        const backendPayload: any = {};

        if (input.ageMin !== undefined) {
          backendPayload.preferredMinAge = input.ageMin;
        }
        if (input.ageMax !== undefined) {
          backendPayload.preferredMaxAge = input.ageMax;
        }
        if (input.maxDistance !== undefined) {
          backendPayload.maxDistance = input.maxDistance;
        }
        if (input.interestedIn !== undefined) {
          backendPayload.preferredGenders = mapInterestedInToGenders(input.interestedIn);
        }
        if (input.connectionType !== undefined) {
          backendPayload.connectionType = input.connectionType;
        }
        if (input.lookingFor !== undefined) {
          backendPayload.preferredRelationshipIntents = mapLookingForToIntents(input.lookingFor);
        }
        if (input.showOnDiscovery !== undefined) {
          backendPayload.showOnDiscovery = input.showOnDiscovery;
        }

        // Update via user-service
        const response = await axios.put(
          `${config.services.user}/profile/preferences`,
          backendPayload,
          {
            headers: {
              Authorization: context.auth.token ? `Bearer ${context.auth.token}` : '',
              'Content-Type': 'application/json',
            },
          }
        );

        const prefs = response.data?.data || response.data;

        return {
          id: `pref_${context.auth.user.id}`,
          userId: context.auth.user.id,
          ageMin: prefs.preferredMinAge ?? input.ageMin ?? DEFAULT_PREFERENCES.ageMin,
          ageMax: prefs.preferredMaxAge ?? input.ageMax ?? DEFAULT_PREFERENCES.ageMax,
          maxDistance: prefs.maxDistance ?? input.maxDistance ?? DEFAULT_PREFERENCES.maxDistance,
          interestedIn: input.interestedIn ?? mapGendersToInterestedIn(prefs.preferredGenders),
          connectionType: prefs.connectionType ?? input.connectionType ?? DEFAULT_PREFERENCES.connectionType,
          lookingFor: input.lookingFor ?? (prefs.preferredRelationshipIntents
            ? mapIntentsToLookingFor(prefs.preferredRelationshipIntents)
            : DEFAULT_PREFERENCES.lookingFor),
          showOnDiscovery: prefs.showOnDiscovery ?? input.showOnDiscovery ?? DEFAULT_PREFERENCES.showOnDiscovery,
          updatedAt: new Date().toISOString(),
        };
      } catch (error: any) {
        console.error('Error updating preferences:', error.response?.data || error.message);
        throw new GraphQLError('Failed to update preferences', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' },
        });
      }
    },
  },
};

// Helper functions to map between frontend and backend formats
function mapGendersToInterestedIn(genders: string[] | undefined): string {
  if (!genders || genders.length === 0) {
    return 'Everyone';
  }
  // Handle both uppercase (backend) and lowercase (legacy) formats
  const normalizedGenders = genders.map(g => g.toUpperCase());
  if (normalizedGenders.includes('MAN') && normalizedGenders.includes('WOMAN')) {
    return 'Everyone';
  }
  if (normalizedGenders.includes('MAN')) {
    return 'Men';
  }
  if (normalizedGenders.includes('WOMAN')) {
    return 'Women';
  }
  return 'Everyone';
}

function mapInterestedInToGenders(interestedIn: string): string[] {
  switch (interestedIn) {
    case 'Men':
      return ['MAN'];
    case 'Women':
      return ['WOMAN'];
    case 'Everyone':
    default:
      return ['MAN', 'WOMAN', 'NONBINARY'];
  }
}

// Map frontend "lookingFor" display strings to backend enum values
function mapLookingForToIntents(lookingFor: string[]): string[] {
  const mapping: Record<string, string> = {
    // Frontend display strings -> Backend enum values
    'A long-term relationship': 'LONG_TERM',
    'Long-term relationship': 'LONG_TERM',
    'Casual Dates': 'CASUAL_DATES',
    'Marriage': 'MARRIAGE',
    'Intimacy': 'INTIMACY',
    'Intimacy Without Commitment': 'INTIMACY_NO_COMMITMENT',
    'Life Partner': 'LIFE_PARTNER',
    'Ethical Non-Monogamy': 'ETHICAL_NON_MONOGAMY',
    // Also handle if already in enum format
    'LONG_TERM': 'LONG_TERM',
    'CASUAL_DATES': 'CASUAL_DATES',
    'MARRIAGE': 'MARRIAGE',
    'INTIMACY': 'INTIMACY',
    'INTIMACY_NO_COMMITMENT': 'INTIMACY_NO_COMMITMENT',
    'LIFE_PARTNER': 'LIFE_PARTNER',
    'ETHICAL_NON_MONOGAMY': 'ETHICAL_NON_MONOGAMY',
    // Handle generic "Dating" as casual dates
    'Dating': 'CASUAL_DATES',
  };

  return lookingFor
    .map(item => mapping[item] || item)
    .filter(item => [
      'LONG_TERM', 'CASUAL_DATES', 'MARRIAGE', 'INTIMACY',
      'INTIMACY_NO_COMMITMENT', 'LIFE_PARTNER', 'ETHICAL_NON_MONOGAMY'
    ].includes(item));
}

// Map backend enum values to frontend display strings
function mapIntentsToLookingFor(intents: string[]): string[] {
  const mapping: Record<string, string> = {
    'LONG_TERM': 'A long-term relationship',
    'CASUAL_DATES': 'Casual Dates',
    'MARRIAGE': 'Marriage',
    'INTIMACY': 'Intimacy',
    'INTIMACY_NO_COMMITMENT': 'Intimacy Without Commitment',
    'LIFE_PARTNER': 'Life Partner',
    'ETHICAL_NON_MONOGAMY': 'Ethical Non-Monogamy',
  };

  return intents.map(intent => mapping[intent] || intent);
}
