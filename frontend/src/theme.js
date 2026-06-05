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

// Dark mode palette — pure obsidian + blue accent (matches BizMatch web demo)
export const investorColors = {
  primary:              '#3B82F6',   // Blue — buttons, active tabs, icons
  primaryDark:          '#2563EB',   // Darker blue — hover states
  primaryLight:         '#60A5FA',   // Light blue — highlights

  background:           '#0A0A0A',   // Pure near-black
  backgroundSoft:       '#0F0F0F',   // Slightly lifted near-black
  surface:              '#141414',   // Card surfaces
  surfaceElevated:      '#1A1A1A',   // Elevated cards, modals
  surfaceBorder:        '#2A2A2A',   // Subtle border

  textPrimary:          '#FFFFFF',   // Pure white — main body text
  textSecondary:        '#9CA3AF',   // Gray-400 — secondary text
  textHint:             '#6B7280',   // Gray-500 — placeholders, hints
  textOnPrimary:        '#FFFFFF',   // White on blue buttons

  success:              '#10B981',
  successLight:         '#022C22',
  error:                '#EF4444',
  errorLight:           '#450A0A',
  warning:              '#F59E0B',
  warningLight:         '#422006',

  buttonPrimary:        '#3B82F6',
  buttonPrimaryText:    '#FFFFFF',
  buttonOutlineBorder:  '#3B82F6',
  buttonOutlineText:    '#3B82F6',
  buttonDestructive:    '#EF4444',

  swipeLike:            '#10B981',
  swipePass:            '#EF4444',

  tabBarBackground:     '#0A0A0A',
  tabBarBorder:         '#2A2A2A',
  tabBarActive:         '#3B82F6',
  tabBarInactive:       '#6B7280',
};

// Investor swipe mode palette — dark forest green + champagne (original premium feel)
export const investorSwipeColors = {
  primary:              '#E8D5A3',   // Champagne — active elements
  primaryDark:          '#C4AD78',
  primaryLight:         '#F0E4BC',

  background:           '#0B3321',   // Dark forest green
  backgroundSoft:       '#0D3D26',
  surface:              '#112E1E',   // Card surfaces
  surfaceElevated:      '#164030',   // Elevated cards
  surfaceBorder:        '#1B5E34',   // Subtle green border

  textPrimary:          '#F0EDE8',   // Cream
  textSecondary:        '#B8CDB8',   // Muted green-cream
  textHint:             '#7A9E80',   // Dim green-tinted hint
  textOnPrimary:        '#0A1A0C',   // Near-black on champagne

  success:              '#4ADE80',
  successLight:         '#052E16',
  error:                '#F87171',
  errorLight:           '#450A0A',
  warning:              '#FCD34D',
  warningLight:         '#422006',

  buttonPrimary:        '#E8D5A3',
  buttonPrimaryText:    '#0A1A0C',
  buttonOutlineBorder:  '#E8D5A3',
  buttonOutlineText:    '#E8D5A3',
  buttonDestructive:    '#F87171',

  swipeLike:            '#4ADE80',
  swipePass:            '#F87171',

  tabBarBackground:     '#0B3321',
  tabBarBorder:         '#1B5E34',
  tabBarActive:         '#E8D5A3',
  tabBarInactive:       '#5A8A65',
};

// Investor account palette — warm parchment + rich gold (light luxury theme)
export const investorThemeColors = {
  primary:              '#A87820',   // Rich gold — buttons, active tabs, icons
  primaryDark:          '#856010',   // Deep gold — pressed/hover
  primaryLight:         '#C49830',   // Light gold — highlights

  background:           '#F7F3EC',   // Warm parchment — main background
  backgroundSoft:       '#EFE8D8',   // Deeper parchment — secondary surfaces
  surface:              '#FFFFFF',   // Card surfaces
  surfaceElevated:      '#FFF8ED',   // Cream — elevated cards, modals
  surfaceBorder:        '#DDD0B8',   // Warm tan border

  textPrimary:          '#1A1208',   // Deep warm near-black — main body text
  textSecondary:        '#5A4A2A',   // Warm dark brown — secondary text
  textHint:             '#8A7A5A',   // Muted warm tan — placeholders, hints
  textOnPrimary:        '#FFFFFF',   // White on gold buttons

  success:              '#1A7A4A',   // Deep green
  successLight:         '#E8F5EE',
  error:                '#B03020',   // Deep red
  errorLight:           '#FDECEA',
  warning:              '#C47A10',   // Dark amber
  warningLight:         '#FEF3DC',

  buttonPrimary:        '#A87820',
  buttonPrimaryText:    '#FFFFFF',
  buttonOutlineBorder:  '#A87820',
  buttonOutlineText:    '#A87820',
  buttonDestructive:    '#B03020',

  swipeLike:            '#1A7A4A',
  swipePass:            '#B03020',

  tabBarBackground:     '#FFFFFF',
  tabBarBorder:         '#DDD0B8',
  tabBarActive:         '#A87820',
  tabBarInactive:       '#8A7A5A',
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