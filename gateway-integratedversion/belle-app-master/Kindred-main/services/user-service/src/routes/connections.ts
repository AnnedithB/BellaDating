import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { RedisClientType } from 'redis';
import { Logger } from '../utils/logger';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler, createNotFoundError, createValidationError } from '../utils/helpers';

export default function createConnectionsRoutes(
  prisma: PrismaClient,
  redis: RedisClientType,
  logger: Logger
): Router {
  const router = Router();

  // All connection routes require authentication
  router.use(authMiddleware(prisma, logger));

  // Get current user's connections
  router.get('/', asyncHandler(async (req: any, res: any) => {
    try {
      const userId = req.user.id;

      // Get connections where user is either user1 or user2
      const connections = await prisma.connection.findMany({
        where: {
          OR: [
            { user1Id: userId },
            { user2Id: userId }
          ],
          isActive: true
        },
        include: {
          user1: {
            select: {
              id: true,
              username: true,
              email: true,
              profile: {
                select: {
                  displayName: true,
                  photos: true,
                  shortBio: true,
                  age: true,
                  locationCity: true
                }
              }
            }
          },
          user2: {
            select: {
              id: true,
              username: true,
              email: true,
              profile: {
                select: {
                  displayName: true,
                  photos: true,
                  shortBio: true,
                  age: true,
                  locationCity: true
                }
              }
            }
          },
          chatRoom: {
            select: {
              id: true,
              roomName: true,
              isActive: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      // Transform connections to show the "other" user
      const transformedConnections = connections.map(conn => {
        const otherUser = conn.user1Id === userId ? conn.user2 : conn.user1;
        const photos = (otherUser.profile?.photos as string[]) || [];

        return {
          id: conn.id,
          connectionType: conn.connectionType,
          isActive: conn.isActive,
          createdAt: conn.createdAt,
          updatedAt: conn.updatedAt,
          chatRoom: conn.chatRoom,
          user: {
            id: otherUser.id,
            username: otherUser.username,
            name: otherUser.profile?.displayName || otherUser.username,
            profilePicture: photos[0] || null,
            bio: otherUser.profile?.shortBio || null,
            age: otherUser.profile?.age || null,
            location: otherUser.profile?.locationCity || null
          }
        };
      });

      res.status(200).json({
        status: 'success',
        data: {
          connections: transformedConnections,
          count: transformedConnections.length
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });

    } catch (error: any) {
      logger.error('Get connections failed', error);
      throw error;
    }
  }));

  // Get a specific connection by ID
  router.get('/:connectionId', asyncHandler(async (req: any, res: any) => {
    try {
      const userId = req.user.id;
      const { connectionId } = req.params;

      const connection = await prisma.connection.findFirst({
        where: {
          id: connectionId,
          OR: [
            { user1Id: userId },
            { user2Id: userId }
          ]
        },
        include: {
          user1: {
            select: {
              id: true,
              username: true,
              profile: {
                select: {
                  displayName: true,
                  photos: true,
                  shortBio: true,
                  age: true,
                  locationCity: true
                }
              }
            }
          },
          user2: {
            select: {
              id: true,
              username: true,
              profile: {
                select: {
                  displayName: true,
                  photos: true,
                  shortBio: true,
                  age: true,
                  locationCity: true
                }
              }
            }
          },
          chatRoom: true,
          interactionLog: {
            select: {
              id: true,
              interactionType: true,
              startedAt: true,
              endedAt: true,
              durationSeconds: true
            }
          }
        }
      });

      if (!connection) {
        throw createNotFoundError('Connection');
      }

      const otherUser = connection.user1Id === userId ? connection.user2 : connection.user1;
      const photos = (otherUser.profile?.photos as string[]) || [];

      res.status(200).json({
        status: 'success',
        data: {
          connection: {
            id: connection.id,
            connectionType: connection.connectionType,
            isActive: connection.isActive,
            createdAt: connection.createdAt,
            updatedAt: connection.updatedAt,
            chatRoom: connection.chatRoom,
            interactionLog: connection.interactionLog,
            user: {
              id: otherUser.id,
              username: otherUser.username,
              name: otherUser.profile?.displayName || otherUser.username,
              profilePicture: photos[0] || null,
              bio: otherUser.profile?.shortBio || null,
              age: otherUser.profile?.age || null,
              location: otherUser.profile?.locationCity || null
            }
          }
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });

    } catch (error: any) {
      logger.error('Get connection failed', error);
      throw error;
    }
  }));

  // Deactivate a connection (soft delete)
  router.delete('/:connectionId', asyncHandler(async (req: any, res: any) => {
    try {
      const userId = req.user.id;
      const { connectionId } = req.params;

      // Verify user owns this connection
      const connection = await prisma.connection.findFirst({
        where: {
          id: connectionId,
          OR: [
            { user1Id: userId },
            { user2Id: userId }
          ]
        }
      });

      if (!connection) {
        throw createNotFoundError('Connection');
      }

      // Soft delete by setting isActive to false
      await prisma.connection.update({
        where: { id: connectionId },
        data: { isActive: false }
      });

      // Also deactivate the chat room if it exists
      await prisma.chatRoom.updateMany({
        where: { connectionId },
        data: { isActive: false }
      });

      logger.info('Connection deactivated', {
        userId,
        connectionId
      });

      res.status(200).json({
        status: 'success',
        data: {
          message: 'Connection removed successfully'
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId
        }
      });

    } catch (error: any) {
      logger.error('Delete connection failed', error);
      throw error;
    }
  }));

  return router;
}
