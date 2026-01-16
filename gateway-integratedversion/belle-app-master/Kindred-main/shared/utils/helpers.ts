import { AppError } from '../types';

/**
 * Validation utility functions
 */

// Email validation
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Password validation
export function isValidPassword(password: string): boolean {
  // At least 8 characters, one uppercase, one lowercase, one digit
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
}

// Username validation
export function isValidUsername(username: string): boolean {
  // 3-50 characters, alphanumeric and underscore only
  const usernameRegex = /^[a-zA-Z0-9_]{3,50}$/;
  return usernameRegex.test(username);
}

// UUID validation
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// Age validation
export function isValidAge(age: number): boolean {
  return age >= 18 && age <= 100;
}

// File type validation
export function isValidFileType(mimetype: string, allowedTypes: string[]): boolean {
  return allowedTypes.includes(mimetype.toLowerCase());
}

// File size validation (in bytes)
export function isValidFileSize(size: number, maxSize: number): boolean {
  return size <= maxSize;
}

/**
 * Sanitization utility functions
 */

// Sanitize string input
export function sanitizeString(input: string, maxLength?: number): string {
  let sanitized = input.trim();
  
  // Remove potentially dangerous characters
  sanitized = sanitized.replace(/[<>]/g, '');
  
  // Truncate if necessary
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized;
}

// Sanitize display name
export function sanitizeDisplayName(displayName: string): string {
  return sanitizeString(displayName, 100);
}

// Sanitize bio
export function sanitizeBio(bio: string): string {
  return sanitizeString(bio, 500);
}

/**
 * Format utility functions
 */

// Format file size
export function formatFileSize(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

// Format duration
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Random utility functions
 */

// Generate random string
export function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate room ID
export function generateRoomId(): string {
  return `room_${generateRandomString(16)}_${Date.now()}`;
}

// Generate request ID
export function generateRequestId(): string {
  return `req_${generateRandomString(12)}_${Date.now()}`;
}

/**
 * Date utility functions
 */

// Check if date is within last N minutes
export function isWithinLastMinutes(date: Date, minutes: number): boolean {
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = diffInMs / (1000 * 60);
  return diffInMinutes <= minutes;
}

// Add minutes to date
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + (minutes * 60 * 1000));
}

// Add hours to date
export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + (hours * 60 * 60 * 1000));
}

// Check if date is expired
export function isExpired(expiryDate: Date): boolean {
  return new Date() > expiryDate;
}

/**
 * Array utility functions
 */

// Shuffle array
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Remove item from array
export function removeFromArray<T>(array: T[], item: T): T[] {
  return array.filter(i => i !== item);
}

// Get random item from array
export function getRandomItem<T>(array: T[]): T | undefined {
  if (array.length === 0) return undefined;
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Object utility functions
 */

// Deep clone object
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as any;
  if (Array.isArray(obj)) return obj.map(item => deepClone(item)) as any;
  
  const cloned = {} as T;
  Object.keys(obj).forEach(key => {
    (cloned as any)[key] = deepClone((obj as any)[key]);
  });
  
  return cloned;
}

// Pick properties from object
export function pick<T extends Record<string, any>, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  keys.forEach(key => {
    if (key in obj) {
      result[key] = obj[key];
    }
  });
  return result;
}

// Omit properties from object
export function omit<T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  keys.forEach(key => {
    delete result[key];
  });
  return result;
}

/**
 * Error utility functions
 */

// Create validation error
export function createValidationError(field: string, message: string): AppError {
  return new AppError(
    `Validation failed for field: ${field}`,
    400,
    'VALIDATION_ERROR',
    [{ field, message }]
  );
}

// Create not found error
export function createNotFoundError(resource: string, id?: string): AppError {
  const message = id ? `${resource} with id ${id} not found` : `${resource} not found`;
  return new AppError(message, 404, 'NOT_FOUND');
}

// Create unauthorized error
export function createUnauthorizedError(message: string = 'Unauthorized'): AppError {
  return new AppError(message, 401, 'UNAUTHORIZED');
}

// Create forbidden error
export function createForbiddenError(message: string = 'Forbidden'): AppError {
  return new AppError(message, 403, 'FORBIDDEN');
}

// Create conflict error
export function createConflictError(message: string): AppError {
  return new AppError(message, 409, 'CONFLICT');
}

/**
 * Performance utility functions
 */

// Simple timer utility
export class Timer {
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  reset(): void {
    this.startTime = Date.now();
  }

  elapsed(): number {
    return Date.now() - this.startTime;
  }

  elapsedSeconds(): number {
    return Math.round(this.elapsed() / 1000);
  }
}

// Create performance timer
export function createTimer(): Timer {
  return new Timer();
}

// Sleep function
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * URL utility functions
 */

// Extract file extension from URL
export function getFileExtension(url: string): string {
  const parts = url.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

// Generate file name with timestamp
export function generateFileName(originalName: string, prefix?: string): string {
  const extension = getFileExtension(originalName);
  const timestamp = Date.now();
  const randomString = generateRandomString(8);
  
  const namePrefix = prefix ? `${prefix}_` : '';
  return `${namePrefix}${timestamp}_${randomString}.${extension}`;
}

/**
 * Retry utility function
 */

export async function retry<T>(
  fn: () => Promise<T>,
  attempts: number = 3,
  delay: number = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (attempts <= 1) {
      throw error;
    }
    
    await sleep(delay);
    return retry(fn, attempts - 1, delay * 2); // Exponential backoff
  }
}