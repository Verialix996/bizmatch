import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, SafeAreaView, StatusBar, ActivityIndicator,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { showAlert } from '../../services/alert';
import useAppStore from '../../store/appStore';
import { colors, investorColors, radius, cardShadow, typography } from '../../theme';
import { getTeam, recomputeTeam } from '../../services/teams.service';
import { listActivities, ACTIVITY_TYPE_LABELS } from '../../services/activities.service';
import { DIMENSION_LABELS } from '../../services/founders.service';

// MVP screen 10 — Team Profile: name, members (name/role/core skills), Team
// Strengths, Complementary Skills, Potential Gaps, Compatibility, Potential
// Friction, Team Activities.
export default function TeamProfileScreen({ route, navigation }) {
  const teamId = route.params?.teamId;
  const darkMode = useAppStore(s => s.darkMode);
  const C = darkMode ? investorColors : colors;
  const styles = makeStyles(C);

  const [team, setTeam] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [teamRes, activitiesRes] = await Promise.all([
        getTeam(teamId),
        listActivities(undefined, teamId),
      ]);
      setTeam(teamRes.data);
      setActivities(activitiesRes.data);
    } catch {
      showAlert('Error', 'Could not load this team.');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleRecompute = async () => {
    setRecomputing(true);
    try {
      await recomputeTeam(teamId);
      await load();
    } catch {
      showAlert('Error', 'Could not recompute this team.');
    } finally {
      setRecomputing(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}><ActivityIndicator size="large" color={C.primary} /></View>
      </SafeAreaView>
    );
  }

  const profile = team?.profile;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{team?.name}</Text>
        <TouchableOpacity onPress={handleRecompute} disabled={recomputing}>
          <Text style={styles.backText}>{recomputing ? '…' : 'Refresh'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Members</Text>
          {(team?.members || []).map(m => (
            <View key={m.id} style={styles.memberRow}>
              <Text style={styles.memberName}>{m.name || 'Unnamed'}</Text>
              <Text style={styles.memberRole}>{m.roleTitle || ''}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.scoreValue}>{profile?.compatibility ?? '—'}</Text>
          <Text style={styles.scoreLabel}>Team Compatibility</Text>
        </View>

        {profile?.strengths?.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Team Strengths</Text>
            {profile.strengths.map(d => <Text key={d} style={styles.bullet}>• {DIMENSION_LABELS[d] || d}</Text>)}
          </View>
        )}

        {profile?.complementarySkills?.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Complementary Skills</Text>
            <Text style={styles.bodyText}>{profile.complementarySkills.join(', ')}</Text>
          </View>
        )}

        {(profile?.potentialGaps?.length > 0 || profile?.capabilityGaps?.length > 0) && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Potential Gaps</Text>
            {profile.potentialGaps.map(d => (
              <Text key={d} style={[styles.bullet, { color: C.warning }]}>• Weak {DIMENSION_LABELS[d] || d}</Text>
            ))}
            {profile.capabilityGaps.length > 0 && (
              <Text style={[styles.bodyText, { color: C.warning, marginTop: 6 }]}>
                No one provides: {profile.capabilityGaps.join(', ')}
              </Text>
            )}
          </View>
        )}

        {profile?.potentialFriction?.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Potential Friction</Text>
            {profile.potentialFriction.map((f, i) => <Text key={i} style={[styles.bullet, { color: C.error }]}>• {f}</Text>)}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Team Activities</Text>
          {activities.length === 0 ? (
            <Text style={styles.emptyText}>No activities logged for this team yet.</Text>
          ) : (
            activities.map(a => (
              <TouchableOpacity key={a.id} style={styles.activityRow} onPress={() => navigation.navigate('ActivityDetail', { activityId: a.id })} activeOpacity={0.75}>
                <Text style={styles.memberName}>{a.title}</Text>
                <Text style={styles.memberRole}>{ACTIVITY_TYPE_LABELS[a.type] || a.type}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.backgroundSoft },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingVertical: 14, backgroundColor: C.surface,
      borderBottomWidth: 1, borderBottomColor: C.surfaceBorder,
    },
    backText: { color: C.primary, ...typography.labelLarge },
    headerTitle: { ...typography.titleMedium, color: C.textPrimary, flex: 1, textAlign: 'center', marginHorizontal: 8 },
    scrollContent: { padding: 20, paddingBottom: 48 },
    card: { backgroundColor: C.surface, borderRadius: radius.lg, padding: 16, marginBottom: 14, ...cardShadow },
    sectionLabel: { ...typography.labelSmall, textTransform: 'uppercase', color: C.textHint, marginBottom: 10 },
    memberRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.surfaceBorder,
    },
    memberName: { ...typography.bodyMedium, color: C.textPrimary },
    memberRole: { ...typography.bodySmall, color: C.textHint },
    scoreValue: { fontSize: 36, fontWeight: '800', color: C.primary, textAlign: 'center' },
    scoreLabel: { ...typography.bodySmall, color: C.textHint, textAlign: 'center', marginTop: 2 },
    bullet: { ...typography.bodyMedium, color: C.textPrimary, marginBottom: 6, lineHeight: 20 },
    bodyText: { ...typography.bodyMedium, color: C.textPrimary },
    emptyText: { ...typography.bodyMedium, color: C.textHint },
    activityRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.surfaceBorder,
    },
  });
}
