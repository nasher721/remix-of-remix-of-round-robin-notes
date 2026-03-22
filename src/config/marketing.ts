/**
 * Public marketing / landing page configuration (Vite env).
 */

const DEFAULT_INTRO_VIDEO = "/video_d947dcb3-9916-4d7f-b617-a3beb20d3fdf.mp4";

/** Shown on landing footer, contact section, and Privacy page */
export const CONTACT_EMAIL =
  import.meta.env.VITE_CONTACT_EMAIL?.trim() || "hello@rollingrounds.app";

/** Whether the default is still the placeholder (show setup hint in UI) */
export const CONTACT_EMAIL_IS_PLACEHOLDER =
  !import.meta.env.VITE_CONTACT_EMAIL?.trim();

/** MP4 path or absolute HTTPS URL for the landing intro overlay */
export const LANDING_INTRO_VIDEO_SRC =
  import.meta.env.VITE_LANDING_INTRO_VIDEO_SRC?.trim() || DEFAULT_INTRO_VIDEO;

/** Skip intro overlay entirely (e.g. dev without asset, or static hero only) */
export const LANDING_INTRO_DISABLED =
  import.meta.env.VITE_LANDING_INTRO_DISABLED === "true";
