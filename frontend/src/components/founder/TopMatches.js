import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { typography, radius } from '../../theme';
import { getTopPairs } from '../../services/matches.service';
import { Avatar, Pill } from '../ui';

// "Top potential matches" — reuses the cohort-wide ranked-pairs endpoint
// scoped to this founder, same data source as the Matching screen, so the
// explanation text here is never invented separately.
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
    <View>
      {pairs.map((pair) => {
        const other = pair.a.id === founderId ? pair.b : pair.a;
        return (
          <View key={other.id} style={styles.card}>
            <View style={styles.topRow}>
              <Avatar photoUrl={other.photoUrl} name={other.name} size={40} C={C} />
              <Text style={styles.name} numberOfLines={1}>{other.name || 'Unnamed'}</Text>
              <Pill
                label={`${pair.score}%`}
                C={C}
                bg={pair.score >= 70 ? C.successLight : C.warningLight}
                color={pair.score >= 70 ? C.success : C.warning}
              />
            </View>
            {pair.explanation?.positives?.[0] ? (
              <View style={styles.line}>
                <Ionicons name="checkmark-circle" size={13} color={C.success} />
                <Text style={styles.lineText} numberOfLines={1}>{pair.explanation.positives[0]}</Text>
              </View>
            ) : null}
            {pair.explanation?.risks?.[0] ? (
              <View style={styles.line}>
                <Ionicons name="warning" size={13} color={C.warning} />
                <Text style={styles.lineText} numberOfLines={1}>{pair.explanation.risks[0]}</Text>
              </View>
            ) : null}
            <TouchableOpacity
              style={styles.btn}
              onPress={() => navigation.navigate('MatchDetail', { a: founderId, b: other.id })}
              activeOpacity={0.85}
            >
              <Text style={styles.btnText}>Open match analysis</Text>
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
    card: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.surfaceBorder, gap: 6 },
    topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    name: { ...typography.bodyMedium, fontWeight: '700', color: C.textPrimary, flex: 1 },
    line: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    lineText: { ...typography.caption, color: C.textSecondary, flex: 1 },
    btn: { backgroundColor: C.surfaceElevated, borderRadius: radius.pill, paddingVertical: 8, alignItems: 'center', marginTop: 4 },
    btnText: { ...typography.labelLarge, color: C.primary },
  });
}
