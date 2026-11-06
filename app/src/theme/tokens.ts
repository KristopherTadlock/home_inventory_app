/** Design tokens. Components reference colours only through `colors` so a dark theme is a
 * change to this file. */

export const colors = {
  background: '#F4F6F8',
  surface: '#FFFFFF',
  border: '#DDE2E8',
  text: '#1B1F24',
  textMuted: '#5B6573',
  placeholder: '#7A8492',
  primary: '#2357C6',
  onPrimary: '#FFFFFF',
  chip: '#EAEFF5',
  chipSelected: '#D6E2FA',
  danger: '#B42318',
  onDanger: '#FFFFFF',
  warning: '#9A4D00',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radii = {
  sm: 8,
  md: 12,
  pill: 999,
};

export const fontSizes = {
  caption: 12,
  small: 14,
  body: 16,
  title: 18,
  heading: 22,
};

/** Minimum size of anything tappable, in dp. */
export const touchTarget = 44;

/** Content is centred and capped at this width on tablets and desktop. */
export const contentMaxWidth = 640;

export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 };
