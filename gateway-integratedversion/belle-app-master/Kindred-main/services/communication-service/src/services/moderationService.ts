import axios from 'axios';
import { logger } from '../utils/logger';
import { config } from '../utils/config';

export interface ToxicityResult {
  isToxic: boolean;
  score: number;
  categories: {
    TOXICITY: number;
    SEVERE_TOXICITY: number;
    IDENTITY_ATTACK: number;
    INSULT: number;
    PROFANITY: number;
    THREAT: number;
    SEXUALLY_EXPLICIT: number;
    FLIRTATION: number;
  };
}

export interface ModerationAction {
  action: 'allow' | 'flag' | 'block' | 'escalate';
  reason?: string;
  confidence: number;
}

export class ModerationService {
  private perspectiveApiUrl: string;
  private apiKey: string;
  private isEnabled: boolean;

  constructor() {
    this.perspectiveApiUrl = config.moderation.perspectiveApiUrl;
    this.apiKey = config.moderation.perspectiveApiKey || '';
    this.isEnabled = config.moderation.enableAutoModeration && !!this.apiKey;
    
    if (!this.isEnabled) {
      logger.warn('AI Moderation disabled - API key not configured');
    }
  }

  async analyzeText(text: string): Promise<ToxicityResult | null> {
    if (!this.isEnabled || !text.trim()) {
      return null;
    }

    try {
      const requestData = {
        comment: { text },
        requestedAttributes: {
          TOXICITY: {},
          SEVERE_TOXICITY: {},
          IDENTITY_ATTACK: {},
          INSULT: {},
          PROFANITY: {},
          THREAT: {},
          SEXUALLY_EXPLICIT: {},
          FLIRTATION: {}
        },
        languages: ['en'], // Add more languages as needed
        doNotStore: true
      };

      const response = await axios.post(
        `${this.perspectiveApiUrl}?key=${this.apiKey}`,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 5000 // 5 second timeout
        }
      );

      const scores = (response.data as any).attributeScores;
      const categories = {
        TOXICITY: scores.TOXICITY?.summaryScore?.value || 0,
        SEVERE_TOXICITY: scores.SEVERE_TOXICITY?.summaryScore?.value || 0,
        IDENTITY_ATTACK: scores.IDENTITY_ATTACK?.summaryScore?.value || 0,
        INSULT: scores.INSULT?.summaryScore?.value || 0,
        PROFANITY: scores.PROFANITY?.summaryScore?.value || 0,
        THREAT: scores.THREAT?.summaryScore?.value || 0,
        SEXUALLY_EXPLICIT: scores.SEXUALLY_EXPLICIT?.summaryScore?.value || 0,
        FLIRTATION: scores.FLIRTATION?.summaryScore?.value || 0
      };

      const maxScore = Math.max(...Object.values(categories));
      const isToxic = maxScore >= config.moderation.toxicityThreshold;

      logger.info('Text analyzed', {
        textLength: text.length,
        isToxic,
        maxScore,
        categories
      });

      return {
        isToxic,
        score: maxScore,
        categories
      };

    } catch (error) {
      logger.error('Perspective API error:', error);
      
      // Fallback to simple keyword detection
      return this.simpleKeywordDetection(text);
    }
  }

  async moderateMessage(text: string, senderId: string, messageType: string = 'text'): Promise<ModerationAction> {
    try {
      const result = await this.analyzeText(text);
      
      if (!result) {
        return { action: 'allow', confidence: 1.0 };
      }

      // Determine action based on toxicity score and categories
      if (result.score >= 0.9 || result.categories.THREAT >= 0.8 || result.categories.SEVERE_TOXICITY >= 0.8) {
        return {
          action: 'block',
          reason: 'High toxicity detected',
          confidence: result.score
        };
      }

      if (result.score >= 0.7 || result.categories.INSULT >= 0.7 || result.categories.PROFANITY >= 0.7) {
        return {
          action: 'flag',
          reason: 'Potentially inappropriate content',
          confidence: result.score
        };
      }

      if (result.score >= 0.5) {
        return {
          action: 'flag',
          reason: 'Moderate toxicity detected',
          confidence: result.score
        };
      }

      return { action: 'allow', confidence: 1.0 - result.score };

    } catch (error) {
      logger.error('Message moderation error:', error);
      return { action: 'allow', confidence: 0.5 };
    }
  }

  async moderateImage(imageUrl: string): Promise<ModerationAction> {
    // For now, implement basic image moderation
    // In production, you'd integrate with Google Cloud Vision API or AWS Rekognition
    try {
      logger.info('Image moderation requested', { imageUrl });
      
      // Placeholder for image content analysis
      // This would involve:
      // 1. Downloading the image
      // 2. Running it through image recognition APIs
      // 3. Checking for inappropriate content
      
      return { action: 'allow', confidence: 1.0 };
    } catch (error) {
      logger.error('Image moderation error:', error);
      return { action: 'allow', confidence: 0.5 };
    }
  }

  async moderateVoiceNote(voiceUrl: string, transcript?: string): Promise<ModerationAction> {
    try {
      // If we have a transcript, moderate that
      if (transcript) {
        return await this.moderateMessage(transcript, '', 'voice');
      }

      // Otherwise, voice moderation would require:
      // 1. Speech-to-text conversion
      // 2. Content analysis of the transcript
      // 3. Possibly audio analysis for tone/aggression
      
      logger.info('Voice note moderation requested', { voiceUrl });
      return { action: 'allow', confidence: 1.0 };
    } catch (error) {
      logger.error('Voice note moderation error:', error);
      return { action: 'allow', confidence: 0.5 };
    }
  }

  private simpleKeywordDetection(text: string): ToxicityResult {
    const toxicKeywords = [
      'fuck', 'shit', 'damn', 'bitch', 'asshole', 'bastard',
      'hate', 'kill', 'die', 'stupid', 'idiot', 'moron',
      // Add more keywords as needed
    ];

    const normalizedText = text.toLowerCase();
    let toxicCount = 0;
    
    for (const keyword of toxicKeywords) {
      if (normalizedText.includes(keyword)) {
        toxicCount++;
      }
    }

    const score = Math.min(toxicCount * 0.3, 1.0); // Simple scoring
    const isToxic = score >= config.moderation.toxicityThreshold;

    return {
      isToxic,
      score,
      categories: {
        TOXICITY: score,
        SEVERE_TOXICITY: score > 0.7 ? score : 0,
        IDENTITY_ATTACK: 0,
        INSULT: score,
        PROFANITY: score,
        THREAT: 0,
        SEXUALLY_EXPLICIT: 0,
        FLIRTATION: 0
      }
    };
  }

  // Check if user has been flagged too many times
  async checkUserModerationHistory(userId: string): Promise<{
    shouldFlag: boolean;
    recentViolations: number;
    totalViolations: number;
  }> {
    try {
      // This would typically query a moderation history database
      // For now, return a simple check
      
      return {
        shouldFlag: false,
        recentViolations: 0,
        totalViolations: 0
      };
    } catch (error) {
      logger.error('User moderation history check error:', error);
      return {
        shouldFlag: false,
        recentViolations: 0,
        totalViolations: 0
      };
    }
  }

  // Generate moderation report for admins
  generateModerationReport(
    messageId: string,
    content: string,
    result: ToxicityResult,
    action: ModerationAction,
    userId: string
  ): any {
    return {
      messageId,
      userId,
      content: content.substring(0, 200), // Truncate for storage
      toxicityScore: result.score,
      categories: result.categories,
      action: action.action,
      reason: action.reason,
      confidence: action.confidence,
      timestamp: new Date(),
      needsReview: action.action === 'flag' || action.action === 'escalate'
    };
  }

  isHealthy(): boolean {
    return this.isEnabled;
  }
}