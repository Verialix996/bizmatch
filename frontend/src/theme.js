// BizMatch Design Tokens
// Brand palette extracted from the official BizMatch logo and identity

export const colors = {
  // ── Primary Brand ──────────────────────────────
  primary:              '#004DBA',   // Vibrant Royal Blue — buttons, active tabs, icons
  primaryDark:          '#022466',   // Deep Navy — text on light, dark headers
  primaryLight:         '#0070F0',   // Bright Azure — highlights, active states, gradient top

  // ── Surfaces ───────────────────────────────────
  background:           '#FFFFFF',   // Pure white — main app background
  backgroundSoft:       '#F4F6F9',   // Light gray-blue — secondary surfaces, input backgrounds
  surface:              '#FFFFFF',   // Card/sheet surfaces
  surfaceElevated:      '#F0F4FF',   // Slightly tinted — elevated cards, modals
  surfaceBorder:        '#DDE3F0',   // Subtle border between elements

  // ── Text ───────────────────────────────────────
  textPrimary:          '#022466',   // Deep navy — main body text (replaces black)
  textSecondary:        '#4A5A7A',   // Mid-tone navy — secondary/muted text
  textHint:             '#8A96AE',   // Light navy-gray — placeholders, hints
  textOnPrimary:        '#FFFFFF',   // White — text on primary blue backgrounds

  // ── Semantic ───────────────────────────────────
  success:              '#1A9E6A',   // Green — match confirmation, positive states
  successLight:         '#E8F7F2',   // Light green background
  error:                '#C0392B',   // Red — errors, destructive actions
  errorLight:           '#FDECEA',   // Light red background
  warning:              '#E67E22',   // Amber — warnings
  warningLight:         '#FEF6EC',   // Light amber background

  // ── Interactive ────────────────────────────────
  buttonPrimary:        '#004DBA',   // Primary CTA button fill
  buttonPrimaryText:    '#FFFFFF',   // Text on primary button
  buttonOutlineBorder:  '#004DBA',   // Outlined button border
  buttonOutlineText:    '#004DBA',   // Outlined button text
  buttonDestructive:    '#C0392B',   // Delete / destructive button

  // ── Swipe Actions ──────────────────────────────
  swipeLike:            '#1A9E6A',   // Like / right swipe
  swipePass:            '#C0392B',   // Pass / left swipe

  // ── Tab Bar ────────────────────────────────────
  tabBarBackground:     '#FFFFFF',
  tabBarBorder:         '#DDE3F0',
  tabBarActive:         '#004DBA',
  tabBarInactive:       '#8A96AE',
};

// Investor mode palette — deep navy + champagne (high-end, luxury feel)
export const investorColors = {
  primary:              '#E8D5A3',   // Champagne — buttons, active tabs
  primaryDark:          '#C4AD78',   // Dark champagne — text on dark
  primaryLight:         '#F0E4BC',   // Light champagne — highlights

  background:           '#0A0F1E',   // Deep navy — main background
  backgroundSoft:       '#0D1426',   // Slightly lighter navy
  surface:              '#111827',   // Card surfaces
  surfaceElevated:      '#1A2340',   // Elevated cards
  surfaceBorder:        '#2A3550',   // Subtle border

  textPrimary:          '#F0EDE8',   // Cream — main body text
  textSecondary:        '#B8C0D4',   // Muted blue-gray
  textHint:             '#6B7A99',   // Dim text
  textOnPrimary:        '#0A0F1E',   // Dark on champagne

  success:              '#4ADE80',
  successLight:         '#052e16',
  error:                '#F87171',
  errorLight:           '#450a0a',
  warning:              '#FCD34D',
  warningLight:         '#422006',

  buttonPrimary:        '#E8D5A3',
  buttonPrimaryText:    '#0A0F1E',
  buttonOutlineBorder:  '#E8D5A3',
  buttonOutlineText:    '#E8D5A3',
  buttonDestructive:    '#F87171',

  swipeLike:            '#4ADE80',
  swipePass:            '#F87171',

  tabBarBackground:     '#0A0F1E',
  tabBarBorder:         '#2A3550',
  tabBarActive:         '#E8D5A3',
  tabBarInactive:       '#6B7A99',
};

// Auth screens / splash — use as a LinearGradient from top to bottom
export const brandGradient = {
  start:    '#0070F0',   // Top — Bright Azure
  middle:   '#004DBA',   // Mid  — Vibrant Royal Blue
  end:      '#022466',   // Base — Deep Navy
};

// Consistent card shadow across the app
export const cardShadow = {
  shadowColor:   '#022466',
  shadowOffset:  { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius:  16,
  elevation:     4,
};

// Border radius tokens
export const radius = {
  sm:   6,
  md:   10,
  lg:   16,
  xl:   24,
  pill: 999,
};

// Typography scale
export const typography = {
  displayLarge:  { fontSize: 32, fontWeight: '800', letterSpacing: -0.8 },
  displayMedium: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  titleLarge:    { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  titleMedium:   { fontSize: 18, fontWeight: '700' },
  titleSmall:    { fontSize: 15, fontWeight: '700' },
  bodyLarge:     { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  bodyMedium:    { fontSize: 14, fontWeight: '400', lineHeight: 20 },
  bodySmall:     { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  labelLarge:    { fontSize: 13, fontWeight: '600' },
  labelSmall:    { fontSize: 11, fontWeight: '700', letterSpacing: 1.0 },
  caption:       { fontSize: 11, fontWeight: '400' },
};