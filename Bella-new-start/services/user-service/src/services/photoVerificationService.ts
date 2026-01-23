import { Logger } from '../utils/logger';
import { 
  createVerificationProvider, 
  PhotoVerificationProvider,
  VerificationResult,
  LivenessResult
} from './photoVerificationProviders';

// Re-export for backward compatibility
export type { VerificationResult, LivenessResult };

export class PhotoVerificationService {
  private provider: PhotoVerificationProvider;
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
    // Use factory to create the appropriate provider based on env config
    this.provider = createVerificationProvider(logger);
  }

  /**
   * Verify a selfie by comparing it with profile photos
   * @param selfieImage - Buffer containing the selfie image
   * @param profilePhotos - Array of buffers containing profile photos
   * @returns Verification result with success status and confidence
   */
  async verifyPhoto(
    selfieImage: Buffer,
    profilePhotos: Buffer[]
  ): Promise<VerificationResult> {
    try {
      return await this.provider.verifyPhoto(selfieImage, profilePhotos);
    } catch (error: any) {
      this.logger.error('Photo verification failed', { error: error.message });
      return {
        success: false,
        confidence: 0,
        message: error.message || 'Photo verification failed. Please try again.',
        livenessDetected: false,
      };
    }
  }

  /**
   * Detect liveness in an image
   * @param image - Buffer containing the image
   * @returns Liveness detection result
   */
  async detectLiveness(image: Buffer): Promise<LivenessResult> {
    try {
      return await this.provider.detectLiveness(image);
    } catch (error: any) {
      this.logger.error('Liveness detection failed', { error: error.message });
      return {
        isLive: false,
        confidence: 0,
        qualityScore: 0,
      };
    }
  }
}

