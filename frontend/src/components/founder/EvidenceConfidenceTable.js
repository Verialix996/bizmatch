import { View, Text, StyleSheet } from 'react-native';
import { radius, typography } from '../../theme';
import { DIMENSIONS, DIMENSION_LABELS } from '../../services/founders.service';

const CONFIDENCE_LABEL = { high: 'High', medium: 'Medium', low: 'Low' };

// Dimension / Score (with a horizontal bar) / Confidence — matches the
// reference design: blue column headers, a score bar per row, and a
// colored confidence label on the right. Missing dimensions render "—",
// never a fabricated 0.
export default function EvidenceConfidenceTable({ insights, C }) {
  const styles = makeStyles(C);
  const dims = insights?.dimensions || {};

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={[styles.headerText, styles.dimCol]}>Dimension</Text>
        <Text style={[styles.headerText, styles.scoreCol]}>Score</Text>
        <Text style={[styles.headerLabel, styles.confCol]}>Confidence</Text>
      </View>
      {DIMENSIONS.map((dim) => {
        const d = dims[dim] || {};
        const confColor = d.confidence === 'high' ? C.success : d.confidence === 'medium' ? C.warning : C.error;
        return (
          <View key={dim} style={styles.row}>
            <Text style={[styles.dimText, styles.dimCol]} numberOfLines={1}>{DIMENSION_LABELS[dim] || dim}</Text>
            <View style={[styles.scoreCol, styles.scoreWrap]}>
              <Text style={styles.scoreText}>{d.score != null ? `${d.score}%` : '—'}</Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.max(0, Math.min(100, d.score ?? 0))}%`, backgroundColor: C.primary }]} />
              </View>
            </View>
            <Text style={[styles.confText, styles.confCol, { color: d.confidence ? confColor : C.textHint }]}>
              {d.confidence ? CONFIDENCE_LABEL[d.confidence] : '—'}
            </Text>
          </View>
        );
      })}
      <Text style={styles.footnote}>
        No evidence is shown as —, never 0. Confidence: High needs 4+ sources from 3+ types; Medium needs 2+ sources from 2+ types; otherwise Low.
      </Text>
    </View>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 8, marginBottom: 4 },
    headerText: { ...typography.labelSmall, color: C.primary, fontWeight: '700' },
    headerLabel: { ...typography.labelSmall, color: C.textHint, fontWeight: '700' },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9,
      borderBottomWidth: 1, borderBottomColor: C.surfaceBorder,
    },
    dimCol: { flex: 1.7, paddingRight: 6 },
    scoreCol: { flex: 1.6 },
    confCol: { flex: 0.9, textAlign: 'right' },
    dimText: { ...typography.bodySmall, color: C.textPrimary },
    scoreWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    scoreText: { ...typography.bodySmall, color: C.textPrimary, fontWeight: '700', width: 34 },
    track: { flex: 1, height: 5, borderRadius: 3, backgroundColor: C.surfaceElevated, overflow: 'hidden' },
    fill: { height: 5, borderRadius: 3 },
    confText: { ...typography.bodySmall, fontWeight: '700' },
    footnote: { ...typography.caption, color: C.textHint, marginTop: 10 },
  });
}
