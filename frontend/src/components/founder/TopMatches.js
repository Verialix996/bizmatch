import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { typography, radius } from '../../theme';
import { getTopPairs } from '../../services/matches.service';
import { Avatar } from '../ui';

// "Top potential matches" — photo-forward cards (avatar, name, role,
// location, match score + progress bar, top skill tags) matching the
// profile page mockup. Reuses the cohort-wide ranked-pairs endpoint scoped
// to this founder, same data source as the Matching screen.
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
      {pairs.map((pair, i) => {
        const other = pair.a.id === founderId ? pair.b : pair.a;
        const tags = [...(pair.explanation?.positives || []), ...(pair.explanation?.risks || [])].slice(0, 3);
        return (
          <TouchableOpacity
            key={other.id}
            style={styles.card}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('MatchDetail', { a: founderId, b: other.id })}
          >
            {i === 0 ? (
              <View style={styles.bestBadge}>
                <Ionicons name="star" size={11} color="#fff" />
                <Text style={styles.bestBadgeText}>Best Match</Text>
              </View>
            ) : null}

            <Avatar photoUrl={other.photoUrl} name={other.name} size={40} C={C} />
            <Text style={styles.name} numberOfLines={1}>{other.name || 'Unnamed'}</Text>
            {other.roleTitle ? <Text style={styles.role} numberOfLines={1}>{other.roleTitle}</Text> : null}
            {other.location ? (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={12} color={C.textHint} />
                <Text style={styles.location} numberOfLines={1}>{other.location}</Text>
              </View>
            ) : null}

            <Text style={styles.score}>{pair.score}%</Text>
            <Text style={styles.scoreLabel}>Match Score{pair.isProvisional ? ' · Provisional' : ''}</Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.max(0, Math.min(100, pair.score))}%` }]} />
            </View>

            {tags.length ? (
              <View style={styles.tagRow}>
                {tags.map((t, ti) => (
                  <View key={ti} style={styles.tag}>
                    <Text style={styles.tagText} numberOfLines={1}>{t}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    emptyText: { ...typography.bodySmall, color: C.textHint },
    wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    card: {
      flex: 1, minWidth: 92, alignItems: 'center', textAlign: 'center',
      backgroundColor: C.surfaceElevated, borderRadius: radius.md, padding: 10,
      borderWidth: 1, borderColor: C.surfaceBorder, gap: 2,
    },
    bestBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 3,
      backgroundColor: C.primary, borderRadius: radius.pill,
      paddingHorizontal: 6, paddingVertical: 2, marginBottom: 4,
    },
    bestBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
    name: { ...typography.labelSmall, fontWeight: '700', color: C.textPrimary, marginTop: 6, textAlign: 'center' },
    role: { ...typography.caption, fontSize: 10, color: C.textSecondary, textAlign: 'center' },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 },
    location: { ...typography.caption, fontSize: 10, color: C.textHint },
    score: { fontSize: 17, fontWeight: '800', color: C.primary, marginTop: 4 },
    scoreLabel: { ...typography.caption, fontSize: 9, color: C.textHint, marginBottom: 4 },
    track: { height: 3, borderRadius: 2, backgroundColor: C.surfaceBorder, alignSelf: 'stretch', overflow: 'hidden', marginBottom: 6 },
    fill: { height: 3, borderRadius: 2, backgroundColor: C.primary },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, justifyContent: 'center' },
    tag: { backgroundColor: C.surface, borderRadius: radius.pill, paddingHorizontal: 5, paddingVertical: 2 },
    tagText: { fontSize: 9, fontWeight: '600', color: C.textSecondary, maxWidth: 70 },
  });
}
