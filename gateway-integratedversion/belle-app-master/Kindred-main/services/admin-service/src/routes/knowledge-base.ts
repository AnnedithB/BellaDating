import express, { Request, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import prisma from '../prisma/client';
import { authenticateAdmin, requirePermission } from '../middleware/auth';
import slugify from 'slugify';

const router = express.Router();

const kbPermissions = {
  read: 'knowledge_base.read',
  write: 'knowledge_base.write',
  publish: 'knowledge_base.publish',
};

// Generate SEO-friendly slug
function generateSlug(title: string): string {
  return slugify(title, {
    lower: true,
    strict: true,
    remove: /[*+~.()'"!:@]/g,
  });
}

// Get all knowledge base articles
router.get('/',
  authenticateAdmin,
  requirePermission(kbPermissions.read),
  [
    query('category').optional().isString(),
    query('published').optional().isBoolean(),
    query('search').optional().isString(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        category,
        published,
        search,
        page = 1,
        limit = 20,
      } = req.query as any;

      const offset = (page - 1) * limit;

      const where: any = {};
      if (category) where.category = category;
      if (published !== undefined) where.isPublished = published;
      
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
          include: {
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            lastEditor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: [
            { isPublished: 'desc' },
            { updatedAt: 'desc' },
          ],
        }),
        prisma.knowledgeBaseArticle.count({ where }),
        prisma.knowledgeBaseArticle.groupBy({
          by: ['category'],
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
          categories,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get single article
router.get('/:id',
  authenticateAdmin,
  requirePermission(kbPermissions.read),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const article = await prisma.knowledgeBaseArticle.findUnique({
        where: { id: req.params.id },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          lastEditor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
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
        where: { id: req.params.id },
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

// Create new article
router.post('/',
  authenticateAdmin,
  requirePermission(kbPermissions.write),
  [
    body('title').notEmpty().trim().isLength({ min: 5, max: 200 }),
    body('content').notEmpty().trim().isLength({ min: 10, max: 10000 }),
    body('summary').optional().trim().isLength({ max: 500 }),
    body('category').notEmpty().trim(),
    body('tags').optional().isArray(),
    body('searchKeywords').optional().isArray(),
    body('isPublished').optional().isBoolean(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        title,
        content,
        summary,
        category,
        tags = [],
        searchKeywords = [],
        isPublished = false,
      } = req.body;

      const adminId = (req as any).admin.id;
      let slug = generateSlug(title);

      // Ensure slug is unique
      let counter = 1;
      let originalSlug = slug;
      while (await prisma.knowledgeBaseArticle.findUnique({ where: { slug } })) {
        slug = `${originalSlug}-${counter}`;
        counter++;
      }

      const article = await prisma.knowledgeBaseArticle.create({
        data: {
          title,
          content,
          summary,
          category,
          tags,
          searchKeywords,
          slug,
          isPublished,
          publishedAt: isPublished ? new Date() : null,
          authorId: adminId,
        },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      res.status(201).json({
        status: 'success',
        data: article,
        message: 'Article created successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// Update article
router.put('/:id',
  authenticateAdmin,
  requirePermission(kbPermissions.write),
  [
    body('title').optional().trim().isLength({ min: 5, max: 200 }),
    body('content').optional().trim().isLength({ min: 10, max: 10000 }),
    body('summary').optional().trim().isLength({ max: 500 }),
    body('category').optional().trim(),
    body('tags').optional().isArray(),
    body('searchKeywords').optional().isArray(),
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

      // Update slug if title changed
      if (updates.title) {
        let slug = generateSlug(updates.title);
        let counter = 1;
        let originalSlug = slug;
        
        while (await prisma.knowledgeBaseArticle.findFirst({ 
          where: { slug, id: { not: id } } 
        })) {
          slug = `${originalSlug}-${counter}`;
          counter++;
        }
        updates.slug = slug;
      }

      const article = await prisma.knowledgeBaseArticle.update({
        where: { id },
        data: {
          ...updates,
          lastEditedBy: adminId,
        },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          lastEditor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      res.json({
        status: 'success',
        data: article,
        message: 'Article updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// Publish/unpublish article
router.patch('/:id/publish',
  authenticateAdmin,
  requirePermission(kbPermissions.publish),
  [
    body('isPublished').isBoolean(),
  ],
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { isPublished } = req.body;
      const adminId = (req as any).admin.id;

      const article = await prisma.knowledgeBaseArticle.update({
        where: { id },
        data: {
          isPublished,
          publishedAt: isPublished ? new Date() : null,
          lastEditedBy: adminId,
        },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      res.json({
        status: 'success',
        data: article,
        message: `Article ${isPublished ? 'published' : 'unpublished'} successfully`,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Delete article
router.delete('/:id',
  authenticateAdmin,
  requirePermission(kbPermissions.write),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await prisma.knowledgeBaseArticle.delete({
        where: { id: req.params.id },
      });

      res.json({
        status: 'success',
        message: 'Article deleted successfully',
      });
    } catch (error) {
      if ((error as any).code === 'P2025') {
        return res.status(404).json({
          status: 'error',
          message: 'Article not found',
        });
      }
      next(error);
    }
  }
);

// Vote on article helpfulness
router.post('/:id/vote',
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
        where: { id },
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

// Get knowledge base analytics
router.get('/analytics/overview',
  authenticateAdmin,
  requirePermission(kbPermissions.read),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const [
        totalArticles,
        publishedArticles,
        totalViews,
        totalVotes,
        topArticles,
        categoryStats,
        recentActivity,
      ] = await Promise.all([
        prisma.knowledgeBaseArticle.count(),
        prisma.knowledgeBaseArticle.count({ where: { isPublished: true } }),
        prisma.knowledgeBaseArticle.aggregate({
          _sum: { viewCount: true },
        }),
        prisma.knowledgeBaseArticle.aggregate({
          _sum: { 
            helpfulVotes: true,
            notHelpfulVotes: true,
          },
        }),
        prisma.knowledgeBaseArticle.findMany({
          take: 10,
          orderBy: { viewCount: 'desc' },
          select: {
            id: true,
            title: true,
            viewCount: true,
            helpfulVotes: true,
            notHelpfulVotes: true,
            category: true,
          },
          where: { isPublished: true },
        }),
        prisma.knowledgeBaseArticle.groupBy({
          by: ['category'],
          _count: true,
          _sum: { viewCount: true },
        }),
        prisma.knowledgeBaseArticle.findMany({
          take: 10,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            title: true,
            updatedAt: true,
            isPublished: true,
            author: {
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
            totalArticles,
            publishedArticles,
            totalViews: totalViews._sum.viewCount || 0,
            totalVotes: (totalVotes._sum.helpfulVotes || 0) + (totalVotes._sum.notHelpfulVotes || 0),
            helpfulVotes: totalVotes._sum.helpfulVotes || 0,
            notHelpfulVotes: totalVotes._sum.notHelpfulVotes || 0,
          },
          topArticles,
          categoryStats,
          recentActivity,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;