export const APACHE_II_CONDITIONS = {
    SEVERE_ORGAN_FAILURE: 'severe organ failure',
    IMMUNOCOMPROMISED: 'immunocompromised',
} as const;

export type ApacheIICondition = typeof APACHE_II_CONDITIONS[keyof typeof APACHE_II_CONDITIONS];
