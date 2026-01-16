import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { config } from '../utils/config';
import { uploadVoiceNote, uploadImage, isS3Available } from '../services/fileUploadService';

const router = Router();
const prisma = new PrismaClient();

// Configure multer to store files in memory (for S3 upload)
const storage = multer.memoryStorage();

// File filter
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedAudioTypes = config.storage.limits.voiceNote.allowedTypes;
  const allowedImageTypes = config.storage.limits.image.allowedTypes;
  // Also allow iOS native formats
  const additionalAudioTypes = ['audio/x-m4a', 'audio/x-caf', 'audio/aac'];

  const allAllowedTypes = [...allowedAudioTypes, ...allowedImageTypes, ...additionalAudioTypes];

  if (allAllowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: ${allAllowedTypes.join(', ')}`));
  }
};

// Multer upload middleware
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: Math.max(
      config.storage.limits.voiceNote.maxSize,
      config.storage.limits.image.maxSize
    ),
    files: 1
  }
});

// Extend Request to include user from auth middleware
interface AuthRequest extends Request {
  user?: { userId: string; email: string };
}

// Upload voice note
router.post('/voice-note', upload.single('voiceNote'), async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ status: 'error', message: 'Unauthorized' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ status: 'error', message: 'No file uploaded' });
      return;
    }

    const { conversationId, duration } = req.body;
    if (!conversationId) {
      res.status(400).json({ status: 'error', message: 'conversationId is required' });
      return;
    }

    // Verify user is participant in conversation
    const participant = await prisma.userRoom.findFirst({
      where: {
        roomId: conversationId,
        userId
      }
    });

    if (!participant) {
      res.status(403).json({ status: 'error', message: 'Access denied to this conversation' });
      return;
    }

    // Upload to S3 (or local fallback)
    const uploadResult = await uploadVoiceNote(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      userId
    );

    // Create voice note message in database
    const message = await prisma.message.create({
      data: {
        roomId: conversationId,
        senderId: userId,
        content: '[Voice Note]',
        messageType: 'VOICE',
        voiceUrl: uploadResult.url,
        voiceDuration: parseInt(duration) || 0,
        voiceSize: uploadResult.size
      }
    });

    // Update room's lastActivity
    await prisma.chatRoom.update({
      where: { roomId: conversationId },
      data: { lastActivity: new Date() }
    });

    logger.info('Voice note uploaded', {
      messageId: message.messageId,
      userId,
      conversationId,
      fileSize: uploadResult.size,
      duration,
      storageType: isS3Available() ? 's3' : 'local',
      url: uploadResult.url
    });

    res.json({
      status: 'success',
      data: {
        messageId: message.messageId,
        voiceUrl: uploadResult.url,
        voiceDuration: parseInt(duration) || 0,
        voiceSize: uploadResult.size,
        timestamp: message.timestamp
      }
    });
  } catch (error) {
    logger.error('Error uploading voice note:', error);
    next(error);
  }
});

// Upload image
router.post('/image', upload.single('image'), async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ status: 'error', message: 'Unauthorized' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ status: 'error', message: 'No file uploaded' });
      return;
    }

    const { conversationId, width, height } = req.body;
    if (!conversationId) {
      res.status(400).json({ status: 'error', message: 'conversationId is required' });
      return;
    }

    // Verify user is participant in conversation
    const participant = await prisma.userRoom.findFirst({
      where: {
        roomId: conversationId,
        userId
      }
    });

    if (!participant) {
      res.status(403).json({ status: 'error', message: 'Access denied to this conversation' });
      return;
    }

    // Upload to S3 (or local fallback)
    const uploadResult = await uploadImage(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      userId
    );

    // Create image message in database
    const message = await prisma.message.create({
      data: {
        roomId: conversationId,
        senderId: userId,
        content: '[Image]',
        messageType: 'IMAGE',
        imageUrl: uploadResult.url,
        imageWidth: parseInt(width) || null,
        imageHeight: parseInt(height) || null,
        imageSize: uploadResult.size
      }
    });

    // Update room's lastActivity
    await prisma.chatRoom.update({
      where: { roomId: conversationId },
      data: { lastActivity: new Date() }
    });

    logger.info('Image uploaded', {
      messageId: message.messageId,
      userId,
      conversationId,
      fileSize: uploadResult.size,
      storageType: isS3Available() ? 's3' : 'local',
      url: uploadResult.url
    });

    res.json({
      status: 'success',
      data: {
        messageId: message.messageId,
        imageUrl: uploadResult.url,
        imageWidth: parseInt(width) || null,
        imageHeight: parseInt(height) || null,
        imageSize: uploadResult.size,
        timestamp: message.timestamp
      }
    });
  } catch (error) {
    logger.error('Error uploading image:', error);
    next(error);
  }
});

// Get storage status (for debugging)
router.get('/status', (req: AuthRequest, res: Response) => {
  res.json({
    status: 'success',
    data: {
      storageProvider: config.storage.provider,
      s3Available: isS3Available(),
      s3Bucket: isS3Available() ? config.storage.aws.bucket : null,
      s3Region: isS3Available() ? config.storage.aws.region : null,
      limits: {
        voiceNote: {
          maxSize: `${config.storage.limits.voiceNote.maxSize / 1024 / 1024}MB`,
          maxDuration: `${config.storage.limits.voiceNote.maxDuration}s`,
          allowedTypes: config.storage.limits.voiceNote.allowedTypes
        },
        image: {
          maxSize: `${config.storage.limits.image.maxSize / 1024 / 1024}MB`,
          allowedTypes: config.storage.limits.image.allowedTypes
        }
      }
    }
  });
});

// Error handling for multer
router.use((error: any, req: Request, res: Response, next: NextFunction): void => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        status: 'error',
        message: `File too large. Maximum size is ${Math.max(
          config.storage.limits.voiceNote.maxSize,
          config.storage.limits.image.maxSize
        ) / 1024 / 1024}MB.`
      });
      return;
    }
    res.status(400).json({ status: 'error', message: error.message });
    return;
  }

  if (error.message?.includes('Invalid file type')) {
    res.status(400).json({ status: 'error', message: error.message });
    return;
  }

  next(error);
});

export default router;
