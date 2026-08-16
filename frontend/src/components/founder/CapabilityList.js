import { View, Text, StyleSheet } from 'react-native';
import { radius, typography } from '../../theme';

// Provides / Needs capability rows (spec section 4) — ranked progress bars
// matching the profile page mockup. The score isn't a self-rated absolute
// strength; it's derived purely from the founder's own priority ranking
// (top of the list = 100, decreasing by 10 per position — see
// EditFounderProfileScreen's scoreByRank) — a within-founder ordering, not a
// number comparable across founders.
export default function CapabilityList({ title, items, C, color }) {
  if (!items || items.length === 0) return null;
  const barColor = color || C.primary;
  const styles = makeStyles(C);
  return (
    <View>
      <Text style={styles.sectionLabel}>{title}</Text>
      {items.map((item) => (
        <View key={item.capability} style={styles.row}>
          <Text style={styles.label} numberOfLines={1}>{item.capability}</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.max(0, Math.min(100, item.score ?? 0))}%`, backgroundColor: barColor }]} />
          </View>
          <Text style={[styles.pct, { color: barColor }]}>{Math.round(item.score ?? 0)}%</Text>
        </View>
      ))}
    </View>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    sectionLabel: { ...typography.labelSmall, color: C.textHint, textTransform: 'uppercase', marginBottom: 10, marginTop: 16 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    label: { ...typography.bodySmall, color: C.textPrimary, width: 128, flexShrink: 0 },
    track: { flexGrow: 1, flexShrink: 1, minWidth: 24, height: 6, borderRadius: radius.pill, backgroundColor: C.surfaceElevated, overflow: 'hidden' },
    fill: { height: 6, borderRadius: radius.pill },
    pct: { ...typography.caption, fontWeight: '700', width: 32, textAlign: 'right' },
  });
}
