import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, StatusBar, ActivityIndicator,
} from 'react-native';
import { showAlert } from '../../services/alert';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import useAppStore from '../../store/appStore';
import useAuthStore from '../../store/authStore';
import { colors, investorColors, investorThemeColors, radius, cardShadow } from '../../theme';
import {
  getChallenge, getChallengeSignups, getSignupsMine, signupTeam, selectWinner,
} from '../../services/challenge.service';
import { getMyTeams } from '../../services/team.service';

export default function ChallengeDetailScreen({ route, navigation }) {
  const { challengeId } = route.params;
  const darkMode = useAppStore(s => s.darkMode);
  const isInvestorTheme = useAppStore(s => s.isInvestorTheme);
  const C = darkMode ? investorColors : (isInvestorTheme ? investorThemeColors : colors);
  const styles = makeStyles(C);
  const user = useAuthStore(s => s.user);

  const [loading, setLoading] = useState(true);
  const [challenge, setChallenge] = useState(null);
  const [signups, setSignups] = useState([]);
  const [mySignup, setMySignup] = useState(null);
  const [myTeam, setMyTeam] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getChallenge(challengeId);
      setChallenge(data);

      if (user?.role === 'investor' && data.investor_id === user.id) {
        const signupsRes = await getChallengeSignups(challengeId);
        setSignups(signupsRes.data || []);
      } else {
        const [mineRes, teamsRes] = await Promise.all([getSignupsMine(), getMyTeams()]);
        setMySignup((mineRes.data || []).find(s => String(s.challenge_id) === String(challengeId)) || null);
        setMyTeam(teamsRes.data?.[0] || null);
      }
    } catch (e) {
      console.error('Failed to load challenge', e);
    } finally {
      setLoading(false);
    }
  }, [challengeId, user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSignup = async () => {
    if (!myTeam) return showAlert('No team', 'Form a team first from the Challenges tab.');
    try {
      await signupTeam(challengeId, myTeam.id);
      load();
    } catch (e) {
      showAlert('Could not sign up', e.response?.data?.error || 'Try again.');
    }
  };

  const handleSelectWinner = async (teamId) => {
    try {
      await selectWinner(challengeId, teamId);
      load();
    } catch (e) {
      showAlert('Could not select winner', e.response?.data?.error || 'Try again.');
    }
  };

  if (loading || !challenge) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}><ActivityIndicator size="large" color={C.primary} /></View>
      </SafeAreaView>
    );
  }

  const isOwnerInvestor = user?.role === 'investor' && challenge.investor_id === user.id;
  const deadlinePassed = new Date(challenge.submission_deadline) <= new Date();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Challenge Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{challenge.title}</Text>
          <Text style={styles.deadline}>
            {deadlinePassed ? 'Closed' : `Deadline: ${new Date(challenge.submission_deadline).toLocaleString()}`}
          </Text>
        </View>

        {challenge.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>DESCRIPTION</Text>
            <Text style={styles.bodyText}>{challenge.description}</Text>
          </View>
        ) : null}

        {challenge.judging_criteria ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>JUDGING CRITERIA</Text>
            <Text style={styles.bodyText}>{challenge.judging_criteria}</Text>
          </View>
        ) : null}

        {challenge.investment_teaser ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>INVESTMENT</Text>
            <Text style={styles.bodyText}>{challenge.investment_teaser}</Text>
          </View>
        ) : null}

        {isOwnerInvestor ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SUBMISSIONS ({signups.length})</Text>
            {signups.length === 0 ? (
              <Text style={styles.bodyText}>No teams have signed up yet.</Text>
            ) : signups.map(s => (
              <View key={s.id} style={styles.signupRow}>
                <Text style={styles.signupTeam}>{s.team_name}</Text>
                <Text style={styles.signupStatus}>{s.status}</Text>
                {challenge.status === 'open' && deadlinePassed && s.status === 'submitted' ? (
                  <TouchableOpacity style={styles.smallBtn} onPress={() => handleSelectWinner(s.team_id)}>
                    <Text style={styles.smallBtnText}>Select Winner</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
            {challenge.status === 'winner_selected' ? (
              <TouchableOpacity
                style={[styles.smallBtn, { marginTop: 12 }]}
                onPress={() => navigation.navigate('OfferNegotiation', { challengeId, teamId: challenge.winning_team_id })}
              >
                <Text style={styles.smallBtnText}>Manage Investment Offer</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>YOUR TEAM'S STATUS</Text>
            {!mySignup ? (
              <TouchableOpacity style={styles.smallBtn} onPress={handleSignup}>
                <Text style={styles.smallBtnText}>Sign Up</Text>
              </TouchableOpacity>
            ) : mySignup.status !== 'submitted' ? (
              <TouchableOpacity
                style={styles.smallBtn}
                onPress={() => navigation.navigate('Submission', { signupId: mySignup.id, challengeType: 'hackathon' })}
              >
                <Text style={styles.smallBtnText}>Continue Submission</Text>
              </TouchableOpacity>
            ) : (
              <>
                <Text style={styles.bodyText}>Submitted ✓</Text>
                {challenge.status === 'winner_selected' && String(challenge.winning_team_id) === String(myTeam?.id) ? (
                  <TouchableOpacity
                    style={[styles.smallBtn, { marginTop: 12 }]}
                    onPress={() => navigation.navigate('OfferNegotiation', { challengeId, teamId: myTeam.id })}
                  >
                    <Text style={styles.smallBtnText}>🎉 View Investment Offer</Text>
                  </TouchableOpacity>
                ) : null}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.backgroundSoft },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.surfaceBorder },
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    backIcon: { fontSize: 22, color: C.textPrimary },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: C.textPrimary },
    content: { paddingBottom: 40 },
    titleBlock: { backgroundColor: C.surface, alignItems: 'center', paddingVertical: 28, paddingHorizontal: 24, marginBottom: 12, ...cardShadow },
    title: { fontSize: 22, fontWeight: '800', color: C.textPrimary, textAlign: 'center', marginBottom: 6 },
    deadline: { fontSize: 13, color: C.textHint },
    section: { backgroundColor: C.surface, marginHorizontal: 16, marginBottom: 12, borderRadius: radius.lg, padding: 18, ...cardShadow },
    sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: C.textHint, marginBottom: 10 },
    bodyText: { fontSize: 14, color: C.textSecondary, lineHeight: 21 },
    signupRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.surfaceBorder },
    signupTeam: { fontSize: 14, fontWeight: '700', color: C.primaryDark },
    signupStatus: { fontSize: 12, color: C.textHint, marginTop: 2 },
    smallBtn: { backgroundColor: C.primary, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center', marginTop: 8, alignSelf: 'flex-start' },
    smallBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  });
}
