import { z } from 'zod';

export interface ProxyServiceConfig {
  key: string;
  label: string;
  description: string;
  target: string;
  mountPath: string;
  ws: boolean;
  stripPrefix: boolean;
  enabled: boolean;
  healthPath: string;
}

interface ServiceBlueprint {
  key: string;
  label: string;
  description: string;
  defaultTarget: string;
  mountPath: string;
  healthPath?: string;
  ws?: boolean;
  stripPrefix?: boolean;
  enabledByDefault?: boolean;
}

const serviceBlueprintSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  defaultTarget: z.string().url(),
  mountPath: z.string().min(1),
  healthPath: z.string().min(1).optional(),
  ws: z.boolean().optional(),
  stripPrefix: z.boolean().optional(),
  enabledByDefault: z.boolean().optional(),
});

const defaultServiceBlueprints: ServiceBlueprint[] = serviceBlueprintSchema.array().parse([
  {
    key: 'user',
    label: 'User Service',
    description: 'Authentication, profiles and account management.',
    defaultTarget: 'http://localhost:3001',
    mountPath: '/api/user',
  },
  {
    key: 'queue',
    label: 'Queuing Service',
    description: 'Realtime intent queues and matchmaking preparation.',
    defaultTarget: 'http://localhost:3002',
    mountPath: '/api/queue',
    ws: true,
  },
  {
    key: 'interaction',
    label: 'Interaction Service',
    description: 'WebRTC signalling, match orchestration and call lifecycle.',
    defaultTarget: 'http://localhost:3003',
    mountPath: '/api/interaction',
    ws: true,
  },
  {
    key: 'history',
    label: 'History Service',
    description: 'Interaction history, analytics and reporting datastore.',
    defaultTarget: 'http://localhost:3007',
    mountPath: '/api/history',
  },
  {
    key: 'communication',
    label: 'Communication Service',
    description: 'Post-match messaging, attachments and voice notes.',
    defaultTarget: 'http://localhost:3008',
    mountPath: '/api/communication',
    ws: true,
  },
  {
    key: 'moderation',
    label: 'Moderation Service',
    description: 'AI-powered content moderation and escalation tooling.',
    defaultTarget: 'http://localhost:3009',
    mountPath: '/api/moderation',
  },
  {
    key: 'admin',
    label: 'Admin Service',
    description: 'Admin dashboard APIs for support, analytics and settings.',
    defaultTarget: 'http://localhost:3006',
    mountPath: '/api/admin',
  },
  {
    key: 'analytics',
    label: 'Analytics Service',
    description: 'Aggregated metrics, cohorts and growth reporting.',
    defaultTarget: 'http://localhost:3005',
    mountPath: '/api/analytics',
  },
  {
    key: 'notification',
    label: 'Notification Service',
    description: 'Push delivery, quiet hours and notification templates.',
    defaultTarget: 'http://localhost:3004',
    mountPath: '/api/notification',
  },
  {
    key: 'subscription',
    label: 'Subscription Service',
    description: 'Plans, entitlement checks and billing webhooks.',
    defaultTarget: 'http://localhost:3010',
    mountPath: '/api/subscription',
  },
  {
    key: 'graphql',
    label: 'GraphQL Gateway',
    description: 'Unified API gateway (disabled until dependencies restored).',
    defaultTarget: 'http://localhost:4000',
    mountPath: '/graphql',
    stripPrefix: false,
    enabledByDefault: false,
  },
]);

const proxyServiceSchema = z.object({
  key: z.string(),
  label: z.string(),
  description: z.string(),
  target: z.string().url(),
  mountPath: z
    .string()
    .min(1)
    .transform((value) => (value.startsWith('/') ? value : `/${value}`))
    .transform((value) => value.replace(/\/+$/, '') || '/'),
  ws: z.boolean(),
  stripPrefix: z.boolean(),
  enabled: z.boolean(),
  healthPath: z
    .string()
    .min(1)
    .transform((value) => (value.startsWith('/') ? value : `/${value}`)),
});

const toEnvKey = (serviceKey: string, suffix: string) =>
  `SERVICE_${serviceKey.toUpperCase().replace(/[^A-Z0-9]/gi, '_')}_${suffix}`;

const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) {
    return fallback;
  }

  if (value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes') {
    return true;
  }

  if (value === '0' || value.toLowerCase() === 'false' || value.toLowerCase() === 'no') {
    return false;
  }

  return fallback;
};

export function loadServiceConfig(): ProxyServiceConfig[] {
  return defaultServiceBlueprints.map((blueprint) => {
    const envPrefix = (suffix: string) => toEnvKey(blueprint.key, suffix);
    const target = process.env[envPrefix('URL')] ?? blueprint.defaultTarget;
    const mountPath = process.env[envPrefix('MOUNT_PATH')] ?? blueprint.mountPath;
    const healthPath = process.env[envPrefix('HEALTH_PATH')] ?? blueprint.healthPath ?? '/health';
    const ws = parseBoolean(process.env[envPrefix('WS')], blueprint.ws ?? false);
    const stripPrefix = parseBoolean(
      process.env[envPrefix('STRIP_PREFIX')],
      blueprint.stripPrefix ?? true
    );
    const enabled = parseBoolean(
      process.env[envPrefix('ENABLED')],
      blueprint.enabledByDefault ?? true
    );

    return proxyServiceSchema.parse({
      key: blueprint.key,
      label: blueprint.label,
      description: blueprint.description,
      target,
      mountPath,
      ws,
      stripPrefix,
      enabled,
      healthPath,
    });
  });
}

export type { ProxyServiceConfig as ServiceConfig };
