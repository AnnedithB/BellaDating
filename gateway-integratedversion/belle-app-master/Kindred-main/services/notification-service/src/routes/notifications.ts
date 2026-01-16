import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { NotificationQueueService } from '../services/queueService';
import { SendNotificationRequest, DeviceTokenData } from '../types';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const prisma = new PrismaClient();
const queueService = new NotificationQueueService(prisma);

// Get user's notifications
router.get('/user/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const notifications = await prisma.notification.findMany({
      where: {
        OR: [
          { userId },
          { userIds: { has: userId } }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        deliveries: {
          where: { userId },
          select: {
            status: true,
            deliveredAt: true,
            clickedAt: true
          }
        }
      }
    });

    // Transform to a user-friendly format
    const transformedNotifications = notifications.map(notification => {
      const delivery = notification.deliveries[0];
      return {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl,
        data: notification.data,
        read: delivery?.clickedAt != null,
        deliveredAt: delivery?.deliveredAt,
        createdAt: notification.createdAt
      };
    });

    res.json({
      status: 'success',
      data: {
        notifications: transformedNotifications,
        count: transformedNotifications.length,
        limit,
        offset
      }
    });

  } catch (error) {
    logger.error('Error getting user notifications:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get notifications'
    });
  }
});

// Get user's unread notifications
router.get('/user/:userId/unread', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const notifications = await prisma.notification.findMany({
      where: {
        OR: [
          { userId },
          { userIds: { has: userId } }
        ],
        deliveries: {
          some: {
            userId,
            clickedAt: null
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      include: {
        deliveries: {
          where: { userId },
          select: {
            status: true,
            deliveredAt: true,
            clickedAt: true
          }
        }
      }
    });

    const transformedNotifications = notifications.map(notification => {
      const delivery = notification.deliveries[0];
      return {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl,
        data: notification.data,
        read: false,
        deliveredAt: delivery?.deliveredAt,
        createdAt: notification.createdAt
      };
    });

    res.json({
      status: 'success',
      data: {
        notifications: transformedNotifications,
        count: transformedNotifications.length
      }
    });

  } catch (error) {
    logger.error('Error getting unread notifications:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get unread notifications'
    });
  }
});

// Mark notification as read
router.put('/:notificationId/read', async (req: Request, res: Response): Promise<void> => {
  try {
    const { notificationId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({
        status: 'error',
        message: 'userId is required'
      });
      return;
    }

    await prisma.notificationDelivery.updateMany({
      where: {
        notificationId,
        userId
      },
      data: {
        clickedAt: new Date()
      }
    });

    res.json({
      status: 'success',
      message: 'Notification marked as read'
    });

  } catch (error) {
    logger.error('Error marking notification as read:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to mark notification as read'
    });
  }
});

// Mark all user's notifications as read
router.put('/user/:userId/read-all', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    await prisma.notificationDelivery.updateMany({
      where: {
        userId,
        clickedAt: null
      },
      data: {
        clickedAt: new Date()
      }
    });

    res.json({
      status: 'success',
      message: 'All notifications marked as read'
    });

  } catch (error) {
    logger.error('Error marking all notifications as read:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to mark all notifications as read'
    });
  }
});

// Send notification
router.post('/send', async (req: Request, res: Response): Promise<void> => {
  try {
    const request: SendNotificationRequest = req.body;
    
    // Create notification record
    const notification = await prisma.notification.create({
      data: {
        type: request.type,
        userId: request.userId,
        userIds: request.userIds || [],
        allUsers: request.allUsers || false,
        title: request.payload.title,
        body: request.payload.body,
        imageUrl: request.payload.imageUrl,
        data: request.payload.data,
        scheduledFor: request.scheduledFor,
        priority: request.priority || 'NORMAL',
        templateId: request.templateId
      }
    });

    // Get target device tokens
    let deviceTokens;
    if (request.allUsers) {
      deviceTokens = await prisma.deviceToken.findMany({
        where: { isActive: true }
      });
    } else if (request.userIds && request.userIds.length > 0) {
      deviceTokens = await prisma.deviceToken.findMany({
        where: { 
          userId: { in: request.userIds },
          isActive: true 
        }
      });
    } else if (request.userId) {
      deviceTokens = await prisma.deviceToken.findMany({
        where: { 
          userId: request.userId,
          isActive: true 
        }
      });
    } else {
      res.status(400).json({
        status: 'error',
        message: 'No target users specified'
      });
      return;
    }

    if (deviceTokens.length === 0) {
      res.status(404).json({
        status: 'error',
        message: 'No active device tokens found for target users'
      });
      return;
    }

    // Create delivery records
    const deliveryRecords = deviceTokens.map((token: any) => ({
      notificationId: notification.id,
      deviceTokenId: token.id,
      userId: token.userId
    }));

    await prisma.notificationDelivery.createMany({
      data: deliveryRecords
    });

    // Update notification with target count
    await prisma.notification.update({
      where: { id: notification.id },
      data: { totalTargets: deviceTokens.length }
    });

    // Queue for processing
    await queueService.queueNotification({
      id: uuidv4(),
      notificationId: notification.id,
      deviceTokens: deviceTokens.map((token: any) => ({
        id: token.id,
        token: token.token,
        platform: token.platform,
        userId: token.userId
      })),
      payload: request.payload,
      retryCount: 0,
      priority: request.priority || 'NORMAL'
    });

    res.json({
      status: 'success',
      data: {
        notificationId: notification.id,
        targetCount: deviceTokens.length,
        scheduledFor: request.scheduledFor || 'immediate'
      }
    });

  } catch (error) {
    logger.error('Error sending notification:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to send notification'
    });
  }
});

// Register device token
router.post('/device-tokens', async (req: Request, res: Response) => {
  try {
    const tokenData: DeviceTokenData = req.body;
    
    // Upsert device token
    const deviceToken = await prisma.deviceToken.upsert({
      where: { token: tokenData.token },
      update: {
        userId: tokenData.userId,
        platform: tokenData.platform,
        isActive: true,
        appVersion: tokenData.appVersion,
        deviceModel: tokenData.deviceModel,
        osVersion: tokenData.osVersion,
        lastUsedAt: new Date()
      },
      create: {
        userId: tokenData.userId,
        token: tokenData.token,
        platform: tokenData.platform,
        appVersion: tokenData.appVersion,
        deviceModel: tokenData.deviceModel,
        osVersion: tokenData.osVersion
      }
    });

    res.json({
      status: 'success',
      data: { deviceTokenId: deviceToken.id }
    });

  } catch (error) {
    logger.error('Error registering device token:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to register device token'
    });
  }
});

// Get notification status
router.get('/:id/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const notification = await prisma.notification.findUnique({
      where: { id },
      include: {
        deliveries: {
          select: {
            status: true,
            sentAt: true,
            deliveredAt: true,
            clickedAt: true,
            errorMessage: true
          }
        }
      }
    });

    if (!notification) {
      res.status(404).json({
        status: 'error',
        message: 'Notification not found'
      });
      return;
    }

    const deliveryStats = {
      total: notification.deliveries.length,
      sent: notification.deliveries.filter((d: any) => d.status === 'SENT').length,
      delivered: notification.deliveries.filter((d: any) => d.status === 'DELIVERED').length,
      failed: notification.deliveries.filter((d: any) => d.status === 'FAILED').length,
      clicked: notification.deliveries.filter((d: any) => d.clickedAt).length
    };

    res.json({
      status: 'success',
      data: {
        notification: {
          id: notification.id,
          type: notification.type,
          status: notification.status,
          createdAt: notification.createdAt,
          sentAt: notification.sentAt,
          totalTargets: notification.totalTargets,
          successfulSends: notification.successfulSends,
          failedSends: notification.failedSends
        },
        deliveryStats
      }
    });

  } catch (error) {
    logger.error('Error getting notification status:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get notification status'
    });
  }
});

// Get user preferences
router.get('/preferences/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    
    const preferences = await prisma.notificationPreference.findUnique({
      where: { userId }
    });

    if (!preferences) {
      // Return default preferences
      res.json({
        status: 'success',
        data: {
          userId,
          globalEnabled: true,
          newMatchEnabled: true,
          newMessageEnabled: true,
          callStartEnabled: true,
          marketingEnabled: false,
          quietHoursStart: null,
          quietHoursEnd: null,
          timezone: 'UTC'
        }
      });
      return;
    }

    res.json({
      status: 'success',
      data: preferences
    });

  } catch (error) {
    logger.error('Error getting user preferences:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get user preferences'
    });
  }
});

// Update user preferences
router.put('/preferences/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const preferences = req.body;
    
    const updatedPreferences = await prisma.notificationPreference.upsert({
      where: { userId },
      update: preferences,
      create: {
        userId,
        ...preferences
      }
    });

    res.json({
      status: 'success',
      data: updatedPreferences
    });

  } catch (error) {
    logger.error('Error updating user preferences:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update user preferences'
    });
  }
});

// Get queue statistics
router.get('/queue/stats', async (req: Request, res: Response) => {
  try {
    const stats = await queueService.getQueueStats();
    
    res.json({
      status: 'success',
      data: stats
    });

  } catch (error) {
    logger.error('Error getting queue stats:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to get queue statistics'
    });
  }
});

export default router;