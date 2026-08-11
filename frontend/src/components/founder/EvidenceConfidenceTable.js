import { View, Text, StyleSheet } from 'react-native';
import { typography } from '../../theme';
import { DIMENSIONS, DIMENSION_LABELS } from '../../services/founders.service';

const CONFIDENCE_LABEL = { high: 'High', medium: 'Medium', low: 'Low' };

// Dimension / Score / Confidence / Evidence count list — direct read of
// dimensions.*.{score,confidence,evidenceCount} from the founder-dna
// endpoint. Missing dimensions render "—", never a fabricated 0. Single-line
// rows (rather than a strict 4-column table) so this stays legible even in
// a narrow card column.
export default function EvidenceConfidenceTable({ insights, C }) {
  const styles = makeStyles(C);
  const dims = insights?.dimensions || {};

  return (
    <View>
      {DIMENSIONS.map((dim) => {
        const d = dims[dim] || {};
        const confColor = d.confidence === 'high' ? C.success : d.confidence === 'medium' ? C.warning : C.error;
        return (
          <View key={dim} style={styles.row}>
            <Text style={styles.label}>{DIMENSION_LABELS[dim] || dim}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>Score <Text style={styles.metaValue}>{d.score ?? '—'}</Text></Text>
              <Text style={[styles.metaText, { color: d.confidence ? confColor : C.textHint, fontWeight: '700' }]}>
                {d.confidence ? CONFIDENCE_LABEL[d.confidence] : '—'}
              </Text>
              <Text style={styles.metaText}>{d.evidenceCount ?? 0} evidence</Text>
            </View>
          </View>
        );
      })}
      <Text style={styles.footnote}>No evidence is shown as —, never 0.</Text>
    </View>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    row: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.surfaceBorder },
    label: { ...typography.bodySmall, fontWeight: '700', color: C.textPrimary },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 3 },
    metaText: { ...typography.caption, color: C.textSecondary },
    metaValue: { color: C.textPrimary, fontWeight: '700' },
    footnote: { ...typography.caption, color: C.textHint, marginTop: 10 },
  });
}
