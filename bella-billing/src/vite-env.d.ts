/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_PORT?: string;
  readonly VITE_BASENAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
