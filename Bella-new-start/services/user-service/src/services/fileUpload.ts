import { Logger } from '../utils/logger';
import { config } from '../utils/config';
import fs from 'fs';
import path from 'path';

interface FileUploadResult {
  url: string;
  key?: string;
}

/**
 * Upload file to configured storage (S3 or local)
 */
export async function uploadFile(
  file: { buffer: Buffer; mimetype: string; originalname: string },
  fileName: string,
  logger: Logger,
  request?: { protocol?: string; get?: (header: string) => string | undefined; hostname?: string }
): Promise<string> {
  try {
    if (config.storage.type === 's3') {
      return await uploadToS3(file, fileName, logger, request);
    } else {
      return await uploadToLocal(file, fileName, logger, request);
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
  logger: Logger,
  request?: { protocol?: string; get?: (header: string) => string | undefined; hostname?: string }
): Promise<string> {
  // For now, we'll implement a local fallback
  // In production, you would use AWS SDK v3:
  // import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
  
  logger.warn('S3 upload not implemented, falling back to local storage');
  return await uploadToLocal(file, fileName, logger, request);
}

/**
 * Upload file to local storage
 */
async function uploadToLocal(
  file: { buffer: Buffer; mimetype: string; originalname: string },
  fileName: string,
  logger: Logger,
  request?: { protocol?: string; get?: (header: string) => string | undefined; hostname?: string }
): Promise<string> {
  const uploadDir = path.join(process.cwd(), 'uploads');
  
  // Create uploads directory if it doesn't exist
  if (!fs.existsSync(uploadDir)) {
    try {
      fs.mkdirSync(uploadDir, { recursive: true });
    } catch (mkdirError: any) {
      logger.error('Failed to create uploads directory', {
        uploadDir,
        error: mkdirError.message,
        code: mkdirError.code,
      });
      throw new Error(`Failed to create uploads directory: ${mkdirError.message}`);
    }
  }

  // Check if directory is writable
  try {
    fs.accessSync(uploadDir, fs.constants.W_OK);
  } catch (accessError: any) {
    logger.error('Uploads directory is not writable', {
      uploadDir,
      error: accessError.message,
      code: accessError.code,
      hint: 'Check volume permissions. The directory should be writable by user 1001 (nodejs)',
    });
    throw new Error(`Uploads directory is not writable: ${accessError.message}. Please check volume permissions.`);
  }

  const filePath = path.join(uploadDir, fileName);
  
  // Write file to disk
  try {
    fs.writeFileSync(filePath, file.buffer);
  } catch (writeError: any) {
    logger.error('Failed to write file to disk', {
      filePath,
      error: writeError.message,
      code: writeError.code,
      errno: writeError.errno,
      hint: writeError.code === 'EACCES' ? 'Permission denied - check volume permissions' : 'Unknown write error',
    });
    throw new Error(`Failed to write file: ${writeError.message}${writeError.code === 'EACCES' ? ' (Permission denied - check volume permissions)' : ''}`);
  }
  
  // Verify file was written correctly
  if (!fs.existsSync(filePath)) {
    throw new Error(`File was not written to disk: ${filePath}`);
  }
  
  const stats = fs.statSync(filePath);
  if (stats.size === 0) {
    throw new Error(`File was written but is empty: ${filePath}`);
  }
  
  if (stats.size !== file.buffer.length) {
    logger.warn('File size mismatch', {
      expected: file.buffer.length,
      actual: stats.size,
      filePath,
    });
  }
  
  logger.info('File written successfully', {
    filePath,
    fileSize: stats.size,
    expectedSize: file.buffer.length,
    mimetype: file.mimetype,
  });

  // Determine base URL from request, environment variable, or default
  let baseUrl: string;
  
  // First, check environment variable (highest priority)
  if (process.env.BASE_URL || process.env.PUBLIC_URL || process.env.EXTERNAL_URL) {
    baseUrl = process.env.BASE_URL || process.env.PUBLIC_URL || process.env.EXTERNAL_URL || '';
  } else if (request) {
    // Try to get from request headers (for proxied requests)
    // x-forwarded-host should contain the external hostname that the client sees
    const forwardedHost = request.get?.('x-forwarded-host');
    const forwardedProto = request.get?.('x-forwarded-proto');
    const host = request.get?.('host') || request.hostname;
    const protocol = forwardedProto || request.protocol || 'http';
    
    // Use x-forwarded-host if available (external hostname), otherwise use host
    // But check if host is a Docker internal hostname (like kindred-user-service)
    let hostname: string;
    let port: string = '4000'; // Default to gateway port since gateway proxies /uploads
    
    // Docker internal hostname patterns
    const dockerInternalPatterns = ['kindred-', 'localhost', '127.0.0.1', '0.0.0.0'];
    
    if (forwardedHost) {
      // x-forwarded-host contains the external hostname
      const forwardedHostLower = forwardedHost.toLowerCase();
      const isDockerInternal = dockerInternalPatterns.some(pattern => forwardedHostLower.includes(pattern));
      
      if (isDockerInternal) {
        // Even x-forwarded-host is Docker internal, use external IP
        hostname = process.env.EXTERNAL_HOST || process.env.PUBLIC_HOST || '51.20.160.210';
        port = '4000';
      } else {
        // x-forwarded-host is external, use it
        if (forwardedHost.includes(':')) {
          [hostname] = forwardedHost.split(':');
        } else {
          hostname = forwardedHost;
        }
        port = '4000'; // Always use gateway port for /uploads
      }
    } else if (host) {
      // Check if host is a Docker internal hostname
      const hostLower = host.toLowerCase();
      const isDockerInternal = dockerInternalPatterns.some(pattern => hostLower.includes(pattern));
      
      if (isDockerInternal) {
        // If it's a Docker internal hostname, we need to use external IP
        // Try to get from environment variable or use a default
        hostname = process.env.EXTERNAL_HOST || process.env.PUBLIC_HOST || '51.20.160.210';
        port = '4000'; // Use gateway port
      } else {
        // External hostname, extract it
        if (host.includes(':')) {
          [hostname] = host.split(':');
        } else {
          hostname = host;
        }
        port = '4000'; // Always use gateway port for /uploads
      }
    } else {
      // Fallback - use environment variable or default external IP
      // NOTE: Set EXTERNAL_HOST or PUBLIC_HOST environment variable in docker-compose.yml
      // to avoid hardcoding the IP address
      const baseUrlEnv = process.env.BASE_URL;
      const extractedHost = baseUrlEnv ? baseUrlEnv.replace(/^https?:\/\//, '').replace(/:\d+$/, '') : null;
      hostname = process.env.EXTERNAL_HOST || process.env.PUBLIC_HOST || extractedHost || '51.20.160.210';
      port = '4000';
    }
    
    baseUrl = `${protocol}://${hostname}:${port}`;
    
    logger.info('File URL generated from request', {
      forwardedHost,
      host,
      detectedHostname: hostname,
      detectedPort: port,
      finalBaseUrl: baseUrl,
      protocol,
    });
  } else {
    // Fallback to environment variable or default external IP
    // NOTE: Set EXTERNAL_HOST or PUBLIC_HOST environment variable in docker-compose.yml
    const baseUrlEnv = process.env.BASE_URL;
    const extractedHost = baseUrlEnv ? baseUrlEnv.replace(/^https?:\/\//, '').replace(/:\d+$/, '') : null;
    const externalHost = process.env.EXTERNAL_HOST || process.env.PUBLIC_HOST || extractedHost || '51.20.160.210';
    baseUrl = `http://${externalHost}:4000`;
    
    logger.info('File URL generated (no request object)', {
      externalHost,
      finalBaseUrl: baseUrl,
    });
  }
  
  const fileUrl = `${baseUrl}/uploads/${fileName}`;
  
  logger.info('Final file URL', {
    fileUrl,
    baseUrl,
    fileName,
  });

  logger.info('File uploaded to local storage', {
    fileName,
    filePath,
    fileSize: file.buffer.length,
    mimetype: file.mimetype,
    fileUrl,
    baseUrl,
  });

  return fileUrl;
}

/**
 * Delete file from storage
 */
export async function deleteFile(fileUrl: string, logger: Logger): Promise<void> {
  try {
    if (config.storage.type === 's3') {
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
  // For now, we'll implement a local fallback
  logger.warn('S3 deletion not implemented, falling back to local deletion');
  await deleteFromLocal(fileUrl, logger);
}

/**
 * Delete file from local storage
 */
async function deleteFromLocal(fileUrl: string, logger: Logger): Promise<void> {
  try {
    // Extract filename from URL
    const fileName = fileUrl.split('/').pop();
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