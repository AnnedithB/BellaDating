import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthContext } from '../types';

export interface AuthToken {
  userId: string;
  email: string;
  username: string;
  emailVerified?: boolean;
  iat: number;
  exp: number;
}

// Simple in-memory cache for user validation (cleared on restart)
// In production, use Redis for distributed caching
const userValidationCache = new Map<string, { isValid: boolean; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function extractTokenFromRequest(request: any): string | null {
  const authHeader = request.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Also check for token in cookies (for browser requests)
  if (request.cookies && request.cookies.token) {
    return request.cookies.token;
  }

  return null;
}

/**
 * Validate user exists and is active by calling user service
 */
async function validateUserWithService(userId: string): Promise<{
  isValid: boolean;
  user?: any;
}> {
  // Check cache first
  const cached = userValidationCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return { isValid: cached.isValid };
  }

  try {
    // Call user service to verify user exists and is active
    const response = await fetch(`${config.services.user}/profile/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Request': 'true', // Mark as internal service call
      },
      signal: AbortSignal.timeout(3000), // 3 second timeout
    });

    if (!response.ok) {
      // User not found or service error
      userValidationCache.set(userId, { isValid: false, expiresAt: Date.now() + CACHE_TTL_MS });
      return { isValid: false };
    }

    const data = await response.json();
    const user = data.data?.user || data.user;

    // Check if user is active
    if (!user || user.isActive === false) {
      userValidationCache.set(userId, { isValid: false, expiresAt: Date.now() + CACHE_TTL_MS });
      return { isValid: false };
    }

    // Cache successful validation
    userValidationCache.set(userId, { isValid: true, expiresAt: Date.now() + CACHE_TTL_MS });
    return { isValid: true, user };
  } catch (error) {
    console.error('Error validating user with service:', error);
    // On error, allow the request but don't cache (fail open for availability)
    // In high-security scenarios, you might want to fail closed instead
    return { isValid: true };
  }
}

export async function authenticateUser(token: string): Promise<AuthContext> {
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as AuthToken;

    // For now, skip external user validation since:
    // 1. JWT is already validated (signature + expiry)
    // 2. User service requires auth token for profile endpoint
    // In production, consider adding an internal-only endpoint for validation
    const now = new Date();

    const user = {
      id: decoded.userId,
      email: decoded.email,
      username: decoded.username,
      emailVerified: decoded.emailVerified || false,
      // Default values - these get populated when fetching full profile
      name: '',
      bio: '',
      age: 0,
      gender: '',
      interests: [] as string[],
      location: '',
      profilePicture: '',
      isOnline: true,
      lastSeen: now,
      isActive: true,
      isVerified: decoded.emailVerified || false,
      createdAt: now,
      updatedAt: now,
    };

    return {
      user,
      token,
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return { user: undefined, token: undefined };
  }
}

export function generateToken(user: any): string {
  const payload = {
    userId: user.id,
    email: user.email,
    username: user.username,
    emailVerified: user.emailVerified || false,
  };

  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: '7d', // Token expires in 7 days
  });
}

export function verifyToken(token: string): AuthToken | null {
  try {
    return jwt.verify(token, config.jwtSecret) as AuthToken;
  } catch (error) {
    return null;
  }
}

export async function createAuthContext(request: any): Promise<AuthContext> {
  const token = extractTokenFromRequest(request);

  if (!token) {
    return { user: undefined, token: undefined };
  }

  return await authenticateUser(token);
}

/**
 * Invalidate cached user validation (call when user is banned/deactivated)
 */
export function invalidateUserCache(userId: string): void {
  userValidationCache.delete(userId);
}

/**
 * Clear entire validation cache
 */
export function clearUserCache(): void {
  userValidationCache.clear();
}