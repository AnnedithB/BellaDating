// shared/swagger/index.ts

// Type definition for swagger-jsdoc options
export interface SwaggerOptions {
  definition: {
    openapi: string;
    info: {
      title: string;
      version: string;
      description: string;
      contact?: {
        name: string;
        email: string;
      };
      license?: {
        name: string;
        url: string;
      };
    };
    servers: Array<{
      url: string;
      description: string;
    }>;
    components?: {
      securitySchemes?: Record<string, any>;
      responses?: Record<string, any>;
    };
    security?: Array<Record<string, any>>;
  };
  apis: string[];
}

export const createSwaggerConfig = (serviceName: string, port: number, description: string): SwaggerOptions => {
  return {
    definition: {
      openapi: '3.0.0',
      info: {
        title: `Real-time Connect - ${serviceName}`,
        version: '1.0.0',
        description: `${description}\n\nPart of the Real-time Connect dating platform microservices architecture.`,
        contact: {
          name: 'Real-time Connect Team',
          email: 'api@realtimeconnect.com'
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT'
        }
      },
      servers: [
        {
          url: `http://localhost:${port}`,
          description: `${serviceName} (Development)`
        },
        {
          url: `https://api.realtimeconnect.com/${serviceName.toLowerCase().replace(/\s+/g, '-')}`,
          description: `${serviceName} (Production)`
        }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT token obtained from authentication endpoints'
          },
          adminAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Admin JWT token with elevated privileges'
          }
        },
        responses: {
          UnauthorizedError: {
            description: 'Authentication token is missing or invalid',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          },
          ForbiddenError: {
            description: 'Insufficient permissions for this operation',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          },
          NotFoundError: {
            description: 'The requested resource was not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          },
          ValidationError: {
            description: 'Validation error in request data',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ValidationErrorResponse'
                }
              }
            }
          },
          InternalServerError: {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          }
        }
      },
      security: [
        {
          bearerAuth: []
        }
      ]
    },
    apis: ['./src/routes/*.ts', './src/schemas/*.ts', './shared/swagger/schemas/*.ts']
  };
};