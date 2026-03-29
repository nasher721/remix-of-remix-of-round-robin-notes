/**
 * Public marketing / landing page configuration (Vite env).
 */

/** Shown on landing footer, contact section, and Privacy page */
export const CONTACT_EMAIL =
  import.meta.env.VITE_CONTACT_EMAIL?.trim() || "hello@rollingrounds.app";

/** Whether the default is still the placeholder (show setup hint in UI) */
export const CONTACT_EMAIL_IS_PLACEHOLDER =
  !import.meta.env.VITE_CONTACT_EMAIL?.trim();
