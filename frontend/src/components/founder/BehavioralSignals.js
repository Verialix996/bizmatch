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
        const lowConfidence = d.confidence === 'low' || d.evidenceCount < 2;
        return (
          <View key={d.dim} style={styles.row}>
            <Ionicons
              name={positive && !lowConfidence ? 'checkmark-circle' : 'alert-circle'}
              size={16}
              color={positive && !lowConfidence ? C.success : C.warning}
              style={styles.icon}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{DIMENSION_LABELS[d.dim] || d.dim}</Text>
              <Text style={styles.sub}>
                {lowConfidence
                  ? 'More evidence under pressure recommended.'
                  : `Based on ${d.evidenceCount} source${d.evidenceCount === 1 ? '' : 's'}, ${d.confidence || 'medium'} confidence.`}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8 },
    icon: { marginTop: 2 },
    label: { ...typography.bodySmall, color: C.textPrimary, fontWeight: '700' },
    sub: { ...typography.caption, color: C.textSecondary, marginTop: 2 },
    emptyText: { ...typography.bodySmall, color: C.textHint },
  });
}
