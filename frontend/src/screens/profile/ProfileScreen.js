import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, SafeAreaView, Image, Animated, Linking, StatusBar,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import useAuthStore from '../../store/authStore';
import useAppStore from '../../store/appStore';
import api from '../../services/api';
import { colors, investorColors, typography, radius, cardShadow } from '../../theme';

const stageLabel = {
  idea: 'Idea Stage', mvp: 'MVP Stage', growth: 'Growth', scale: 'Scale',
};

function Avatar({ photoUrl, name, size = 100, C }) {
  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={{
          width: size, height: size,
          borderRadius: size / 2,
          resizeMode: 'cover',
          borderWidth: 3,
          borderColor: C.surface,
        }}
      />
    );
  }
  return (
    <View style={[
      { width: size, height: size, borderRadius: size / 2, backgroundColor: C.primary,
        justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: C.surface },
    ]}>
      <Text style={{ fontSize: size * 0.38, fontWeight: '800', color: C.textOnPrimary }}>
        {name ? name[0].toUpperCase() : '?'}
      </Text>
    </View>
  );
}

export default function ProfileScreen({ navigation }) {
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const { darkMode, investorMode } = useAppStore(s => ({ darkMode: s.darkMode, investorMode: s.investorMode }));
  const C = (darkMode || investorMode) ? investorColors : colors;
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      api.get('/profile')
        .then(res => setProfile(res.data))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [])
  );

  const styles = makeStyles(C);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle={darkMode || investorMode ? 'light-content' : 'dark-content'} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const isPremium = !!(user?.is_premium && user?.premium_expires_at && new Date(user.premium_expires_at) > new Date());
  const isInvestor = profile?.role_type === 'investor' || user?.role === 'investor';
  const roleTitle = isInvestor
    ? `Investor · ${profile?.investment_domain || 'Multi-sector'}`
    : 'Entrepreneur';

  const skills = (() => {
    try { return JSON.parse(profile?.skills || '[]'); } catch { return []; }
  })();

  const completeness = (() => {
    let pts = 0;
    if (profile?.photo_url) pts += 20;
    if ((profile?.bio || '').length > 50) pts += 20;
    if (skills.length >= 2) pts += 20;
    if (isInvestor) {
      if (profile?.investment_domain) pts += 20;
      if (profile?.preferred_stage) pts += 20;
    } else {
      if (skills.length >= 1) pts += 10;
      if (profile?.bio && (profile?.bio || '').length > 100) pts += 10;
    }
    return pts;
  })();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={darkMode || investorMode ? 'light-content' : 'dark-content'} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Hero */}
        <View style={styles.hero}>
          <Avatar photoUrl={profile?.photo_url} name={user?.name} size={100} C={C} />
          <Text style={styles.heroName}>{user?.name}</Text>
          {isPremium && (
            <View style={styles.premiumBadge}>
              <Text style={styles.premiumBadgeText}>✦ PREMIUM</Text>
            </View>
          )}
          {user?.verification_status === 'verified' && (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedBadgeText}>✓ VERIFIED</Text>
            </View>
          )}
          <Text style={styles.heroRole}>{roleTitle}</Text>
        </View>

        {/* Profile completeness */}
        {profile && (
          <View style={styles.completenessCard}>
            <View style={styles.completenessHeader}>
              <Text style={styles.completenessLabel}>Profile Strength</Text>
              <Text style={[styles.completenessPct, {
                color: completeness === 100 ? C.success : completeness >= 60 ? C.primary : C.warning,
              }]}>{completeness}%</Text>
            </View>
            <View style={styles.completenessTrack}>
              <View style={[styles.completenessBar, {
                width: `${completeness}%`,
                backgroundColor: completeness === 100 ? C.success : completeness >= 60 ? C.primary : C.warning,
              }]} />
            </View>
            {completeness < 100 && (
              <Text style={styles.completenessHint}>
                {!profile.photo_url ? 'Add a profile photo · ' : ''}
                {(profile.bio || '').length <= 50 ? 'Write a bio · ' : ''}
                {skills.length < 2 ? 'Add 2+ skills' : ''}
              </Text>
            )}
          </View>
        )}

        {!profile?.bio && (
          <View style={styles.emptyBanner}>
            <Text style={styles.emptyBannerText}>Complete your profile to start matching</Text>
          </View>
        )}

        <View style={styles.body}>
          {profile?.bio ? (
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>ABOUT ME</Text>
              <Text style={styles.bioText}>{profile.bio}</Text>
            </View>
          ) : null}

          {skills.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>CORE EXPERTISE</Text>
              <View style={styles.chipRow}>
                {skills.map((item, i) => (
                  <View key={i} style={styles.chip}>
                    <Text style={styles.chipText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Experience */}
          {profile?.experience ? (
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>PAST EXPERIENCE</Text>
              <Text style={styles.bioText}>{profile.experience}</Text>
            </View>
          ) : null}

          {/* Links */}
          {(profile?.portfolio_url || profile?.linkedin_url || profile?.cv_url) ? (
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>LINKS</Text>
              {profile?.linkedin_url ? (
                <TouchableOpacity style={styles.linkRow} onPress={() => Linking.openURL(profile.linkedin_url)} activeOpacity={0.7}>
                  <Text style={styles.linkIcon}>💼</Text>
                  <Text style={styles.linkText}>LinkedIn Profile</Text>
                  <Text style={styles.linkArrow}>→</Text>
                </TouchableOpacity>
              ) : null}
              {profile?.portfolio_url ? (
                <TouchableOpacity style={styles.linkRow} onPress={() => Linking.openURL(profile.portfolio_url)} activeOpacity={0.7}>
                  <Text style={styles.linkIcon}>🌐</Text>
                  <Text style={styles.linkText}>Portfolio / Website</Text>
                  <Text style={styles.linkArrow}>→</Text>
                </TouchableOpacity>
              ) : null}
              {profile?.cv_url ? (
                <TouchableOpacity style={styles.linkRow} onPress={() => Linking.openURL(profile.cv_url)} activeOpacity={0.7}>
                  <Text style={styles.linkIcon}>📄</Text>
                  <Text style={styles.linkText}>Download CV / Resume</Text>
                  <Text style={styles.linkArrow}>→</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {/* Investor fields */}
          {isInvestor && (
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>INVESTMENT GOALS</Text>
              {profile?.investment_domain && (
                <View style={styles.dataRow}>
                  <Text style={styles.dataLabel}>Domain</Text>
                  <Text style={styles.dataValue}>{profile.investment_domain}</Text>
                </View>
              )}
              {profile?.preferred_stage && (
                <View style={styles.dataRow}>
                  <Text style={styles.dataLabel}>Target Stage</Text>
                  <Text style={styles.dataValue}>{stageLabel[profile.preferred_stage] || profile.preferred_stage}</Text>
                </View>
              )}
              {profile?.max_investment && (
                <View style={styles.dataRow}>
                  <Text style={styles.dataLabel}>Max Investment</Text>
                  <Text style={styles.highlight}>${Number(profile.max_investment).toLocaleString()}</Text>
                </View>
              )}
            </View>
          )}

          {/* Actions */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity style={styles.btnPrimary} onPress={() => navigation.navigate('EditProfile', { profile })} activeOpacity={0.85}>
              <Text style={styles.btnPrimaryText}>{profile?.bio ? 'Edit Profile' : 'Create Profile'}</Text>
            </TouchableOpacity>

            {!isPremium && (
              <TouchableOpacity style={styles.btnPremium} onPress={() => navigation.navigate('Premium')} activeOpacity={0.85}>
                <Text style={styles.btnPremiumText}>✦ Go Premium</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.btnSecondary} onPress={() => navigation.navigate('AccountSettings')} activeOpacity={0.85}>
              <Text style={styles.btnSecondaryText}>Account Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnLogout} onPress={logout} activeOpacity={0.75}>
              <Text style={styles.btnLogoutText}>Log Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.backgroundSoft },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { paddingBottom: 48 },

    hero: { alignItems: 'center', paddingTop: 40, paddingBottom: 24, paddingHorizontal: 24 },
    heroName: { fontSize: 26, fontWeight: '800', color: C.textPrimary, marginTop: 16, textAlign: 'center', letterSpacing: -0.5 },
    heroRole: { fontSize: 14, fontWeight: '600', color: C.primary, marginTop: 4, textAlign: 'center' },

    premiumBadge: {
      backgroundColor: '#C9A84C', borderRadius: radius.pill,
      paddingHorizontal: 14, paddingVertical: 4, marginTop: 8,
    },
    premiumBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 1 },
    verifiedBadge: {
      backgroundColor: C.success, borderRadius: radius.pill,
      paddingHorizontal: 14, paddingVertical: 4, marginTop: 6,
    },
    verifiedBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 1 },

    body: { paddingHorizontal: 20 },

    completenessCard: {
      marginHorizontal: 20, marginBottom: 16,
      backgroundColor: C.surface, borderRadius: radius.lg, padding: 16, ...cardShadow,
    },
    completenessHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    completenessLabel: { fontSize: 12, fontWeight: '700', color: C.textHint, letterSpacing: 1, textTransform: 'uppercase' },
    completenessPct: { fontSize: 14, fontWeight: '800' },
    completenessTrack: { height: 6, backgroundColor: C.backgroundSoft, borderRadius: 3, overflow: 'hidden' },
    completenessBar: { height: 6, borderRadius: 3 },
    completenessHint: { fontSize: 11, color: C.textHint, marginTop: 8 },

    emptyBanner: {
      backgroundColor: C.warningLight, borderRadius: radius.md, padding: 16,
      marginHorizontal: 20, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(230,126,34,0.2)',
    },
    emptyBannerText: { fontSize: 14, color: C.warning, textAlign: 'center', fontWeight: '600' },

    card: { backgroundColor: C.surface, borderRadius: radius.lg, padding: 20, marginBottom: 16, ...cardShadow },
    sectionLabel: { fontSize: 10, fontWeight: '700', color: C.textHint, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 },

    bioText: { fontSize: 15, color: C.textSecondary, lineHeight: 22 },

    linkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.surfaceBorder },
    linkIcon: { fontSize: 16, marginRight: 10 },
    linkText: { flex: 1, fontSize: 14, color: C.primary, fontWeight: '600' },
    linkArrow: { fontSize: 16, color: C.textHint },

    dataRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.backgroundSoft },
    dataLabel: { fontSize: 14, color: C.textSecondary },
    dataValue: { fontSize: 14, fontWeight: '700', color: C.textPrimary },
    highlight: { fontSize: 18, fontWeight: '800', color: C.primary },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { backgroundColor: C.surfaceElevated, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: C.surfaceBorder },
    chipText: { fontSize: 13, fontWeight: '600', color: C.primary },

    actionsContainer: { marginTop: 16, gap: 12 },
    btnPremium: { backgroundColor: '#F5A623', borderRadius: radius.pill, paddingVertical: 16, alignItems: 'center' },
    btnPremiumText: { color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
    btnPrimary: { backgroundColor: C.buttonPrimary, borderRadius: radius.pill, paddingVertical: 16, alignItems: 'center' },
    btnPrimaryText: { color: C.textOnPrimary, fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
    btnSecondary: { backgroundColor: C.surface, borderRadius: radius.pill, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: C.buttonOutlineBorder },
    btnSecondaryText: { color: C.buttonOutlineText, fontSize: 14, fontWeight: '700' },
    btnLogout: { paddingVertical: 16, alignItems: 'center' },
    btnLogoutText: { color: C.textSecondary, fontSize: 14, fontWeight: '600' },
  });
}
