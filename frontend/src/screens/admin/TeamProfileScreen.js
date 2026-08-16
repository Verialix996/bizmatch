import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { showAlert } from '../../services/alert';
import useAuthStore from '../../store/authStore';
import useAppStore from '../../store/appStore';
import { colors, investorColors, radius, cardShadow, typography } from '../../theme';
import { getTeam, recomputeTeam } from '../../services/teams.service';
import { listActivities, ACTIVITY_TYPE_LABELS } from '../../services/activities.service';
import { DIMENSION_LABELS } from '../../services/founders.service';
import AppShell from '../../components/AppShell';
import { ADMIN_NAV_ITEMS, FOUNDER_NAV_ITEMS } from '../../config/nav';
import { Avatar, Pill, SectionCard, ResponsiveRow } from '../../components/ui';

// MVP screen 10 — Team Profile: name, members (name/role/core skills), Team
// Strengths, Complementary Skills, Potential Gaps, Compatibility, Potential
// Friction, Team Activities.
export default function TeamProfileScreen({ route, navigation }) {
  const teamId = route.params?.teamId;
  const isAdmin = useAuthStore(s => s.user?.role === 'admin');
  const darkMode = useAppStore(s => s.darkMode);
  const C = darkMode ? investorColors : colors;
  const styles = makeStyles(C);
  const navItems = isAdmin ? ADMIN_NAV_ITEMS : FOUNDER_NAV_ITEMS;
  const activeNav = isAdmin ? 'teams' : undefined;

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
      <AppShell navigation={navigation} active={activeNav} items={navItems}>
        <View style={styles.centered}><ActivityIndicator size="large" color={C.primary} /></View>
      </AppShell>
    );
  }

  const profile = team?.profile;

  return (
    <AppShell navigation={navigation} active={activeNav} items={navItems}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backRow}>
          <Text style={styles.backText}>← Teams</Text>
        </TouchableOpacity>

        <View style={styles.titleRow}>
          <View style={styles.avatarCluster}>
            {(team?.members || []).slice(0, 3).map((m, i) => (
              <View key={m.id} style={[styles.avatarStack, i > 0 && { marginLeft: -12 }]}>
                <Avatar photoUrl={m.photoUrl} name={m.name} size={48} C={C} />
              </View>
            ))}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.teamName}>{team?.name}</Text>
            <Text style={styles.teamMeta}>{(team?.members || []).length} member{(team?.members || []).length === 1 ? '' : 's'}</Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={handleRecompute} disabled={recomputing} activeOpacity={0.85}>
            {recomputing ? <ActivityIndicator color={C.primary} size="small" /> : <Text style={styles.refreshText}>Recompute</Text>}
          </TouchableOpacity>
        </View>

        <ResponsiveRow gap={16} style={{ marginTop: 16 }}>
          <View style={{ flex: 1 }}>
            <SectionCard title="Members" icon="people-outline" C={C} style={{ flex: 1 }}>
              {(team?.members || []).map(m => (
                <TouchableOpacity
                  key={m.id}
                  style={styles.memberRow}
                  onPress={() => navigation.navigate('FounderProfile', { founderId: m.id })}
                  activeOpacity={0.75}
                >
                  <Avatar photoUrl={m.photoUrl} name={m.name} size={36} C={C} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>{m.name || 'Unnamed'}</Text>
                    <Text style={styles.memberRole}>{m.roleTitle || ''}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={C.textHint} />
                </TouchableOpacity>
              ))}
            </SectionCard>
          </View>

          <View style={{ flex: 1 }}>
            <SectionCard title="Compatibility" icon="heart-outline" iconColor={C.success} iconBg={C.successLight} C={C} style={{ flex: 1 }}>
              <View style={styles.scoreBlock}>
                <Text style={styles.scoreValue}>{profile?.compatibility ?? '—'}%</Text>
              </View>
            </SectionCard>
          </View>
        </ResponsiveRow>

        <ResponsiveRow gap={16} style={{ marginTop: 16 }}>
          {profile?.strengths?.length > 0 && (
            <View style={{ flex: 1 }}>
              <SectionCard title="Team Strengths" icon="star-outline" iconColor={C.success} iconBg={C.successLight} C={C} style={{ flex: 1 }}>
                {profile.strengths.map(d => (
                  <View key={d} style={styles.checkLine}>
                    <Ionicons name="checkmark-circle" size={16} color={C.success} />
                    <Text style={styles.checkLineText}>{DIMENSION_LABELS[d] || d}</Text>
                  </View>
                ))}
              </SectionCard>
            </View>
          )}

          {profile?.complementarySkills?.length > 0 && (
            <View style={{ flex: 1 }}>
              <SectionCard title="Complementary Skills" icon="extension-puzzle-outline" C={C} style={{ flex: 1 }}>
                <View style={styles.chipWrap}>
                  {profile.complementarySkills.map(s => (
                    <Pill key={s} label={s} C={C} bg={C.surfaceElevated} color={C.primary} />
                  ))}
                </View>
              </SectionCard>
            </View>
          )}
        </ResponsiveRow>

        <ResponsiveRow gap={16} style={{ marginTop: 16 }}>
          {(profile?.potentialGaps?.length > 0 || profile?.capabilityGaps?.length > 0) && (
            <View style={{ flex: 1 }}>
              <SectionCard title="Potential Gaps" icon="alert-circle-outline" iconColor={C.warning} iconBg={C.warningLight} C={C} style={{ flex: 1 }}>
                {profile.potentialGaps.map(d => (
                  <Text key={d} style={[styles.bullet, { color: C.warning }]}>• Weak {DIMENSION_LABELS[d] || d}</Text>
                ))}
                {profile.capabilityGaps.length > 0 && (
                  <Text style={[styles.bodyText, { color: C.warning, marginTop: 6 }]}>
                    No one provides: {profile.capabilityGaps.join(', ')}
                  </Text>
                )}
              </SectionCard>
            </View>
          )}

          {profile?.potentialFriction?.length > 0 && (
            <View style={{ flex: 1 }}>
              <SectionCard title="Potential Friction" icon="flash-outline" iconColor={C.error} iconBg={C.errorLight} C={C} style={{ flex: 1 }}>
                {profile.potentialFriction.map((f, i) => <Text key={i} style={[styles.bullet, { color: C.error }]}>• {f}</Text>)}
              </SectionCard>
            </View>
          )}
        </ResponsiveRow>

        <View style={{ marginTop: 16 }}>
          <SectionCard title="Team Activities" icon="calendar-outline" C={C}>
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
          </SectionCard>
        </View>
      </ScrollView>
    </AppShell>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { padding: 20, paddingBottom: 48, maxWidth: 1100, width: '100%', alignSelf: 'center' },
    backRow: { marginBottom: 12 },
    backText: { color: C.primary, ...typography.labelLarge },

    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    avatarCluster: { flexDirection: 'row' },
    avatarStack: { borderWidth: 3, borderColor: C.backgroundSoft, borderRadius: 24 },
    teamName: { ...typography.displayMedium, color: C.textPrimary },
    teamMeta: { ...typography.bodyMedium, color: C.textSecondary, marginTop: 2 },
    refreshBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 1.5, borderColor: C.surfaceBorder },
    refreshText: { color: C.primary, fontWeight: '700', fontSize: 13 },

    memberRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.surfaceBorder,
    },
    memberName: { ...typography.bodyMedium, color: C.textPrimary },
    memberRole: { ...typography.bodySmall, color: C.textHint },

    scoreBlock: { alignItems: 'center', paddingVertical: 8 },
    scoreValue: { fontSize: 40, fontWeight: '800', color: C.success },

    checkLine: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
    checkLineText: { ...typography.bodyMedium, color: C.textPrimary },

    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

    bullet: { ...typography.bodyMedium, marginBottom: 6, lineHeight: 20 },
    bodyText: { ...typography.bodyMedium, color: C.textPrimary },
    emptyText: { ...typography.bodyMedium, color: C.textHint },
    activityRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.surfaceBorder,
    },
  });
}
