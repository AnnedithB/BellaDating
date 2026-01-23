import { Logger } from '../utils/logger';

// Re-export interfaces for convenience
export interface VerificationResult {
  success: boolean;
  confidence: number;
  message: string;
  livenessDetected: boolean;
}

export interface LivenessResult {
  isLive: boolean;
  confidence: number;
  qualityScore: number;
}

/**
 * Interface for photo verification providers
 */
export interface PhotoVerificationProvider {
  verifyPhoto(selfieImage: Buffer, profilePhotos: Buffer[]): Promise<VerificationResult>;
  detectLiveness(image: Buffer): Promise<LivenessResult>;
}

/**
 * AWS Rekognition Provider (Default)
 */
export class AWSRekognitionProvider implements PhotoVerificationProvider {
  private rekognitionClient: any;
  private minSimilarity: number;
  private logger: Logger;

  constructor(logger: Logger) {
    const { RekognitionClient, CompareFacesCommand, DetectFacesCommand } = require('@aws-sdk/client-rekognition');
    
    // IMPORTANT: Rekognition client must be explicitly initialized with the correct region
    // AWS will fail if region doesn't match the backend's region
    // Default to us-east-2 as required for this deployment
    const region = process.env.AWS_REGION || 'us-east-2';
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (!accessKeyId || !secretAccessKey) {
      logger.warn('AWS credentials not configured. Photo verification will fail.');
    }

    // Explicitly initialize RekognitionClient with region - this is critical for AWS SDK
    this.rekognitionClient = new RekognitionClient({
      region: region, // Explicitly set region - must match backend region (us-east-2)
      credentials: accessKeyId && secretAccessKey ? {
        accessKeyId,
        secretAccessKey,
      } : undefined,
    });
    
    logger.info(`AWS Rekognition client initialized with region: ${region}`);

    // Lower default threshold to 75% for better user experience
    // Users can still set AWS_REKOGNITION_MIN_SIMILARITY env var to override
    this.minSimilarity = parseFloat(process.env.AWS_REKOGNITION_MIN_SIMILARITY || '75');
    this.logger = logger;
    
    logger.info(`AWS Rekognition configured with minimum similarity threshold: ${this.minSimilarity}%`);
  }

  async verifyPhoto(selfieImage: Buffer, profilePhotos: Buffer[]): Promise<VerificationResult> {
    const { CompareFacesCommand } = require('@aws-sdk/client-rekognition');
    
    if (!profilePhotos || profilePhotos.length === 0) {
      this.logger.warn('No profile photos provided for verification');
      return {
        success: false,
        confidence: 0,
        message: 'No profile photos found. Please upload at least one profile photo first.',
        livenessDetected: false,
      };
    }

    this.logger.info('Starting photo verification', {
      selfieSize: selfieImage.length,
      profilePhotoCount: profilePhotos.length,
      minSimilarity: this.minSimilarity,
    });

    const livenessResult = await this.detectLiveness(selfieImage);
    this.logger.info('Liveness detection result', {
      isLive: livenessResult.isLive,
      confidence: livenessResult.confidence,
      qualityScore: livenessResult.qualityScore,
    });

    // Make liveness detection less strict - only fail if clearly not a face
    if (!livenessResult.isLive && livenessResult.confidence === 0) {
      this.logger.warn('Liveness detection failed - no face detected');
      return {
        success: false,
        confidence: 0,
        message: 'No face detected in selfie. Please ensure your face is clearly visible.',
        livenessDetected: false,
      };
    }

    // Continue with verification even if liveness is uncertain (confidence > 0)
    // This allows verification to proceed if a face is detected, even if quality isn't perfect

    let bestMatch = { confidence: 0, matched: false };
    let comparisonErrors: string[] = [];

    for (let i = 0; i < profilePhotos.length; i++) {
      try {
        this.logger.info(`Comparing selfie with profile photo ${i + 1}/${profilePhotos.length}`, {
          profilePhotoSize: profilePhotos[i].length,
        });

        const command = new CompareFacesCommand({
          SourceImage: { Bytes: selfieImage },
          TargetImage: { Bytes: profilePhotos[i] },
          SimilarityThreshold: this.minSimilarity,
        });

        const response = await this.rekognitionClient.send(command);
        
        this.logger.info(`Comparison result for photo ${i + 1}`, {
          faceMatches: response.FaceMatches?.length || 0,
          unmatchedFaces: response.UnmatchedFaces?.length || 0,
        });

        if (response.FaceMatches && response.FaceMatches.length > 0) {
          const confidence = response.FaceMatches[0].Similarity || 0;
          this.logger.info(`Face match found for photo ${i + 1}`, {
            confidence,
            minSimilarity: this.minSimilarity,
            matched: confidence >= this.minSimilarity,
          });
          
          if (confidence > bestMatch.confidence) {
            bestMatch = { confidence, matched: confidence >= this.minSimilarity };
          }
        } else {
          this.logger.warn(`No face match found for photo ${i + 1}`, {
            unmatchedFaces: response.UnmatchedFaces?.length || 0,
          });
        }
      } catch (error: any) {
        const errorMsg = error.message || 'Unknown error';
        comparisonErrors.push(`Photo ${i + 1}: ${errorMsg}`);
        this.logger.warn('Error comparing with profile photo', { 
          photoIndex: i + 1,
          error: errorMsg,
          code: error.code,
        });
      }
    }

    this.logger.info('Photo verification completed', {
      bestMatchConfidence: bestMatch.confidence,
      matched: bestMatch.matched,
      minSimilarity: this.minSimilarity,
      comparisonErrors: comparisonErrors.length,
    });

    if (bestMatch.matched) {
      return {
        success: true,
        confidence: bestMatch.confidence,
        message: `Photo verification successful (${bestMatch.confidence.toFixed(1)}% match)`,
        livenessDetected: livenessResult.isLive || livenessResult.confidence > 0,
      };
    } else {
      const errorDetails = comparisonErrors.length > 0 
        ? ` Errors: ${comparisonErrors.join('; ')}.`
        : '';
      return {
        success: false,
        confidence: bestMatch.confidence,
        message: `Face match confidence (${bestMatch.confidence.toFixed(1)}%) is below the required threshold (${this.minSimilarity}%).${errorDetails}`,
        livenessDetected: livenessResult.isLive || livenessResult.confidence > 0,
      };
    }
  }

  async detectLiveness(image: Buffer): Promise<LivenessResult> {
    const { DetectFacesCommand } = require('@aws-sdk/client-rekognition');
    
    try {
      const command = new DetectFacesCommand({
        Image: { Bytes: image },
        Attributes: ['ALL'], // Use ALL to get all available face attributes
      });

      const response = await this.rekognitionClient.send(command);
      
      if (!response.FaceDetails || response.FaceDetails.length === 0) {
        this.logger.warn('No faces detected in selfie');
        return { isLive: false, confidence: 0, qualityScore: 0 };
      }

      const faceDetails = response.FaceDetails.sort(
        (a: any, b: any) => (b.BoundingBox?.Width || 0) * (b.BoundingBox?.Height || 0) - 
                  (a.BoundingBox?.Width || 0) * (a.BoundingBox?.Height || 0)
      )[0];

      // Quality information is available in the response by default (not as an attribute)
      const qualityScore = faceDetails.Quality?.Brightness || 0;
      const sharpness = faceDetails.Quality?.Sharpness || 0;
      const isOccluded = faceDetails.FaceOccluded?.Value || false;
      const faceCount = response.FaceDetails.length;
      
      // More lenient liveness detection:
      // - Allow if face is detected and not heavily occluded
      // - Lower brightness threshold (30 instead of 50)
      // - Allow multiple faces (might be user + reflection or other people)
      // - Consider sharpness as well
      const isLive = !isOccluded && 
                     qualityScore > 30 && 
                     sharpness > 30 &&
                     faceCount >= 1; // Allow multiple faces (at least one face detected)

      this.logger.info('Liveness detection details', {
        isLive,
        qualityScore,
        sharpness,
        isOccluded,
        faceCount,
        boundingBox: faceDetails.BoundingBox,
      });

      return {
        isLive,
        confidence: isLive ? 85 : (faceCount > 0 ? 60 : 0), // Give partial credit if face detected
        qualityScore: qualityScore || sharpness, // Use sharpness as fallback
      };
    } catch (error: any) {
      // Check for AWS credential errors
      const errorMessage = error.message || '';
      const errorCode = error.code || error.name || '';
      
      if (errorMessage.includes('security token') || 
          errorMessage.includes('invalid') ||
          errorCode === 'InvalidSignatureException' ||
          errorCode === 'UnrecognizedClientException' ||
          errorCode === 'InvalidClientTokenId') {
        this.logger.error('AWS credentials are invalid or missing', { 
          error: errorMessage,
          code: errorCode,
          hint: 'Please check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables',
        });
        throw new Error('AWS credentials are invalid. Please check your AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.');
      }
      
      this.logger.error('Liveness detection failed', { 
        error: errorMessage,
        code: errorCode,
      });
      return { isLive: false, confidence: 0, qualityScore: 0 };
    }
  }
}

/**
 * Face++ Provider
 * Documentation: https://www.faceplusplus.com/api-docs/
 */
export class FacePlusPlusProvider implements PhotoVerificationProvider {
  private apiKey: string;
  private apiSecret: string;
  private minSimilarity: number;
  private logger: Logger;

  constructor(logger: Logger) {
    this.apiKey = process.env.FACEPP_API_KEY || '';
    this.apiSecret = process.env.FACEPP_API_SECRET || '';
    this.minSimilarity = parseFloat(process.env.FACEPP_MIN_SIMILARITY || '80');
    this.logger = logger;

    if (!this.apiKey || !this.apiSecret) {
      logger.warn('Face++ credentials not configured.');
    }
  }

  async verifyPhoto(selfieImage: Buffer, profilePhotos: Buffer[]): Promise<VerificationResult> {
    if (!profilePhotos || profilePhotos.length === 0) {
      return {
        success: false,
        confidence: 0,
        message: 'No profile photos found. Please upload at least one profile photo first.',
        livenessDetected: false,
      };
    }

    // Face++ Compare API
    const axios = require('axios');
    const FormData = require('form-data');
    
    let bestMatch = { confidence: 0, matched: false };

    for (const profilePhoto of profilePhotos) {
      try {
        const formData = new FormData();
        formData.append('api_key', this.apiKey);
        formData.append('api_secret', this.apiSecret);
        formData.append('image_file1', selfieImage, { filename: 'selfie.jpg' });
        formData.append('image_file2', profilePhoto, { filename: 'profile.jpg' });

        const response = await axios.post('https://api-us.faceplusplus.com/facepp/v3/compare', formData, {
          headers: formData.getHeaders(),
        });

        if (response.data.confidence) {
          const confidence = response.data.confidence;
          if (confidence > bestMatch.confidence) {
            bestMatch = { confidence, matched: confidence >= this.minSimilarity };
          }
        }
      } catch (error: any) {
        this.logger.warn('Face++ comparison error', { error: error.message });
      }
    }

    // Basic liveness check (Face++ has separate liveness API)
    const livenessResult = await this.detectLiveness(selfieImage);

    if (bestMatch.matched && livenessResult.isLive) {
      return {
        success: true,
        confidence: bestMatch.confidence,
        message: 'Photo verification successful',
        livenessDetected: true,
      };
    } else {
      return {
        success: false,
        confidence: bestMatch.confidence,
        message: `Face match confidence (${bestMatch.confidence.toFixed(1)}%) is below the required threshold.`,
        livenessDetected: livenessResult.isLive,
      };
    }
  }

  async detectLiveness(image: Buffer): Promise<LivenessResult> {
    // Face++ has a separate Detect API for face detection
    // For basic liveness, we check if face is detected
    const axios = require('axios');
    const FormData = require('form-data');

    try {
      const formData = new FormData();
      formData.append('api_key', this.apiKey);
      formData.append('api_secret', this.apiSecret);
      formData.append('image_file', image, { filename: 'selfie.jpg' });

      const response = await axios.post('https://api-us.faceplusplus.com/facepp/v3/detect', formData, {
        headers: formData.getHeaders(),
      });

      const faceCount = response.data.faces?.length || 0;
      const isLive = faceCount === 1; // Single face detected

      return {
        isLive,
        confidence: isLive ? 80 : 20,
        qualityScore: 70, // Face++ doesn't provide quality score in basic detect
      };
    } catch (error: any) {
      this.logger.error('Face++ liveness detection failed', { error: error.message });
      return { isLive: false, confidence: 0, qualityScore: 0 };
    }
  }
}

/**
 * Luxand Face Verification Provider
 * Documentation: https://luxand.cloud/docs/
 */
export class LuxandProvider implements PhotoVerificationProvider {
  private apiKey: string;
  private minSimilarity: number;
  private logger: Logger;

  constructor(logger: Logger) {
    this.apiKey = process.env.LUXAND_API_KEY || '';
    this.minSimilarity = parseFloat(process.env.LUXAND_MIN_SIMILARITY || '80');
    this.logger = logger;

    if (!this.apiKey) {
      logger.warn('Luxand API key not configured.');
    }
  }

  async verifyPhoto(selfieImage: Buffer, profilePhotos: Buffer[]): Promise<VerificationResult> {
    if (!profilePhotos || profilePhotos.length === 0) {
      return {
        success: false,
        confidence: 0,
        message: 'No profile photos found. Please upload at least one profile photo first.',
        livenessDetected: false,
      };
    }

    const axios = require('axios');
    let bestMatch = { confidence: 0, matched: false };

    for (const profilePhoto of profilePhotos) {
      try {
        // Luxand Face Verification API
        const formData = new (require('form-data'))();
        formData.append('photo1', selfieImage, { filename: 'selfie.jpg', contentType: 'image/jpeg' });
        formData.append('photo2', profilePhoto, { filename: 'profile.jpg', contentType: 'image/jpeg' });

        const response = await axios.post('https://api.luxand.cloud/photo/verify', formData, {
          headers: {
            ...formData.getHeaders(),
            'token': this.apiKey,
          },
        });

        if (response.data.similarity !== undefined) {
          const confidence = response.data.similarity * 100; // Convert to percentage
          if (confidence > bestMatch.confidence) {
            bestMatch = { confidence, matched: confidence >= this.minSimilarity };
          }
        }
      } catch (error: any) {
        this.logger.warn('Luxand comparison error', { error: error.message });
      }
    }

    const livenessResult = await this.detectLiveness(selfieImage);

    if (bestMatch.matched && livenessResult.isLive) {
      return {
        success: true,
        confidence: bestMatch.confidence,
        message: 'Photo verification successful',
        livenessDetected: true,
      };
    } else {
      return {
        success: false,
        confidence: bestMatch.confidence,
        message: `Face match confidence (${bestMatch.confidence.toFixed(1)}%) is below the required threshold.`,
        livenessDetected: livenessResult.isLive,
      };
    }
  }

  async detectLiveness(image: Buffer): Promise<LivenessResult> {
    // Luxand basic face detection for liveness
    const axios = require('axios');
    
    try {
      const formData = new (require('form-data'))();
      formData.append('photo', image, { filename: 'selfie.jpg', contentType: 'image/jpeg' });

      const response = await axios.post('https://api.luxand.cloud/photo/detect', formData, {
        headers: {
          ...formData.getHeaders(),
          'token': this.apiKey,
        },
      });

      const faceCount = response.data.faces?.length || 0;
      const isLive = faceCount === 1;

      return {
        isLive,
        confidence: isLive ? 75 : 25,
        qualityScore: 70,
      };
    } catch (error: any) {
      this.logger.error('Luxand liveness detection failed', { error: error.message });
      return { isLive: false, confidence: 0, qualityScore: 0 };
    }
  }
}

/**
 * Provider Factory
 */
export function createVerificationProvider(logger: Logger): PhotoVerificationProvider {
  const provider = process.env.VERIFICATION_PROVIDER || 'aws';

  switch (provider.toLowerCase()) {
    case 'facepp':
    case 'face++':
    case 'faceplusplus':
      return new FacePlusPlusProvider(logger);
    
    case 'luxand':
      return new LuxandProvider(logger);
    
    case 'aws':
    case 'rekognition':
    default:
      return new AWSRekognitionProvider(logger);
  }
}

