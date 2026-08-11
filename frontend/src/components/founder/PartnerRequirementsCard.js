import { View, Text, StyleSheet } from 'react-native';
import { radius, typography } from '../../theme';

// LOOKING FOR card (spec section 5) — distinct from the Founder Profile
// itself: this is the Founder Matching Profile, what they need in a partner.
export default function PartnerRequirementsCard({ requirements, dealBreakers, C }) {
  const hasContent = requirements?.roleWanted || requirements?.mustProvide?.length
    || requirements?.commitmentRequired || requirements?.preferredTraits?.length
    || dealBreakers?.length;
  if (!hasContent) return null;

  return (
    <View>
      {requirements?.roleWanted ? (
        <Row label="Role" value={requirements.roleWanted} C={C} />
      ) : null}
      {requirements?.commitmentRequired ? (
        <Row label="Commitment" value={requirements.commitmentRequired} C={C} />
      ) : null}
      {requirements?.ambitionRequired ? (
        <Row label="Ambition" value={requirements.ambitionRequired} C={C} />
      ) : null}

      {requirements?.mustProvide?.length ? (
        <ChipGroup label="Must Provide" items={requirements.mustProvide} C={C} chipColor={C.primary} />
      ) : null}
      {requirements?.preferredTraits?.length ? (
        <ChipGroup label="Preferred" items={requirements.preferredTraits} C={C} chipColor={C.success} />
      ) : null}
      {dealBreakers?.length ? (
        <ChipGroup label="Deal Breakers" items={dealBreakers} C={C} chipColor={C.error} />
      ) : null}
    </View>
  );
}

function Row({ label, value, C }) {
  return (
    <View style={[styles.dataRow, { borderBottomColor: C.surfaceBorder }]}>
      <Text style={[styles.dataLabel, { color: C.textSecondary }]}>{label}</Text>
      <Text style={[styles.dataValue, { color: C.textPrimary }]}>{value}</Text>
    </View>
  );
}

function ChipGroup({ label, items, C, chipColor }) {
  return (
    <View style={styles.chipGroup}>
      <Text style={[styles.chipGroupLabel, { color: C.textSecondary }]}>{label}</Text>
      <View style={styles.chipRow}>
        {items.map((item) => (
          <View key={item} style={[styles.chip, { borderColor: chipColor }]}>
            <Text style={[styles.chipText, { color: chipColor }]}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { ...typography.labelSmall, textTransform: 'uppercase', marginBottom: 12, marginTop: 16 },
  dataRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1 },
  dataLabel: { ...typography.bodyMedium },
  dataValue: { ...typography.bodyMedium, fontWeight: '700' },
  chipGroup: { marginTop: 10 },
  chipGroupLabel: { ...typography.caption, marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  chipText: { fontSize: 12, fontWeight: '600' },
});
