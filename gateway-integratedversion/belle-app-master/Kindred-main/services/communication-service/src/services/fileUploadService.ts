import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

// Initialize S3 client if AWS credentials are configured
let s3Client: S3Client | null = null;

if (config.storage.aws.accessKeyId && config.storage.aws.secretAccessKey) {
  s3Client = new S3Client({
    region: config.storage.aws.region,
    credentials: {
      accessKeyId: config.storage.aws.accessKeyId,
      secretAccessKey: config.storage.aws.secretAccessKey,
    },
  });
  logger.info('S3 client initialized for file uploads');
} else {
  logger.warn('AWS credentials not configured, falling back to local storage');
}

interface UploadResult {
  url: string;
  key: string;
  size: number;
}

/**
 * Generate a unique filename for uploads
 */
function generateFileName(type: 'voice-notes' | 'images', extension: string, userId?: string): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  const prefix = userId ? `chat/${userId}/${type}` : `chat/${type}`;
  return `${prefix}/${timestamp}-${random}${extension}`;
}

/**
 * Upload a voice note file
 */
export async function uploadVoiceNote(
  fileBuffer: Buffer,
  originalName: string,
  mimeType: string,
  userId: string
): Promise<UploadResult> {
  const ext = path.extname(originalName) || getExtensionFromMimeType(mimeType);
  const key = generateFileName('voice-notes', ext, userId);

  if (config.storage.provider === 'aws' && s3Client) {
    return await uploadToS3(fileBuffer, key, mimeType);
  } else {
    return await uploadToLocal(fileBuffer, key, mimeType, 'voice-notes');
  }
}

/**
 * Upload an image file
 */
export async function uploadImage(
  fileBuffer: Buffer,
  originalName: string,
  mimeType: string,
  userId: string
): Promise<UploadResult> {
  const ext = path.extname(originalName) || getExtensionFromMimeType(mimeType);
  const key = generateFileName('images', ext, userId);

  if (config.storage.provider === 'aws' && s3Client) {
    return await uploadToS3(fileBuffer, key, mimeType);
  } else {
    return await uploadToLocal(fileBuffer, key, mimeType, 'images');
  }
}

/**
 * Upload file to AWS S3
 */
async function uploadToS3(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<UploadResult> {
  if (!s3Client) {
    throw new Error('S3 client not initialized');
  }

  try {
    const command = new PutObjectCommand({
      Bucket: config.storage.aws.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ACL: 'public-read',
    });

    await s3Client.send(command);

    const url = `https://${config.storage.aws.bucket}.s3.${config.storage.aws.region}.amazonaws.com/${key}`;

    logger.info('File uploaded to S3', {
      bucket: config.storage.aws.bucket,
      key,
      size: buffer.length,
      contentType,
    });

    return {
      url,
      key,
      size: buffer.length,
    };
  } catch (error: any) {
    logger.error('S3 upload failed', {
      error: error.message,
      bucket: config.storage.aws.bucket,
      key,
    });
    throw new Error(`S3 upload failed: ${error.message}`);
  }
}

/**
 * Upload file to local storage (fallback for development)
 */
async function uploadToLocal(
  buffer: Buffer,
  key: string,
  contentType: string,
  subdir: string
): Promise<UploadResult> {
  const uploadsDir = path.join(process.cwd(), 'uploads', subdir);

  // Create directory if it doesn't exist
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Use just the filename part for local storage
  const filename = path.basename(key);
  const filePath = path.join(uploadsDir, filename);

  fs.writeFileSync(filePath, buffer);

  const url = `/uploads/${subdir}/${filename}`;

  logger.info('File uploaded to local storage', {
    path: filePath,
    size: buffer.length,
    contentType,
  });

  return {
    url,
    key: filename,
    size: buffer.length,
  };
}

/**
 * Delete a file from storage
 */
export async function deleteFile(fileUrl: string): Promise<void> {
  try {
    if (config.storage.provider === 'aws' && s3Client && fileUrl.includes('s3.')) {
      // Extract key from S3 URL
      const url = new URL(fileUrl);
      const key = url.pathname.substring(1); // Remove leading /

      const command = new DeleteObjectCommand({
        Bucket: config.storage.aws.bucket,
        Key: key,
      });

      await s3Client.send(command);
      logger.info('File deleted from S3', { key });
    } else if (fileUrl.startsWith('/uploads/')) {
      // Local file
      const filePath = path.join(process.cwd(), fileUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.info('File deleted from local storage', { path: filePath });
      }
    }
  } catch (error: any) {
    logger.error('File deletion failed', { error: error.message, fileUrl });
    // Don't throw - deletion failures shouldn't break the app
  }
}

/**
 * Get file extension from MIME type
 */
function getExtensionFromMimeType(mimeType: string): string {
  const map: { [key: string]: string } = {
    'audio/webm': '.webm',
    'audio/mp4': '.m4a',
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav',
    'audio/ogg': '.ogg',
    'audio/x-m4a': '.m4a',
    'audio/x-caf': '.caf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
  };
  return map[mimeType] || '.bin';
}

/**
 * Check if S3 is configured and available
 */
export function isS3Available(): boolean {
  return config.storage.provider === 'aws' && s3Client !== null;
}
