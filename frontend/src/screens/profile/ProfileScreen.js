import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, SafeAreaView, Image,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import useAuthStore from '../../store/authStore';
import api from '../../services/api';
import { colors } from '../../theme';

const stageLabel = {
  idea: 'Idea Stage', mvp: 'MVP Stage', growth: 'Growth', scale: 'Scale',
};

function Avatar({ photoUrl, name, size = 80 }) {
  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={{ width: size, height: size, borderRadius: size / 2, resizeMode: 'cover' }}
      />
    );
  }
  return (
    <View style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={{ fontSize: size * 0.4, fontWeight: '800', color: '#fff' }}>
        {name ? name[0].toUpperCase() : '?'}
      </Text>
    </View>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
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

  useFocusEffect(useCallback(() => {
    setLoading(true);
    api.get('/profile')
      .then(res => setProfile(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []));

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
    : `Entrepreneur · ${stageLabel[profile?.venture_stage] || 'Early Stage'}`;

  const skills = (() => {
    try { return JSON.parse(profile?.skills || '[]'); } catch { return []; }
  })();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroBg} />
          <View style={styles.heroTextBlock}>
            <Text style={styles.heroName}>{user?.name}</Text>
            <Text style={styles.heroRole}>{roleTitle}</Text>
          </View>
          <View style={styles.heroAvatarWrap}>
            <Avatar photoUrl={profile?.photo_url} name={user?.name} size={88} />
          </View>
        </View>

        <View style={styles.body}>
          {/* No profile yet */}
          {!profile?.bio && (
            <View style={styles.emptyBanner}>
              <Text style={styles.emptyBannerText}>Complete your profile to start matching</Text>
            </View>
          )}

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
            <>
              {profile?.investment_domain ? (
                <Section title="INVESTMENT DOMAIN">
                  <Text style={styles.metaValue}>{profile.investment_domain}</Text>
                </Section>
              ) : null}
              {profile?.preferred_stage ? (
                <Section title="TARGET STAGE">
                  <Text style={styles.metaValue}>{stageLabel[profile.preferred_stage] || profile.preferred_stage}</Text>
                </Section>
              ) : null}
              {profile?.max_investment ? (
                <Section title="MAX INVESTMENT">
                  <Text style={styles.highlight}>${Number(profile.max_investment).toLocaleString()}</Text>
                </Section>
              ) : null}
            </>
          )}

          {/* Entrepreneur fields */}
          {!isInvestor && (
            <>
              {profile?.venture_stage ? (
                <Section title="VENTURE STAGE">
                  <Text style={styles.metaValue}>{stageLabel[profile.venture_stage] || profile.venture_stage}</Text>
                </Section>
              ) : null}
              {profile?.funding_needs ? (
                <Section title="SEEKING">
                  <Text style={styles.highlight}>${Number(profile.funding_needs).toLocaleString()}</Text>
                </Section>
              ) : null}
            </>
          )}

          {/* Actions */}
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => navigation.navigate('EditProfile', { profile })}
          >
            <Text style={styles.editBtnText}>{profile?.bio ? 'Edit Profile' : 'Create Profile'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
            <Text style={styles.logoutBtnText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  hero: { height: 200, position: 'relative' },
  heroBg: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: colors.primaryContainer,
  },
  heroAvatarWrap: {
    position: 'absolute', bottom: -44, left: 24,
    borderWidth: 3, borderColor: colors.surface, borderRadius: 999,
  },
  avatarPlaceholder: {
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  heroTextBlock: {
    position: 'absolute', bottom: 20, left: 130, right: 16,
  },
  heroName: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.4 },
  heroRole: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  body: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },

  emptyBanner: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 12, padding: 16, marginBottom: 20,
  },
  emptyBannerText: { fontSize: 13, color: colors.onSurfaceVariant, textAlign: 'center' },

  section: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 10, fontWeight: '700', color: colors.onSurfaceVariant,
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8,
  },
  bioText: { fontSize: 14, color: colors.onSurfaceVariant, lineHeight: 22 },
  metaValue: { fontSize: 15, color: colors.onSurface, fontWeight: '600' },
  highlight: { fontSize: 24, fontWeight: '800', color: colors.primary, letterSpacing: -0.4 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.onSurfaceVariant },

  editBtn: {
    backgroundColor: colors.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginBottom: 12,
  },
  editBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  logoutBtn: {
    borderRadius: 14, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.outlineVariant,
  },
  logoutBtnText: { color: colors.onSurfaceVariant, fontWeight: '600', fontSize: 15 },
});
