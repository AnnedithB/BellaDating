import Mixpanel from 'mixpanel';
import { Logger } from './logger';

interface EventProperties {
  [key: string]: any;
}

interface UserProperties {
  [key: string]: any;
}

interface RevenueProperties {
  amount: number;
  currency?: string;
  revenue_type?: string;
  subscription_plan?: string;
}

class Analytics {
  private mixpanel: Mixpanel.Mixpanel | null = null;
  private logger = new Logger('Analytics');
  private isEnabled: boolean = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    try {
      const token = process.env.MIXPANEL_PROJECT_TOKEN;
      
      if (!token) {
        this.logger.warn('Mixpanel token not found. Analytics tracking disabled.');
        return;
      }

      this.mixpanel = Mixpanel.init(token, {
        debug: process.env.NODE_ENV === 'development',
        host: process.env.MIXPANEL_HOST || 'api.mixpanel.com',
      });

      this.isEnabled = true;
      this.logger.info('Mixpanel analytics initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Mixpanel:', error as Error);
    }
  }

  /**
   * Track a server-side event
   */
  trackEvent(
    userId: string,
    eventName: string,
    properties: EventProperties = {},
    options?: { ip?: string; time?: Date }
  ): void {
    if (!this.isEnabled || !this.mixpanel) {
      this.logger.debug(`Analytics disabled. Would track: ${eventName}`, { userId, properties });
      return;
    }

    try {
      const enrichedProperties = {
        distinct_id: userId,
        source: 'server',
        environment: process.env.NODE_ENV || 'unknown',
        timestamp: new Date().toISOString(),
        ...properties,
      };

      // Add IP and custom time if provided
      const trackOptions: any = {};
      if (options?.ip) trackOptions.ip = options.ip;
      if (options?.time) trackOptions.time = options.time.getTime();

      this.mixpanel.track(eventName, enrichedProperties, trackOptions);
      this.logger.debug(`Tracked event: ${eventName}`, { userId, properties: enrichedProperties });
    } catch (error) {
      this.logger.error(`Failed to track event ${eventName}:`, error as Error);
    }
  }

  /**
   * Set user properties
   */
  setUserProperties(userId: string, properties: UserProperties): void {
    if (!this.isEnabled || !this.mixpanel) {
      this.logger.debug(`Analytics disabled. Would set user properties for: ${userId}`, properties);
      return;
    }

    try {
      this.mixpanel.people.set(userId, {
        $last_seen: new Date().toISOString(),
        ...properties,
      });
      this.logger.debug(`Set user properties for: ${userId}`, properties);
    } catch (error) {
      this.logger.error(`Failed to set user properties for ${userId}:`, error as Error);
    }
  }

  /**
   * Update user properties (only sets if property doesn't exist)
   */
  setUserPropertiesOnce(userId: string, properties: UserProperties): void {
    if (!this.isEnabled || !this.mixpanel) {
      return;
    }

    try {
      this.mixpanel.people.set_once(userId, properties);
      this.logger.debug(`Set user properties once for: ${userId}`, properties);
    } catch (error) {
      this.logger.error(`Failed to set user properties once for ${userId}:`, error as Error);
    }
  }

  /**
   * Increment user properties
   */
  incrementUserProperty(userId: string, property: string, value: number = 1): void {
    if (!this.isEnabled || !this.mixpanel) {
      return;
    }

    try {
      this.mixpanel.people.increment(userId, property, value);
      this.logger.debug(`Incremented ${property} by ${value} for user: ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to increment ${property} for ${userId}:`, error as Error);
    }
  }

  /**
   * Track revenue for a user
   */
  trackRevenue(userId: string, properties: RevenueProperties): void {
    if (!this.isEnabled || !this.mixpanel) {
      return;
    }

    try {
      this.mixpanel.people.track_charge(userId, properties.amount, {
        currency: properties.currency || 'USD',
        revenue_type: properties.revenue_type || 'subscription',
        subscription_plan: properties.subscription_plan,
        time: new Date().toISOString(),
      });
      
      // Also track as an event
      this.trackEvent(userId, 'Revenue Tracked', {
        amount: properties.amount,
        currency: properties.currency || 'USD',
        revenue_type: properties.revenue_type || 'subscription',
        subscription_plan: properties.subscription_plan,
      });

      this.logger.debug(`Tracked revenue for user: ${userId}`, properties);
    } catch (error) {
      this.logger.error(`Failed to track revenue for ${userId}:`, error as Error);
    }
  }

  /**
   * Create a user alias (for when user signs up)
   */
  createAlias(userId: string, aliasId: string): void {
    if (!this.isEnabled || !this.mixpanel) {
      return;
    }

    try {
      this.mixpanel.alias(userId, aliasId);
      this.logger.debug(`Created alias ${aliasId} for user: ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to create alias for ${userId}:`, error as Error);
    }
  }

  /**
   * Batch track multiple events (for better performance)
   */
  batchTrack(events: Array<{
    userId: string;
    eventName: string;
    properties?: EventProperties;
    options?: { ip?: string; time?: Date };
  }>): void {
    if (!this.isEnabled || !this.mixpanel) {
      return;
    }

    try {
      const batchData = events.map(({ userId, eventName, properties = {}, options }) => ({
        event: eventName,
        properties: {
          distinct_id: userId,
          source: 'server',
          environment: process.env.NODE_ENV || 'unknown',
          timestamp: new Date().toISOString(),
          ...properties,
          ...(options?.ip && { ip: options.ip }),
          ...(options?.time && { time: options.time.getTime() }),
        },
      }));

      // Note: Mixpanel doesn't have built-in batch tracking in the Node.js SDK
      // So we'll track them individually but log as batch
      events.forEach(({ userId, eventName, properties, options }) => {
        this.trackEvent(userId, eventName, properties, options);
      });

      this.logger.debug(`Batch tracked ${events.length} events`);
    } catch (error) {
      this.logger.error('Failed to batch track events:', error as Error);
    }
  }

  /**
   * Flush any pending events (useful for server shutdown)
   */
  flush(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.isEnabled || !this.mixpanel) {
        resolve();
        return;
      }

      // Mixpanel Node.js SDK doesn't have a flush method
      // Events are sent immediately, so we just resolve
      setTimeout(resolve, 100);
    });
  }
}

// Create singleton instance
const analytics = new Analytics();

// Convenience functions for common tracking patterns
export const trackServerEvent = (
  userId: string,
  eventName: string,
  properties: EventProperties = {},
  options?: { ip?: string; time?: Date }
): void => {
  analytics.trackEvent(userId, eventName, properties, options);
};

export const setUserProperties = (userId: string, properties: UserProperties): void => {
  analytics.setUserProperties(userId, properties);
};

export const incrementUserProperty = (userId: string, property: string, value: number = 1): void => {
  analytics.incrementUserProperty(userId, property, value);
};

export const trackRevenue = (userId: string, properties: RevenueProperties): void => {
  analytics.trackRevenue(userId, properties);
};

export const createUserAlias = (userId: string, aliasId: string): void => {
  analytics.createAlias(userId, aliasId);
};

// Business Logic Tracking Functions
export const trackUserRegistration = (userId: string, registrationData: {
  method: string;
  age: number;
  gender: string;
  country: string;
  photosUploaded: number;
  bioCompleted: boolean;
  interestsSelected: number;
}): void => {
  // Set initial user properties
  setUserProperties(userId, {
    age: registrationData.age,
    gender: registrationData.gender,
    location_country: registrationData.country,
    signup_date: new Date().toISOString(),
    signup_method: registrationData.method,
    total_sessions: 0,
    total_matches: 0,
    total_messages_sent: 0,
    subscription_status: 'free',
  });

  // Track registration event
  trackServerEvent(userId, 'Complete Registration', {
    registration_method: registrationData.method,
    age: registrationData.age,
    gender: registrationData.gender,
    location_country: registrationData.country,
    photos_uploaded: registrationData.photosUploaded,
    bio_completed: registrationData.bioCompleted,
    interests_selected: registrationData.interestsSelected,
  });
};

export const trackMatchCreated = (userId: string, matchData: {
  matchId: string;
  sessionId: string;
  sessionDuration: number;
  sessionType: string;
  compatibilityScore: number;
  partnerAge: number;
  mutualInterestsCount: number;
}): void => {
  trackServerEvent(userId, 'Create Match', {
    match_id: matchData.matchId,
    session_id: matchData.sessionId,
    session_duration: matchData.sessionDuration,
    session_type: matchData.sessionType,
    compatibility_score: matchData.compatibilityScore,
    partner_age: matchData.partnerAge,
    mutual_interests_count: matchData.mutualInterestsCount,
  });

  // Increment user's total matches
  incrementUserProperty(userId, 'total_matches');
};

export const trackSubscriptionPurchase = (userId: string, subscriptionData: {
  planId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  isUpgrade: boolean;
  trialIncluded: boolean;
}): void => {
  // Track revenue
  trackRevenue(userId, {
    amount: subscriptionData.amount,
    currency: subscriptionData.currency,
    revenue_type: 'subscription',
    subscription_plan: subscriptionData.planId,
  });

  // Track purchase event
  trackServerEvent(userId, 'Purchase Completed', {
    plan_purchased: subscriptionData.planId,
    amount_paid: subscriptionData.amount,
    currency: subscriptionData.currency,
    payment_method: subscriptionData.paymentMethod,
    is_upgrade: subscriptionData.isUpgrade,
    trial_included: subscriptionData.trialIncluded,
  });

  // Update user subscription status
  setUserProperties(userId, {
    subscription_status: subscriptionData.planId.includes('premium') ? 'premium' : 'vip',
    subscription_start_date: new Date().toISOString(),
  });
};

export const trackMessageSent = (userId: string, messageData: {
  conversationId: string;
  matchId: string;
  messageType: string;
  messageLength?: number;
  voiceNoteDuration?: number;
  isFirstMessage: boolean;
}): void => {
  trackServerEvent(userId, 'Send Message', {
    conversation_id: messageData.conversationId,
    match_id: messageData.matchId,
    message_type: messageData.messageType,
    message_length: messageData.messageLength,
    voice_note_duration: messageData.voiceNoteDuration,
    is_first_message: messageData.isFirstMessage,
  });

  // Increment user's total messages sent
  incrementUserProperty(userId, 'total_messages_sent');
};

export const trackSafetyReport = (userId: string, reportData: {
  reportedUserId: string;
  reason: string;
  context: string;
  sessionId?: string;
  evidenceProvided: boolean;
}): void => {
  trackServerEvent(userId, 'Report User', {
    reported_user_id: reportData.reportedUserId,
    report_reason: reportData.reason,
    report_context: reportData.context,
    session_id: reportData.sessionId,
    evidence_provided: reportData.evidenceProvided,
  });
};

export const trackSessionEnd = (userId: string, sessionData: {
  sessionId: string;
  duration: number;
  screensViewed: number;
  actionsTaken: number;
}): void => {
  trackServerEvent(userId, 'App Close', {
    session_duration: sessionData.duration,
    screens_viewed: sessionData.screensViewed,
    actions_taken: sessionData.actionsTaken,
    session_id: sessionData.sessionId,
  });

  // Increment total sessions
  incrementUserProperty(userId, 'total_sessions');
  
  // Update last active date
  setUserProperties(userId, {
    last_active_date: new Date().toISOString(),
  });
};

// Export the main analytics instance for advanced usage
export { analytics };

export default {
  trackServerEvent,
  setUserProperties,
  incrementUserProperty,
  trackRevenue,
  createUserAlias,
  trackUserRegistration,
  trackMatchCreated,
  trackSubscriptionPurchase,
  trackMessageSent,
  trackSafetyReport,
  trackSessionEnd,
  flush: () => analytics.flush(),
};