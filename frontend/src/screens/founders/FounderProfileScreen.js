import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Linking,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { showAlert } from '../../services/alert';
import useAuthStore from '../../store/authStore';
import useAppStore from '../../store/appStore';
import { colors, investorColors, radius, typography } from '../../theme';
import { getFounder, getFounderInsights, listEvidence, setFounderStatus, DIMENSIONS, DIMENSION_LABELS } from '../../services/founders.service';
import { listActivities, ACTIVITY_TYPE_LABELS } from '../../services/activities.service';
import { getTopPairs } from '../../services/matches.service';
import { listFounderInterviews } from '../../services/interviews.service';
import FounderHeader from '../../components/founder/FounderHeader';
import CapabilityList from '../../components/founder/CapabilityList';
import PartnerRequirementsCard from '../../components/founder/PartnerRequirementsCard';
import EvidenceTimeline from '../../components/founder/EvidenceTimeline';
import BehavioralSignals from '../../components/founder/BehavioralSignals';
import EvidenceConfidenceTable from '../../components/founder/EvidenceConfidenceTable';
import TopMatches from '../../components/founder/TopMatches';
import RadarChart, { RadarLegend } from '../../components/founder/RadarChart';
import MatchCard from '../../components/founder/MatchCard';
import AppShell from '../../components/AppShell';
import { ADMIN_NAV_ITEMS, FOUNDER_NAV_ITEMS } from '../../config/nav';
import { ResponsiveRow, SectionCard, Pill, useIsDesktop } from '../../components/ui';

const STATUS_OPTIONS = ['active', 'inactive', 'dropped'];
const TABS = ['overview', 'dna', 'evidence', 'activities', 'matches'];
const TAB_LABELS = { overview: 'Overview', dna: 'DNA', evidence: 'Evidence', activities: 'Activities', matches: 'Matches' };

export default function FounderProfileScreen({ route, navigation }) {
  const currentUser = useAuthStore(s => s.user);
  const darkMode = useAppStore(s => s.darkMode);
  const C = darkMode ? investorColors : colors;
  const styles = makeStyles(C);
  const isDesktop = useIsDesktop();

  const founderId = route.params?.founderId || currentUser?.id;
  const isAdmin = currentUser?.role === 'admin';

  const [tab, setTab] = useState('overview');
  const [founder, setFounder] = useState(null);
  const [insights, setInsights] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [activities, setActivities] = useState([]);
  const [matchPairs, setMatchPairs] = useState(null);
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Individual evidence entries (who said what) are admin-only — a
      // founder only ever sees their own aggregate scores, fetched below.
      const [founderRes, insightsRes, evidenceRes, activitiesRes, interviewsRes] = await Promise.all([
        getFounder(founderId),
        getFounderInsights(founderId),
        isAdmin ? listEvidence(founderId) : Promise.resolve({ data: [] }),
        listActivities(undefined, undefined, founderId),
        isAdmin ? listFounderInterviews(founderId) : Promise.resolve({ data: [] }),
      ]);
      setFounder(founderRes.data);
      setInsights(insightsRes.data);
      setEvidence(evidenceRes.data);
      setActivities(activitiesRes.data);
      setInterviews(interviewsRes.data);
    } catch (err) {
      showAlert('Error', 'Could not load this founder profile.');
    } finally {
      setLoading(false);
    }
  }, [founderId, isAdmin]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useFocusEffect(useCallback(() => {
    if (tab !== 'matches' || !isAdmin) return;
    setMatchPairs(null);
    getTopPairs(15, founderId).then(({ data }) => setMatchPairs(data)).catch(() => setMatchPairs([]));
  }, [tab, isAdmin, founderId]));

  const handleChangeStatus = () => {
    showAlert(
      'Change Status',
      `Current status: ${founder?.status}`,
      STATUS_OPTIONS.filter(s => s !== founder?.status).map(s => ({
        text: s.charAt(0).toUpperCase() + s.slice(1),
        onPress: async () => {
          setStatusUpdating(true);
          try {
            await setFounderStatus(founderId, s);
            setFounder(prev => ({ ...prev, status: s }));
          } catch {
            showAlert('Error', 'Could not update status.');
          } finally {
            setStatusUpdating(false);
          }
        },
      })).concat([{ text: 'Cancel', style: 'cancel' }]),
    );
  };

  const navItems = isAdmin ? ADMIN_NAV_ITEMS : FOUNDER_NAV_ITEMS;
  const activeNav = isAdmin ? 'founders' : 'home';

  if (loading) {
    return (
      <AppShell navigation={navigation} active={activeNav} items={navItems}>
        <View style={styles.centered}><ActivityIndicator size="large" color={C.primary} /></View>
      </AppShell>
    );
  }

  const axes = DIMENSIONS.map(dim => ({
    key: dim,
    label: DIMENSION_LABELS[dim],
    score: insights?.dimensions?.[dim]?.score ?? null,
  }));

  // Aggregate count works for both roles even though only admins fetch the
  // raw evidence list — it's summed from the same per-dimension counts the
  // Evidence Confidence table already shows.
  const evidenceCount = Object.values(insights?.dimensions || {})
    .reduce((sum, d) => sum + (d?.evidenceCount || 0), 0);

  return (
    <AppShell navigation={navigation} active={activeNav} items={navItems}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {isAdmin && navigation.canGoBack() && (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backRow}>
            <Text style={styles.backText}>← Founders</Text>
          </TouchableOpacity>
        )}

        {!isAdmin && !founder?.dnaSelfAssessmentCompletedAt && (
          <TouchableOpacity
            style={styles.dnaBanner}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('DnaQuestionnaire')}
          >
            <Ionicons name="analytics-outline" size={18} color={C.primary} />
            <Text style={styles.dnaBannerText}>Fill in your Founder DNA assessment</Text>
            <Ionicons name="chevron-forward" size={16} color={C.primary} />
          </TouchableOpacity>
        )}

        <View style={[styles.titleRow, isDesktop && styles.titleRowDesktop]}>
          <View>
            <View style={styles.titleLine}>
              <Text style={styles.pageTitle}>Founder Profile</Text>
              <Ionicons name="information-circle-outline" size={18} color={C.textHint} />
            </View>
            <Text style={styles.founderName}>{founder?.name}</Text>
          </View>
          {(founder?.cvUrl || !isAdmin) && (
            <View style={styles.titleActions}>
              {founder?.cvUrl && (
                <TouchableOpacity
                  style={styles.btnSecondary}
                  activeOpacity={0.85}
                  onPress={() => Linking.openURL(founder.cvUrl)}
                >
                  <Ionicons name="document-text-outline" size={15} color={C.textSecondary} />
                  <Text style={styles.btnSecondaryText}>View CV</Text>
                </TouchableOpacity>
              )}
              {!isAdmin && (
                <TouchableOpacity
                  style={styles.btnPrimary}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate('EditFounderProfile', { founderId })}
                >
                  <Ionicons name="create-outline" size={15} color="#fff" />
                  <Text style={styles.btnPrimaryText}>Edit Profile</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        <FounderHeader
          founder={founder}
          insights={insights}
          evidenceCount={evidenceCount}
          activitiesCount={activities.length}
          C={C}
          isAdmin={isAdmin}
          onTeamPress={() => navigation.navigate('TeamProfile', { teamId: founder.team.id })}
        />

        {isAdmin && (
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.btnPrimary} onPress={() => navigation.navigate('Matching', { founderId, founderName: founder?.name })} activeOpacity={0.85}>
              <Ionicons name="people" size={15} color="#fff" />
              <Text style={styles.btnPrimaryText}>Find Matches</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSecondary} onPress={() => navigation.navigate('Evaluation', { founderId })} activeOpacity={0.85}>
              <Ionicons name="add-circle-outline" size={15} color={C.textSecondary} />
              <Text style={styles.btnSecondaryText}>Add Evaluation</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSecondary} onPress={() => navigation.navigate('NewInterview', { founderId, founderName: founder?.name })} activeOpacity={0.85}>
              <Ionicons name="mic-outline" size={15} color={C.textSecondary} />
              <Text style={styles.btnSecondaryText}>Run Interview</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSecondary} onPress={handleChangeStatus} disabled={statusUpdating} activeOpacity={0.85}>
              <Text style={styles.btnSecondaryText}>{statusUpdating ? 'Updating…' : 'Change Status'}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.tabRow}>
          {TABS.filter(t => isAdmin || t !== 'evidence').map(t => (
            <TabButton key={t} label={TAB_LABELS[t]} active={tab === t} onPress={() => setTab(t)} styles={styles} />
          ))}
        </View>

        <View style={styles.body}>
          {tab === 'overview' && (
            <>
              <ResponsiveRow gap={16}>
                <View style={{ flex: 1 }}>
                  <SectionCard title="Founder DNA" icon="analytics-outline" C={C}>
                    <View style={{ alignItems: 'center' }}>
                      <RadarChart axes={axes} size={isDesktop ? 260 : 280} C={C} />
                    </View>
                    <RadarLegend axes={axes} C={C} />
                  </SectionCard>
                </View>
                <View style={{ flex: 1 }}>
                  <SectionCard title="Capability profile" icon="bar-chart-outline" C={C}>
                    <CapabilityList title="Provides" items={founder?.provides} C={C} color={C.primary} />
                    <CapabilityList title="Needs" items={founder?.needs} C={C} color={C.warning} />
                  </SectionCard>
                </View>
                {isAdmin && (
                  <View style={{ flex: 1 }}>
                    <SectionCard title="Behavioral signals" icon="pulse-outline" C={C}>
                      <BehavioralSignals insights={insights} C={C} />
                    </SectionCard>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <SectionCard title="Partner requirements" icon="person-add-outline" C={C}>
                    <PartnerRequirementsCard requirements={founder?.partnerRequirements} dealBreakers={founder?.dealBreakers} C={C} />
                  </SectionCard>
                </View>
              </ResponsiveRow>

              <ResponsiveRow gap={16} style={{ marginTop: 16 }}>
                {isAdmin && (
                  <View style={{ flex: 1 }}>
                    <SectionCard title="Evidence confidence" icon="shield-checkmark-outline" C={C}>
                      <EvidenceConfidenceTable insights={insights} C={C} />
                    </SectionCard>
                  </View>
                )}
                {isAdmin && (
                  <View style={{ flex: 1 }}>
                    <SectionCard title="Recent evidence" icon="time-outline" C={C}>
                      <EvidenceTimeline evidence={evidence.slice(0, 2)} C={C} />
                      {evidence.length > 2 ? (
                        <TouchableOpacity onPress={() => setTab('evidence')} activeOpacity={0.75}>
                          <Text style={styles.linkText}>View all evidence ({evidence.length})</Text>
                        </TouchableOpacity>
                      ) : null}
                    </SectionCard>
                  </View>
                )}
                {isAdmin && (
                  <View style={{ flex: 1 }}>
                    <SectionCard title="Interviews" icon="mic-outline" C={C}>
                      {interviews.length === 0 ? (
                        <Text style={styles.emptyText}>No interviews yet.</Text>
                      ) : (
                        interviews.map((iv) => (
                          <TouchableOpacity
                            key={iv.id}
                            style={styles.activityRow}
                            onPress={() => navigation.navigate('InterviewRunner', { interviewId: iv.id })}
                            activeOpacity={0.75}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={styles.activityTitle}>{iv.meta?.ventureField || 'Interview'}</Text>
                              <Text style={styles.activityMeta}>{new Date(iv.createdAt).toLocaleDateString()}</Text>
                            </View>
                            <Pill
                              label={iv.status === 'completed' ? 'Completed' : 'In progress'}
                              C={C}
                              bg={iv.status === 'completed' ? C.successLight : C.warningLight}
                              color={iv.status === 'completed' ? C.success : C.warning}
                            />
                          </TouchableOpacity>
                        ))
                      )}
                    </SectionCard>
                  </View>
                )}
                {isAdmin && (
                  <View style={{ flex: 1.4 }}>
                    <SectionCard title="Top potential matches" icon="git-merge-outline" C={C}>
                      <TopMatches founderId={founderId} navigation={navigation} limit={3} C={C} />
                      <TouchableOpacity onPress={() => setTab('matches')} activeOpacity={0.75}>
                        <Text style={styles.linkText}>View all matches</Text>
                      </TouchableOpacity>
                    </SectionCard>
                  </View>
                )}
              </ResponsiveRow>
            </>
          )}

          {tab === 'dna' && (
            <SectionCard title="Founder DNA" icon="analytics-outline" C={C}>
              <View style={{ alignItems: 'center' }}>
                <RadarChart axes={axes} size={isDesktop ? 420 : 340} C={C} />
              </View>
              <RadarLegend axes={axes} C={C} />
            </SectionCard>
          )}

          {tab === 'evidence' && isAdmin && (
            <SectionCard title={`All Evidence (${evidence.length})`} icon="time-outline" C={C}>
              <EvidenceTimeline evidence={evidence} C={C} />
            </SectionCard>
          )}

          {tab === 'activities' && (
            <SectionCard title={`Activities (${activities.length})`} icon="calendar-outline" C={C}>
              {activities.length === 0 ? (
                <Text style={styles.emptyText}>No activities yet.</Text>
              ) : (
                activities.map(a => (
                  <TouchableOpacity
                    key={a.id}
                    style={styles.activityRow}
                    onPress={() => navigation.navigate('ActivityDetail', { activityId: a.id })}
                    activeOpacity={0.75}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activityTitle}>{a.title}</Text>
                      <Text style={styles.activityMeta}>
                        {ACTIVITY_TYPE_LABELS[a.type] || a.type}
                        {a.scheduledAt ? ` · ${new Date(a.scheduledAt).toLocaleDateString()}` : ''}
                      </Text>
                    </View>
                    <Pill
                      label={a.status}
                      C={C}
                      bg={a.status === 'active' ? C.warningLight : a.status === 'completed' ? C.successLight : C.surfaceElevated}
                      color={a.status === 'active' ? C.warning : a.status === 'completed' ? C.success : C.textSecondary}
                    />
                  </TouchableOpacity>
                ))
              )}
            </SectionCard>
          )}

          {tab === 'matches' && (
            isAdmin ? (
              matchPairs === null ? (
                <View style={styles.centered}><ActivityIndicator color={C.primary} /></View>
              ) : matchPairs.length === 0 ? (
                <Text style={styles.emptyText}>No matches computed yet for this founder.</Text>
              ) : (
                matchPairs.map((pair) => (
                  <MatchCard
                    key={`${pair.a.id}-${pair.b.id}`}
                    pair={pair}
                    C={C}
                    onCreateTeam={() => navigation.navigate('TeamCreation', { founderIds: [pair.a.id, pair.b.id] })}
                    onCompare={() => navigation.navigate('MatchDetail', { a: pair.a.id, b: pair.b.id })}
                    onViewMatch={() => navigation.navigate('MatchDetail', { a: pair.a.id, b: pair.b.id })}
                  />
                ))
              )
            ) : (
              <Text style={styles.emptyText}>Matches are managed by your program admin.</Text>
            )
          )}
        </View>
      </ScrollView>
    </AppShell>
  );
}

function TabButton({ label, active, onPress, styles }) {
  return (
    <TouchableOpacity style={[styles.tabBtn, active && styles.tabBtnActive]} onPress={onPress} activeOpacity={0.8}>
      <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
    scrollContent: { paddingBottom: 48, paddingHorizontal: 20, maxWidth: 1200, width: '100%', alignSelf: 'center' },

    backRow: { marginTop: 16 },
    backText: { color: C.primary, ...typography.labelLarge },

    dnaBanner: {
      flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16,
      backgroundColor: C.surfaceElevated, borderRadius: radius.md,
      borderWidth: 1, borderColor: C.primary, paddingHorizontal: 16, paddingVertical: 12,
    },
    dnaBannerText: { flex: 1, color: C.primary, fontWeight: '700', fontSize: 14 },

    titleRow: { marginTop: 16, marginBottom: 20, alignItems: 'center', gap: 14 },
    titleRowDesktop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    pageTitle: { ...typography.displayMedium, color: C.textPrimary },
    founderName: { ...typography.titleMedium, color: C.primary, marginTop: 2 },
    titleActions: { flexDirection: 'row', gap: 10 },

    actionsRow: { flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 8, flexWrap: 'wrap', justifyContent: 'center' },
    btnPrimary: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: C.primary, borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: 18,
    },
    btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    btnSecondary: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: C.surface, borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: 18,
      borderWidth: 1.5, borderColor: C.surfaceBorder,
    },
    btnSecondaryText: { color: C.textSecondary, fontWeight: '700', fontSize: 13 },

    tabRow: { flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: C.surfaceBorder, flexWrap: 'wrap' },
    tabBtn: { paddingVertical: 10, paddingHorizontal: 4, marginRight: 16, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabBtnActive: { borderBottomColor: C.primary },
    tabBtnText: { fontSize: 14, fontWeight: '700', color: C.textSecondary },
    tabBtnTextActive: { color: C.primary },

    body: { paddingBottom: 20 },
    linkText: { ...typography.labelLarge, color: C.primary, marginTop: 8 },
    emptyText: { ...typography.bodyMedium, color: C.textHint, textAlign: 'center', paddingVertical: 20 },

    activityRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.surfaceBorder,
    },
    activityTitle: { ...typography.bodyMedium, fontWeight: '700', color: C.textPrimary },
    activityMeta: { ...typography.caption, color: C.textHint, marginTop: 2 },
  });
}
