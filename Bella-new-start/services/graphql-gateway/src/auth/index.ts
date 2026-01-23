import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthContext } from '../types';

export interface AuthToken {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

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

export async function authenticateUser(token: string): Promise<AuthContext> {
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as AuthToken;
    
    // In a real implementation, you might want to:
    // 1. Check if the user still exists in the database
    // 2. Check if the user account is active/not banned
    // 3. Refresh user data from the database
    
    const user = {
      id: decoded.userId,
      email: decoded.email,
      // These would be fetched from the user service in a real implementation
      name: '',
      bio: '',
      age: 0,
      gender: '',
      interests: [],
      location: '',
      profilePicture: '',
      isOnline: true,
      lastSeen: new Date(),
      isActive: true,
      isVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
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