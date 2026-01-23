import { Router } from 'express';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import { RedisClientType } from 'redis';
import { Logger } from '../utils/logger';
import { 
  sanitizeDisplayName,
  sanitizeBio,
  isValidAge,
  createValidationError,
  createNotFoundError,
  generateFileName,
  asyncHandler
} from '../utils/helpers';
import { authMiddleware } from '../middleware/auth';
import { uploadFile, getPresignedUploadUrl, isS3Configured } from '../services/fileUpload';

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
  locationCity?: string;
  locationCountry?: string;
  preferences?: Record<string, any>;
  
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
  const router = Router();

  // All profile routes require authentication
  router.use(authMiddleware(prisma, logger));

  // Get current user's profile
  router.get('/', asyncHandler(async (req: any, res: any) => {
    try {
      const profile = await prisma.profile.findUnique({
        where: { userId: req.user.id },
      });

      if (!profile) {
        throw createNotFoundError('Profile');
      }

      res.status(200).json({
        status: 'success',
        data: {
          profile: {
            id: profile.id,
            displayName: profile.displayName,
            shortBio: profile.shortBio,
            photos: profile.photos,
            videos: profile.videos,
            intent: profile.intent,
            age: profile.age,
            locationCity: profile.locationCity,
            locationCountry: profile.locationCountry,
            preferences: profile.preferences,
            // Dating-specific fields
            gender: profile.gender,
            relationshipIntents: profile.relationshipIntents,
            familyPlans: profile.familyPlans,
            religion: profile.religion,
            educationLevel: profile.educationLevel,
            politicalViews: profile.politicalViews,
            exercise: profile.exercise,
            smoking: profile.smoking,
            drinking: profile.drinking,
            // Partner preferences
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
            isPremiumUser: profile.isPremium,
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
    const { 
      displayName, shortBio, intent, age, locationCity, locationCountry, preferences,
      gender, relationshipIntents, familyPlans, religion, educationLevel, 
      politicalViews, exercise, smoking, drinking 
    } = updates;

    try {
      // Validate and sanitize input
      const updateData: any = {};

      if (updates.displayName !== undefined) {
        if (!updates.displayName || updates.displayName.trim().length === 0) {
          throw createValidationError('displayName', 'Display name is required');
        }
        updateData.displayName = sanitizeDisplayName(updates.displayName);
      }

      if (updates.shortBio !== undefined) {
        updateData.shortBio = updates.shortBio ? sanitizeBio(updates.shortBio) : null;
      }

      if (updates.intent !== undefined) {
        const validIntents = ['CASUAL', 'FRIENDS', 'SERIOUS', 'NETWORKING'];
        if (!validIntents.includes(updates.intent)) {
          throw createValidationError('intent', 'Invalid intent value');
        }
        updateData.intent = updates.intent;
      }

      if (updates.age !== undefined) {
        if (updates.age !== null && !isValidAge(updates.age)) {
          throw createValidationError('age', 'Age must be between 18 and 100');
        }
        updateData.age = updates.age;
      }

      if (updates.locationCity !== undefined) {
        updateData.locationCity = updates.locationCity || null;
      }

      if (updates.locationCountry !== undefined) {
        updateData.locationCountry = updates.locationCountry || null;
      }

      if (updates.preferences !== undefined) {
        updateData.preferences = updates.preferences || {};
      }

      // Dating-specific field validations
      if (updates.gender !== undefined) {
        const validGenders = ['MAN', 'WOMAN', 'NONBINARY'];
        if (!validGenders.includes(updates.gender)) {
          throw createValidationError('gender', 'Invalid gender value');
        }
        updateData.gender = updates.gender;
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

      // Handle photos array (for profile picture updates from presigned URL uploads)
      if ((updates as any).photos !== undefined) {
        const photos = (updates as any).photos;
        if (Array.isArray(photos)) {
          // Validate that all items are strings (URLs)
          if (photos.every((photo: any) => typeof photo === 'string')) {
            updateData.photos = photos;
          }
        }
      }

      // Check if profile exists
      const existingProfile = await prisma.profile.findUnique({
        where: { userId: req.user.id },
      });

      let profile;

      if (existingProfile) {
        // Update existing profile
        profile = await prisma.profile.update({
          where: { userId: req.user.id },
          data: updateData,
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

      logger.info('Profile updated successfully', {
        userId: req.user.id,
        profileId: profile.id,
      });

      res.status(200).json({
        status: 'success',
        data: {
          profile: {
            id: profile.id,
            displayName: profile.displayName,
            shortBio: profile.shortBio,
            photos: profile.photos,
            videos: profile.videos,
            intent: profile.intent,
            age: profile.age,
            locationCity: profile.locationCity,
            locationCountry: profile.locationCountry,
            preferences: profile.preferences,
            // Dating-specific fields
            gender: profile.gender,
            relationshipIntents: profile.relationshipIntents,
            familyPlans: profile.familyPlans,
            religion: profile.religion,
            educationLevel: profile.educationLevel,
            politicalViews: profile.politicalViews,
            exercise: profile.exercise,
            smoking: profile.smoking,
            drinking: profile.drinking,
            // Partner preferences
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
            isPremiumUser: profile.isPremium,
            updatedAt: profile.updatedAt,
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

      // Check if profile exists
      const existingProfile = await prisma.profile.findUnique({
        where: { userId: req.user.id },
      });

      if (!existingProfile) {
        throw createNotFoundError('Profile not found. Please create a profile first.');
      }

      // Update preferences
      const profile = await prisma.profile.update({
        where: { userId: req.user.id },
        data: updateData,
      });

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

      // Generate unique filename
      const fileName = generateFileName(req.file.originalname, `${req.user.id}_${fileType}`);

      // Upload file to storage (S3 or local)
      const fileUrl = await uploadFile(req.file, fileName, logger);

      // Update profile with new media URL
      const profile = await prisma.profile.findUnique({
        where: { userId: req.user.id },
      });

      if (!profile) {
        throw createNotFoundError('Profile');
      }

      const currentPhotos = (profile.photos as string[]) || [];
      const currentVideos = (profile.videos as string[]) || [];

      let updateData: any = {};

      if (fileType === 'photo') {
        updateData.photos = [...currentPhotos, fileUrl];
      } else {
        updateData.videos = [...currentVideos, fileUrl];
      }

      await prisma.profile.update({
        where: { userId: req.user.id },
        data: updateData,
      });

      logger.info('File uploaded successfully', {
        userId: req.user.id,
        fileType,
        fileName,
        fileSize: req.file.size,
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
      logger.error('File upload failed', error);
      throw error;
    }
  }));

  // Get presigned URL for direct S3 upload
  router.post('/upload/presigned', asyncHandler(async (req: any, res: any) => {
    try {
      const { fileType } = req.body;

      if (!fileType) {
        throw createValidationError('fileType', 'File type (MIME type) is required');
      }

      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'];
      if (!allowedTypes.includes(fileType)) {
        throw createValidationError('fileType', `File type must be one of: ${allowedTypes.join(', ')}`);
      }

      if (!isS3Configured()) {
        throw createValidationError('s3', 'S3 is not configured. Please use the standard upload endpoint.');
      }

      const result = await getPresignedUploadUrl(req.user.id, fileType, logger);

      logger.info('Presigned URL generated', {
        userId: req.user.id,
        fileType,
        key: result.key,
      });

      res.status(200).json({
        status: 'success',
        data: {
          uploadUrl: result.uploadUrl,
          publicUrl: result.publicUrl,
          key: result.key,
          expiresIn: result.expiresIn,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
    } catch (error: any) {
      logger.error('Get presigned URL failed', error);
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

      const profile = await prisma.profile.findUnique({
        where: { userId: req.user.id },
      });

      if (!profile) {
        throw createNotFoundError('Profile');
      }

      const currentPhotos = (profile.photos as string[]) || [];
      const currentVideos = (profile.videos as string[]) || [];

      let updateData: any = {};

      if (type === 'photo') {
        updateData.photos = currentPhotos.filter(photo => photo !== url);
      } else {
        updateData.videos = currentVideos.filter(video => video !== url);
      }

      await prisma.profile.update({
        where: { userId: req.user.id },
        data: updateData,
      });

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

  return router;
}