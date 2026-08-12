import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { typography } from '../../theme';

// Partner requirements card (spec section 5) — what this founder needs in a
// co-founder. Rendered as checklist rows (desired qualities in green,
// deal-breakers in red) matching the profile page mockup, rather than chips.
export default function PartnerRequirementsCard({ requirements, dealBreakers, C }) {
  const desired = [...(requirements?.mustProvide || []), ...(requirements?.preferredTraits || [])];
  const hasContent = requirements?.roleWanted || requirements?.commitmentRequired
    || requirements?.ambitionRequired || desired.length || dealBreakers?.length;
  if (!hasContent) return null;

  const styles = makeStyles(C);

  return (
    <View>
      {requirements?.roleWanted ? <Row label="Role" value={requirements.roleWanted} C={C} styles={styles} /> : null}
      {requirements?.commitmentRequired ? <Row label="Commitment" value={requirements.commitmentRequired} C={C} styles={styles} /> : null}
      {requirements?.ambitionRequired ? <Row label="Ambition" value={requirements.ambitionRequired} C={C} styles={styles} /> : null}

      {desired.length ? (
        <View style={styles.group}>
          <Text style={styles.groupLabel}>Desired Co-founder Qualities</Text>
          {desired.map((item) => (
            <View key={item} style={styles.checkRow}>
              <Ionicons name="checkmark-circle" size={16} color={C.success} />
              <Text style={styles.checkText}>{item}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {dealBreakers?.length ? (
        <View style={styles.group}>
          <Text style={[styles.groupLabel, { color: C.error }]}>Deal Breakers</Text>
          {dealBreakers.map((item) => (
            <View key={item} style={styles.checkRow}>
              <Ionicons name="close-circle" size={16} color={C.error} />
              <Text style={styles.checkText}>{item}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Row({ label, value, C, styles }) {
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text style={styles.dataValue}>{value}</Text>
    </View>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    dataRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.surfaceBorder },
    dataLabel: { ...typography.bodyMedium, color: C.textSecondary },
    dataValue: { ...typography.bodyMedium, fontWeight: '700', color: C.textPrimary },

    group: { marginTop: 14 },
    groupLabel: { ...typography.labelLarge, color: C.success, marginBottom: 8 },
    checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 5 },
    checkText: { ...typography.bodySmall, color: C.textPrimary, flex: 1 },
  });
}
