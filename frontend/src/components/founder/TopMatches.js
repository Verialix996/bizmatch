import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { typography, radius } from '../../theme';
import { getTopPairs } from '../../services/matches.service';
import { Avatar } from '../ui';

function matchLabel(score) {
  if (score >= 80) return 'Strong match';
  if (score >= 60) return 'Good match';
  if (score >= 40) return 'Fair match';
  return 'Weak match';
}

function scoreColor(score, C) {
  if (score >= 80) return C.success;
  if (score >= 40) return C.warning;
  return C.error;
}

// "Top potential matches" — matches the profile page mockup: avatar + name/
// role/location on the left, big score % + match label on the right, an
// evidence-based checklist below, and an "Open match analysis" button.
// Reuses the cohort-wide ranked-pairs endpoint scoped to this founder, same
// data source as the Matching screen.
export default function TopMatches({ founderId, navigation, limit = 2, C }) {
  const styles = makeStyles(C);
  const [pairs, setPairs] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getTopPairs(limit, founderId)
      .then(({ data }) => { if (!cancelled) setPairs(data); })
      .catch(() => { if (!cancelled) setPairs([]); });
    return () => { cancelled = true; };
  }, [founderId, limit]);

  if (pairs === null) return <Text style={styles.emptyText}>Loading…</Text>;
  if (pairs.length === 0) return <Text style={styles.emptyText}>No matches computed yet.</Text>;

  return (
    <View style={styles.wrap}>
      {pairs.map((pair) => {
        const other = pair.a.id === founderId ? pair.b : pair.a;
        const positives = pair.explanation?.positives || [];
        const risks = pair.explanation?.risks || [];
        return (
          <View key={other.id} style={styles.card}>
            <View style={styles.topRow}>
              <Avatar photoUrl={other.photoUrl} name={other.name} size={48} C={C} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.name} numberOfLines={1}>{other.name || 'Unnamed'}</Text>
                {other.roleTitle ? <Text style={styles.role} numberOfLines={1}>{other.roleTitle}</Text> : null}
                {other.location ? (
                  <View style={styles.locationRow}>
                    <Ionicons name="location-outline" size={12} color={C.textHint} />
                    <Text style={styles.location} numberOfLines={1}>{other.location}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.scoreCol}>
                <Text style={[styles.score, { color: scoreColor(pair.score, C) }]}>{pair.score}%</Text>
                <Text style={[styles.scoreLabel, { color: scoreColor(pair.score, C) }]} numberOfLines={1}>
                  {matchLabel(pair.score)}
                </Text>
                {pair.isProvisional ? <Text style={styles.provisionalLabel}>Provisional</Text> : null}
              </View>
            </View>

            {(positives.length || risks.length) ? (
              <View style={styles.checklist}>
                {positives.map((p, i) => (
                  <View key={`p${i}`} style={styles.checklistItem}>
                    <Ionicons name="checkmark-circle" size={14} color={C.success} />
                    <Text style={styles.checklistText} numberOfLines={1}>{p}</Text>
                  </View>
                ))}
                {risks.map((r, i) => (
                  <View key={`r${i}`} style={styles.checklistItem}>
                    <Ionicons name="warning" size={14} color={C.warning} />
                    <Text style={styles.checklistText} numberOfLines={1}>{r}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <TouchableOpacity
              style={styles.analysisBtn}
              activeOpacity={0.75}
              onPress={() => navigation.navigate('MatchDetail', { a: founderId, b: other.id })}
            >
              <Text style={styles.analysisBtnText}>Open match analysis</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    emptyText: { ...typography.bodySmall, color: C.textHint },
    wrap: { gap: 12 },
    card: {
      backgroundColor: C.surfaceElevated, borderRadius: radius.lg, padding: 14,
      borderWidth: 1, borderColor: C.surfaceBorder, gap: 10,
    },
    topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    name: { ...typography.labelLarge, color: C.textPrimary },
    role: { ...typography.caption, color: C.textSecondary },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
    location: { ...typography.caption, color: C.textHint },
    scoreCol: { alignItems: 'flex-end', maxWidth: 110 },
    score: { fontSize: 20, fontWeight: '800' },
    scoreLabel: { ...typography.caption, fontWeight: '600' },
    provisionalLabel: { ...typography.caption, color: C.textHint, fontSize: 10 },
    checklist: { gap: 4 },
    checklistItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    checklistText: { ...typography.caption, color: C.textSecondary, flexShrink: 1 },
    analysisBtn: {
      borderWidth: 1, borderColor: C.primary, borderRadius: radius.md,
      paddingVertical: 8, alignItems: 'center',
    },
    analysisBtnText: { ...typography.labelSmall, color: C.primary, fontWeight: '700' },
  });
}
