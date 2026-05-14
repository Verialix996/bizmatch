import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, SafeAreaView, Image, Animated,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import useAuthStore from '../../store/authStore';
import api from '../../services/api';
import { colors, typography, radius, cardShadow } from '../../theme';

const stageLabel = {
  idea: 'Idea Stage', mvp: 'MVP Stage', growth: 'Growth', scale: 'Scale',
};

function Avatar({ photoUrl, name, size = 100 }) {
  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={{
          width: size, height: size,
          borderRadius: size / 2,
          resizeMode: 'cover',
          borderWidth: 3,
          borderColor: colors.surface,
        }}
      />
    );
  }
  return (
    <View style={[
      styles.avatarPlaceholder,
      { width: size, height: size, borderRadius: size / 2 },
    ]}>
      <Text style={{ fontSize: size * 0.38, fontWeight: '800', color: '#fff' }}>
        {name ? name[0].toUpperCase() : '?'}
      </Text>
    </View>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionLabel}>{title}</Text>
      {children}
    </View>
  );
}

function ChipRow({ items }) {
  if (!items?.length) return null;
  return (
    <View style={styles.chipRow}>
      {items.map((item, i) => (
        <View key={i} style={styles.chip}>
          <Text style={styles.chipText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export default function ProfileScreen({ navigation }) {
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

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
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Avatar photoUrl={profile?.photo_url} name={user?.name} size={100} />
          <Text style={styles.heroName}>{user?.name}</Text>
          <Text style={styles.heroRole}>{roleTitle}</Text>
        </View>

        {/* Profile completeness bar */}
        {profile && (
          <View style={styles.completenessCard}>
            <View style={styles.completenessHeader}>
              <Text style={styles.completenessLabel}>Profile Strength</Text>
              <Text style={[
                styles.completenessPct,
                { color: completeness === 100 ? colors.success : completeness >= 60 ? colors.primary : colors.warning },
              ]}>
                {completeness}%
              </Text>
            </View>
            <View style={styles.completenessTrack}>
              <View style={[
                styles.completenessBar,
                {
                  width: `${completeness}%`,
                  backgroundColor: completeness === 100 ? colors.success : completeness >= 60 ? colors.primary : colors.warning,
                },
              ]} />
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

        {/* Incomplete profile banner */}
        {!profile?.bio && (
          <View style={styles.emptyBanner}>
            <Text style={styles.emptyBannerText}>
              Complete your profile to start matching
            </Text>
          </View>
        )}

        <View style={styles.body}>
          {/* About */}
          {profile?.bio ? (
            <Section title="ABOUT ME">
              <Text style={styles.bioText}>{profile.bio}</Text>
            </Section>
          ) : null}

          {/* Skills */}
          {skills.length > 0 && (
            <Section title="CORE EXPERTISE">
              <ChipRow items={skills} />
            </Section>
          )}

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
                  <Text style={styles.dataValue}>
                    {stageLabel[profile.preferred_stage] || profile.preferred_stage}
                  </Text>
                </View>
              )}
              {profile?.max_investment && (
                <View style={styles.dataRow}>
                  <Text style={styles.dataLabel}>Max Investment</Text>
                  <Text style={styles.highlight}>
                    ${Number(profile.max_investment).toLocaleString()}
                  </Text>
                </View>
              )}
            </View>
          )}


          {/* Actions */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={() => navigation.navigate('EditProfile', { profile })}
              activeOpacity={0.85}
            >
              <Text style={styles.btnPrimaryText}>
                {profile?.bio ? 'Edit Profile' : 'Create Profile'}
              </Text>
            </TouchableOpacity>

            {!(user?.is_premium && user?.premium_expires_at && new Date(user.premium_expires_at) > new Date()) && (
              <TouchableOpacity
                style={styles.btnPremium}
                onPress={() => navigation.navigate('Premium')}
                activeOpacity={0.85}
              >
                <Text style={styles.btnPremiumText}>✦ Go Premium</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.btnSecondary}
              onPress={() => navigation.navigate('AccountSettings')}
              activeOpacity={0.85}
            >
              <Text style={styles.btnSecondaryText}>Account Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnLogout}
              onPress={logout}
              activeOpacity={0.75}
            >
              <Text style={styles.btnLogoutText}>Log Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSoft },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: 48 },

  hero: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  avatarPlaceholder: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: colors.surface,
    ...cardShadow,
  },
  heroName: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.primaryDark,
    marginTop: 16,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  heroRole: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginTop: 4,
    textAlign: 'center',
  },

  body: { paddingHorizontal: 20 },

  completenessCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    ...cardShadow,
  },
  completenessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  completenessLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textHint,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  completenessPct: {
    fontSize: 14,
    fontWeight: '800',
  },
  completenessTrack: {
    height: 6,
    backgroundColor: colors.backgroundSoft,
    borderRadius: 3,
    overflow: 'hidden',
  },
  completenessBar: {
    height: 6,
    borderRadius: 3,
  },
  completenessHint: {
    fontSize: 11,
    color: colors.textHint,
    marginTop: 8,
  },

  emptyBanner: {
    backgroundColor: colors.warningLight,
    borderRadius: radius.md,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(230,126,34,0.2)',
  },
  emptyBannerText: {
    fontSize: 14,
    color: colors.warning,
    textAlign: 'center',
    fontWeight: '600',
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 20,
    marginBottom: 16,
    ...cardShadow,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textHint,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },

  bioText: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },

  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundSoft,
  },
  dataLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  dataValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  highlight: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },

  actionsContainer: { marginTop: 16, gap: 12 },
  btnPremium: {
    backgroundColor: '#F5A623',
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnPremiumText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  btnPrimary: {
    backgroundColor: colors.buttonPrimary,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  btnSecondary: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.buttonOutlineBorder,
  },
  btnSecondaryText: {
    color: colors.buttonOutlineText,
    fontSize: 14,
    fontWeight: '700',
  },
  btnLogout: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnLogoutText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
});