import { View, Text, StyleSheet } from 'react-native';
import { radius, typography } from '../../theme';
import { DIMENSION_LABELS } from '../../services/founders.service';

const SOURCE_LABELS = {
  self: 'Self Report',
  peer: 'Peer Feedback',
  evaluator: 'Evaluator',
  interview: 'Interview',
  activity: 'Activity',
  work_trial: 'Work Trial',
  reference: 'Reference',
};

// FND-05/06: distinct color per provenance so the source reads at a glance
// instead of requiring the badge text to be read every time — same idea as
// the app's other semantic-color usage (status pills, confidence dots).
const SOURCE_COLORS = {
  self: (C) => ({ bg: C.surfaceElevated, color: C.textSecondary }),
  peer: (C) => ({ bg: C.warningLight, color: C.warning }),
  evaluator: (C) => ({ bg: C.successLight, color: C.success }),
  interview: (C) => ({ bg: C.successLight, color: C.success }),
  activity: (C) => ({ bg: C.primaryLight || C.surfaceElevated, color: C.primary }),
  work_trial: (C) => ({ bg: C.primaryLight || C.surfaceElevated, color: C.primary }),
  reference: (C) => ({ bg: C.warningLight, color: C.warning }),
};

const CONFIDENCE_LABELS = { low: 'Low confidence', medium: 'Medium confidence', high: 'High confidence' };

function formatDate(dateStr) {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

// Evidence Timeline (spec section 10) — every piece of evidence with its
// source, so a score never floats free of what it's based on. Each row
// surfaces weight and confidence too (FND-05/06) — two rows with the same
// score can carry very different trust depending on where they came from,
// and that shouldn't be hidden behind the source label alone.
export default function EvidenceTimeline({ evidence, C }) {
  if (!evidence || evidence.length === 0) {
    return (
      <Text style={[styles.emptyText, { color: C.textHint }]}>No evidence recorded yet.</Text>
    );
  }

  return (
    <View>
      {evidence.map((item) => {
        const sourceColor = (SOURCE_COLORS[item.source_type] || SOURCE_COLORS.self)(C);
        return (
          <View key={item.id} style={[styles.row, { borderBottomColor: C.surfaceBorder }]}>
            <View style={styles.rowHeader}>
              <Text style={[styles.date, { color: C.textHint }]}>{formatDate(item.created_at)}</Text>
              <View style={[styles.sourceBadge, { backgroundColor: sourceColor.bg }]}>
                <Text style={[styles.sourceBadgeText, { color: sourceColor.color }]}>
                  {SOURCE_LABELS[item.source_type] || item.source_type}
                </Text>
              </View>
            </View>
            <Text style={[styles.dimension, { color: C.textPrimary }]}>
              {DIMENSION_LABELS[item.dimension] || item.dimension}
              {item.is_negative ? ' −' : ' +'}
              {item.score}
            </Text>
            {item.observation ? (
              <Text style={[styles.observation, { color: C.textSecondary }]}>“{item.observation}”</Text>
            ) : null}
            <View style={styles.metaRow}>
              {item.evaluator_name ? (
                <Text style={[styles.evaluator, { color: C.textHint }]}>— {item.evaluator_name}</Text>
              ) : null}
              {item.weight != null ? (
                <Text style={[styles.metaText, { color: C.textHint }]}>weight {Number(item.weight).toFixed(2)}×</Text>
              ) : null}
              {item.confidence ? (
                <Text style={[styles.metaText, { color: C.textHint }]}>{CONFIDENCE_LABELS[item.confidence] || item.confidence}</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyText: { ...typography.bodyMedium, textAlign: 'center', paddingVertical: 20 },
  row: { paddingVertical: 12, borderBottomWidth: 1 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  date: { ...typography.caption },
  sourceBadge: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  sourceBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  dimension: { ...typography.bodyMedium, fontWeight: '700' },
  observation: { ...typography.bodySmall, marginTop: 4, fontStyle: 'italic' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  evaluator: { ...typography.caption },
  metaText: { ...typography.caption },
});
