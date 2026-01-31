import { PrismaClient } from '@prisma/client';
import { NotificationQueueService } from '../services/queueService';

describe('NotificationQueueService (unit)', () => {
  let service: NotificationQueueService;
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient();
    service = new NotificationQueueService(prisma);
  });

  test('sanitizePayloadForPrivacy removes message content and sets safe body for NEW_MESSAGE', () => {
    const payload: any = {
      type: 'NEW_MESSAGE',
      title: 'New message',
      body: 'This is a secret message',
      data: {
        senderName: 'Alice',
        content: 'This is the full message payload that should not be sent in push'
      }
    };

    // Access private method via any cast for testing
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sanitized = (service as any).sanitizePayloadForPrivacy(payload);
    expect(sanitized.body).toBe('Alice sent a message');
    expect(sanitized.data.content).toBeUndefined();
  });
});

