/**
 * Environment Variable Validator
 *
 * Use this to validate required environment variables at startup.
 * If any are missing, the server will fail fast with a clear error message.
 */

export interface EnvValidationOptions {
  /** Name of the service (for error messages) */
  serviceName: string;
  /** List of required environment variable names */
  required: string[];
  /** List of optional environment variable names (for documentation) */
  optional?: string[];
}

export class EnvValidationError extends Error {
  constructor(
    public serviceName: string,
    public missingVars: string[]
  ) {
    super(
      `\n\n` +
      `========================================\n` +
      `  ${serviceName} - CONFIGURATION ERROR\n` +
      `========================================\n\n` +
      `Missing required environment variables:\n\n` +
      missingVars.map(v => `  - ${v}`).join('\n') +
      `\n\n` +
      `Please set these in your .env file or environment.\n` +
      `The server cannot start without them.\n\n` +
      `========================================\n`
    );
    this.name = 'EnvValidationError';
  }
}

/**
 * Validates that all required environment variables are set.
 * Throws EnvValidationError if any are missing.
 *
 * @example
 * ```typescript
 * validateEnv({
 *   serviceName: 'User Service',
 *   required: ['JWT_SECRET', 'DATABASE_URL'],
 *   optional: ['LOG_LEVEL', 'PORT']
 * });
 * ```
 */
export function validateEnv(options: EnvValidationOptions): void {
  const { serviceName, required } = options;

  const missingVars = required.filter(varName => {
    const value = process.env[varName];
    return value === undefined || value === '';
  });

  if (missingVars.length > 0) {
    throw new EnvValidationError(serviceName, missingVars);
  }
}

/**
 * Gets an environment variable, throwing if it's not set.
 * Use this for required variables instead of fallbacks.
 *
 * @example
 * ```typescript
 * const secret = requireEnv('JWT_SECRET');
 * ```
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

/**
 * Gets an environment variable with a default value.
 * Only use this for truly optional variables.
 */
export function optionalEnv(name: string, defaultValue: string): string {
  const value = process.env[name];
  return (value !== undefined && value !== '') ? value : defaultValue;
}

export default { validateEnv, requireEnv, optionalEnv, EnvValidationError };
