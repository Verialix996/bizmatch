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

function formatDate(dateStr) {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

// Evidence Timeline (spec section 10) — every piece of evidence with its
// source, so a score never floats free of what it's based on.
export default function EvidenceTimeline({ evidence, C }) {
  if (!evidence || evidence.length === 0) {
    return (
      <Text style={[styles.emptyText, { color: C.textHint }]}>No evidence recorded yet.</Text>
    );
  }

  return (
    <View>
      {evidence.map((item) => (
        <View key={item.id} style={[styles.row, { borderBottomColor: C.surfaceBorder }]}>
          <View style={styles.rowHeader}>
            <Text style={[styles.date, { color: C.textHint }]}>{formatDate(item.created_at)}</Text>
            <View style={[styles.sourceBadge, { backgroundColor: C.surfaceElevated }]}>
              <Text style={[styles.sourceBadgeText, { color: C.textSecondary }]}>
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
          {item.evaluator_name ? (
            <Text style={[styles.evaluator, { color: C.textHint }]}>— {item.evaluator_name}</Text>
          ) : null}
        </View>
      ))}
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
  evaluator: { ...typography.caption, marginTop: 2 },
});
