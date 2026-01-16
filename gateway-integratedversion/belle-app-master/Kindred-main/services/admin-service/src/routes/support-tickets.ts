import express, { Request, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import prisma from '../prisma/client';
import { authenticateAdmin, requirePermission } from '../middleware/auth';
import { TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'tickets');
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, PDFs, and documents are allowed.'));
    }
  }
});

const supportPermissions = {
  read: 'support.read',
  write: 'support.write',
  assign: 'support.assign',
  escalate: 'support.escalate',
};

// Generate ticket number
function generateTicketNumber(): string {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `TK-${timestamp}-${random}`;
}

// Get all support tickets with filtering and pagination
router.get('/',
  authenticateAdmin,
  requirePermission(supportPermissions.read),
  [
    query('status').optional().isIn(Object.values(TicketStatus)),
    query('priority').optional().isIn(Object.values(TicketPriority)),
    query('category').optional().isIn(Object.values(TicketCategory)),
    query('assignedTo').optional().isUUID(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().isString(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        status,
        priority,
        category,
        assignedTo,
        page = 1,
        limit = 20,
        search,
      } = req.query as any;

      const offset = (page - 1) * limit;

      const where: any = {};
      if (status) where.status = status;
      if (priority) where.priority = priority;
      if (category) where.category = category;
      if (assignedTo) where.assignedAdminId = assignedTo;
      
      if (search) {
        where.OR = [
          { subject: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { ticketNumber: { contains: search, mode: 'insensitive' } },
          { customerEmail: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [tickets, total] = await Promise.all([
        prisma.supportTicket.findMany({
          where,
          skip: offset,
          take: limit,
          include: {
            assignedAdmin: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            comments: {
              take: 1,
              orderBy: { createdAt: 'desc' },
              select: {
                createdAt: true,
                isFromCustomer: true,
              },
            },
            _count: {
              select: {
                comments: true,
                attachments: true,
              },
            },
          },
          orderBy: [
            { priority: 'desc' },
            { createdAt: 'desc' },
          ],
        }),
        prisma.supportTicket.count({ where }),
      ]);

      res.json({
        status: 'success',
        data: tickets.map(ticket => ({
          ...ticket,
          responseTimeHours: ticket.responseTimeHours,
          lastActivity: ticket.comments[0]?.createdAt || ticket.createdAt,
          hasUnreadCustomerMessage: ticket.comments[0]?.isFromCustomer || false,
        })),
        meta: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get single ticket details
router.get('/:id',
  authenticateAdmin,
  requirePermission(supportPermissions.read),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ticket = await prisma.supportTicket.findUnique({
        where: { id: req.params.id },
        include: {
          assignedAdmin: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          escalatedAdmin: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          comments: {
            include: {
              authorAdmin: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
              attachments: true,
            },
            orderBy: { createdAt: 'asc' },
          },
          attachments: true,
          tags: true,
        },
      });

      if (!ticket) {
        return res.status(404).json({
          status: 'error',
          message: 'Ticket not found',
        });
      }

      res.json({
        status: 'success',
        data: ticket,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Create new ticket (usually from customer support interface)
router.post('/',
  authenticateAdmin,
  requirePermission(supportPermissions.write),
  [
    body('subject').notEmpty().trim().isLength({ min: 5, max: 200 }),
    body('description').notEmpty().trim().isLength({ min: 10, max: 2000 }),
    body('category').isIn(Object.values(TicketCategory)),
    body('priority').optional().isIn(Object.values(TicketPriority)),
    body('customerId').notEmpty().trim(),
    body('customerEmail').isEmail(),
    body('customerName').optional().trim(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        subject,
        description,
        category,
        priority = TicketPriority.MEDIUM,
        customerId,
        customerEmail,
        customerName,
      } = req.body;

      const ticketNumber = generateTicketNumber();

      const ticket = await prisma.supportTicket.create({
        data: {
          ticketNumber,
          subject,
          description,
          category,
          priority,
          customerId,
          customerEmail,
          customerName,
          createdBy: (req as any).admin.id,
        },
        include: {
          assignedAdmin: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      // Auto-assign based on category if rules exist
      await autoAssignTicket(ticket.id, category);

      res.status(201).json({
        status: 'success',
        data: ticket,
        message: 'Support ticket created successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update ticket
router.put('/:id',
  authenticateAdmin,
  requirePermission(supportPermissions.write),
  [
    body('subject').optional().trim().isLength({ min: 5, max: 200 }),
    body('description').optional().trim().isLength({ min: 10, max: 2000 }),
    body('category').optional().isIn(Object.values(TicketCategory)),
    body('priority').optional().isIn(Object.values(TicketPriority)),
    body('status').optional().isIn(Object.values(TicketStatus)),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const updates = req.body;
      const adminId = (req as any).admin.id;

      // Handle status changes
      const statusChanges: any = {};
      if (updates.status === TicketStatus.RESOLVED) {
        statusChanges.resolvedAt = new Date();
        statusChanges.resolutionTimeHours = await calculateResolutionTime(id);
      } else if (updates.status === TicketStatus.CLOSED) {
        statusChanges.closedAt = new Date();
      }

      const ticket = await prisma.supportTicket.update({
        where: { id },
        data: {
          ...updates,
          ...statusChanges,
        },
        include: {
          assignedAdmin: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      // Log the change
      await logTicketActivity(id, adminId, 'UPDATED', updates);

      res.json({
        status: 'success',
        data: ticket,
        message: 'Ticket updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// Assign ticket to admin
router.post('/:id/assign',
  authenticateAdmin,
  requirePermission(supportPermissions.assign),
  [
    body('assignedTo').isUUID(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { assignedTo } = req.body;
      const adminId = (req as any).admin.id;

      // Verify the assigned admin exists
      const assignedAdmin = await prisma.admin.findUnique({
        where: { id: assignedTo },
        select: { id: true, firstName: true, lastName: true, email: true },
      });

      if (!assignedAdmin) {
        return res.status(404).json({
          status: 'error',
          message: 'Assigned admin not found',
        });
      }

      const ticket = await prisma.supportTicket.update({
        where: { id },
        data: {
          assignedAdminId: assignedTo,
          status: TicketStatus.IN_PROGRESS,
        },
        include: {
          assignedAdmin: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      // Log the assignment
      await logTicketActivity(id, adminId, 'ASSIGNED', { assignedTo });

      res.json({
        status: 'success',
        data: ticket,
        message: 'Ticket assigned successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// Escalate ticket
router.post('/:id/escalate',
  authenticateAdmin,
  requirePermission(supportPermissions.escalate),
  [
    body('reason').notEmpty().trim().isLength({ min: 10, max: 500 }),
    body('escalateTo').optional().isUUID(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { reason, escalateTo } = req.body;
      const adminId = (req as any).admin.id;

      const ticket = await prisma.supportTicket.update({
        where: { id },
        data: {
          isEscalated: true,
          escalatedAt: new Date(),
          escalatedBy: adminId,
          priority: TicketPriority.HIGH,
          ...(escalateTo && { assignedAdminId: escalateTo }),
        },
        include: {
          assignedAdmin: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          escalatedAdmin: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      // Add escalation comment
      await prisma.ticketComment.create({
        data: {
          ticketId: id,
          content: `Ticket escalated. Reason: ${reason}`,
          isInternal: true,
          authorId: adminId,
        },
      });

      // Log the escalation
      await logTicketActivity(id, adminId, 'ESCALATED', { reason, escalateTo });

      res.json({
        status: 'success',
        data: ticket,
        message: 'Ticket escalated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// Add comment to ticket
router.post('/:id/comments',
  authenticateAdmin,
  requirePermission(supportPermissions.write),
  upload.array('attachments', 5),
  [
    body('content').notEmpty().trim().isLength({ min: 1, max: 2000 }),
    body('isInternal').optional().isBoolean(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { content, isInternal = false } = req.body;
      const adminId = (req as any).admin.id;
      const files = req.files as Express.Multer.File[];

      // Create comment
      const comment = await prisma.ticketComment.create({
        data: {
          ticketId: id,
          content,
          isInternal,
          authorId: adminId,
        },
        include: {
          authorAdmin: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      // Handle file attachments
      const attachments = [];
      if (files && files.length > 0) {
        for (const file of files) {
          const attachment = await prisma.ticketAttachment.create({
            data: {
              filename: file.filename,
              originalName: file.originalname,
              mimeType: file.mimetype,
              fileSize: file.size,
              filePath: file.path,
              commentId: comment.id,
              uploadedBy: adminId,
            },
          });
          attachments.push(attachment);
        }
      }

      // Update ticket with first response time if this is the first admin response
      const ticket = await prisma.supportTicket.findUnique({
        where: { id },
        select: { firstResponseAt: true, createdAt: true },
      });

      if (!ticket?.firstResponseAt && !isInternal) {
        const responseTimeHours = (Date.now() - ticket!.createdAt.getTime()) / (1000 * 60 * 60);
        await prisma.supportTicket.update({
          where: { id },
          data: {
            firstResponseAt: new Date(),
            responseTimeHours,
          },
        });
      }

      res.status(201).json({
        status: 'success',
        data: {
          ...comment,
          attachments,
        },
        message: 'Comment added successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get ticket metrics
router.get('/metrics/dashboard',
  authenticateAdmin,
  requirePermission(supportPermissions.read),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const today = new Date();
      const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [
        totalTickets,
        openTickets,
        pendingTickets,
        resolvedToday,
        avgResponseTime,
        avgResolutionTime,
        escalatedTickets,
        ticketsByCategory,
        ticketsByPriority,
        recentActivity,
      ] = await Promise.all([
        prisma.supportTicket.count(),
        prisma.supportTicket.count({ where: { status: TicketStatus.OPEN } }),
        prisma.supportTicket.count({ 
          where: { 
            status: {
              in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_FOR_CUSTOMER]
            }
          }
        }),
        prisma.supportTicket.count({
          where: {
            status: TicketStatus.RESOLVED,
            resolvedAt: { gte: new Date(today.setHours(0, 0, 0, 0)) },
          },
        }),
        prisma.supportTicket.aggregate({
          _avg: { responseTimeHours: true },
          where: { responseTimeHours: { not: null } },
        }),
        prisma.supportTicket.aggregate({
          _avg: { resolutionTimeHours: true },
          where: { resolutionTimeHours: { not: null } },
        }),
        prisma.supportTicket.count({ where: { isEscalated: true } }),
        prisma.supportTicket.groupBy({
          by: ['category'],
          _count: true,
        }),
        prisma.supportTicket.groupBy({
          by: ['priority'],
          _count: true,
        }),
        prisma.supportTicket.findMany({
          take: 10,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            ticketNumber: true,
            subject: true,
            status: true,
            priority: true,
            updatedAt: true,
            assignedAdmin: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        }),
      ]);

      res.json({
        status: 'success',
        data: {
          overview: {
            totalTickets,
            openTickets,
            pendingTickets,
            resolvedToday,
            escalatedTickets,
          },
          performance: {
            avgResponseTimeHours: avgResponseTime._avg.responseTimeHours || 0,
            avgResolutionTimeHours: avgResolutionTime._avg.resolutionTimeHours || 0,
          },
          distribution: {
            byCategory: ticketsByCategory,
            byPriority: ticketsByPriority,
          },
          recentActivity,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Helper functions
async function autoAssignTicket(ticketId: string, category: TicketCategory) {
  // Implementation for auto-assignment rules based on category
  // This can be configured in system settings
  try {
    const rules = await prisma.systemSettings.findUnique({
      where: { key: 'ticket_auto_assignment_rules' },
    });

    if (rules && rules.value) {
      const assignmentRules = rules.value as any;
      const assignedTo = assignmentRules[category];
      
      if (assignedTo) {
        await prisma.supportTicket.update({
          where: { id: ticketId },
          data: { 
            assignedAdminId: assignedTo,
            status: TicketStatus.IN_PROGRESS,
          },
        });
      }
    }
  } catch (error) {
    console.error('Auto-assignment failed:', error);
  }
}

async function calculateResolutionTime(ticketId: string): Promise<number> {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { createdAt: true },
  });

  if (!ticket) return 0;

  return (Date.now() - ticket.createdAt.getTime()) / (1000 * 60 * 60);
}

async function logTicketActivity(
  ticketId: string,
  adminId: string,
  action: string,
  details: any
) {
  try {
    await prisma.adminLog.create({
      data: {
        adminId,
        action,
        resource: `ticket:${ticketId}`,
        details,
      },
    });
  } catch (error) {
    console.error('Failed to log ticket activity:', error);
  }
}

export default router;