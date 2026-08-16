import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { typography } from '../../theme';
import { DIMENSION_LABELS } from '../../services/founders.service';

const PREVIEW_LIMIT = 4;

// Short, human-readable phrase per dimension for the strong-signal case —
// there's no free-text bullet field in the API, so this is a fixed phrase
// bank keyed by dimension rather than a synthesized narrative.
const POSITIVE_PHRASES = {
  execution: { title: 'Strong ownership', sub: 'Takes full responsibility and drives outcomes.' },
  integrity: { title: 'High integrity', sub: 'Consistently honest and transparent.' },
  commitment: { title: 'Reliable follow-through', sub: 'Consistently meets commitments.' },
  communication: { title: 'Direct communication', sub: 'Clear, honest, and constructive in feedback.' },
  conflict: { title: 'Handles conflict well', sub: 'Engages disagreements constructively.' },
  resilience: { title: 'High resilience', sub: 'Recovers well from setbacks and pressure.' },
  ego: { title: 'High initiative', sub: 'Proactively identifies problems and acts.' },
  values: { title: 'Values-aligned', sub: 'Clear and consistent personal principles.' },
};

function lowConfidencePhrase(dim) {
  const label = DIMENSION_LABELS[dim] || dim;
  return { title: `Limited ${label.toLowerCase()} data`, sub: 'More evidence under pressure recommended.' };
}

export default function BehavioralSignals({ insights, C }) {
  const styles = makeStyles(C);
  const [expanded, setExpanded] = useState(false);

  const dims = Object.entries(insights?.dimensions || {})
    .filter(([, d]) => d.score != null)
    .map(([dim, d]) => ({ dim, ...d }))
    .map((d) => {
      const lowConfidence = d.confidence === 'low' || d.evidenceCount < 2;
      const positive = d.score >= 60 && !lowConfidence;
      return { ...d, positive, lowConfidence, phrase: positive ? POSITIVE_PHRASES[d.dim] : lowConfidencePhrase(d.dim) };
    })
    .sort((a, b) => (b.positive - a.positive) || (b.score - a.score));

  if (dims.length === 0) {
    return <Text style={styles.emptyText}>No evidence recorded yet.</Text>;
  }

  const visible = expanded ? dims : dims.slice(0, PREVIEW_LIMIT);

  return (
    <View>
      {visible.map((d) => (
        <View key={d.dim} style={styles.row}>
          <Ionicons
            name={d.positive ? 'checkmark-circle' : 'alert-circle'}
            size={16}
            color={d.positive ? C.success : C.warning}
            style={styles.icon}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{d.phrase.title}</Text>
            <Text style={styles.sub}>{d.phrase.sub}</Text>
          </View>
        </View>
      ))}
      {dims.length > PREVIEW_LIMIT ? (
        <TouchableOpacity onPress={() => setExpanded((v) => !v)} activeOpacity={0.75} style={styles.linkRow}>
          <Text style={styles.linkText}>{expanded ? 'Show less' : 'View full behavioral report'}</Text>
          <Ionicons name={expanded ? 'chevron-up' : 'arrow-forward'} size={13} color={C.primary} />
        </TouchableOpacity>
      ) : null}
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
    linkRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
    linkText: { ...typography.bodySmall, color: C.primary, fontWeight: '700' },
  });
}
