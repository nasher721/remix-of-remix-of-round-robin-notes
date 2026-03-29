/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN?: string;
  /** Set at build time from package.json / Vercel; optional override via VITE_APP_VERSION in .env */
  readonly VITE_APP_VERSION?: string;
  /** Landing: public contact email (mailto links) */
  readonly VITE_CONTACT_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
