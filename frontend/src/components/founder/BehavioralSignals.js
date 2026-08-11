import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { typography } from '../../theme';
import { DIMENSION_LABELS } from '../../services/founders.service';

// "Behavioral signals" list — the same strengths/weaknesses split InsightsList
// already computes, rendered as icon + dimension + real source count instead
// of a synthesized narrative sentence (there's no free-text bullet field in
// the API to draw one from honestly).
export default function BehavioralSignals({ insights, C }) {
  const styles = makeStyles(C);
  const dims = Object.entries(insights?.dimensions || {})
    .filter(([, d]) => d.score != null)
    .map(([dim, d]) => ({ dim, ...d }))
    .sort((a, b) => b.score - a.score);

  if (dims.length === 0) {
    return <Text style={styles.emptyText}>No evidence recorded yet.</Text>;
  }

  return (
    <View>
      {dims.map((d) => {
        const positive = d.score >= 60;
        return (
          <View key={d.dim} style={styles.row}>
            <Ionicons
              name={positive ? 'checkmark-circle' : 'alert-circle'}
              size={16}
              color={positive ? C.success : C.warning}
            />
            <Text style={styles.label}>{DIMENSION_LABELS[d.dim] || d.dim}</Text>
            <Text style={styles.count}>{d.evidenceCount} source{d.evidenceCount === 1 ? '' : 's'}</Text>
          </View>
        );
      })}
    </View>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7 },
    label: { ...typography.bodySmall, color: C.textPrimary, flex: 1 },
    count: { ...typography.caption, color: C.textHint },
    emptyText: { ...typography.bodySmall, color: C.textHint },
  });
}
