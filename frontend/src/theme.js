// Design tokens from the "Professional Nexus" design system
export const colors = {
  primary:                '#070049',
  primaryContainer:       '#1e1b5e',
  onPrimary:              '#ffffff',
  secondary:              '#0058be',
  surface:                '#faf8ff',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow:    '#f2f3ff',
  surfaceContainer:       '#eaedff',
  surfaceContainerHigh:   '#e2e7ff',
  onSurface:              '#131b2e',
  onSurfaceVariant:       '#474650',
  outlineVariant:         '#c8c5d2',
  tertiaryFixedDim:       '#c6c6c6',
  onTertiaryFixed:        '#1a1c1c',
  error:                  '#ba1a1a',
};

export const fonts = {
  headline: 'System',  // Manrope equivalent — system bold
  body:     'System',
};

// Ambient shadow matching design spec (on_surface at 6% opacity, 32px blur)
export const cardShadow = {
  shadowColor:   '#131b2e',
  shadowOffset:  { width: 0, height: 12 },
  shadowOpacity: 0.06,
  shadowRadius:  32,
  elevation:     6,
};
