import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, SafeAreaView, ActivityIndicator, Modal, StatusBar,
} from 'react-native';
import { showAlert } from '../../services/alert';
import { useState, useCallback } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import useAppStore from '../../store/appStore';
import useAuthStore from '../../store/authStore';
import { colors, investorColors, investorThemeColors, radius, cardShadow } from '../../theme';
import {
  createTeam, getMyTeams, getMyPendingInvites, inviteToTeam, respondToInvite,
} from '../../services/team.service';
import { getMatches } from '../../services/match.service';
import {
  getOpenChallenges, getMyChallenges, createChallenge, draftChallengeDescription,
  getSignupsMine, submitEntry, getSubmissionAiReview, signupTeam,
} from '../../services/challenge.service';

const STAGE_LABELS = { idea: 'Idea Stage', mvp: 'MVP Stage', growth: 'Growth', scale: 'Scale' };

export default function ChallengesScreen() {
  const darkMode = useAppStore(s => s.darkMode);
  const isInvestorTheme = useAppStore(s => s.isInvestorTheme);
  const C = darkMode ? investorColors : (isInvestorTheme ? investorThemeColors : colors);
  const styles = makeStyles(C);
  const user = useAuthStore(s => s.user);

  if (user?.role === 'investor') {
    return <InvestorChallenges C={C} styles={styles} darkMode={darkMode} />;
  }
  return <EntrepreneurChallenges C={C} styles={styles} darkMode={darkMode} />;
}

// ---------------------------------------------------------------------------
// Entrepreneur
// ---------------------------------------------------------------------------

function EntrepreneurChallenges({ C, styles, darkMode }) {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState(null);
  const [invites, setInvites] = useState([]);
  const [matches, setMatches] = useState([]);
  const [openChallenges, setOpenChallenges] = useState([]);
  const [mySignups, setMySignups] = useState([]);
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [showInvitePicker, setShowInvitePicker] = useState(false);
  const [cohesionResponse, setCohesionResponse] = useState('');
  const [submittingCohesion, setSubmittingCohesion] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [teamsRes, invitesRes, matchesRes, openRes, signupsRes] = await Promise.all([
        getMyTeams(), getMyPendingInvites(), getMatches(), getOpenChallenges(), getSignupsMine(),
      ]);
      setTeam(teamsRes.data?.[0] || null);
      setInvites(invitesRes.data || []);
      setMatches(matchesRes.data || []);
      setOpenChallenges(openRes.data || []);
      setMySignups(signupsRes.data || []);
    } catch (e) {
      console.error('Failed to load challenges data', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cohesionSignup = mySignups.find(s => s.challenge_type === 'cohesion_test');
  const cohesionDone = cohesionSignup?.status === 'submitted';
  const acceptedCount = team?.members?.filter(m => m.status === 'accepted').length || 0;

  const handleCreateTeam = async (data) => {
    await createTeam(data);
    setShowTeamForm(false);
    load();
  };

  const handleInvite = async (userId) => {
    try {
      await inviteToTeam(team.id, userId);
      setShowInvitePicker(false);
      showAlert('Invite Sent', 'They’ll see it as a pending invite.');
      load();
    } catch (e) {
      showAlert('Could not invite', e.response?.data?.error || 'Try again.');
    }
  };

  const handleRespond = async (teamId, accept) => {
    await respondToInvite(teamId, accept);
    load();
  };

  const handleSubmitCohesion = async () => {
    if (!cohesionResponse.trim()) return;
    setSubmittingCohesion(true);
    try {
      await submitEntry(cohesionSignup.id, cohesionResponse.trim());
      await getSubmissionAiReview(cohesionSignup.id);
      load();
    } catch (e) {
      showAlert('Error', e.response?.data?.error || 'Could not submit.');
    } finally {
      setSubmittingCohesion(false);
    }
  };

  const handleSignup = async (challengeId) => {
    if (!team) return showAlert('Form a team first', 'You need a team before applying.');
    try {
      await signupTeam(challengeId, team.id);
      showAlert('Signed up!', 'Head to My Applications to submit your entry.');
      load();
    } catch (e) {
      showAlert('Could not sign up', e.response?.data?.error || 'Try again.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}><ActivityIndicator size="large" color={C.primary} /></View>
      </SafeAreaView>
    );
  }

  const gateActive = !!team && acceptedCount >= 2 && !cohesionDone;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.sectionLabel}>CHALLENGES</Text>
            <Text style={styles.pageTitle}>Team Up & Compete</Text>
          </View>
        </View>

        {invites.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending Team Invites</Text>
            {invites.map(inv => (
              <View key={inv.team_id} style={styles.card}>
                <Text style={styles.cardTitle}>{inv.team_name}</Text>
                <Text style={styles.cardDesc}>Invited by {inv.invited_by_name}</Text>
                <View style={styles.formBtnRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => handleRespond(inv.team_id, false)}>
                    <Text style={styles.cancelBtnText}>Decline</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveBtn} onPress={() => handleRespond(inv.team_id, true)}>
                    <Text style={styles.saveBtnText}>Accept</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Team</Text>
          {!team ? (
            <View style={styles.card}>
              <Text style={styles.cardDesc}>Form a team with someone you've matched with to start competing in challenges.</Text>
              <TouchableOpacity style={[styles.saveBtn, { marginTop: 12 }]} onPress={() => setShowTeamForm(true)}>
                <Text style={styles.saveBtnText}>Create Team</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{team.name}</Text>
              {team.members?.map(m => (
                <Text key={m.user_id} style={styles.cardDesc}>
                  {m.name} — {m.status}
                </Text>
              ))}
              <TouchableOpacity style={[styles.uploadBtn, { marginTop: 10 }]} onPress={() => setShowInvitePicker(true)}>
                <Text style={styles.uploadBtnText}>+ Invite a match</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {team && acceptedCount >= 2 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Team Cohesion Challenge</Text>
            <View style={styles.card}>
              {!cohesionSignup ? (
                <Text style={styles.cardDesc}>Generating your team's cohesion exercise…</Text>
              ) : (
                <>
                  <Text style={styles.cardDesc}>{cohesionSignup.challenge_type === 'cohesion_test' ? undefined : null}</Text>
                  {!cohesionDone ? (
                    <>
                      <Text style={styles.fieldLabel}>YOUR RESPONSE</Text>
                      <TextInput
                        style={[styles.input, styles.inputMultiline]}
                        multiline
                        value={cohesionResponse}
                        onChangeText={setCohesionResponse}
                        placeholder="Write how your team would tackle this..."
                        placeholderTextColor={C.textHint}
                      />
                      <TouchableOpacity style={[styles.saveBtn, { marginTop: 12 }]} onPress={handleSubmitCohesion} disabled={submittingCohesion}>
                        {submittingCohesion ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Submit Response</Text>}
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <Text style={styles.metaChipText}>✓ Completed</Text>
                      {cohesionSignup.ai_review?.feedback ? (
                        <>
                          <Text style={[styles.cardDesc, { marginTop: 8 }]}>{cohesionSignup.ai_review.feedback}</Text>
                          <Text style={styles.deckFeedbackScore}>Cohesion Score: {cohesionSignup.ai_review.cohesionScore}/100</Text>
                        </>
                      ) : null}
                    </>
                  )}
                </>
              )}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Open Challenges</Text>
          {gateActive && (
            <View style={styles.bannerWarning}>
              <Text style={styles.bannerWarningText}>Complete your team cohesion challenge before applying to hackathons.</Text>
            </View>
          )}
          {openChallenges.length === 0 ? (
            <Text style={styles.cardDesc}>No open challenges right now.</Text>
          ) : openChallenges.map(c => (
            <TouchableOpacity key={c.id} style={styles.card} onPress={() => navigation.navigate('ChallengeDetail', { challengeId: c.id })} activeOpacity={0.8}>
              <Text style={styles.cardTitle}>{c.title}</Text>
              <Text style={styles.cardDesc} numberOfLines={2}>{c.description}</Text>
              {c.investment_teaser ? <Text style={styles.metaChipText}>{c.investment_teaser}</Text> : null}
              <TouchableOpacity
                style={[styles.uploadBtn, { marginTop: 10, opacity: gateActive ? 0.5 : 1 }]}
                onPress={() => !gateActive && handleSignup(c.id)}
                disabled={gateActive}
              >
                <Text style={styles.uploadBtnText}>Sign Up</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>

        {mySignups.filter(s => s.challenge_type === 'hackathon').length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Applications</Text>
            {mySignups.filter(s => s.challenge_type === 'hackathon').map(s => (
              <TouchableOpacity key={s.id} style={styles.card} onPress={() => navigation.navigate('ChallengeDetail', { challengeId: s.challenge_id })} activeOpacity={0.8}>
                <Text style={styles.cardTitle}>{s.challenge_title}</Text>
                <Text style={styles.cardDesc}>Status: {s.status}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={showTeamForm} animationType="slide">
        <SafeAreaView style={styles.container}>
          <View style={styles.formModalHeader}>
            <TouchableOpacity onPress={() => setShowTeamForm(false)}><Text style={styles.formModalBack}>✕</Text></TouchableOpacity>
            <Text style={styles.formModalTitle}>New Team</Text>
            <View style={{ width: 28 }} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <TeamForm onSave={handleCreateTeam} onCancel={() => setShowTeamForm(false)} styles={styles} C={C} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={showInvitePicker} transparent animationType="fade">
        <View style={styles.deleteOverlay}>
          <View style={styles.deleteModal}>
            <Text style={styles.deleteModalTitle}>Invite a Match</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {matches.length === 0 ? (
                <Text style={styles.cardDesc}>No matches yet.</Text>
              ) : matches.map(m => (
                <TouchableOpacity key={m.userId} style={styles.card} onPress={() => handleInvite(m.userId)}>
                  <Text style={styles.cardTitle}>{m.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.deleteBtnCancel} onPress={() => setShowInvitePicker(false)}>
              <Text style={styles.deleteBtnCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function TeamForm({ onSave, onCancel, styles, C }) {
  const [form, setForm] = useState({ name: '', stage: '', industry: '', fundingNeeded: '' });
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Team name is required'); return; }
    setError('');
    try {
      await onSave({
        name: form.name.trim(),
        stage: form.stage || undefined,
        industry: form.industry || undefined,
        fundingNeeded: form.fundingNeeded ? Number(form.fundingNeeded) : undefined,
      });
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save.');
    }
  };

  return (
    <View style={styles.formPanel}>
      <Text style={styles.fieldLabel}>TEAM NAME *</Text>
      <TextInput style={styles.input} value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} placeholder="e.g. TeamSync Squad" placeholderTextColor={C.textHint} />
      <Text style={styles.fieldLabel}>INDUSTRY</Text>
      <TextInput style={styles.input} value={form.industry} onChangeText={v => setForm(f => ({ ...f, industry: v }))} placeholder="e.g. SaaS" placeholderTextColor={C.textHint} />
      <Text style={styles.fieldLabel}>STAGE</Text>
      <View style={styles.stageRow}>
        {['idea', 'mvp', 'growth', 'scale'].map(v => (
          <TouchableOpacity key={v} style={[styles.stageChip, form.stage === v && styles.stageChipActive]} onPress={() => setForm(f => ({ ...f, stage: v }))}>
            <Text style={[styles.stageChipText, form.stage === v && styles.stageChipTextActive]}>{STAGE_LABELS[v]}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.fieldLabel}>FUNDING NEEDED ($)</Text>
      <TextInput style={styles.input} value={form.fundingNeeded} onChangeText={v => setForm(f => ({ ...f, fundingNeeded: v }))} keyboardType="numeric" placeholderTextColor={C.textHint} />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <View style={styles.formBtnRow}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}><Text style={styles.saveBtnText}>Create Team</Text></TouchableOpacity>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Investor
// ---------------------------------------------------------------------------

function InvestorChallenges({ C, styles, darkMode }) {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [challenges, setChallenges] = useState([]);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMyChallenges();
      setChallenges(res.data || []);
    } catch (e) {
      console.error('Failed to load challenges', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleCreate = async (data) => {
    await createChallenge(data);
    setShowForm(false);
    load();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}><ActivityIndicator size="large" color={C.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.sectionLabel}>MY CHALLENGES</Text>
            <Text style={styles.pageTitle}>Hackathons</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)}>
            <Text style={styles.addBtnText}>+ New</Text>
          </TouchableOpacity>
        </View>

        {challenges.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No challenges yet</Text>
            <Text style={styles.emptySub}>Post a hackathon-style challenge for teams to apply to.</Text>
          </View>
        ) : challenges.map(c => (
          <TouchableOpacity key={c.id} style={styles.card} onPress={() => navigation.navigate('ChallengeDetail', { challengeId: c.id })} activeOpacity={0.8}>
            <Text style={styles.cardTitle}>{c.title}</Text>
            <Text style={styles.cardDesc} numberOfLines={2}>{c.description}</Text>
            <Text style={styles.metaChipText}>Status: {c.status} · Deadline: {new Date(c.submission_deadline).toLocaleDateString()}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={showForm} animationType="slide">
        <SafeAreaView style={styles.container}>
          <View style={styles.formModalHeader}>
            <TouchableOpacity onPress={() => setShowForm(false)}><Text style={styles.formModalBack}>✕</Text></TouchableOpacity>
            <Text style={styles.formModalTitle}>New Challenge</Text>
            <View style={{ width: 28 }} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            <ChallengeForm onSave={handleCreate} onCancel={() => setShowForm(false)} styles={styles} C={C} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function ChallengeForm({ onSave, onCancel, styles, C }) {
  const [form, setForm] = useState({ title: '', description: '', judgingCriteria: '', investmentTeaser: '', deadlineDays: '14' });
  const [error, setError] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState('');

  const handleDraft = async () => {
    if (!draftPrompt.trim()) return;
    setDrafting(true);
    try {
      const { data } = await draftChallengeDescription(draftPrompt.trim());
      setForm(f => ({ ...f, description: data.description }));
    } catch (e) {
      showAlert('Error', e.response?.data?.error || 'Could not draft description.');
    } finally {
      setDrafting(false);
    }
  };

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Title is required'); return; }
    setError('');
    try {
      const deadline = new Date(Date.now() + Number(form.deadlineDays || 14) * 86400000).toISOString();
      await onSave({
        title: form.title.trim(),
        description: form.description || undefined,
        judgingCriteria: form.judgingCriteria || undefined,
        investmentTeaser: form.investmentTeaser || undefined,
        submissionDeadline: deadline,
      });
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save.');
    }
  };

  return (
    <View style={styles.formPanel}>
      <Text style={styles.fieldLabel}>TITLE *</Text>
      <TextInput style={styles.input} value={form.title} onChangeText={v => setForm(f => ({ ...f, title: v }))} placeholderTextColor={C.textHint} />

      <Text style={styles.fieldLabel}>AI DRAFT ASSIST — describe the challenge briefly</Text>
      <TextInput style={styles.input} value={draftPrompt} onChangeText={setDraftPrompt} placeholder="e.g. micro-lending pilot for small businesses" placeholderTextColor={C.textHint} />
      <TouchableOpacity style={[styles.uploadBtn, { marginTop: 8 }]} onPress={handleDraft} disabled={drafting}>
        {drafting ? <ActivityIndicator size="small" color={C.primary} /> : <Text style={styles.uploadBtnText}>✦ Draft with AI</Text>}
      </TouchableOpacity>

      <Text style={styles.fieldLabel}>DESCRIPTION</Text>
      <TextInput style={[styles.input, styles.inputMultiline]} multiline value={form.description} onChangeText={v => setForm(f => ({ ...f, description: v }))} placeholderTextColor={C.textHint} />

      <Text style={styles.fieldLabel}>JUDGING CRITERIA</Text>
      <TextInput style={styles.input} value={form.judgingCriteria} onChangeText={v => setForm(f => ({ ...f, judgingCriteria: v }))} placeholderTextColor={C.textHint} />

      <Text style={styles.fieldLabel}>INVESTMENT TEASER</Text>
      <TextInput style={styles.input} value={form.investmentTeaser} onChangeText={v => setForm(f => ({ ...f, investmentTeaser: v }))} placeholder="e.g. Up to $150k for the winner" placeholderTextColor={C.textHint} />

      <Text style={styles.fieldLabel}>SUBMISSION WINDOW (DAYS)</Text>
      <TextInput style={styles.input} value={form.deadlineDays} onChangeText={v => setForm(f => ({ ...f, deadlineDays: v }))} keyboardType="numeric" placeholderTextColor={C.textHint} />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <View style={styles.formBtnRow}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}><Text style={styles.saveBtnText}>Post Challenge</Text></TouchableOpacity>
      </View>
    </View>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.backgroundSoft },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16 },
    sectionLabel: { fontSize: 13, fontWeight: '700', color: C.textHint, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2 },
    pageTitle: { fontSize: 30, fontWeight: '800', color: C.primaryDark, letterSpacing: -0.4 },
    addBtn: { backgroundColor: C.primary, borderRadius: radius.md, paddingHorizontal: 18, paddingVertical: 9 },
    addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    section: { marginBottom: 8 },
    sectionTitle: { fontSize: 15, fontWeight: '800', color: C.primaryDark, marginHorizontal: 16, marginBottom: 8 },
    card: {
      backgroundColor: C.surface, marginHorizontal: 16, marginBottom: 12, borderRadius: radius.lg, padding: 16,
      borderWidth: 1, borderColor: C.surfaceBorder, ...cardShadow, shadowOpacity: 0.04,
    },
    cardTitle: { fontSize: 16, fontWeight: '700', color: C.primaryDark, marginBottom: 6 },
    cardDesc: { fontSize: 13, color: C.textSecondary, lineHeight: 18, marginBottom: 6 },
    metaChipText: { fontSize: 12, fontWeight: '600', color: C.primary },
    bannerWarning: { backgroundColor: '#FFF6E5', borderColor: '#FFE0A3', borderWidth: 1, borderRadius: radius.md, padding: 12, marginHorizontal: 16, marginBottom: 12 },
    bannerWarningText: { color: '#8A5A00', fontSize: 13, fontWeight: '600' },
    uploadBtn: { backgroundColor: C.backgroundSoft, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center', borderWidth: 1.5, borderColor: C.surfaceBorder, borderStyle: 'dashed' },
    uploadBtnText: { fontSize: 12, fontWeight: '600', color: C.primary },
    deckFeedbackScore: { fontSize: 15, fontWeight: '800', color: C.primary, marginTop: 8 },
    formModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.surfaceBorder, backgroundColor: C.surface },
    formModalBack: { fontSize: 20, color: C.textSecondary, fontWeight: '600' },
    formModalTitle: { fontSize: 17, fontWeight: '800', color: C.primaryDark },
    formPanel: { backgroundColor: C.surface, marginHorizontal: 16, marginBottom: 16, borderRadius: radius.lg, padding: 20, borderWidth: 1, borderColor: C.surfaceBorder, ...cardShadow, shadowOpacity: 0.05 },
    fieldLabel: { fontSize: 11, fontWeight: '700', color: C.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6, marginTop: 14 },
    input: { backgroundColor: C.backgroundSoft, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.primaryDark, borderWidth: 1, borderColor: C.surfaceBorder },
    inputMultiline: { height: 80, textAlignVertical: 'top' },
    stageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    stageChip: { borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: C.backgroundSoft, borderWidth: 1.5, borderColor: C.surfaceBorder },
    stageChipActive: { backgroundColor: C.primary, borderColor: C.primary },
    stageChipText: { fontSize: 13, fontWeight: '600', color: C.textSecondary },
    stageChipTextActive: { color: '#fff' },
    formBtnRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
    cancelBtn: { flex: 1, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: C.surfaceBorder },
    cancelBtnText: { color: C.textSecondary, fontWeight: '600' },
    saveBtn: { flex: 2, backgroundColor: C.primary, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
    saveBtnText: { color: '#fff', fontWeight: '700' },
    errorText: { color: C.error, marginTop: 8, fontSize: 13 },
    emptyState: { alignItems: 'center', padding: 48 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: C.primaryDark, marginBottom: 8 },
    emptySub: { fontSize: 13, color: C.textHint, textAlign: 'center', lineHeight: 20 },
    deleteOverlay: { flex: 1, backgroundColor: 'rgba(2, 36, 102, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    deleteModal: { backgroundColor: C.surface, borderRadius: radius.xl, padding: 28, width: '100%', maxWidth: 400, ...cardShadow },
    deleteModalTitle: { fontSize: 18, fontWeight: '700', color: C.textPrimary, textAlign: 'center', marginBottom: 12 },
    deleteBtnCancel: { borderWidth: 1, borderColor: C.surfaceBorder, borderRadius: radius.pill, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
    deleteBtnCancelText: { color: C.textSecondary, fontWeight: '600', fontSize: 14 },
  });
}
