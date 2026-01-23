/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADMIN_SERVICE_URL?: string;
  readonly VITE_ANALYTICS_SERVICE_URL?: string;
  readonly VITE_APP_PORT?: string;
  readonly VITE_ASSET_BASE_URL?: string;
  readonly VITE_BASENAME?: string;
  readonly PROD: boolean;
  readonly DEV: boolean;
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
