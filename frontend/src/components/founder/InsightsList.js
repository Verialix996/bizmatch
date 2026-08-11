import { View, Text, StyleSheet } from 'react-native';
import { radius, typography, cardShadow } from '../../theme';
import { DIMENSION_LABELS } from '../../services/founders.service';
import { IconCircle } from '../ui';

const CONFIDENCE_LABEL = { high: 'High', medium: 'Medium', low: 'Low' };

// MVP screen 7 — Founder Insights: what the system learned from evidence,
// rendered as bulleted strengths/weaknesses/friction points. Deliberately no
// single "Founder Score" and no DNA radar for the MVP — see the reconciled
// screen inventory (research doc's confidence chart stays internal/optional).
export default function InsightsList({ insights, C }) {
  if (!insights) return null;

  const dims = Object.entries(insights.dimensions || {})
    .filter(([, d]) => d.score != null)
    .map(([dim, d]) => ({ dim, ...d }));

  const strengths = dims.filter(d => d.score >= 70).sort((a, b) => b.score - a.score);
  const weaknesses = dims.filter(d => d.score < 50).sort((a, b) => a.score - b.score);
  const middle = dims.filter(d => d.score >= 50 && d.score < 70);

  const hasAnyEvidence = dims.length > 0;

  return (
    <View>
      <View style={styles.confidenceRow}>
        <Text style={[styles.confidenceLabel, { color: C.textHint }]}>PROFILE CONFIDENCE</Text>
        <Text style={[styles.confidenceValue, { color: C.primary }]}>{insights.profileConfidence}%</Text>
      </View>

      {!hasAnyEvidence ? (
        <EmptyState emptyState={insights.emptyState} C={C} />
      ) : (
        <>
    {strengths.length > 0 && (
            <Section title="Strengths" icon="checkmark-circle" color={C.success} bg={C.successLight} C={C}>
              {strengths.map(d => <DimRow key={d.dim} d={d} C={C} />)}
            </Section>
          )}
          {middle.length > 0 && (
            <Section title="Work Style" icon="person" color={C.primary} bg={C.surfaceElevated} C={C}>
              {middle.map(d => <DimRow key={d.dim} d={d} C={C} />)}
            </Section>
          )}
          {weaknesses.length > 0 && (
            <Section title="Potential Weaknesses" icon="alert-circle" color={C.warning} bg={C.warningLight} C={C}>
              {weaknesses.map(d => <DimRow key={d.dim} d={d} C={C} />)}
            </Section>
          )}
        </>
      )}

      {insights.contradictions?.length > 0 && (
        <Section title="Potential Friction Points" icon="warning" color={C.error} bg={C.errorLight} C={C}>
          {insights.contradictions.map((c) => (
            <Text key={c.dimension} style={[styles.bulletText, { color: C.textSecondary }]}>
              {DIMENSION_LABELS[c.dimension] || c.dimension}: self-report ({c.selfScore}) vs. others ({c.otherScore}) diverge significantly.
            </Text>
          ))}
        </Section>
      )}
    </View>
  );
}

function DimRow({ d, C }) {
  return (
    <View style={styles.dimRow}>
      <Text style={[styles.dimLabel, { color: C.textPrimary }]}>{DIMENSION_LABELS[d.dim] || d.dim}</Text>
      <View style={styles.dimRight}>
        <Text style={[styles.dimScore, { color: C.textSecondary }]}>{d.score}</Text>
        <View style={[styles.confBadge, { backgroundColor: C.surfaceElevated }]}>
          <Text style={[styles.confBadgeText, { color: C.textHint }]}>{CONFIDENCE_LABEL[d.confidence]}</Text>
        </View>
      </View>
    </View>
  );
}

function Section({ title, icon, color, bg, C, children }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <IconCircle name={icon} color={color} bg={bg} size={30} iconSize={16} />
        <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

// Spec section 30 — never fabricate a score when there's no evidence; show
// what's present and what's still needed instead.
function EmptyState({ emptyState, C }) {
  return (
    <View style={[styles.emptyCard, { backgroundColor: C.surfaceElevated }]}>
      <Text style={[styles.emptyTitle, { color: C.textPrimary }]}>Not enough evidence yet</Text>
      {emptyState?.present?.length > 0 && (
        <>
          <Text style={[styles.emptyLabel, { color: C.textHint }]}>Profile currently contains:</Text>
          {emptyState.present.map(item => (
            <Text key={item} style={[styles.emptyItem, { color: C.success }]}>✓ {item}</Text>
          ))}
        </>
      )}
      {emptyState?.stillNeeded?.length > 0 && (
        <>
          <Text style={[styles.emptyLabel, { color: C.textHint, marginTop: 10 }]}>Still needed:</Text>
          {emptyState.stillNeeded.map(item => (
            <Text key={item} style={[styles.emptyItem, { color: C.textSecondary }]}>○ {item}</Text>
          ))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  confidenceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  confidenceLabel: { ...typography.labelSmall },
  confidenceValue: { fontSize: 28, fontWeight: '800' },

  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  sectionTitle: { ...typography.titleSmall },
  dimRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  dimLabel: { ...typography.bodyMedium, fontWeight: '600' },
  dimRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dimScore: { ...typography.bodyMedium, fontWeight: '700' },
  confBadge: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  confBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  bulletText: { ...typography.bodySmall, marginBottom: 6, lineHeight: 18 },

  emptyCard: { borderRadius: radius.lg, padding: 16 },
  emptyTitle: { ...typography.titleSmall, marginBottom: 10 },
  emptyLabel: { ...typography.caption, textTransform: 'uppercase', fontWeight: '700' },
  emptyItem: { ...typography.bodySmall, marginTop: 4 },
});
