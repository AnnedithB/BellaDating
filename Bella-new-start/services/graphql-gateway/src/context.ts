import { Request } from 'express';
import { config } from './config';
import { verifyToken } from './auth/verifyToken';
import { createDataSources } from './dataSources';

export interface GraphQLContext {
  auth: {
    user: any | null;
    token: string | null;
  };
  dataSources: any;
  services: {
    user: string;
    queuing: string;
    interaction: string;
    history: string;
    communication: string;
    notification: string;
    moderation: string;
    analytics: string;
    admin: string;
    subscription: string;
  };
}

export async function createContext({ req }: { req: Request }): Promise<GraphQLContext> {
  // Extract token from Authorization header
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  console.log(`[Context] Creating context`, {
    hasToken: !!token,
    tokenLength: token?.length || 0,
    path: req.path,
    method: req.method,
  });

  // Verify token and get user
  let user = null;
  if (token) {
    try {
      const decoded = await verifyToken(token);
      if (decoded) {
        // Transform decoded token into user object
        user = {
          id: decoded.userId || decoded.id,
          email: decoded.email,
          // These fields will be populated from user service if needed
          name: decoded.name || null,
          bio: decoded.bio || null,
          age: decoded.age || null,
          gender: decoded.gender || null,
          interests: decoded.interests || [],
          location: decoded.location || null,
          profilePicture: decoded.profilePicture || null,
          isOnline: decoded.isOnline || false,
          isActive: decoded.isActive !== undefined ? decoded.isActive : true,
          isVerified: decoded.isVerified || false,
          isPhotoVerified: decoded.isPhotoVerified || decoded.isVerified || false,
          createdAt: decoded.createdAt || new Date(),
          updatedAt: decoded.updatedAt || new Date(),
        };
        console.log(`[Context] User authenticated: ${user.id}`);
      }
    } catch (error) {
      console.error('[Context] Token verification failed:', error);
      // Don't throw error, just set user to null
    }
  } else {
    console.log('[Context] No token provided');
  }

  // Create data sources with token for authenticated requests
  const dataSources = createDataSources(token);

  return {
    auth: {
      user,
      token,
    },
    dataSources,
    services: config.services,
  };
}
