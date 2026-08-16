import { View, Text, Image, StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { radius, cardShadow, typography, brandGradient } from '../../theme';

const DESKTOP_BREAKPOINT = 768;

// Shared responsive check — screens use this to switch between the mobile
// single-column layout and the desktop two-column grid seen in the mockups.
export function useIsDesktop() {
  const { width } = useWindowDimensions();
  return width >= DESKTOP_BREAKPOINT;
}

// Colored circle with an Ionicons glyph inside — the recurring section-header
// and stat-tile icon treatment across every mockup screen.
export function IconCircle({ name, color, bg, size = 40, iconSize }) {
  return (
    <View style={[styles.iconCircle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Ionicons name={name} size={iconSize || size * 0.5} color={color} />
    </View>
  );
}

// Card with a big number, label, and optional icon — dashboard/program
// overview tiles.
export function StatTile({ icon, iconColor, iconBg, value, label, warn, C }) {
  return (
    <View style={[styles.statTile, { backgroundColor: C.surface }, cardShadow]}>
      {icon ? <IconCircle name={icon} color={iconColor || C.primary} bg={iconBg || C.surfaceElevated} size={40} /> : null}
      <Text style={[styles.statValue, { color: warn ? C.warning : C.textPrimary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: C.textSecondary }]}>{label}</Text>
    </View>
  );
}

// Deep-navy → azure gradient banner used for the Dashboard "program" hero and
// the Founder Profile header.
export function GradientHero({ children, style }) {
  return (
    <LinearGradient
      colors={[brandGradient.start, brandGradient.middle, brandGradient.end]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.hero, style]}
    >
      {children}
    </LinearGradient>
  );
}

// Rounded status/label pill — "Active", "Looking for Team", "92% Match", etc.
export function Pill({ label, color, bg, outline, C }) {
  return (
    <View style={[
      styles.pill,
      { backgroundColor: outline ? 'transparent' : (bg || C.surfaceElevated) },
      outline && { borderWidth: 1, borderColor: color || C.primary },
    ]}>
      <Text style={[styles.pillText, { color: color || C.textSecondary }]}>{label}</Text>
    </View>
  );
}

// White card with an icon-circle + title header — "Team Strengths",
// "Potential Gaps", etc. throughout the Team/Founder mockups.
export function SectionCard({ icon, iconColor, iconBg, title, children, C, style, right }) {
  return (
    <View style={[styles.sectionCard, { backgroundColor: C.surface }, cardShadow, style]}>
      {title ? (
        <View style={styles.sectionCardHeader}>
          <View style={styles.sectionCardHeaderLeft}>
            {icon ? <IconCircle name={icon} color={iconColor || C.primary} bg={iconBg || C.surfaceElevated} size={32} iconSize={16} /> : null}
            <Text style={[styles.sectionCardTitle, { color: C.textPrimary }]}>{title}</Text>
          </View>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function Avatar({ photoUrl, name, size = 44, C }) {
  if (photoUrl) return <Image source={{ uri: photoUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2, backgroundColor: C.primary }]}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.4 }}>
        {name ? name[0].toUpperCase() : '?'}
      </Text>
    </View>
  );
}

// Simple responsive row that becomes a column below the desktop breakpoint —
// the "two cards side by side on desktop, stacked on mobile" pattern used
// throughout the mockups.
export function ResponsiveRow({ children, gap = 16, style }) {
  const isDesktop = useIsDesktop();
  return (
    <View style={[{ flexDirection: isDesktop ? 'row' : 'column', gap }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  iconCircle: { justifyContent: 'center', alignItems: 'center' },

  statTile: { flex: 1, minWidth: 150, borderRadius: radius.lg, padding: 16, gap: 10 },
  statValue: { fontSize: 26, fontWeight: '800' },
  statLabel: { ...typography.bodySmall },

  hero: { borderRadius: radius.xl, overflow: 'hidden' },

  pill: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  pillText: { fontSize: 11, fontWeight: '700' },

  // height:'100%' (not flex:1) deliberately: this needs to fill a bounded,
  // row-stretched parent (ResponsiveRow's per-card flex:1 wrapper) so cards
  // in the same row match the tallest one, but SectionCard is also used
  // standalone in plain column ScrollViews with no bounded parent height —
  // flex:1 there degenerates (flex-basis:0% + no available space to grow
  // into) into near-zero/unpredictable sizing, which clipped or stretched
  // content wildly. height:'100%' resolves to `auto` (a no-op) when the
  // parent has no defined height, so it's safe in both contexts.
  sectionCard: { height: '100%', borderRadius: radius.lg, padding: 18 },
  sectionCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionCardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionCardTitle: { ...typography.titleSmall },

  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
});
