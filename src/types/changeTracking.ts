/**
 * Change Tracking Types
 * For marking newly added text with visual styles
 */

export interface ChangeTrackingStyles {
  textColor: boolean;
  backgroundColor: boolean;
  italic: boolean;
}

export interface DaySettings {
  date: string; // YYYY-MM-DD
  enabled: boolean;
  color: string;
  styles: ChangeTrackingStyles;
}

export interface ChangeTrackingState {
  enabled: boolean;
  color: string;
  styles: ChangeTrackingStyles;
}

export const DEFAULT_TRACKING_COLOR = "#C92A2A";

export const DEFAULT_STYLES: ChangeTrackingStyles = {
  textColor: true,
  backgroundColor: false,
  italic: false,
};
