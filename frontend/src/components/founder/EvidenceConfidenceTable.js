import { View, Text, StyleSheet } from 'react-native';
import { radius, typography } from '../../theme';
import { DIMENSIONS, DIMENSION_LABELS } from '../../services/founders.service';

const CONFIDENCE_LABEL = { high: 'High', medium: 'Medium', low: 'Low' };

// Dimension / Score / Confidence / Evidence — a real 4-column table, matching
// the profile page mockup exactly (header row, column dividers, colored
// confidence text). Missing dimensions render "—", never a fabricated 0.
export default function EvidenceConfidenceTable({ insights, C }) {
  const styles = makeStyles(C);
  const dims = insights?.dimensions || {};

  return (
    <View>
      <View style={styles.table}>
        <View style={[styles.row, styles.headerRow]}>
          <Text style={[styles.cell, styles.dimCell, styles.headerText]}>Dimension</Text>
          <Text style={[styles.cell, styles.scoreCell, styles.headerText]}>Score</Text>
          <Text style={[styles.cell, styles.confCell, styles.headerText]}>Confidence</Text>
          <Text style={[styles.cell, styles.evCell, styles.headerText]}>Evidence</Text>
        </View>
        {DIMENSIONS.map((dim, i) => {
          const d = dims[dim] || {};
          const confColor = d.confidence === 'high' ? C.success : d.confidence === 'medium' ? C.warning : C.error;
          return (
            <View key={dim} style={[styles.row, i === DIMENSIONS.length - 1 && styles.lastRow]}>
              <Text style={[styles.cell, styles.dimCell, styles.dimText]}>{DIMENSION_LABELS[dim] || dim}</Text>
              <Text style={[styles.cell, styles.scoreCell, styles.valueText]}>{d.score ?? '—'}</Text>
              <Text style={[styles.cell, styles.confCell, styles.valueText, { color: d.confidence ? confColor : C.textHint, fontWeight: '700' }]}>
                {d.confidence ? CONFIDENCE_LABEL[d.confidence] : '—'}
              </Text>
              <Text style={[styles.cell, styles.evCell, styles.valueText]}>{d.evidenceCount ?? 0}</Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.footnote}>
        No evidence is shown as —, never 0. Confidence: High needs 4+ sources from 3+ types; Medium needs 2+ sources from 2+ types; otherwise Low.
      </Text>
    </View>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    table: {
      borderWidth: 1, borderColor: C.surfaceBorder, borderRadius: radius.md, overflow: 'hidden',
    },
    row: {
      flexDirection: 'row', alignItems: 'center',
      borderBottomWidth: 1, borderBottomColor: C.surfaceBorder,
    },
    lastRow: { borderBottomWidth: 0 },
    headerRow: { backgroundColor: C.surfaceElevated },
    cell: { paddingVertical: 10, paddingHorizontal: 8 },
    dimCell: { flex: 1.3 },
    scoreCell: { flex: 0.8 },
    confCell: { flex: 1 },
    evCell: { flex: 0.8 },
    headerText: { ...typography.caption, color: C.textHint, fontWeight: '700', textTransform: 'uppercase', fontSize: 10 },
    dimText: { ...typography.bodySmall, fontWeight: '700', color: C.textPrimary },
    valueText: { ...typography.bodySmall, color: C.textPrimary, fontWeight: '600' },
    footnote: { ...typography.caption, color: C.textHint, marginTop: 10 },
  });
}
