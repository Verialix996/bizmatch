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
import { colors, investorColors, radius, typography, cardShadow } from '../../theme';
import { getFounder, getFounderInsights, listEvidence, setFounderStatus, DIMENSIONS, DIMENSION_LABELS } from '../../services/founders.service';
import { listActivities, ACTIVITY_TYPE_LABELS, formatActivityDateRange } from '../../services/activities.service';
import { getTopPairs, getTopMatches, compareFounders } from '../../services/matches.service';
import { listFounderInterviews, deleteFounderInterview } from '../../services/interviews.service';
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
import { ResponsiveRow, SectionCard, Pill, Avatar, useIsDesktop } from '../../components/ui';

const STATUS_OPTIONS = ['active', 'inactive', 'dropped'];
// A founder only gets to compare matches that already clear a 50% compatibility score — below
// that the match isn't strong enough to be worth comparing against another candidate.
const MATCH_SUGGEST_THRESHOLD = 50;

export default function FounderProfileScreen({ route, navigation }) {
  const currentUser = useAuthStore(s => s.user);
  const darkMode = useAppStore(s => s.darkMode);
  const C = darkMode ? investorColors : colors;
  const styles = makeStyles(C);
  const isDesktop = useIsDesktop();

  const founderId = route.params?.founderId || currentUser?.id;
  const isAdmin = currentUser?.role === 'admin';

  const [founder, setFounder] = useState(null);
  const [insights, setInsights] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [activities, setActivities] = useState([]);
  const [matchPairs, setMatchPairs] = useState(null);
  const [myMatches, setMyMatches] = useState(null);
  const [selectedMatchIds, setSelectedMatchIds] = useState([]);
  const [comparing, setComparing] = useState(false);
  const [compareResult, setCompareResult] = useState(null);
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [showAllEvidence, setShowAllEvidence] = useState(false);

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
    if (isAdmin) return;
    setMyMatches(null);
    setSelectedMatchIds([]);
    setCompareResult(null);
    getTopMatches(founderId, 50)
      .then(({ data }) => setMyMatches(data.filter(m => m.score >= MATCH_SUGGEST_THRESHOLD)))
      .catch(() => setMyMatches([]));
  }, [isAdmin, founderId]));

  const toggleSelectedMatch = (id) => {
    setCompareResult(null);
    setSelectedMatchIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2) return [prev[1], id]; // keep it a max-2 selection, drop the oldest
      return [...prev, id];
    });
  };

  const handleCompareMyMatches = async () => {
    if (selectedMatchIds.length !== 2) return;
    setComparing(true);
    setCompareResult(null);
    try {
      const [resA, resB] = await Promise.all([
        compareFounders(founderId, selectedMatchIds[0]),
        compareFounders(founderId, selectedMatchIds[1]),
      ]);
      setCompareResult({ a: resA.data, b: resB.data });
    } catch {
      showAlert('Error', 'Could not compare these matches.');
    } finally {
      setComparing(false);
    }
  };

  useFocusEffect(useCallback(() => {
    if (!isAdmin) return;
    setMatchPairs(null);
    getTopPairs(15, founderId).then(({ data }) => setMatchPairs(data)).catch(() => setMatchPairs([]));
  }, [isAdmin, founderId]));

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

  const confirmDeleteInterview = (interviewId) => {
    showAlert(
      'Delete Interview',
      'This in-progress interview and its answers will be permanently deleted. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFounderInterview(interviewId);
              setInterviews(prev => prev.filter(iv => iv.id !== interviewId));
            } catch {
              showAlert('Error', 'Could not delete this interview.');
            }
          },
        },
      ],
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

        {!isAdmin && founder?.dnaScoringStatus === 'pending' && (
          <View style={styles.dnaBanner}>
            <Ionicons name="hourglass-outline" size={18} color={C.primary} />
            <Text style={styles.dnaBannerText}>Scoring your DNA assessment answers…</Text>
          </View>
        )}
        {!isAdmin && founder?.dnaScoringStatus === 'failed' && (
          <TouchableOpacity
            style={[styles.dnaBanner, { borderColor: C.error }]}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('DnaQuestionnaire')}
          >
            <Ionicons name="alert-circle-outline" size={18} color={C.error} />
            <Text style={[styles.dnaBannerText, { color: C.error }]}>DNA scoring failed — tap to retry</Text>
            <Ionicons name="chevron-forward" size={16} color={C.error} />
          </TouchableOpacity>
        )}
        {!isAdmin && !founder?.dnaSelfAssessmentCompletedAt && founder?.dnaScoringStatus !== 'pending' && founder?.dnaScoringStatus !== 'failed' && (
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
          <View style={styles.titleActions}>
            {isAdmin && (
              <>
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
                <TouchableOpacity style={styles.btnPrimary} onPress={() => navigation.navigate('Matching', { founderId, founderName: founder?.name })} activeOpacity={0.85}>
                  <Ionicons name="people" size={15} color="#fff" />
                  <Text style={styles.btnPrimaryText}>Find Matches</Text>
                </TouchableOpacity>
              </>
            )}
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

        <View style={[styles.body, { marginTop: 20 }]}>
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
                <View style={{ flex: 1 }}>
                  <SectionCard title="Partner requirements" icon="person-add-outline" C={C}>
                    <PartnerRequirementsCard requirements={founder?.partnerRequirements} dealBreakers={founder?.dealBreakers} C={C} />
                  </SectionCard>
                </View>
              </ResponsiveRow>

              <ResponsiveRow gap={16} style={{ marginTop: 16 }}>
                {isAdmin && (
                  <View style={{ flex: 1 }}>
                    <SectionCard title="Behavioral signals" icon="pulse-outline" C={C}>
                      <BehavioralSignals insights={insights} C={C} />
                    </SectionCard>
                  </View>
                )}
                {isAdmin && (
                  <View style={{ flex: 1 }}>
                    <SectionCard title="Evidence confidence" icon="shield-checkmark-outline" C={C}>
                      <EvidenceConfidenceTable insights={insights} C={C} />
                    </SectionCard>
                  </View>
                )}
                {isAdmin && (
                  <View style={{ flex: 1 }}>
                    <SectionCard title={showAllEvidence ? `All evidence (${evidence.length})` : 'Recent evidence'} icon="time-outline" C={C}>
                      <EvidenceTimeline evidence={showAllEvidence ? evidence : evidence.slice(0, 2)} C={C} />
                      {evidence.length > 2 ? (
                        <TouchableOpacity onPress={() => setShowAllEvidence(v => !v)} activeOpacity={0.75}>
                          <Text style={styles.linkText}>{showAllEvidence ? 'Show less' : `View all evidence (${evidence.length})`}</Text>
                        </TouchableOpacity>
                      ) : null}
                    </SectionCard>
                  </View>
                )}
                <View style={{ flex: 1.4 }}>
                  <SectionCard title="Top potential matches" icon="git-merge-outline" C={C}>
                    <TopMatches founderId={founderId} navigation={navigation} limit={3} C={C} />
                  </SectionCard>
                </View>
              </ResponsiveRow>

              {isAdmin && (
                <SectionCard title="Interviews" icon="mic-outline" C={C} style={{ marginTop: 16 }}>
                  {interviews.length === 0 ? (
                    <Text style={styles.emptyText}>No interviews yet.</Text>
                  ) : (
                    interviews.map((iv) => (
                      <View key={iv.id} style={styles.activityRow}>
                        <TouchableOpacity
                          style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
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
                        {iv.status !== 'completed' && (
                          <TouchableOpacity
                            onPress={() => confirmDeleteInterview(iv.id)}
                            activeOpacity={0.75}
                            style={{ paddingLeft: 10, paddingVertical: 4 }}
                          >
                            <Ionicons name="trash-outline" size={18} color={C.error} />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))
                  )}
                </SectionCard>
              )}

              <SectionCard title={`Activities (${activities.length})`} icon="calendar-outline" C={C} style={{ marginTop: 16 }}>
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
                          {a.startsAt && a.endsAt ? ` · ${formatActivityDateRange(a.startsAt, a.endsAt)}` : ''}
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

              <SectionCard title="Matches" icon="people-outline" C={C} style={{ marginTop: 16 }}>
                {isAdmin ? (
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
                        onViewMatch={() => navigation.navigate('MatchDetail', { a: pair.a.id, b: pair.b.id })}
                      />
                    ))
                  )
                ) : (
                  <CompareMyMatches
                    myMatches={myMatches}
                    selectedMatchIds={selectedMatchIds}
                    onToggleSelect={toggleSelectedMatch}
                    onCompare={handleCompareMyMatches}
                    comparing={comparing}
                    compareResult={compareResult}
                    founderId={founderId}
                    C={C}
                    styles={styles}
                  />
                )}
              </SectionCard>
        </View>
      </ScrollView>
    </AppShell>
  );
}

// Compares two of the viewer's OWN matches against each other (not two different founders) —
// e.g. "is my match with Alex or my match with Priya the stronger one?" Only matches that already
// clear MATCH_SUGGEST_THRESHOLD are offered, since a weak match isn't worth comparing against
// another candidate. Fetches compareFounders(me, candidate) once per selected match so each side
// shows the founder's own compatibility with that specific candidate.
function CompareMyMatches({ myMatches, selectedMatchIds, onToggleSelect, onCompare, comparing, compareResult, founderId, C, styles }) {
  if (myMatches === null) {
    return <View style={styles.centered}><ActivityIndicator color={C.primary} /></View>;
  }
  if (myMatches.length === 0) {
    return <Text style={styles.emptyText}>No matches at {MATCH_SUGGEST_THRESHOLD}%+ compatibility yet — check back as more founders join.</Text>;
  }

  return (
    <View>
      <Text style={styles.compareHint}>Pick two of your matches ({MATCH_SUGGEST_THRESHOLD}%+) to compare side by side.</Text>
      {myMatches.map((m) => {
        const selected = selectedMatchIds.includes(m.founderId);
        return (
          <TouchableOpacity
            key={m.founderId}
            style={[styles.matchSelectRow, selected && styles.matchSelectRowActive]}
            onPress={() => onToggleSelect(m.founderId)}
            activeOpacity={0.75}
          >
            <View style={[styles.checkbox, selected && styles.checkboxChecked]} />
            <Avatar photoUrl={m.photoUrl} name={m.name} size={36} C={C} />
            <Text style={[styles.participantName, { flex: 1, marginLeft: 10 }]}>{m.name || 'Unnamed'}</Text>
            <Pill label={`${m.score}%`} C={C} bg={C.successLight} color={C.success} />
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity
        style={[styles.btnPrimary, (selectedMatchIds.length !== 2 || comparing) && styles.btnDisabled]}
        onPress={onCompare}
        disabled={selectedMatchIds.length !== 2 || comparing}
        activeOpacity={0.85}
      >
        {comparing ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Compare Selected</Text>}
      </TouchableOpacity>

      {compareResult && (
        <View style={styles.compareResultRow}>
          <CompareResultCard detail={compareResult.a} founderId={founderId} C={C} styles={styles} />
          <CompareResultCard detail={compareResult.b} founderId={founderId} C={C} styles={styles} />
        </View>
      )}
    </View>
  );
}

// pairDetail canonicalizes (a, b) by uuid ordering, so "me" isn't reliably `a` or `b` — resolve
// which side is the viewer here rather than assuming.
function CompareResultCard({ detail, founderId, C, styles }) {
  const iAmA = detail.a_id === founderId;
  const otherName = iAmA ? detail.b_name : detail.a_name;
  const breakdown = detail.dimension_breakdown || {};

  return (
    <View style={styles.compareCard}>
      <Text style={styles.compareCardName}>{otherName || 'Unnamed'}</Text>
      <Text style={styles.scoreValue}>{detail.score}%{detail.is_provisional ? ' · Provisional' : ''}</Text>
      {(detail.explanation?.positives || []).slice(0, 3).map((p, i) => (
        <Text key={`p${i}`} style={[styles.bullet, { color: C.success }]}>+ {p}</Text>
      ))}
      {(detail.explanation?.risks || []).slice(0, 3).map((r, i) => (
        <Text key={`r${i}`} style={[styles.bullet, { color: C.warning }]}>! {r}</Text>
      ))}
      {DIMENSIONS.map((dim) => (
        breakdown[dim] ? (
          <View key={dim} style={styles.dimRow}>
            <Text style={styles.dimLabel}>{DIMENSION_LABELS[dim] || dim}</Text>
            <Text style={styles.dimValues}>gap {breakdown[dim].gap ?? '—'}</Text>
          </View>
        ) : null
      ))}
    </View>
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
    titleActions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' },
    btnPrimary: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: C.primary, borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: 18,
    },
    btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    btnDisabled: { opacity: 0.6 },

    compareHint: { ...typography.bodySmall, color: C.textSecondary, marginBottom: 12 },
    matchSelectRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: C.surface, borderRadius: radius.lg, padding: 12, marginBottom: 8,
      borderWidth: 1.5, borderColor: C.surfaceBorder,
    },
    matchSelectRowActive: { borderColor: C.primary },
    checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: C.surfaceBorder },
    checkboxChecked: { backgroundColor: C.primary, borderColor: C.primary },
    participantName: { ...typography.bodyMedium, color: C.textPrimary },

    compareResultRow: { flexDirection: 'row', gap: 12, marginTop: 20, flexWrap: 'wrap' },
    compareCard: {
      flex: 1, minWidth: 220, backgroundColor: C.surface, borderRadius: radius.lg,
      padding: 16, ...cardShadow,
    },
    compareCardName: { ...typography.titleSmall, color: C.textPrimary, textAlign: 'center' },
    scoreValue: { fontSize: 32, fontWeight: '800', color: C.primary, textAlign: 'center', marginVertical: 6 },
    bullet: { ...typography.bodySmall, color: C.textPrimary, marginBottom: 4, lineHeight: 18 },
    dimRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.surfaceBorder, marginTop: 6,
    },
    dimLabel: { ...typography.bodySmall, color: C.textPrimary },
    dimValues: { ...typography.caption, color: C.textSecondary },

    btnSecondary: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: C.surface, borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: 18,
      borderWidth: 1.5, borderColor: C.surfaceBorder,
    },
    btnSecondaryText: { color: C.textSecondary, fontWeight: '700', fontSize: 13 },

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
