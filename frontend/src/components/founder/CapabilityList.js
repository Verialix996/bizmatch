import { View, Text, StyleSheet } from 'react-native';
import { radius, typography } from '../../theme';

// Provides / Needs capability tags (spec section 4). Names only — no score
// or bar, since the underlying score is just a self-entered onboarding
// default, not a meaningfully comparable strength rating.
export default function CapabilityList({ title, items, C, color }) {
  if (!items || items.length === 0) return null;
  const tagColor = color || C.primary;
  return (
    <View>
      <Text style={[styles.sectionLabel, { color: C.textHint }]}>{title}</Text>
      <View style={styles.tagRow}>
        {items.map((item) => (
          <View key={item.capability} style={[styles.tag, { borderColor: tagColor }]}>
            <Text style={[styles.tagText, { color: tagColor }]}>{item.capability}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { ...typography.labelSmall, textTransform: 'uppercase', marginBottom: 12, marginTop: 16 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { borderRadius: radius.pill, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 7 },
  tagText: { ...typography.bodySmall, fontWeight: '700' },
});
