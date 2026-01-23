import { Logger } from '../utils/logger';
import { config } from '../utils/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Initialize S3 client if AWS credentials are configured
let s3Client: S3Client | null = null;

if (config.aws.accessKeyId && config.aws.secretAccessKey) {
  s3Client = new S3Client({
    region: config.aws.region,
    credentials: {
      accessKeyId: config.aws.accessKeyId,
      secretAccessKey: config.aws.secretAccessKey,
    },
  });
}

interface FileUploadResult {
  url: string;
  key?: string;
}

interface PresignedUrlResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  expiresIn: number;
}

/**
 * Generate a unique filename
 */
function generateFileName(originalName: string, userId?: string): string {
  const ext = path.extname(originalName);
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  const prefix = userId ? `users/${userId}` : 'uploads';
  return `${prefix}/${timestamp}-${random}${ext}`;
}

/**
 * Upload file to configured storage (S3 or local)
 */
export async function uploadFile(
  file: { buffer: Buffer; mimetype: string; originalname: string },
  fileName: string,
  logger: Logger
): Promise<string> {
  try {
    if (config.storage.type === 's3' && s3Client) {
      return await uploadToS3(file, fileName, logger);
    } else {
      return await uploadToLocal(file, fileName, logger);
    }
  } catch (error: any) {
    logger.error('File upload failed', error);
    throw new Error('File upload failed');
  }
}

/**
 * Upload file to AWS S3
 */
async function uploadToS3(
  file: { buffer: Buffer; mimetype: string; originalname: string },
  fileName: string,
  logger: Logger
): Promise<string> {
  if (!s3Client) {
    logger.warn('S3 client not configured, falling back to local storage');
    return await uploadToLocal(file, fileName, logger);
  }

  try {
    const command = new PutObjectCommand({
      Bucket: config.aws.s3Bucket,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
      // Make uploaded files publicly readable
      ACL: 'public-read',
    });

    await s3Client.send(command);

    // Construct the public URL
    const publicUrl = `https://${config.aws.s3Bucket}.s3.${config.aws.region}.amazonaws.com/${fileName}`;

    logger.info('File uploaded to S3', {
      bucket: config.aws.s3Bucket,
      key: fileName,
      fileSize: file.buffer.length,
      mimetype: file.mimetype,
      url: publicUrl,
    });

    return publicUrl;
  } catch (error: any) {
    logger.error('S3 upload failed', {
      error: error.message,
      bucket: config.aws.s3Bucket,
      key: fileName,
    });
    throw error;
  }
}

/**
 * Upload file to local storage
 */
async function uploadToLocal(
  file: { buffer: Buffer; mimetype: string; originalname: string },
  fileName: string,
  logger: Logger
): Promise<string> {
  const uploadDir = path.join(process.cwd(), 'uploads');

  // Create uploads directory if it doesn't exist
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Handle nested paths
  const filePath = path.join(uploadDir, fileName);
  const fileDir = path.dirname(filePath);
  if (!fs.existsSync(fileDir)) {
    fs.mkdirSync(fileDir, { recursive: true });
  }

  // Write file to disk
  fs.writeFileSync(filePath, file.buffer);

  // Return URL (in production, this would be your CDN/S3 URL)
  const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
  const fileUrl = `${baseUrl}/uploads/${fileName}`;

  logger.info('File uploaded to local storage', {
    fileName,
    filePath,
    fileSize: file.buffer.length,
    mimetype: file.mimetype,
  });

  return fileUrl;
}

/**
 * Delete file from storage
 */
export async function deleteFile(fileUrl: string, logger: Logger): Promise<void> {
  try {
    if (config.storage.type === 's3' && s3Client) {
      await deleteFromS3(fileUrl, logger);
    } else {
      await deleteFromLocal(fileUrl, logger);
    }
  } catch (error: any) {
    logger.error('File deletion failed', error);
    // Don't throw error for deletion failures in non-critical path
  }
}

/**
 * Delete file from AWS S3
 */
async function deleteFromS3(fileUrl: string, logger: Logger): Promise<void> {
  if (!s3Client) {
    logger.warn('S3 client not configured, falling back to local deletion');
    await deleteFromLocal(fileUrl, logger);
    return;
  }

  try {
    // Extract key from URL
    const urlObj = new URL(fileUrl);
    const key = urlObj.pathname.substring(1); // Remove leading /

    const command = new DeleteObjectCommand({
      Bucket: config.aws.s3Bucket,
      Key: key,
    });

    await s3Client.send(command);

    logger.info('File deleted from S3', {
      bucket: config.aws.s3Bucket,
      key,
    });
  } catch (error: any) {
    logger.error('S3 deletion failed', { error: error.message, fileUrl });
    throw error;
  }
}

/**
 * Delete file from local storage
 */
async function deleteFromLocal(fileUrl: string, logger: Logger): Promise<void> {
  try {
    // Extract filename from URL
    const fileName = fileUrl.split('/uploads/').pop();
    if (!fileName) {
      throw new Error('Invalid file URL');
    }

    const filePath = path.join(process.cwd(), 'uploads', fileName);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info('File deleted from local storage', { fileName, filePath });
    }
  } catch (error: any) {
    logger.error('Local file deletion failed', error);
    throw error;
  }
}

/**
 * Generate a presigned URL for direct client upload to S3
 */
export async function getPresignedUploadUrl(
  userId: string,
  fileType: string,
  logger: Logger
): Promise<PresignedUrlResult> {
  if (!s3Client) {
    throw new Error('S3 is not configured. Please configure AWS credentials.');
  }

  // Determine file extension from MIME type
  const extMap: { [key: string]: string } = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
  };

  const ext = extMap[fileType] || '.bin';
  const key = generateFileName(`upload${ext}`, userId);
  const expiresIn = 3600; // 1 hour

  const command = new PutObjectCommand({
    Bucket: config.aws.s3Bucket,
    Key: key,
    ContentType: fileType,
    ACL: 'public-read', // Make uploaded files publicly readable
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn });
  const publicUrl = `https://${config.aws.s3Bucket}.s3.${config.aws.region}.amazonaws.com/${key}`;

  logger.info('Generated presigned upload URL', {
    userId,
    key,
    fileType,
    expiresIn,
  });

  return {
    uploadUrl,
    publicUrl,
    key,
    expiresIn,
  };
}

/**
 * Generate a presigned URL for reading a private file
 */
export async function getPresignedDownloadUrl(
  key: string,
  logger: Logger,
  expiresIn: number = 3600
): Promise<string> {
  if (!s3Client) {
    throw new Error('S3 is not configured. Please configure AWS credentials.');
  }

  const command = new GetObjectCommand({
    Bucket: config.aws.s3Bucket,
    Key: key,
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn });

  logger.info('Generated presigned download URL', {
    key,
    expiresIn,
  });

  return url;
}

/**
 * Check if S3 is configured
 */
export function isS3Configured(): boolean {
  return !!s3Client;
}
