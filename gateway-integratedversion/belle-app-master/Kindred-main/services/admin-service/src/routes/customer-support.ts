import express, { Request, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import multer from 'multer';
import path from 'path';
import prisma from '../prisma/client';

const router = express.Router();

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/customer-tickets/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not supported'), false);
    }
  },
});

// Submit new ticket
router.post('/submit',
  upload.array('attachments', 5),
  [
    body('title').notEmpty().trim().isLength({ min: 5, max: 200 }),
    body('description').notEmpty().trim().isLength({ min: 10, max: 2000 }),
    body('category').notEmpty().isIn(['GENERAL', 'TECHNICAL', 'BILLING', 'ACCOUNT', 'CONTENT', 'SAFETY']),
    body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
    body('userEmail').notEmpty().isEmail(),
    body('userName').notEmpty().trim().isLength({ min: 2, max: 100 }),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        title,
        description,
        category,
        priority = 'MEDIUM',
        userEmail,
        userName,
      } = req.body;

      // Create ticket
      const ticket = await prisma.supportTicket.create({
        data: {
          title,
          description,
          category,
          priority,
          status: 'OPEN',
          userEmail,
          userName,
          ticketNumber: `CUS-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
        },
      });

      // Handle file attachments
      const files = req.files as Express.Multer.File[];
      if (files && files.length > 0) {
        const attachments = files.map(file => ({
          ticketId: ticket.id,
          fileName: file.originalname,
          filePath: file.path,
          fileSize: file.size,
          mimeType: file.mimetype,
        }));

        await prisma.ticketAttachment.createMany({
          data: attachments,
        });
      }

      // Get ticket with attachments for response
      const ticketWithAttachments = await prisma.supportTicket.findUnique({
        where: { id: ticket.id },
        include: {
          attachments: true,
        },
      });

      res.status(201).json({
        status: 'success',
        data: ticketWithAttachments,
        message: 'Ticket submitted successfully. You will receive an email confirmation shortly.',
      });

      // TODO: Send email confirmation to customer
    } catch (error) {
      next(error);
    }
  }
);

// Get ticket status by ticket number
router.get('/status/:ticketNumber',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { ticketNumber } = req.params;

      const ticket = await prisma.supportTicket.findUnique({
        where: { ticketNumber },
        include: {
          comments: {
            where: { isInternal: false },
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              content: true,
              createdAt: true,
              isFromCustomer: true,
            },
          },
          attachments: {
            select: {
              id: true,
              fileName: true,
              fileSize: true,
              mimeType: true,
              createdAt: true,
            },
          },
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

// Add customer response to ticket
router.post('/:ticketNumber/respond',
  upload.array('attachments', 3),
  [
    body('content').notEmpty().trim().isLength({ min: 5, max: 2000 }),
    body('customerEmail').notEmpty().isEmail(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { ticketNumber } = req.params;
      const { content, customerEmail } = req.body;

      // Verify ticket exists and email matches
      const ticket = await prisma.supportTicket.findUnique({
        where: { ticketNumber },
      });

      if (!ticket) {
        return res.status(404).json({
          status: 'error',
          message: 'Ticket not found',
        });
      }

      if (ticket.userEmail !== customerEmail) {
        return res.status(403).json({
          status: 'error',
          message: 'Email does not match ticket owner',
        });
      }

      // Create comment
      const comment = await prisma.ticketComment.create({
        data: {
          ticketId: ticket.id,
          content,
          isFromCustomer: true,
          isInternal: false,
        },
      });

      // Handle file attachments
      const files = req.files as Express.Multer.File[];
      if (files && files.length > 0) {
        const attachments = files.map(file => ({
          ticketId: ticket.id,
          fileName: file.originalname,
          filePath: file.path,
          fileSize: file.size,
          mimeType: file.mimetype,
        }));

        await prisma.ticketAttachment.createMany({
          data: attachments,
        });
      }

      // Update ticket status if it was resolved
      if (ticket.status === 'RESOLVED') {
        await prisma.supportTicket.update({
          where: { id: ticket.id },
          data: { 
            status: 'OPEN',
            lastActivityAt: new Date(),
          },
        });
      } else {
        await prisma.supportTicket.update({
          where: { id: ticket.id },
          data: { lastActivityAt: new Date() },
        });
      }

      res.json({
        status: 'success',
        data: comment,
        message: 'Response added successfully',
      });

      // TODO: Notify assigned agent about customer response
    } catch (error) {
      next(error);
    }
  }
);

// Get knowledge base articles (public)
router.get('/help/articles',
  [
    query('category').optional().isString(),
    query('search').optional().isString(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 20 }).toInt(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        category,
        search,
        page = 1,
        limit = 10,
      } = req.query as any;

      const offset = (page - 1) * limit;

      const where: any = {
        isPublished: true,
      };

      if (category) where.category = category;
      
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { content: { contains: search, mode: 'insensitive' } },
          { summary: { contains: search, mode: 'insensitive' } },
          { searchKeywords: { has: search } },
        ];
      }

      const [articles, total, categories] = await Promise.all([
        prisma.knowledgeBaseArticle.findMany({
          where,
          skip: offset,
          take: limit,
          select: {
            id: true,
            title: true,
            summary: true,
            category: true,
            tags: true,
            slug: true,
            helpfulVotes: true,
            notHelpfulVotes: true,
            viewCount: true,
            publishedAt: true,
          },
          orderBy: [
            { viewCount: 'desc' },
            { helpfulVotes: 'desc' },
          ],
        }),
        prisma.knowledgeBaseArticle.count({ where }),
        prisma.knowledgeBaseArticle.groupBy({
          by: ['category'],
          where: { isPublished: true },
          _count: true,
        }),
      ]);

      res.json({
        status: 'success',
        data: articles,
        meta: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          categories: categories.map(cat => ({
            category: cat.category,
            count: cat._count,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get single knowledge base article
router.get('/help/articles/:slug',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { slug } = req.params;

      const article = await prisma.knowledgeBaseArticle.findUnique({
        where: { 
          slug,
          isPublished: true,
        },
        select: {
          id: true,
          title: true,
          content: true,
          summary: true,
          category: true,
          tags: true,
          helpfulVotes: true,
          notHelpfulVotes: true,
          viewCount: true,
          publishedAt: true,
        },
      });

      if (!article) {
        return res.status(404).json({
          status: 'error',
          message: 'Article not found',
        });
      }

      // Increment view count
      await prisma.knowledgeBaseArticle.update({
        where: { slug },
        data: { viewCount: { increment: 1 } },
      });

      res.json({
        status: 'success',
        data: article,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Vote on article helpfulness
router.post('/help/articles/:id/vote',
  [
    body('helpful').isBoolean(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { helpful } = req.body;

      const updateField = helpful ? 'helpfulVotes' : 'notHelpfulVotes';

      const article = await prisma.knowledgeBaseArticle.update({
        where: { 
          id,
          isPublished: true,
        },
        data: {
          [updateField]: { increment: 1 },
        },
        select: {
          id: true,
          helpfulVotes: true,
          notHelpfulVotes: true,
        },
      });

      res.json({
        status: 'success',
        data: article,
        message: 'Vote recorded successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get contact categories for ticket submission
router.get('/categories',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const categories = [
        {
          value: 'GENERAL',
          label: 'General Inquiry',
          description: 'General questions about our service',
        },
        {
          value: 'TECHNICAL',
          label: 'Technical Issue',
          description: 'App crashes, bugs, or technical problems',
        },
        {
          value: 'BILLING',
          label: 'Billing & Payments',
          description: 'Questions about subscriptions, payments, or refunds',
        },
        {
          value: 'ACCOUNT',
          label: 'Account Issues',
          description: 'Login problems, account settings, or profile issues',
        },
        {
          value: 'CONTENT',
          label: 'Content & Matching',
          description: 'Issues with matches, profiles, or content moderation',
        },
        {
          value: 'SAFETY',
          label: 'Safety & Security',
          description: 'Report abuse, harassment, or safety concerns',
        },
      ];

      res.json({
        status: 'success',
        data: categories,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;