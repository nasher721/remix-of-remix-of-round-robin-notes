/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN?: string;
  /** Set at build time from package.json / Vercel; optional override via VITE_APP_VERSION in .env */
  readonly VITE_APP_VERSION?: string;
  /** Landing: public contact email (mailto links) */
  readonly VITE_CONTACT_EMAIL?: string;
  /** Landing: intro MP4 path or full URL; defaults to bundled public filename */
  readonly VITE_LANDING_INTRO_VIDEO_SRC?: string;
  /** Landing: when "true", skip intro video overlay (poster/hero only) */
  readonly VITE_LANDING_INTRO_DISABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
