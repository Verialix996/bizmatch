import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { radius, cardShadow, typography } from '../../theme';

// MVP screen 8 — Suggested Matches list row. Score + a one-line "why" isn't
// available at this granularity (only the full explanation is), so the list
// row shows score + a review flag; the full positives/risks breakdown lives
// on MatchDetailScreen.
export default function MatchCard({ match, C, onPress }) {
  const styles = makeStyles(C);
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.75}>
      {match.photoUrl ? (
        <Image source={{ uri: match.photoUrl }} style={styles.avatarImg} />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarInitial}>{match.name ? match.name[0].toUpperCase() : '?'}</Text>
        </View>
      )}
      <View style={styles.body}>
        <Text style={styles.name}>{match.name || 'Unnamed'}</Text>
        {match.requiresAdminReview ? (
          <Text style={styles.reviewFlag}>⚠ Deal breaker stated — needs review</Text>
        ) : null}
      </View>
      <View style={styles.scoreWrap}>
        <Text style={styles.scoreValue}>{match.score}</Text>
        <Text style={styles.scoreLabel}>match</Text>
      </View>
    </TouchableOpacity>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: C.surface, borderRadius: radius.lg, padding: 14, marginBottom: 10, ...cardShadow,
    },
    avatarImg: { width: 44, height: 44, borderRadius: 22 },
    avatarPlaceholder: {
      width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center',
      backgroundColor: C.primary,
    },
    avatarInitial: { color: '#fff', fontWeight: '800', fontSize: 16 },
    body: { flex: 1 },
    name: { ...typography.titleSmall, color: C.textPrimary },
    reviewFlag: { ...typography.caption, color: C.warning, marginTop: 3 },
    scoreWrap: { alignItems: 'center' },
    scoreValue: { fontSize: 20, fontWeight: '800', color: C.primary },
    scoreLabel: { ...typography.caption, color: C.textHint },
  });
}
