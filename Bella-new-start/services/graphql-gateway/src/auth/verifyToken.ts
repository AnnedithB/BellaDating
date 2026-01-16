import jwt from 'jsonwebtoken';
import { config } from '../config';

export async function verifyToken(token: string): Promise<any> {
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    return decoded;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

export function generateToken(payload: any): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' });
}
