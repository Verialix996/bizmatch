import { View, Text, StyleSheet } from 'react-native';
import { radius, typography } from '../../theme';

function Bar({ score, color, trackColor }) {
  return (
    <View style={[styles.track, { backgroundColor: trackColor }]}>
      <View style={[styles.fill, { width: `${Math.max(0, Math.min(100, score))}%`, backgroundColor: color }]} />
    </View>
  );
}

// Provides / Needs capability bars (spec section 4). Raw profile data —
// scores are self-entered during onboarding, not evidence-derived.
// Provides renders in the primary color, Needs in warning/amber, matching
// the Capability profile card's blue-vs-orange convention.
export default function CapabilityList({ title, items, C, color }) {
  if (!items || items.length === 0) return null;
  const barColor = color || C.primary;
  return (
    <View>
      <Text style={[styles.sectionLabel, { color: C.textHint }]}>{title}</Text>
      {items.map((item) => (
        <View key={item.capability} style={styles.row}>
          <View style={styles.rowHeader}>
            <Text style={[styles.rowLabel, { color: C.textPrimary }]}>{item.capability}</Text>
            <Text style={[styles.rowScore, { color: C.textSecondary }]}>{item.score}</Text>
          </View>
          <Bar score={item.score} color={barColor} trackColor={C.surfaceElevated} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { ...typography.labelSmall, textTransform: 'uppercase', marginBottom: 12, marginTop: 16 },
  row: { marginBottom: 12 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  rowLabel: { ...typography.bodyMedium, fontWeight: '600' },
  rowScore: { ...typography.bodyMedium, fontWeight: '700' },
  track: { height: 6, borderRadius: radius.sm, overflow: 'hidden' },
  fill: { height: 6, borderRadius: radius.sm },
});
