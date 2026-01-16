import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import fs from 'fs/promises';
import path from 'path';

export interface VoiceNoteData {
  messageId: string;
  filePath: string;
  duration?: number;
  size: number;
  format: string;
}

export class VoiceNoteService {
  private prisma: PrismaClient;
  private uploadPath: string;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.uploadPath = process.env.UPLOAD_PATH || './uploads';
  }

  async saveVoiceNote(data: VoiceNoteData): Promise<any> {
    try {
      // Update message with voice note data
      const voiceNote = await this.prisma.message.update({
        where: { messageId: data.messageId },
        data: {
          voiceUrl: data.filePath,
          voiceDuration: data.duration,
          voiceSize: data.size,
          messageType: 'VOICE'
        }
      });

      logger.info('Voice note saved', {
        voiceNoteId: voiceNote.id,
        messageId: data.messageId,
        size: data.size
      });

      return voiceNote;
    } catch (error) {
      logger.error('Error saving voice note:', error);
      throw new Error('Failed to save voice note');
    }
  }

  async getVoiceNote(messageId: string): Promise<any> {
    try {
      const voiceNote = await this.prisma.message.findFirst({
        where: {
          messageId,
          messageType: 'VOICE'
        }
      });

      if (!voiceNote) {
        throw new Error('Voice note not found');
      }

      return {
        id: voiceNote.id,
        messageId: voiceNote.messageId,
        voiceUrl: voiceNote.voiceUrl,
        duration: voiceNote.voiceDuration,
        size: voiceNote.voiceSize,
        timestamp: voiceNote.timestamp
      };
    } catch (error) {
      logger.error('Error retrieving voice note:', error);
      throw error;
    }
  }

  async getVoiceNoteWithFile(messageId: string): Promise<any> {
    try {
      const voiceNote = await this.getVoiceNote(messageId);
      
      if (!voiceNote.voiceUrl) {
        throw new Error('Voice note file path not found');
      }

      // Check if file exists
      const filePath = path.join(this.uploadPath, voiceNote.voiceUrl);
      await fs.access(filePath);

      return {
        ...voiceNote,
        filePath
      };
    } catch (error) {
      logger.error('Error retrieving voice note with file:', error);
      throw error;
    }
  }

  async deleteVoiceNote(messageId: string): Promise<void> {
    try {
      const voiceNote = await this.getVoiceNote(messageId);
      
      // Delete the physical file
      if (voiceNote.voiceUrl) {
        const filePath = path.join(this.uploadPath, voiceNote.voiceUrl);
        try {
          await fs.unlink(filePath);
        } catch (fileError) {
          logger.warn('Could not delete voice note file:', fileError);
        }
      }

      // Clear voice note data from message
      await this.prisma.message.update({
        where: { messageId },
        data: {
          voiceUrl: null,
          voiceDuration: null,
          voiceSize: null,
          messageType: 'TEXT'
        }
      });

      logger.info('Voice note deleted', { messageId });
    } catch (error) {
      logger.error('Error deleting voice note:', error);
      throw error;
    }
  }

  async getVoiceNotesByRoom(roomId: string, limit = 50): Promise<any[]> {
    try {
      const voiceNotes = await this.prisma.message.findMany({
        where: {
          roomId,
          messageType: 'VOICE',
          voiceUrl: { not: null }
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
        select: {
          id: true,
          messageId: true,
          voiceUrl: true,
          voiceDuration: true,
          voiceSize: true,
          timestamp: true,
          senderId: true
        }
      });

      return voiceNotes;
    } catch (error) {
      logger.error('Error retrieving voice notes by room:', error);
      throw error;
    }
  }

  async getVoiceNotesByUser(userId: string, limit = 50): Promise<any[]> {
    try {
      const voiceNotes = await this.prisma.message.findMany({
        where: {
          senderId: userId,
          messageType: 'VOICE',
          voiceUrl: { not: null }
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
        select: {
          id: true,
          messageId: true,
          roomId: true,
          voiceUrl: true,
          voiceDuration: true,
          voiceSize: true,
          timestamp: true
        }
      });

      return voiceNotes;
    } catch (error) {
      logger.error('Error retrieving voice notes by user:', error);
      throw error;
    }
  }
}