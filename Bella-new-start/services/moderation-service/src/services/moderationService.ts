import { PrismaClient } from '@prisma/client';

export interface CreateReportData {
  contentId: string;
  contentType: string;
  reason: string;
  description?: string;
  reporterId: string;
}

export interface ModerationAction {
  action: 'APPROVE' | 'REJECT' | 'ESCALATE';
  reason: string;
  moderatorId: string;
}

export interface ModerationFilters {
  status?: string;
  contentType?: string;
  page: number;
  limit: number;
}

export class ModerationService {
  constructor(private prisma: PrismaClient) {}

  async createReport(data: CreateReportData) {
    // Placeholder implementation
    return {
      id: 'temp-id',
      ...data,
      status: 'PENDING',
      createdAt: new Date()
    };
  }

  async getModerationQueue(filters: ModerationFilters) {
    try {
      console.log('Fetching moderation queue with filters:', filters);
      
      // Try to get all records first without filters
      const allRecords = await this.prisma.moderationRecord.findMany({
        take: 10
      });
      
      console.log('Found records:', allRecords.length);
      console.log('Sample record:', allRecords[0]);

      // Build where clause for filtering
      const where: any = {};
      
      if (filters.status) {
        where.status = filters.status;
      }
      
      if (filters.contentType) {
        where.contentType = filters.contentType;
      }

      // Calculate pagination
      const skip = (filters.page - 1) * filters.limit;

      // Query moderation records from database
      const [reports, total] = await Promise.all([
        this.prisma.moderationRecord.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: filters.limit
        }),
        this.prisma.moderationRecord.count({ where })
      ]);

      console.log('Filtered reports:', reports.length, 'Total:', total);

      // Transform the data to match frontend expectations
      const transformedReports = reports.map(record => ({
        id: record.id,
        contentId: record.contentId,
        contentType: record.contentType,
        userId: record.userId,
        reportedUserId: record.userId, // For compatibility with frontend
        reporterUserId: 'system', // Placeholder since this is AI-detected content
        status: record.status,
        toxicityScore: record.toxicityScore,
        reportType: this.mapContentTypeToReportType(record.contentType),
        reason: record.actionReason || this.getReasonFromToxicity(record.toxicityScore),
        description: record.content || `${record.contentType} content flagged by AI moderation`,
        priority: this.getPriorityFromToxicity(record.toxicityScore),
        createdAt: record.createdAt,
        confidence: record.confidence,
        sourceService: record.sourceService
      }));

      return {
        reports: transformedReports,
        total,
        page: filters.page,
        limit: filters.limit
      };
    } catch (error) {
      console.error('Error fetching moderation queue:', error);
      return {
        reports: [],
        total: 0,
        page: filters.page,
        limit: filters.limit
      };
    }
  }

  private mapContentTypeToReportType(contentType: string): string {
    switch (contentType) {
      case 'TEXT_MESSAGE': return 'HARASSMENT';
      case 'IMAGE': return 'INAPPROPRIATE_CONTENT';
      case 'VOICE_NOTE': return 'INAPPROPRIATE_BEHAVIOR';
      case 'PROFILE_CONTENT': return 'FAKE_PROFILE';
      default: return 'OTHER';
    }
  }

  private getReasonFromToxicity(toxicityScore: number | null): string {
    if (!toxicityScore) return 'Content flagged for review';
    if (toxicityScore >= 0.9) return 'High toxicity detected';
    if (toxicityScore >= 0.7) return 'Moderate toxicity detected';
    if (toxicityScore >= 0.5) return 'Potentially inappropriate content';
    return 'Content flagged for review';
  }

  private getPriorityFromToxicity(toxicityScore: number | null): string {
    if (!toxicityScore) return 'MEDIUM';
    if (toxicityScore >= 0.9) return 'URGENT';
    if (toxicityScore >= 0.7) return 'HIGH';
    if (toxicityScore >= 0.5) return 'MEDIUM';
    return 'LOW';
  }

  async moderateContent(reportId: string, action: ModerationAction) {
    // Placeholder implementation
    return {
      id: reportId,
      status: action.action === 'APPROVE' ? 'RESOLVED' : 'REJECTED',
      moderatedAt: new Date(),
      moderatedBy: action.moderatorId,
      reason: action.reason
    };
  }

  async getReportById(reportId: string) {
    // Placeholder implementation
    return null;
  }

  async getReportsByUser(userId: string) {
    // Placeholder implementation
    return [];
  }

  isHealthy(): boolean {
    // Placeholder implementation
    return true;
  }

  async updateUserTrustScores() {
    // Placeholder implementation
    return;
  }
}

export default ModerationService;