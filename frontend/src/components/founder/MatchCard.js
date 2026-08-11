import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, cardShadow, typography } from '../../theme';
import { Avatar, Pill } from '../ui';

// Suggested Matches pair card — two founders linked by a match score, with
// "why they match" / "potential friction" pulled straight from the
// cohort-wide ranked pairs endpoint (no extra per-row fetch needed).
export default function MatchCard({ pair, onCreateTeam, onCompare, onViewMatch, C }) {
  const styles = makeStyles(C);
  const positives = pair.explanation?.positives || [];
  const risks = pair.explanation?.risks || [];

  return (
    <View style={styles.card}>
      <View style={styles.pairRow}>
        <View style={styles.person}>
          <Avatar photoUrl={pair.a?.photoUrl} name={pair.a?.name} size={44} C={C} />
          <View>
            <Text style={styles.name}>{pair.a?.name || 'Unnamed'}</Text>
            {pair.a?.roleTitle ? <Text style={styles.role}>{pair.a.roleTitle}</Text> : null}
          </View>
        </View>

        <Ionicons name="link" size={18} color={C.primary} style={styles.linkIcon} />

        <View style={[styles.person, { justifyContent: 'flex-end' }]}>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.name}>{pair.b?.name || 'Unnamed'}</Text>
            {pair.b?.roleTitle ? <Text style={styles.role}>{pair.b.roleTitle}</Text> : null}
          </View>
          <Avatar photoUrl={pair.b?.photoUrl} name={pair.b?.name} size={44} C={C} />
        </View>
      </View>

      <View style={styles.scoreRow}>
        <Pill label={`${pair.score}% Match`} C={C} bg={C.successLight} color={C.success} />
        {pair.requiresAdminReview ? (
          <Text style={styles.reviewFlag}>⚠ Needs review</Text>
        ) : null}
      </View>

      {(positives.length > 0 || risks.length > 0) && (
        <View style={styles.explainRow}>
          {positives.length > 0 && (
            <View style={styles.explainCol}>
              <Text style={styles.explainLabel}>Why they match</Text>
              <View style={styles.chipWrap}>
                {positives.slice(0, 3).map((p, i) => (
                  <View key={i} style={[styles.chip, { backgroundColor: C.successLight }]}>
                    <Ionicons name="checkmark-circle" size={12} color={C.success} />
                    <Text style={[styles.chipText, { color: C.success }]}>{p}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          {risks.length > 0 && (
            <View style={styles.explainCol}>
              <Text style={styles.explainLabel}>Potential friction</Text>
              <View style={styles.chipWrap}>
                {risks.slice(0, 2).map((r, i) => (
                  <View key={i} style={[styles.chip, { backgroundColor: C.warningLight }]}>
                    <Ionicons name="warning" size={12} color={C.warning} />
                    <Text style={[styles.chipText, { color: C.warning }]}>{r}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.btnPrimary} onPress={onCreateTeam} activeOpacity={0.85}>
          <Text style={styles.btnPrimaryText}>Create Team</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnSecondary} onPress={onCompare} activeOpacity={0.85}>
          <Text style={styles.btnSecondaryText}>Compare</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onViewMatch} activeOpacity={0.75} style={styles.viewMatchBtn}>
          <Text style={styles.viewMatchText}>View Match</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    card: {
      backgroundColor: C.surface, borderRadius: radius.lg, padding: 16, marginBottom: 14, ...cardShadow,
    },
    pairRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    person: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    linkIcon: { marginHorizontal: 4 },
    name: { ...typography.titleSmall, color: C.textPrimary },
    role: { ...typography.caption, color: C.textSecondary, marginTop: 1 },
    reviewFlag: { ...typography.caption, color: C.warning },

    scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 12 },

    explainRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 14 },
    explainCol: { flex: 1, minWidth: 160 },
    explainLabel: { ...typography.labelSmall, color: C.textHint, textTransform: 'uppercase', marginBottom: 8 },
    chipWrap: { gap: 6 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
    chipText: { fontSize: 11, fontWeight: '600' },

    actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
    btnPrimary: { backgroundColor: C.primary, borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: 18 },
    btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    btnSecondary: { backgroundColor: C.surface, borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: 18, borderWidth: 1.5, borderColor: C.surfaceBorder },
    btnSecondaryText: { color: C.textSecondary, fontWeight: '700', fontSize: 13 },
    viewMatchBtn: { marginLeft: 'auto' },
    viewMatchText: { color: C.primary, fontWeight: '700', fontSize: 13 },
  });
}
