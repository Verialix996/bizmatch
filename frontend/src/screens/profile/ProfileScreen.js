import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, SafeAreaView, Image, Alert
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
          width: size, height: size, borderRadius: size / 2, 
          resizeMode: 'cover', borderWidth: 3, borderColor: colors.surface 
        }}
      />
    );
  }
  return (
    <View style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[typography.displayLarge, { color: colors.textOnPrimary }]}>
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

  // Re-fetch data every time the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      api.get('/profile')
        .then(res => setProfile(res.data))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, [])
  );

  const handleDeleteProfile = () => {
    Alert.alert(
      "Delete Profile",
      "Are you sure you want to permanently delete your profile and account? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            try {
              setLoading(true);
              await api.delete('/users/me'); // Call to delete user
              logout(); // Clear auth state
            } catch (err) {
              setLoading(false);
              Alert.alert("Error", "Could not delete profile. Please try again.");
            }
          }
        }
      ]
    );
  };

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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Hero Section */}
        <View style={styles.hero}>
          <Avatar photoUrl={profile?.photo_url} name={user?.name} size={100} />
          <Text style={styles.heroName}>{user?.name}</Text>
          <Text style={styles.heroRole}>{roleTitle}</Text>
        </View>

        {/* Missing Profile Banner */}
        {!profile?.bio && (
          <View style={styles.emptyBanner}>
            <Text style={styles.emptyBannerText}>Complete your profile to start matching</Text>
          </View>
        )}

        {/* Data Cards */}
        <View style={styles.body}>
          {profile?.bio ? (
            <Section title="ABOUT ME">
              <Text style={styles.bioText}>{profile.bio}</Text>
            </Section>
          ) : null}

          {skills.length > 0 && (
            <Section title="CORE EXPERTISE">
              <ChipRow items={skills} />
            </Section>
          )}

          {/* Investor Specific Data */}
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

          {/* Entrepreneur Specific Data */}
          {!isInvestor && (profile?.venture_stage || profile?.funding_needs) && (
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>VENTURE DETAILS</Text>
              
              {profile?.venture_stage && (
                <View style={styles.dataRow}>
                  <Text style={styles.dataLabel}>Stage</Text>
                  <Text style={styles.dataValue}>{stageLabel[profile.venture_stage] || profile.venture_stage}</Text>
                </View>
              )}
              
              {profile?.funding_needs && (
                <View style={styles.dataRow}>
                  <Text style={styles.dataLabel}>Seeking</Text>
                  <Text style={styles.highlight}>${Number(profile.funding_needs).toLocaleString()}</Text>
                </View>
              )}
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={() => navigation.navigate('EditProfile', { profile })}
            >
              <Text style={styles.btnPrimaryText}>
                {profile?.bio ? 'Edit Profile' : 'Create Profile'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnSecondary}
              onPress={() => navigation.navigate('AccountSettings')} 
            >
              <Text style={styles.btnSecondaryText}>Account Settings (Change Name)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnLogout} onPress={logout}>
              <Text style={styles.btnLogoutText}>Log Out</Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.backgroundSoft 
  },
  centered: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  scrollContent: {
    paddingBottom: 40,
  },

  // ── Hero ───────────────────────────────────────
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
    ...typography.displayMedium, 
    color: colors.textPrimary, 
    marginTop: 16,
    textAlign: 'center',
  },
  heroRole: { 
    ...typography.titleSmall, 
    color: colors.primary, 
    marginTop: 4,
    textAlign: 'center',
  },

  body: { 
    paddingHorizontal: 20, 
  },

  // ── Banners & Cards ────────────────────────────
  emptyBanner: {
    backgroundColor: colors.warningLight,
    borderRadius: radius.md, 
    padding: 16, 
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(230, 126, 34, 0.2)',
  },
  emptyBannerText: { 
    ...typography.bodyMedium,
    color: colors.warning, 
    textAlign: 'center',
    fontWeight: '600'
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 20,
    marginBottom: 16,
    ...cardShadow,
  },
  sectionLabel: {
    ...typography.labelSmall,
    color: colors.textHint,
    marginBottom: 12,
  },
  
  // ── Content ────────────────────────────────────
  bioText: { 
    ...typography.bodyLarge, 
    color: colors.textSecondary 
  },
  
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  dataLabel: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  dataValue: { 
    ...typography.titleSmall, 
    color: colors.textPrimary,
  },
  highlight: { 
    ...typography.titleMedium, 
    color: colors.primary, 
  },

  // ── Chips ──────────────────────────────────────
  chipRow: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 8 
  },
  chip: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.pill, 
    paddingHorizontal: 14, 
    paddingVertical: 8,
  },
  chipText: { 
    ...typography.labelLarge, 
    color: colors.primary 
  },

  // ── Actions ────────────────────────────────────
  actionsContainer: {
    marginTop: 16,
    gap: 12,
  },
  btnPrimary: {
    backgroundColor: colors.buttonPrimary, 
    borderRadius: radius.pill,
    paddingVertical: 16, 
    alignItems: 'center', 
  },
  btnPrimaryText: { 
    color: colors.buttonPrimaryText, 
    ...typography.labelLarge,
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
    ...typography.labelLarge,
  },

  btnLogout: {
    paddingVertical: 16, 
    alignItems: 'center',
  },
  btnLogoutText: { 
    color: colors.textSecondary, 
    ...typography.labelLarge,
  },
});