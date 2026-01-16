export const config = {
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },
  sessions: {
    ttlHours: Number(process.env.SESSION_TTL_HOURS || 24)
  },
  storage: {
    type: process.env.STORAGE_TYPE || 'local'
  }
};
