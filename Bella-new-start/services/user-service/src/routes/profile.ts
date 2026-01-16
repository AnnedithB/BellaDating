import { Router } from 'express';
import multer from 'multer';
import { PrismaClient, Prisma } from '@prisma/client';
import { RedisClientType } from 'redis';
import { Logger } from '../utils/logger';
import {
  sanitizeDisplayName,
  sanitizeBio,
  isValidAge,
  createValidationError,
  createNotFoundError,
  createUnauthorizedError,
  generateFileName,
  asyncHandler
} from '../utils/helpers';
import { authMiddleware } from '../middleware/auth';
import { uploadFile } from '../services/fileUpload';
import { PhotoVerificationService } from '../services/photoVerificationService';
import axios from 'axios';
import { randomBytes } from 'crypto';
import fs from 'fs';
import path from 'path';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/gif,video/mp4,video/webm').split(',');
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

interface UpdateProfileRequest {
  displayName?: string;
  shortBio?: string;
  intent?: 'CASUAL' | 'FRIENDS' | 'SERIOUS' | 'NETWORKING';
  age?: number;
  birthday?: string | Date; // Accept birthday and convert to age
  locationCity?: string;
  locationCountry?: string;
  preferences?: Record<string, any>;
  interests?: string[]; // Allow interests to be passed directly

  // User's own attributes (stored in preferences JSON, not database columns)
  languages?: string[];
  ethnicity?: string;
  hasKids?: string | string[] | null;

  // Dating-specific fields
  gender?: 'MAN' | 'WOMAN' | 'NONBINARY';
  relationshipIntents?: ('LONG_TERM' | 'CASUAL_DATES' | 'MARRIAGE' | 'INTIMACY' | 'INTIMACY_NO_COMMITMENT' | 'LIFE_PARTNER' | 'ETHICAL_NON_MONOGAMY')[];
  familyPlans?: 'HAS_KIDS_WANTS_MORE' | 'HAS_KIDS_DOESNT_WANT_MORE' | 'DOESNT_HAVE_KIDS_WANTS_KIDS' | 'DOESNT_HAVE_KIDS_DOESNT_WANT_KIDS' | 'NOT_SURE_YET';
  religion?: 'AGNOSTIC' | 'ATHEIST' | 'BUDDHIST' | 'CATHOLIC' | 'CHRISTIAN' | 'HINDU' | 'JEWISH' | 'MUSLIM' | 'SPIRITUAL' | 'OTHER';
  educationLevel?: 'HIGH_SCHOOL' | 'IN_COLLEGE' | 'UNDERGRADUATE' | 'IN_GRAD_SCHOOL' | 'POSTGRADUATE';
  politicalViews?: 'LIBERAL' | 'MODERATE' | 'CONSERVATIVE' | 'APOLITICAL' | 'OTHER';
  exercise?: 'FREQUENTLY' | 'SOCIALLY' | 'RARELY' | 'NEVER';
  smoking?: 'FREQUENTLY' | 'SOCIALLY' | 'RARELY' | 'NEVER';
  drinking?: 'FREQUENTLY' | 'SOCIALLY' | 'RARELY' | 'NEVER';
}

interface UpdatePreferencesRequest {
  preferredGenders?: ('MAN' | 'WOMAN' | 'NONBINARY')[];
  preferredRelationshipIntents?: ('LONG_TERM' | 'CASUAL_DATES' | 'MARRIAGE' | 'INTIMACY' | 'INTIMACY_NO_COMMITMENT' | 'LIFE_PARTNER' | 'ETHICAL_NON_MONOGAMY')[];
  preferredFamilyPlans?: ('HAS_KIDS_WANTS_MORE' | 'HAS_KIDS_DOESNT_WANT_MORE' | 'DOESNT_HAVE_KIDS_WANTS_KIDS' | 'DOESNT_HAVE_KIDS_DOESNT_WANT_KIDS' | 'NOT_SURE_YET')[];
  preferredReligions?: ('AGNOSTIC' | 'ATHEIST' | 'BUDDHIST' | 'CATHOLIC' | 'CHRISTIAN' | 'HINDU' | 'JEWISH' | 'MUSLIM' | 'SPIRITUAL' | 'OTHER')[];
  preferredEducationLevels?: ('HIGH_SCHOOL' | 'IN_COLLEGE' | 'UNDERGRADUATE' | 'IN_GRAD_SCHOOL' | 'POSTGRADUATE')[];
  preferredPoliticalViews?: ('LIBERAL' | 'MODERATE' | 'CONSERVATIVE' | 'APOLITICAL' | 'OTHER')[];
  preferredExerciseHabits?: ('FREQUENTLY' | 'SOCIALLY' | 'RARELY' | 'NEVER')[];
  preferredSmokingHabits?: ('FREQUENTLY' | 'SOCIALLY' | 'RARELY' | 'NEVER')[];
  preferredDrinkingHabits?: ('FREQUENTLY' | 'SOCIALLY' | 'RARELY' | 'NEVER')[];
  preferredMinAge?: number;
  preferredMaxAge?: number;
}

export default function createProfileRoutes(
  prisma: PrismaClient,
  redis: RedisClientType,
  logger: Logger
): Router {

  // Helper to safely convert JSON photos/videos to arrays
  const getPhotosArray = (photos: any): string[] => {
    if (Array.isArray(photos)) return photos;
    if (typeof photos === 'string') {
      try {
        const parsed = JSON.parse(photos);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const getVideosArray = (videos: any): string[] => {
    if (Array.isArray(videos)) return videos;
    if (typeof videos === 'string') {
      try {
        const parsed = JSON.parse(videos);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };
  const router = Router();
  const photoVerificationService = new PhotoVerificationService(logger);

  // Helper to convert snake_case database columns to camelCase Prisma field names
  const convertProfileToPrismaFormat = (dbProfile: any): any => {
    if (!dbProfile) return null;

    // Parse preferences JSON if it's a string
    let preferences = dbProfile.preferences;
    if (typeof preferences === 'string') {
      try {
        preferences = JSON.parse(preferences);
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        logger.warn('Failed to parse preferences JSON', { userId: dbProfile.user_id, error: errorMessage });
        preferences = {};
      }
    }
    if (!preferences) preferences = {};

    // Extract fields from preferences - check multiple possible key names
    const languages = dbProfile.languages ||
      preferences?.languages ||
      preferences?.language ||
      (Array.isArray(preferences?.languages) ? preferences.languages : []);
    const ethnicity = dbProfile.ethnicity ||
      preferences?.ethnicity ||
      preferences?.ethnic ||
      null;
    const hasKids = dbProfile.has_kids !== undefined && dbProfile.has_kids !== null
      ? dbProfile.has_kids
      : (preferences?.hasKids !== undefined && preferences?.hasKids !== null
        ? preferences.hasKids
        : null);

    logger.info('convertProfileToPrismaFormat - Extracted fields', {
      userId: dbProfile.user_id,
      hasPreferences: !!preferences,
      preferencesKeys: preferences ? Object.keys(preferences) : [],
      languagesFromDb: dbProfile.languages,
      languagesFromPrefs: preferences?.languages || preferences?.language,
      languagesFinal: languages,
      ethnicityFromDb: dbProfile.ethnicity,
      ethnicityFromPrefs: preferences?.ethnicity || preferences?.ethnic,
      ethnicityFinal: ethnicity,
      hasKidsFromDb: dbProfile.has_kids,
      hasKidsFromPrefs: preferences?.hasKids,
      hasKidsFinal: hasKids,
    });

    return {
      id: dbProfile.id,
      userId: dbProfile.user_id,
      displayName: dbProfile.display_name,
      shortBio: dbProfile.short_bio,
      photos: dbProfile.photos,
      videos: dbProfile.videos,
      intent: dbProfile.intent,
      age: dbProfile.age,
      locationCity: dbProfile.location_city,
      locationCountry: dbProfile.location_country,
      preferences: preferences,
      // Convert gender from database lowercase enum to uppercase for API
      gender: dbProfile.gender ? dbProfile.gender.toUpperCase() : null,
      relationshipIntents: dbProfile.relationship_intents || [],
      familyPlans: dbProfile.family_plans,
      religion: dbProfile.religion,
      educationLevel: dbProfile.education_level,
      politicalViews: dbProfile.political_views,
      exercise: dbProfile.exercise,
      smoking: dbProfile.smoking,
      drinking: dbProfile.drinking,
      hasKids: hasKids,
      languages: languages,
      ethnicity: ethnicity,
      preferredGenders: dbProfile.preferred_genders || [],
      preferredRelationshipIntents: dbProfile.preferred_relationship_intents || [],
      preferredFamilyPlans: dbProfile.preferred_family_plans || [],
      preferredReligions: dbProfile.preferred_religions || [],
      preferredEducationLevels: dbProfile.preferred_education_levels || [],
      preferredPoliticalViews: dbProfile.preferred_political_views || [],
      preferredExerciseHabits: dbProfile.preferred_exercise_habits || [],
      preferredSmokingHabits: dbProfile.preferred_smoking_habits || [],
      preferredDrinkingHabits: dbProfile.preferred_drinking_habits || [],
      preferredMinAge: dbProfile.preferred_min_age,
      preferredMaxAge: dbProfile.preferred_max_age,
      isPremium: dbProfile.is_premium,
      createdAt: dbProfile.created_at,
      updatedAt: dbProfile.updated_at,
    };
  };

  // Helper function to safely fetch profile using raw SQL (bypasses Prisma type validation)
  // This is needed because database may have lowercase enum values that Prisma rejects
  const fetchProfileRaw = async (userId: string): Promise<any> => {
    try {
      // Escape SQL strings to prevent injection
      const escapeSql = (str: string) => str.replace(/'/g, "''");
      const result = await prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM profiles WHERE user_id = '${escapeSql(userId)}' LIMIT 1`
      );
      const dbProfile = result.length > 0 ? result[0] : null;

      logger.info('fetchProfileRaw - Raw database result', {
        userId,
        hasResult: !!dbProfile,
        display_name: dbProfile?.display_name,
        short_bio: dbProfile?.short_bio,
        age: dbProfile?.age,
        location_city: dbProfile?.location_city,
        location_country: dbProfile?.location_country,
        photos: dbProfile?.photos,
      });

      const converted = convertProfileToPrismaFormat(dbProfile);

      logger.info('fetchProfileRaw - Converted profile', {
        userId,
        displayName: converted?.displayName,
        shortBio: converted?.shortBio,
        age: converted?.age,
        locationCity: converted?.locationCity,
        locationCountry: converted?.locationCountry,
      });

      return converted;
    } catch (error: any) {
      logger.error('Raw profile fetch failed', {
        userId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  };

  // Helper function to safely update profile using raw SQL (bypasses Prisma enum validation)
  // This is needed because database may have lowercase enum values that Prisma rejects
  // Accepts Prisma-style camelCase field names and converts to database snake_case
  const updateProfileRaw = async (userId: string, updateData: any): Promise<any> => {
    try {
      // Escape SQL strings to prevent injection
      const escapeSql = (str: string) => str.replace(/'/g, "''");

      // Map Prisma camelCase field names to database snake_case column names
      const fieldMap: Record<string, string> = {
        displayName: 'display_name',
        shortBio: 'short_bio',
        locationCity: 'location_city',
        locationCountry: 'location_country',
        relationshipIntents: 'relationship_intents',
        familyPlans: 'family_plans',
        educationLevel: 'education_level',
        politicalViews: 'political_views',
        preferredGenders: 'preferred_genders',
        preferredRelationshipIntents: 'preferred_relationship_intents',
        preferredFamilyPlans: 'preferred_family_plans',
        preferredReligions: 'preferred_religions',
        preferredEducationLevels: 'preferred_education_levels',
        preferredPoliticalViews: 'preferred_political_views',
        preferredExerciseHabits: 'preferred_exercise_habits',
        preferredSmokingHabits: 'preferred_smoking_habits',
        preferredDrinkingHabits: 'preferred_drinking_habits',
        preferredMinAge: 'preferred_min_age',
        preferredMaxAge: 'preferred_max_age',
      };

      // Fields that are JSONB (not PostgreSQL arrays)
      const jsonbFields = new Set(['photos', 'videos', 'preferences']);

      // Fields that are PostgreSQL text arrays
      const arrayFields = new Set([
        'relationship_intents',
        'preferred_genders',
        'preferred_relationship_intents',
        'preferred_family_plans',
        'preferred_religions',
        'preferred_education_levels',
        'preferred_political_views',
        'preferred_exercise_habits',
        'preferred_smoking_habits',
        'preferred_drinking_habits',
      ]);

      // Handle intent separately using Prisma (to avoid enum casting issues)
      let intentValue: string | undefined = undefined;
      if (updateData.intent !== undefined) {
        intentValue = updateData.intent;
        delete updateData.intent; // Remove from updateData to handle separately
      }

      // Build SET clause for SQL UPDATE
      const setClauses: string[] = [];

      // Fields that should be skipped (handled separately or not supported)
      const skipFields = new Set(['id', 'userId', 'user_id', 'created_at', 'updated_at']);

      for (const [key, value] of Object.entries(updateData)) {
        // Skip undefined values and excluded fields
        if (value === undefined) continue;
        if (skipFields.has(key) || skipFields.has(fieldMap[key] || key)) continue;

        // Convert camelCase to snake_case for database column
        const dbColumn = fieldMap[key] || key;

        if (value === null) {
          setClauses.push(`${dbColumn} = NULL`);
        } else if (jsonbFields.has(dbColumn)) {
          // Handle JSONB fields (photos, videos, preferences)
          const jsonValue = JSON.stringify(value);
          setClauses.push(`${dbColumn} = '${escapeSql(jsonValue)}'::jsonb`);
        } else if (arrayFields.has(dbColumn)) {
          // Handle PostgreSQL array fields - format as PostgreSQL array literal
          if (Array.isArray(value) && value.length === 0) {
            setClauses.push(`${dbColumn} = '{}'::text[]`);
          } else if (Array.isArray(value)) {
            // Format as PostgreSQL array: ARRAY['value1','value2'] or use array literal
            // Escape each value and wrap in quotes
            const escapedValues = value.map(v => {
              const str = String(v).replace(/'/g, "''").replace(/\\/g, '\\\\');
              return `'${str}'`;
            }).join(',');
            setClauses.push(`${dbColumn} = ARRAY[${escapedValues}]::text[]`);
          } else {
            // Not an array, treat as JSONB
            const jsonValue = JSON.stringify(value);
            setClauses.push(`${dbColumn} = '${escapeSql(jsonValue)}'::jsonb`);
          }
        } else if (typeof value === 'string') {
          // Special handling for enum fields - cast to enum type
          if (dbColumn === 'gender') {
            // Gender enum in database uses lowercase: 'man', 'woman', 'nonbinary'
            const genderLower = value.toLowerCase();
            setClauses.push(`${dbColumn} = '${escapeSql(genderLower)}'::"Gender"`);
          } else if (dbColumn === 'intent') {
            // Intent field is handled separately using Prisma (see above)
            // Skip it here to avoid enum casting issues
            logger.debug(`Intent field will be handled separately, skipping in raw SQL`);
          } else {
            setClauses.push(`${dbColumn} = '${escapeSql(value)}'`);
          }
        } else if (typeof value === 'number' || typeof value === 'boolean') {
          setClauses.push(`${dbColumn} = ${value}`);
        } else if (Array.isArray(value)) {
          // Fallback for arrays not in arrayFields - treat as JSONB
          const jsonValue = JSON.stringify(value);
          setClauses.push(`${dbColumn} = '${escapeSql(jsonValue)}'::jsonb`);
        } else if (typeof value === 'object') {
          // Handle JSON fields
          const jsonValue = JSON.stringify(value);
          setClauses.push(`${dbColumn} = '${escapeSql(jsonValue)}'::jsonb`);
        }
      }

      // Always update updated_at
      setClauses.push(`updated_at = NOW()`);

      if (setClauses.length === 0) {
        // No fields to update, just return the existing profile
        return await fetchProfileRaw(userId);
      }

      // Update non-intent fields using raw SQL
      if (setClauses.length > 0) {
        const sql = `UPDATE profiles SET ${setClauses.join(', ')} WHERE user_id = '${escapeSql(userId)}'`;
        logger.info('Executing profile update SQL', {
          userId,
          setClausesCount: setClauses.length,
          hasPreferences: setClauses.some(c => c.includes('preferences')),
          sqlPreview: sql.substring(0, 500), // First 500 chars
        });
        await prisma.$executeRawUnsafe(sql);
        logger.info('Profile update SQL executed successfully', { userId });
      } else {
        logger.warn('No fields to update in profile', { userId, updateDataKeys: Object.keys(updateData) });
      }

      // Handle intent separately using raw SQL (to avoid enum type issues)
      // The database enum uses lowercase values: 'casual', 'friends', 'serious', 'networking'
      if (intentValue !== undefined) {
        logger.info(`Attempting to update intent: ${intentValue}`, { userId });
        const validIntents = ['CASUAL', 'FRIENDS', 'SERIOUS', 'NETWORKING'];
        const upperValue = intentValue.toUpperCase();
        if (validIntents.includes(upperValue)) {
          try {
            // Convert to lowercase to match database enum values
            const lowerValue = upperValue.toLowerCase();
            const escapeSql = (str: string) => str.replace(/'/g, "''");
            // Cast to enum type explicitly
            const intentSql = `UPDATE profiles SET intent = '${escapeSql(lowerValue)}'::"Intent" WHERE user_id = '${escapeSql(userId)}'`;
            logger.info(`Executing intent update SQL: ${intentSql}`, { userId });
            await prisma.$executeRawUnsafe(intentSql);
            logger.info(`Intent updated successfully: ${lowerValue}`, { userId });
          } catch (intentError: any) {
            logger.warn(`Failed to update intent field: ${intentError.message}`, {
              userId,
              intentValue,
              error: intentError.message,
              code: intentError.code
            });
            // Continue - intent update failure shouldn't break the whole update
          }
        } else {
          logger.warn(`Invalid intent value: ${intentValue}`, { userId, validIntents });
        }
      } else {
        logger.debug(`No intent value to update`, { userId });
      }

      // Fetch and return the updated profile
      return await fetchProfileRaw(userId);
    } catch (error: any) {
      logger.error('Raw profile update failed', {
        userId,
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  };

  // Helper function to create a default profile
  // Uses raw SQL with manual ID generation to bypass ALL Prisma serialization issues
  const createDefaultProfile = async (userId: string, email?: string) => {
    try {
      const displayName = email?.split('@')[0] || 'User';

      // Generate CUID manually (Prisma format: c + timestamp + random)
      const generateCuid = () => {
        const timestamp = Date.now().toString(36);
        const random = randomBytes(6).toString('hex');
        return `c${timestamp}${random}`;
      };
      const profileId = generateCuid();

      logger.info('Creating profile with raw SQL', { userId, displayName, profileId });

      // Escape SQL strings to prevent injection
      const escapeSql = (str: string) => str.replace(/'/g, "''");

      // Use raw SQL with manual ID - completely bypass Prisma's serialization
      // Only insert required fields, database defaults handle everything else
      const sql = `INSERT INTO profiles (id, user_id, display_name, created_at, updated_at)
                     VALUES ('${escapeSql(profileId)}', '${escapeSql(userId)}', '${escapeSql(displayName)}', NOW(), NOW())`;

      await prisma.$executeRawUnsafe(sql);

      // Fetch the created profile using raw SQL (bypasses Prisma enum validation)
      const defaultProfile = await fetchProfileRaw(userId);

      if (!defaultProfile) {
        throw new Error('Failed to fetch created profile');
      }

      logger.info('Profile auto-created successfully', {
        userId,
        profileId: defaultProfile.id,
      });

      return defaultProfile;
    } catch (error: any) {
      logger.error('Profile creation error', {
        userId,
        error: error.message,
        stack: error.stack,
        code: error.code,
        meta: error.meta,
      });
      throw error;
    }
  };

  // Location search endpoint (public, no auth required)
  router.get('/search-location', asyncHandler(async (req: any, res: any) => {
    try {
      const { q } = req.query;

      if (!q || typeof q !== 'string' || q.trim().length < 2) {
        return res.status(400).json({
          status: 'error',
          message: 'Query parameter "q" is required and must be at least 2 characters',
        });
      }

      // Proxy request to Nominatim API
      const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: q.trim(),
          format: 'json',
          addressdetails: 1,
          limit: 10,
        },
        headers: {
          'User-Agent': 'BellaApp/1.0 (contact@bella.app)',
        },
      });

      // Format the response
      const locations = response.data.map((location: any) => ({
        id: location.place_id.toString(),
        name: location.display_name,
        lat: location.lat,
        lon: location.lon,
        type: location.type,
      }));

      res.status(200).json({
        status: 'success',
        data: {
          locations,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
    } catch (error: any) {
      logger.error('Location search failed', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to search locations',
        error: error.message,
      });
    }
  }));

  // Internal service endpoint - no auth required (for service-to-service calls)
  // This endpoint is used by other microservices to fetch user info
  router.get('/internal/users/:id', asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;

    try {
      // Verify this is an internal request (from another service)
      const isInternal = req.headers['x-internal-request'] === 'true' ||
        req.headers['x-service-token'] === process.env.INTERNAL_SERVICE_TOKEN ||
        req.ip === '127.0.0.1' ||
        req.ip?.startsWith('172.') || // Docker network
        req.ip?.startsWith('10.') || // Private network
        req.hostname?.includes('kindred-'); // Docker service name

      if (!isInternal) {
        throw createUnauthorizedError('Internal endpoint - service access only');
      }

      // Fetch user without profile relation to avoid Prisma enum validation
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          isActive: true,
          isPhotoVerified: true,
          photoVerificationAttempts: true,
          photoVerifiedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        throw createNotFoundError('User');
      }

      // Fetch profile using raw SQL to bypass Prisma enum validation
      const profile = await fetchProfileRaw(id);

      // Return full profile data (same structure as authenticated /profile endpoint)
      const userPhotos = profile ? getPhotosArray(profile.photos) : [];
      const userVideos = profile ? getVideosArray(profile.videos) : [];
      const preferences = profile?.preferences as any || {};
      const privacySettings = preferences?.privacySettings || {};
      const notificationSettings = preferences?.notificationSettings || {};
      
      const sanitizedUser = {
        id: user.id,
        email: user.email,
        name: profile?.displayName || null,
        displayName: profile?.displayName || user.email,
        profilePicture: userPhotos[0] || null,
        avatar: userPhotos[0] || null,
        shortBio: profile?.shortBio || null,
        bio: profile?.shortBio || null,
        age: profile?.age || null,
        gender: profile?.gender || null,
        interests: preferences?.interests || [],
        locationCity: profile?.locationCity || null,
        locationCountry: profile?.locationCountry || null,
        location: profile?.locationCity ? `${profile.locationCity}, ${profile.locationCountry}` : profile?.locationCountry || null,
        intent: profile?.intent || null,
        isOnline: false,
        isActive: user.isActive,
        isVerified: user.isPhotoVerified || false,
        isPhotoVerified: user.isPhotoVerified || false,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt || profile?.updatedAt,
        // Additional profile fields
        photos: userPhotos,
        videos: userVideos,
        educationLevel: profile?.educationLevel || null,
        religion: profile?.religion || null,
        familyPlans: profile?.familyPlans || null,
        hasKids: profile?.hasKids || null,
        languages: preferences?.languages || [],
        ethnicity: profile?.ethnicity || null,
        politicalViews: profile?.politicalViews || null,
        exercise: profile?.exercise || null,
        smoking: profile?.smoking || null,
        drinking: profile?.drinking || null,
        relationshipIntents: profile?.relationshipIntents || [],
        preferences,
        privacySettings: {
          showOnlineStatus: privacySettings?.showOnlineStatus !== false,
          sendReadReceipts: privacySettings?.sendReadReceipts !== false,
        },
        notificationSettings: {
          all: notificationSettings?.all !== false,
          newMatches: notificationSettings?.newMatches !== false,
          newMessages: notificationSettings?.newMessages !== false,
          appPromotions: notificationSettings?.appPromotions === true,
        },
      };

      res.status(200).json({
        status: 'success',
        data: {
          user: sanitizedUser,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });

    } catch (error: any) {
      logger.error('Get user profile (internal) failed', error);
      throw error;
    }
  }));

  // All other profile routes require authentication
  router.use(authMiddleware(prisma, logger));

  // Get current user's profile
  router.get('/', asyncHandler(async (req: any, res: any) => {
    try {
      // Fetch user without profile relation to avoid Prisma enum validation
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          email: true,
          isActive: true,
          isPhotoVerified: true,
          photoVerificationAttempts: true,
          photoVerifiedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        throw createNotFoundError('User');
      }

      // Fetch profile using raw SQL to bypass Prisma enum validation
      let profile = await fetchProfileRaw(req.user.id);

      logger.info('GET /profile - Fetched profile data', {
        userId: req.user.id,
        hasProfile: !!profile,
        displayName: profile?.displayName,
        shortBio: profile?.shortBio,
        age: profile?.age,
        locationCity: profile?.locationCity,
        locationCountry: profile?.locationCountry,
        preferences: profile?.preferences,
        photosCount: profile?.photos ? (Array.isArray(profile.photos) ? profile.photos.length : 'not array') : 'no photos',
      });

      // If profile doesn't exist, create a default one with all fields properly initialized
      if (!profile) {
        const newProfile = await createDefaultProfile(req.user.id, req.user.email);

        // Fetch the created profile to ensure it's saved and can be returned (using raw SQL)
        const savedProfile = await fetchProfileRaw(req.user.id);

        if (!savedProfile) {
          throw new Error('Failed to create profile');
        }

        // Return the newly created profile
        return res.status(200).json({
          status: 'success',
          data: {
            profile: {
              id: savedProfile.id,
              displayName: savedProfile.displayName,
              shortBio: savedProfile.shortBio,
              photos: getPhotosArray(savedProfile.photos),
              videos: getVideosArray(savedProfile.videos),
              intent: savedProfile.intent,
              age: savedProfile.age,
              locationCity: savedProfile.locationCity,
              locationCountry: savedProfile.locationCountry,
              preferences: savedProfile.preferences || {},
              gender: savedProfile.gender,
              relationshipIntents: savedProfile.relationshipIntents || [],
              familyPlans: savedProfile.familyPlans,
              religion: savedProfile.religion,
              educationLevel: savedProfile.educationLevel,
              politicalViews: savedProfile.politicalViews,
              exercise: savedProfile.exercise,
              smoking: savedProfile.smoking,
              drinking: savedProfile.drinking,
              preferredGenders: savedProfile.preferredGenders || [],
              preferredRelationshipIntents: savedProfile.preferredRelationshipIntents || [],
              preferredFamilyPlans: savedProfile.preferredFamilyPlans || [],
              preferredReligions: savedProfile.preferredReligions || [],
              preferredEducationLevels: savedProfile.preferredEducationLevels || [],
              preferredPoliticalViews: savedProfile.preferredPoliticalViews || [],
              preferredExerciseHabits: savedProfile.preferredExerciseHabits || [],
              preferredSmokingHabits: savedProfile.preferredSmokingHabits || [],
              preferredDrinkingHabits: savedProfile.preferredDrinkingHabits || [],
              preferredMinAge: savedProfile.preferredMinAge,
              preferredMaxAge: savedProfile.preferredMaxAge,
              isPremiumUser: savedProfile.isPremium,
              isPhotoVerified: user.isPhotoVerified,
              photoVerificationAttempts: user.photoVerificationAttempts,
              photoVerifiedAt: user.photoVerifiedAt,
              updatedAt: savedProfile.updatedAt,
            }
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId,
          },
        });
      }

      res.status(200).json({
        status: 'success',
        data: {
          profile: {
            id: profile.id,
            displayName: profile.displayName,
            shortBio: profile.shortBio,
            photos: getPhotosArray(profile.photos),
            videos: getVideosArray(profile.videos),
            intent: profile.intent,
            age: profile.age,
            locationCity: profile.locationCity,
            locationCountry: profile.locationCountry,
            preferences: profile.preferences || {},
            // Dating-specific fields
            gender: profile.gender,
            relationshipIntents: profile.relationshipIntents || [],
            familyPlans: profile.familyPlans,
            religion: profile.religion,
            educationLevel: profile.educationLevel,
            politicalViews: profile.politicalViews,
            exercise: profile.exercise,
            smoking: profile.smoking,
            drinking: profile.drinking,
            // Partner preferences
            preferredGenders: profile.preferredGenders || [],
            preferredRelationshipIntents: profile.preferredRelationshipIntents || [],
            preferredFamilyPlans: profile.preferredFamilyPlans || [],
            preferredReligions: profile.preferredReligions || [],
            preferredEducationLevels: profile.preferredEducationLevels || [],
            preferredPoliticalViews: profile.preferredPoliticalViews || [],
            preferredExerciseHabits: profile.preferredExerciseHabits || [],
            preferredSmokingHabits: profile.preferredSmokingHabits || [],
            preferredDrinkingHabits: profile.preferredDrinkingHabits || [],
            preferredMinAge: profile.preferredMinAge,
            preferredMaxAge: profile.preferredMaxAge,
            isPremiumUser: profile.isPremium,
            isPhotoVerified: user.isPhotoVerified,
            photoVerificationAttempts: user.photoVerificationAttempts,
            photoVerifiedAt: user.photoVerifiedAt,
            updatedAt: profile.updatedAt,
          }
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });

    } catch (error: any) {
      logger.error('Get profile failed', error);
      throw error;
    }
  }));

  // Update profile
  router.put('/', asyncHandler(async (req: any, res: any) => {
    const updates: UpdateProfileRequest = req.body;

    logger.info('Profile update request received', {
      userId: req.user.id,
      updateFields: Object.keys(updates),
      hasDisplayName: updates.displayName !== undefined,
      hasShortBio: updates.shortBio !== undefined,
      hasAge: updates.age !== undefined,
      hasLocationCity: updates.locationCity !== undefined,
      hasInterests: updates.interests !== undefined,
      hasPreferences: updates.preferences !== undefined,
      rawBody: JSON.stringify(updates),
    });

    try {
      // Validate and sanitize input
      const updateData: any = {};

      if (updates.displayName !== undefined) {
        const trimmedName = updates.displayName ? updates.displayName.trim() : '';
        if (trimmedName.length === 0) {
          throw createValidationError('displayName', 'Display name is required');
        }
        updateData.displayName = sanitizeDisplayName(trimmedName);
      }

      if (updates.shortBio !== undefined) {
        const trimmedBio = updates.shortBio ? updates.shortBio.trim() : '';
        updateData.shortBio = trimmedBio.length > 0 ? sanitizeBio(trimmedBio) : null;
      }

      if (updates.intent !== undefined) {
        const validIntents = ['CASUAL', 'FRIENDS', 'SERIOUS', 'NETWORKING'];
        if (!validIntents.includes(updates.intent)) {
          throw createValidationError('intent', 'Invalid intent value');
        }
        updateData.intent = updates.intent;
      }

      // Handle birthday - convert to age if provided
      if (updates.birthday !== undefined && updates.birthday !== null) {
        try {
          const birthdayDate = updates.birthday instanceof Date
            ? updates.birthday
            : new Date(updates.birthday);

          if (isNaN(birthdayDate.getTime())) {
            throw createValidationError('birthday', 'Invalid birthday date');
          }

          const today = new Date();
          let calculatedAge = today.getFullYear() - birthdayDate.getFullYear();
          const monthDiff = today.getMonth() - birthdayDate.getMonth();

          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthdayDate.getDate())) {
            calculatedAge--;
          }

          if (!isValidAge(calculatedAge)) {
            throw createValidationError('birthday', 'Age calculated from birthday must be between 18 and 100');
          }

          updateData.age = calculatedAge;
        } catch (error: any) {
          if (error.code === 'VALIDATION_ERROR') {
            throw error;
          }
          throw createValidationError('birthday', 'Invalid birthday format');
        }
      } else if (updates.age !== undefined) {
        // If age is provided directly (and no birthday), use it
        if (updates.age !== null && !isValidAge(updates.age)) {
          throw createValidationError('age', 'Age must be between 18 and 100');
        }
        updateData.age = updates.age;
      }

      if (updates.locationCity !== undefined) {
        const trimmedCity = updates.locationCity ? updates.locationCity.trim() : '';
        updateData.locationCity = trimmedCity.length > 0 ? trimmedCity : null;
      }

      if (updates.locationCountry !== undefined) {
        const trimmedCountry = updates.locationCountry ? updates.locationCountry.trim() : '';
        updateData.locationCountry = trimmedCountry.length > 0 ? trimmedCountry : null;
      }

      // Check if profile exists early (we'll need it for merging interests if needed)
      const existingProfile = await fetchProfileRaw(req.user.id);

      // Handle preferences - merge with existing preferences to preserve other fields
      let preferencesToUpdate: any = {};
      if (existingProfile?.preferences) {
        // Preserve existing preferences
        preferencesToUpdate = typeof existingProfile.preferences === 'string'
          ? JSON.parse(existingProfile.preferences)
          : existingProfile.preferences;
      }

      // If preferences are provided directly, merge them
      if (updates.preferences !== undefined) {
        preferencesToUpdate = { ...preferencesToUpdate, ...updates.preferences };
      }

      // Handle user's own attributes that should be stored in preferences
      if (updates.languages !== undefined) {
        preferencesToUpdate.languages = Array.isArray(updates.languages) ? updates.languages : [];
      }
      if (updates.ethnicity !== undefined) {
        preferencesToUpdate.ethnicity = updates.ethnicity || null;
      }
      if (updates.hasKids !== undefined) {
        preferencesToUpdate.hasKids = updates.hasKids;
      }

      // Always update preferences if we've modified them
      if (updates.preferences !== undefined || updates.languages !== undefined || updates.ethnicity !== undefined || updates.hasKids !== undefined) {
        updateData.preferences = preferencesToUpdate;
      }

      // Handle interests - can come as direct field or inside preferences
      if (updates.interests !== undefined) {
        // Interests provided directly - merge into preferences
        if (!updateData.preferences) {
          // Get existing preferences if not already set
          updateData.preferences = existingProfile?.preferences || {};
        }
        updateData.preferences = {
          ...updateData.preferences,
          interests: Array.isArray(updates.interests) ? updates.interests : [],
        };
      }

      // Dating-specific field validations
      if (updates.gender !== undefined) {
        const validGenders = ['MAN', 'WOMAN', 'NONBINARY'];
        if (!validGenders.includes(updates.gender)) {
          throw createValidationError('gender', 'Invalid gender value');
        }
        // Convert to lowercase for database enum (database uses 'man', 'woman', 'nonbinary')
        updateData.gender = updates.gender.toLowerCase();
      }

      if (updates.relationshipIntents !== undefined) {
        const validIntents = ['LONG_TERM', 'CASUAL_DATES', 'MARRIAGE', 'INTIMACY', 'INTIMACY_NO_COMMITMENT', 'LIFE_PARTNER', 'ETHICAL_NON_MONOGAMY'];
        if (!Array.isArray(updates.relationshipIntents) ||
          !updates.relationshipIntents.every(intent => validIntents.includes(intent))) {
          throw createValidationError('relationshipIntents', 'Invalid relationship intents');
        }
        updateData.relationshipIntents = updates.relationshipIntents;
      }

      if (updates.familyPlans !== undefined) {
        const validPlans = ['HAS_KIDS_WANTS_MORE', 'HAS_KIDS_DOESNT_WANT_MORE', 'DOESNT_HAVE_KIDS_WANTS_KIDS', 'DOESNT_HAVE_KIDS_DOESNT_WANT_KIDS', 'NOT_SURE_YET'];
        if (!validPlans.includes(updates.familyPlans)) {
          throw createValidationError('familyPlans', 'Invalid family plans value');
        }
        updateData.familyPlans = updates.familyPlans;
      }

      if (updates.religion !== undefined) {
        const validReligions = ['AGNOSTIC', 'ATHEIST', 'BUDDHIST', 'CATHOLIC', 'CHRISTIAN', 'HINDU', 'JEWISH', 'MUSLIM', 'SPIRITUAL', 'OTHER'];
        if (!validReligions.includes(updates.religion)) {
          throw createValidationError('religion', 'Invalid religion value');
        }
        updateData.religion = updates.religion;
      }

      if (updates.educationLevel !== undefined) {
        const validLevels = ['HIGH_SCHOOL', 'IN_COLLEGE', 'UNDERGRADUATE', 'IN_GRAD_SCHOOL', 'POSTGRADUATE'];
        if (!validLevels.includes(updates.educationLevel)) {
          throw createValidationError('educationLevel', 'Invalid education level value');
        }
        updateData.educationLevel = updates.educationLevel;
      }

      if (updates.politicalViews !== undefined) {
        const validViews = ['LIBERAL', 'MODERATE', 'CONSERVATIVE', 'APOLITICAL', 'OTHER'];
        if (!validViews.includes(updates.politicalViews)) {
          throw createValidationError('politicalViews', 'Invalid political views value');
        }
        updateData.politicalViews = updates.politicalViews;
      }

      if (updates.exercise !== undefined) {
        const validHabits = ['FREQUENTLY', 'SOCIALLY', 'RARELY', 'NEVER'];
        if (!validHabits.includes(updates.exercise)) {
          throw createValidationError('exercise', 'Invalid exercise habit value');
        }
        updateData.exercise = updates.exercise;
      }

      if (updates.smoking !== undefined) {
        const validHabits = ['FREQUENTLY', 'SOCIALLY', 'RARELY', 'NEVER'];
        if (!validHabits.includes(updates.smoking)) {
          throw createValidationError('smoking', 'Invalid smoking habit value');
        }
        updateData.smoking = updates.smoking;
      }

      if (updates.drinking !== undefined) {
        const validHabits = ['FREQUENTLY', 'SOCIALLY', 'RARELY', 'NEVER'];
        if (!validHabits.includes(updates.drinking)) {
          throw createValidationError('drinking', 'Invalid drinking habit value');
        }
        updateData.drinking = updates.drinking;
      }

      // Profile already fetched above for preferences merging
      let profile;

      logger.info('Preparing to update profile', {
        userId: req.user.id,
        updateDataKeys: Object.keys(updateData),
        updateData: JSON.stringify(updateData),
        hasExistingProfile: !!existingProfile,
        hasPreferences: !!updateData.preferences,
        preferencesKeys: updateData.preferences ? Object.keys(updateData.preferences) : [],
        preferencesData: updateData.preferences ? JSON.stringify(updateData.preferences) : null,
      });

      if (existingProfile) {
        // Update existing profile using raw SQL (bypasses Prisma enum validation)
        profile = await updateProfileRaw(req.user.id, updateData);

        logger.info('Profile updated via raw SQL', {
          userId: req.user.id,
          profileId: profile?.id,
        });
      } else {
        // Create new profile
        if (!updateData.displayName) {
          throw createValidationError('displayName', 'Display name is required for new profile');
        }

        profile = await prisma.profile.create({
          data: {
            userId: req.user.id,
            displayName: updateData.displayName,
            ...updateData,
          },
        });
      }

      // Fetch updated profile to ensure we have the latest data
      const updatedProfile = await fetchProfileRaw(req.user.id);

      logger.info('Profile updated successfully', {
        userId: req.user.id,
        profileId: updatedProfile?.id || profile?.id,
        updatedFields: Object.keys(updateData),
        displayName: updatedProfile?.displayName,
        shortBio: updatedProfile?.shortBio,
        age: updatedProfile?.age,
        locationCity: updatedProfile?.locationCity,
        interests: (updatedProfile?.preferences as any)?.interests,
      });

      res.status(200).json({
        status: 'success',
        data: {
          profile: {
            id: updatedProfile?.id || profile.id,
            displayName: updatedProfile?.displayName || profile.displayName,
            shortBio: updatedProfile?.shortBio || profile.shortBio,
            photos: getPhotosArray(updatedProfile?.photos || profile.photos),
            videos: getVideosArray(updatedProfile?.videos || profile.videos),
            intent: updatedProfile?.intent || profile.intent,
            age: updatedProfile?.age || profile.age,
            locationCity: updatedProfile?.locationCity || profile.locationCity,
            locationCountry: updatedProfile?.locationCountry || profile.locationCountry,
            preferences: updatedProfile?.preferences || profile.preferences,
            // Dating-specific fields
            gender: updatedProfile?.gender || profile.gender || null,
            relationshipIntents: updatedProfile?.relationshipIntents || profile.relationshipIntents,
            familyPlans: updatedProfile?.familyPlans || profile.familyPlans,
            religion: updatedProfile?.religion || profile.religion,
            educationLevel: updatedProfile?.educationLevel || profile.educationLevel,
            politicalViews: updatedProfile?.politicalViews || profile.politicalViews,
            exercise: updatedProfile?.exercise || profile.exercise,
            smoking: updatedProfile?.smoking || profile.smoking,
            drinking: updatedProfile?.drinking || profile.drinking,
            // Partner preferences
            preferredGenders: updatedProfile?.preferredGenders || profile.preferredGenders,
            preferredRelationshipIntents: updatedProfile?.preferredRelationshipIntents || profile.preferredRelationshipIntents,
            preferredFamilyPlans: updatedProfile?.preferredFamilyPlans || profile.preferredFamilyPlans,
            preferredReligions: updatedProfile?.preferredReligions || profile.preferredReligions,
            preferredEducationLevels: updatedProfile?.preferredEducationLevels || profile.preferredEducationLevels,
            preferredPoliticalViews: updatedProfile?.preferredPoliticalViews || profile.preferredPoliticalViews,
            preferredExerciseHabits: updatedProfile?.preferredExerciseHabits || profile.preferredExerciseHabits,
            preferredSmokingHabits: updatedProfile?.preferredSmokingHabits || profile.preferredSmokingHabits,
            preferredDrinkingHabits: updatedProfile?.preferredDrinkingHabits || profile.preferredDrinkingHabits,
            preferredMinAge: updatedProfile?.preferredMinAge || profile.preferredMinAge,
            preferredMaxAge: updatedProfile?.preferredMaxAge || profile.preferredMaxAge,
            isPremiumUser: updatedProfile?.isPremium || profile.isPremium,
            updatedAt: updatedProfile?.updatedAt || profile.updatedAt,
          }
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });

    } catch (error: any) {
      logger.error('Update profile failed', error);
      throw error;
    }
  }));

  // Update partner preferences
  router.put('/preferences', asyncHandler(async (req: any, res: any) => {
    const updates: UpdatePreferencesRequest = req.body;

    try {
      // Validate and sanitize input
      const updateData: any = {};

      if (updates.preferredGenders !== undefined) {
        const validGenders = ['MAN', 'WOMAN', 'NONBINARY'];
        if (!Array.isArray(updates.preferredGenders) ||
          !updates.preferredGenders.every(gender => validGenders.includes(gender))) {
          throw createValidationError('preferredGenders', 'Invalid preferred genders');
        }
        updateData.preferredGenders = updates.preferredGenders;
      }

      if (updates.preferredRelationshipIntents !== undefined) {
        const validIntents = ['LONG_TERM', 'CASUAL_DATES', 'MARRIAGE', 'INTIMACY', 'INTIMACY_NO_COMMITMENT', 'LIFE_PARTNER', 'ETHICAL_NON_MONOGAMY'];
        if (!Array.isArray(updates.preferredRelationshipIntents) ||
          !updates.preferredRelationshipIntents.every(intent => validIntents.includes(intent))) {
          throw createValidationError('preferredRelationshipIntents', 'Invalid preferred relationship intents');
        }
        updateData.preferredRelationshipIntents = updates.preferredRelationshipIntents;
      }

      if (updates.preferredFamilyPlans !== undefined) {
        const validPlans = ['HAS_KIDS_WANTS_MORE', 'HAS_KIDS_DOESNT_WANT_MORE', 'DOESNT_HAVE_KIDS_WANTS_KIDS', 'DOESNT_HAVE_KIDS_DOESNT_WANT_KIDS', 'NOT_SURE_YET'];
        if (!Array.isArray(updates.preferredFamilyPlans) ||
          !updates.preferredFamilyPlans.every(plan => validPlans.includes(plan))) {
          throw createValidationError('preferredFamilyPlans', 'Invalid preferred family plans');
        }
        updateData.preferredFamilyPlans = updates.preferredFamilyPlans;
      }

      if (updates.preferredReligions !== undefined) {
        const validReligions = ['AGNOSTIC', 'ATHEIST', 'BUDDHIST', 'CATHOLIC', 'CHRISTIAN', 'HINDU', 'JEWISH', 'MUSLIM', 'SPIRITUAL', 'OTHER'];
        if (!Array.isArray(updates.preferredReligions) ||
          !updates.preferredReligions.every(religion => validReligions.includes(religion))) {
          throw createValidationError('preferredReligions', 'Invalid preferred religions');
        }
        updateData.preferredReligions = updates.preferredReligions;
      }

      if (updates.preferredEducationLevels !== undefined) {
        const validLevels = ['HIGH_SCHOOL', 'IN_COLLEGE', 'UNDERGRADUATE', 'IN_GRAD_SCHOOL', 'POSTGRADUATE'];
        if (!Array.isArray(updates.preferredEducationLevels) ||
          !updates.preferredEducationLevels.every(level => validLevels.includes(level))) {
          throw createValidationError('preferredEducationLevels', 'Invalid preferred education levels');
        }
        updateData.preferredEducationLevels = updates.preferredEducationLevels;
      }

      if (updates.preferredPoliticalViews !== undefined) {
        const validViews = ['LIBERAL', 'MODERATE', 'CONSERVATIVE', 'APOLITICAL', 'OTHER'];
        if (!Array.isArray(updates.preferredPoliticalViews) ||
          !updates.preferredPoliticalViews.every(view => validViews.includes(view))) {
          throw createValidationError('preferredPoliticalViews', 'Invalid preferred political views');
        }
        updateData.preferredPoliticalViews = updates.preferredPoliticalViews;
      }

      if (updates.preferredExerciseHabits !== undefined) {
        const validHabits = ['FREQUENTLY', 'SOCIALLY', 'RARELY', 'NEVER'];
        if (!Array.isArray(updates.preferredExerciseHabits) ||
          !updates.preferredExerciseHabits.every(habit => validHabits.includes(habit))) {
          throw createValidationError('preferredExerciseHabits', 'Invalid preferred exercise habits');
        }
        updateData.preferredExerciseHabits = updates.preferredExerciseHabits;
      }

      if (updates.preferredSmokingHabits !== undefined) {
        const validHabits = ['FREQUENTLY', 'SOCIALLY', 'RARELY', 'NEVER'];
        if (!Array.isArray(updates.preferredSmokingHabits) ||
          !updates.preferredSmokingHabits.every(habit => validHabits.includes(habit))) {
          throw createValidationError('preferredSmokingHabits', 'Invalid preferred smoking habits');
        }
        updateData.preferredSmokingHabits = updates.preferredSmokingHabits;
      }

      if (updates.preferredDrinkingHabits !== undefined) {
        const validHabits = ['FREQUENTLY', 'SOCIALLY', 'RARELY', 'NEVER'];
        if (!Array.isArray(updates.preferredDrinkingHabits) ||
          !updates.preferredDrinkingHabits.every(habit => validHabits.includes(habit))) {
          throw createValidationError('preferredDrinkingHabits', 'Invalid preferred drinking habits');
        }
        updateData.preferredDrinkingHabits = updates.preferredDrinkingHabits;
      }

      if (updates.preferredMinAge !== undefined) {
        if (updates.preferredMinAge !== null && (updates.preferredMinAge < 18 || updates.preferredMinAge > 100)) {
          throw createValidationError('preferredMinAge', 'Preferred minimum age must be between 18 and 100');
        }
        updateData.preferredMinAge = updates.preferredMinAge;
      }

      if (updates.preferredMaxAge !== undefined) {
        if (updates.preferredMaxAge !== null && (updates.preferredMaxAge < 18 || updates.preferredMaxAge > 100)) {
          throw createValidationError('preferredMaxAge', 'Preferred maximum age must be between 18 and 100');
        }
        updateData.preferredMaxAge = updates.preferredMaxAge;
      }

      // Validate age range consistency
      if (updates.preferredMinAge !== undefined && updates.preferredMaxAge !== undefined) {
        if (updates.preferredMinAge && updates.preferredMaxAge && updates.preferredMinAge > updates.preferredMaxAge) {
          throw createValidationError('ageRange', 'Minimum age cannot be greater than maximum age');
        }
      }

      // Check if profile exists (using raw SQL to bypass enum validation)
      const existingProfile = await fetchProfileRaw(req.user.id);

      if (!existingProfile) {
        throw createNotFoundError('Profile not found. Please create a profile first.');
      }

      // Update preferences using raw SQL (bypasses Prisma enum validation)
      const profile = await updateProfileRaw(req.user.id, updateData);

      logger.info('Partner preferences updated successfully', {
        userId: req.user.id,
        profileId: profile.id,
      });

      res.status(200).json({
        status: 'success',
        data: {
          preferences: {
            preferredGenders: profile.preferredGenders,
            preferredRelationshipIntents: profile.preferredRelationshipIntents,
            preferredFamilyPlans: profile.preferredFamilyPlans,
            preferredReligions: profile.preferredReligions,
            preferredEducationLevels: profile.preferredEducationLevels,
            preferredPoliticalViews: profile.preferredPoliticalViews,
            preferredExerciseHabits: profile.preferredExerciseHabits,
            preferredSmokingHabits: profile.preferredSmokingHabits,
            preferredDrinkingHabits: profile.preferredDrinkingHabits,
            preferredMinAge: profile.preferredMinAge,
            preferredMaxAge: profile.preferredMaxAge,
            updatedAt: profile.updatedAt,
          }
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });

    } catch (error: any) {
      logger.error('Update preferences failed', error);
      throw error;
    }
  }));

  // Upload profile media
  router.post('/upload', upload.single('file'), asyncHandler(async (req: any, res: any) => {
    try {
      if (!req.file) {
        throw createValidationError('file', 'No file provided');
      }

      const fileType = req.body.type as 'photo' | 'video';
      if (!fileType || !['photo', 'video'].includes(fileType)) {
        throw createValidationError('type', 'File type must be "photo" or "video"');
      }

      // Validate user is authenticated
      if (!req.user || !req.user.id) {
        throw createValidationError('user', 'User not authenticated');
      }

      // Generate unique filename
      const fileName = generateFileName(req.file.originalname, `${req.user.id}_${fileType}`);

      // Upload file to storage (S3 or local)
      let fileUrl: string;
      try {
        // Pass request object to determine correct base URL
        fileUrl = await uploadFile(req.file, fileName, logger, req);
      } catch (uploadError: any) {
        logger.error('File upload to storage failed', uploadError);
        throw createValidationError('file', `File upload failed: ${uploadError.message}`);
      }

      // Check if profile exists, create if it doesn't (using raw SQL to avoid JSON issues and enum case problems)
      let profile = await fetchProfileRaw(req.user.id);

      if (!profile) {
        try {
          // Auto-create profile using raw SQL (avoids Prisma JSON serialization issues)
          logger.info('Profile not found, auto-creating during photo upload', {
            userId: req.user.id,
          });

          profile = await createDefaultProfile(req.user.id, req.user.email);

          // Verify profile was created using raw SQL
          const verifyProfile = await fetchProfileRaw(req.user.id);

          if (!verifyProfile) {
            throw new Error('Failed to create profile - profile not found after creation');
          }

          profile = verifyProfile;
        } catch (profileError: any) {
          logger.error('Profile auto-creation failed during upload', {
            userId: req.user.id,
            error: profileError.message,
            stack: profileError.stack,
          });
          throw createValidationError('profile', `Failed to create profile: ${profileError.message}`);
        }
      }

      // Handle photos/videos as JSON arrays (database stores as JSONB)
      const currentPhotos = getPhotosArray(profile.photos);
      const currentVideos = getVideosArray(profile.videos);

      let updateData: any = {};

      if (fileType === 'photo') {
        updateData.photos = [...currentPhotos, fileUrl];
      } else {
        updateData.videos = [...currentVideos, fileUrl];
      }

      try {
        // Use raw SQL update to bypass Prisma enum validation
        await updateProfileRaw(req.user.id, updateData);
      } catch (updateError: any) {
        logger.error('Profile update failed', {
          userId: req.user.id,
          error: updateError.message,
          stack: updateError.stack,
        });
        throw createValidationError('profile', `Failed to update profile: ${updateError.message}`);
      }

      logger.info('File uploaded successfully', {
        userId: req.user.id,
        fileType,
        fileName,
        fileSize: req.file.size,
        fileUrl,
      });

      res.status(201).json({
        status: 'success',
        data: {
          url: fileUrl,
          type: fileType,
          uploadedAt: new Date().toISOString(),
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });

    } catch (error: any) {
      logger.error('File upload failed', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id,
        fileType: req.body?.type,
      });
      throw error;
    }
  }));

  // Remove media from profile
  router.delete('/media', asyncHandler(async (req: any, res: any) => {
    const { url, type } = req.body;

    try {
      if (!url || !type) {
        throw createValidationError('url', 'URL and type are required');
      }

      if (!['photo', 'video'].includes(type)) {
        throw createValidationError('type', 'Type must be "photo" or "video"');
      }

      // Use raw SQL to fetch profile (bypasses Prisma enum validation issues)
      const profile = await fetchProfileRaw(req.user.id);

      if (!profile) {
        throw createNotFoundError('Profile');
      }

      const currentPhotos = getPhotosArray(profile.photos);
      const currentVideos = getVideosArray(profile.videos);

      let updateData: any = {};

      if (type === 'photo') {
        updateData.photos = currentPhotos.filter(photo => photo !== url);
      } else {
        updateData.videos = currentVideos.filter(video => video !== url);
      }

      // Use raw SQL update to bypass Prisma enum validation
      await updateProfileRaw(req.user.id, updateData);

      logger.info('Media removed successfully', {
        userId: req.user.id,
        type,
        url,
      });

      res.status(200).json({
        status: 'success',
        data: {
          message: 'Media removed successfully',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });

    } catch (error: any) {
      logger.error('Remove media failed', error);
      throw error;
    }
  }));

  // Public endpoint: Get user profile by ID (sanitized)
  router.get('/users/:id', asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;

    try {
      // Fetch user without profile relation to avoid Prisma enum validation
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          isActive: true,
          isPhotoVerified: true,
          photoVerificationAttempts: true,
          photoVerifiedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!user) {
        throw createNotFoundError('User');
      }

      // Fetch profile using raw SQL to bypass Prisma enum validation
      const profile = await fetchProfileRaw(id);

      // Return sanitized user data (exclude sensitive info)
      const userPhotos = profile ? getPhotosArray(profile.photos) : [];
      const profilePreferences = profile?.preferences ? (typeof profile.preferences === 'string' ? JSON.parse(profile.preferences) : profile.preferences) : {};

      // Log preferences for debugging
      logger.info('Profile data for user GET', {
        userId: id,
        hasProfile: !!profile,
        preferencesType: typeof profile?.preferences,
        preferencesRaw: profile?.preferences,
        preferencesParsed: profilePreferences,
        languagesFromProfile: profile?.languages,
        languagesFromPrefs: profilePreferences?.languages,
        ethnicityFromProfile: profile?.ethnicity,
        ethnicityFromPrefs: profilePreferences?.ethnicity,
        hasKidsFromProfile: profile?.hasKids,
        hasKidsFromPrefs: profilePreferences?.hasKids,
      });

      const sanitizedUser = {
        id: user.id,
        email: user.email, // Include email for GraphQL compatibility
        name: profile?.displayName || null,
        displayName: profile?.displayName || user.email,
        profilePicture: userPhotos[0] || null,
        avatar: userPhotos[0] || null,
        shortBio: profile?.shortBio || null,
        bio: profile?.shortBio || null,
        age: profile?.age || null,
        gender: profile?.gender || null,
        interests: profilePreferences?.interests || [],
        locationCity: profile?.locationCity || null,
        locationCountry: profile?.locationCountry || null,
        location: profile?.locationCity ? `${profile.locationCity}, ${profile.locationCountry}` : profile?.locationCountry || null,
        intent: profile?.intent || null,
        // Profile fields for About Me - prioritize direct fields, then preferences (use first value from preference arrays)
        educationLevel: profile?.educationLevel || (profilePreferences?.preferredEducationLevels?.[0]) || null,
        religion: profile?.religion || (profilePreferences?.preferredReligions?.[0]) || null,
        familyPlans: profile?.familyPlans || (profilePreferences?.preferredFamilyPlans?.[0]) || null,
        hasKids: profile?.hasKids ?? profilePreferences?.hasKids ?? (profilePreferences?.preferredHasKids?.[0]) ?? null,
        languages: profile?.languages ?? profilePreferences?.languages ?? [],
        ethnicity: profile?.ethnicity ?? profilePreferences?.ethnicity ?? null,
        politicalViews: profile?.politicalViews || (profilePreferences?.preferredPoliticalViews?.[0]) || null,
        exercise: profile?.exercise || null,
        smoking: profile?.smoking || (profilePreferences?.preferredSmokingHabits?.[0]) || null,
        drinking: profile?.drinking || (profilePreferences?.preferredDrinkingHabits?.[0]) || null,
        photos: userPhotos,
        isOnline: false, // Default to false, should be fetched from presence service
        isActive: user.isActive,
        isVerified: user.isPhotoVerified || false,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };

      logger.info('Sanitized user data', {
        userId: id,
        languages: sanitizedUser.languages,
        ethnicity: sanitizedUser.ethnicity,
        hasKids: sanitizedUser.hasKids,
      });

      res.status(200).json({
        status: 'success',
        data: {
          user: sanitizedUser,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });

    } catch (error: any) {
      logger.error('Get user profile failed', error);
      throw error;
    }
  }));

  // Photo verification endpoint
  router.post('/verify-photo', upload.single('selfie'), asyncHandler(async (req: any, res: any) => {
    try {
      if (!req.file) {
        throw createValidationError('selfie', 'No selfie image provided');
      }

      // Get user's profile photos - auto-create if doesn't exist (using raw SQL)
      let profile = await fetchProfileRaw(req.user.id);

      if (!profile) {
        try {
          // Auto-create profile if it doesn't exist
          logger.info('Profile not found, auto-creating during photo verification', {
            userId: req.user.id,
          });

          profile = await createDefaultProfile(req.user.id, req.user.email);

          // Verify profile was created using raw SQL
          const verifyProfile = await fetchProfileRaw(req.user.id);

          if (!verifyProfile) {
            throw new Error('Failed to create profile - profile not found after creation');
          }

          profile = verifyProfile;
        } catch (profileError: any) {
          logger.error('Profile auto-creation failed during photo verification', {
            userId: req.user.id,
            error: profileError.message,
            stack: profileError.stack,
          });
          throw createValidationError('profile', `Failed to create profile: ${profileError.message}`);
        }
      }

      const profilePhotos = getPhotosArray(profile.photos);

      if (!profilePhotos || profilePhotos.length === 0) {
        throw createValidationError('photos', 'Please upload at least one profile photo before verifying.');
      }

      // Load profile photos from filesystem or download from URL
      const profilePhotoBuffers: Buffer[] = [];
      const uploadDir = path.join(process.cwd(), 'uploads');

      // Ensure uploads directory exists
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
        logger.info('Created uploads directory', { uploadDir });
      }

      // List existing files in uploads directory for debugging
      let existingFiles: string[] = [];
      try {
        if (fs.existsSync(uploadDir)) {
          existingFiles = fs.readdirSync(uploadDir);
        }
      } catch (err: any) {
        logger.warn('Failed to list files in uploads directory', { error: err.message });
      }

      logger.info('Starting profile photo load for verification', {
        userId: req.user.id,
        photoCount: profilePhotos.length,
        photoUrls: profilePhotos.slice(0, 3), // Log first 3 URLs
        uploadDir,
        uploadDirExists: fs.existsSync(uploadDir),
        existingFilesCount: existingFiles.length,
        existingFilesSample: existingFiles.slice(0, 5), // Log first 5 files
      });

      for (const photoUrl of profilePhotos.slice(0, 5)) { // Limit to first 5 photos
        try {
          let buffer: Buffer | null = null;

          // Extract filename from URL (e.g., http://.../uploads/filename.jpg -> filename.jpg)
          const urlParts = photoUrl.split('/');
          const fileName = urlParts[urlParts.length - 1];

          // Try to read from local filesystem first (more efficient)
          const localFilePath = path.join(uploadDir, fileName);
          if (fs.existsSync(localFilePath)) {
            buffer = fs.readFileSync(localFilePath);
            logger.info('Successfully loaded profile photo from filesystem', {
              fileName,
              filePath: localFilePath,
              bufferSize: buffer.length,
            });
          } else {
            // Fallback: download from URL (for S3 or external storage)
            // Try internal service URL first (for Docker containers)
            const internalServiceUrl = process.env.USER_SERVICE_URL || 'http://kindred-user-service:3001';
            const internalPhotoUrl = photoUrl.replace(/https?:\/\/[^\/]+/, internalServiceUrl);

            logger.info('Photo not found locally, attempting to download from URL', {
              photoUrl,
              internalPhotoUrl,
              localFilePath,
            });

            // Try internal URL first, then external URL
            const urlsToTry = [internalPhotoUrl, photoUrl];
            let downloadSuccess = false;

            for (const url of urlsToTry) {
              try {
                const response = await axios.get(url, {
                  responseType: 'arraybuffer',
                  timeout: 10000, // 10 second timeout
                });
                buffer = Buffer.from(response.data);
                logger.info('Successfully downloaded profile photo from URL', {
                  url,
                  bufferSize: buffer.length,
                });
                downloadSuccess = true;
                break;
              } catch (downloadError: any) {
                logger.warn('Failed to download profile photo from URL', {
                  url,
                  error: downloadError.message,
                  code: downloadError.code,
                });
                // Try next URL
              }
            }

            if (!downloadSuccess) {
              logger.error('Failed to download profile photo from all URLs', {
                photoUrl,
                internalPhotoUrl,
                localFilePath,
              });
              // Continue to next photo
              continue;
            }
          }

          if (buffer && buffer.length > 0) {
            profilePhotoBuffers.push(buffer);
          } else {
            logger.warn('Photo buffer is empty or null', { fileName, photoUrl });
          }
        } catch (error: any) {
          logger.warn('Failed to load profile photo', {
            photoUrl,
            error: error.message,
            code: error.code,
          });
          // Continue with other photos
        }
      }

      if (profilePhotoBuffers.length === 0) {
        logger.error('No profile photos could be loaded', {
          userId: req.user.id,
          photoUrls: profilePhotos,
          uploadDir,
          uploadDirExists: fs.existsSync(uploadDir),
        });
        throw createValidationError('photos', 'Could not load profile photos. The photo files may have been lost. Please re-upload your profile photos and try verification again.');
      }

      logger.info('Profile photos downloaded successfully', {
        userId: req.user.id,
        downloadedCount: profilePhotoBuffers.length,
        selfieSize: req.file.buffer.length,
      });

      // Verify the selfie
      const selfieBuffer = req.file.buffer;
      const verificationResult = await photoVerificationService.verifyPhoto(
        selfieBuffer,
        profilePhotoBuffers
      );

      logger.info('Photo verification result', {
        userId: req.user.id,
        success: verificationResult.success,
        confidence: verificationResult.confidence,
        message: verificationResult.message,
        livenessDetected: verificationResult.livenessDetected,
      });

      // Update user verification status
      // IMPORTANT: Once verified, isPhotoVerified should never be reset to false
      // Only set to true if verification succeeds, never set to false
      const updateData: any = {
        photoVerificationAttempts: {
          increment: 1,
        },
      };

      if (verificationResult.success) {
        // Only update if not already verified (idempotent - safe to call multiple times)
        // This ensures verification status persists for the lifetime of the account
        updateData.isPhotoVerified = true;
        updateData.photoVerifiedAt = new Date();
      }
      // Note: We never set isPhotoVerified to false - once verified, always verified

      await prisma.user.update({
        where: { id: req.user.id },
        data: updateData,
      });

      logger.info('Photo verification completed', {
        userId: req.user.id,
        success: verificationResult.success,
        confidence: verificationResult.confidence,
      });

      res.status(200).json({
        status: 'success',
        data: {
          verified: verificationResult.success,
          confidence: verificationResult.confidence,
          message: verificationResult.message,
          livenessDetected: verificationResult.livenessDetected,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });

    } catch (error: any) {
      logger.error('Photo verification failed', error);
      throw error;
    }
  }));

  // Get verification status
  router.get('/verification-status', asyncHandler(async (req: any, res: any) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          isPhotoVerified: true,
          photoVerificationAttempts: true,
          photoVerifiedAt: true,
        },
      });

      if (!user) {
        throw createNotFoundError('User');
      }

      res.status(200).json({
        status: 'success',
        data: {
          isPhotoVerified: user.isPhotoVerified,
          photoVerificationAttempts: user.photoVerificationAttempts,
          photoVerifiedAt: user.photoVerifiedAt,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });

    } catch (error: any) {
      logger.error('Get verification status failed', error);
      throw error;
    }
  }));

  // Public endpoint: Batch fetch users by IDs (sanitized)
  router.post('/users/batch', asyncHandler(async (req: any, res: any) => {
    const { userIds } = req.body;

    try {
      // Validate input
      if (!Array.isArray(userIds) || userIds.length === 0) {
        throw createValidationError('userIds', 'userIds must be a non-empty array');
      }

      if (userIds.length > 100) {
        throw createValidationError('userIds', 'Cannot fetch more than 100 users at once');
      }

      const users = await prisma.user.findMany({
        where: {
          id: {
            in: userIds,
          },
        },
        include: {
          profile: true,
        },
      });

      // Return sanitized user data for all found users
      const sanitizedUsers = users.map((user: any) => {
        const userPhotos = user.profile ? getPhotosArray(user.profile.photos) : [];
        return {
          id: user.id,
          email: user.email,
          name: user.profile?.displayName || null,
          displayName: user.profile?.displayName || user.email,
          profilePicture: userPhotos[0] || null,
          avatar: userPhotos[0] || null,
          bio: user.profile?.shortBio || null,
          shortBio: user.profile?.shortBio || null,
          age: user.profile?.age || null,
          gender: user.profile?.gender || null,
          interests: (user.profile?.preferences as any)?.interests || [],
          locationCity: user.profile?.locationCity || null,
          locationCountry: user.profile?.locationCountry || null,
          location: user.profile?.locationCity ? `${user.profile.locationCity}, ${user.profile.locationCountry}` : user.profile?.locationCountry || null,
          intent: user.profile?.intent || null,
          isOnline: false,
          isActive: user.isActive,
          isVerified: user.isPhotoVerified || false,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        };
      });

      res.status(200).json({
        status: 'success',
        data: {
          users: sanitizedUsers,
          count: sanitizedUsers.length,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });

    } catch (error: any) {
      logger.error('Batch fetch users failed', error);
      throw error;
    }
  }));

  return router;
}