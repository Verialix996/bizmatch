import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, SafeAreaView,
} from 'react-native';
import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import { colors } from '../../theme';

const ROLE_OPTIONS = [
  {
    value: 'entrepreneur',
    emoji: '🚀',
    title: 'Entrepreneur',
    subtitle: 'I am seeking funding, mentorship, or strategic partners.',
  },
  {
    value: 'investor',
    emoji: '🏛',
    title: 'Investor',
    subtitle: 'I am seeking vetted opportunities and high-growth ventures.',
  },
];

function RoleCard({ option, selected, onSelect }) {
  return (
    <TouchableOpacity
      style={[styles.roleCard, selected && styles.roleCardSelected]}
      onPress={() => onSelect(option.value)}
      activeOpacity={0.8}
    >
      <Text style={styles.roleCardEmoji}>{option.emoji}</Text>
      <View style={styles.roleCardBody}>
        <Text style={[styles.roleCardTitle, selected && styles.roleCardTitleSelected]}>
          {option.title}
        </Text>
        <Text style={styles.roleCardSubtitle}>{option.subtitle}</Text>
      </View>
      {selected && <View style={styles.roleCardCheck}><Text style={styles.roleCardCheckText}>✓</Text></View>}
    </TouchableOpacity>
  );
}

export default function EditProfileScreen({ route, navigation }) {
  const existing = route.params?.profile;
  const updateUser = useAuthStore(s => s.updateUser);
  const currentUser = useAuthStore(s => s.user);

  const isNew = !existing?.bio;
  const hasRole = !!currentUser?.role;

  // For new profiles with no role, show role selection step first
  const [step, setStep] = useState(isNew && !hasRole ? 'role' : 'profile');
  const [selectedRole, setSelectedRole] = useState(currentUser?.role || '');
  const [roleError, setRoleError] = useState('');
  const [saveError, setSaveError] = useState('');

  const { control, handleSubmit } = useForm({
    defaultValues: {
      bio: existing?.bio || '',
      skills: existing?.skills
        ? (Array.isArray(existing.skills) ? existing.skills.join(', ') : existing.skills)
        : '',
      venture_stage: existing?.venture_stage || '',
      funding_needs: existing?.funding_needs ? String(existing.funding_needs) : '',
      investment_domain: existing?.investment_domain || '',
      preferred_stage: existing?.preferred_stage || '',
      max_investment: existing?.max_investment ? String(existing.max_investment) : '',
    },
  });

  const handleRoleContinue = async () => {
    if (!selectedRole) {
      setRoleError('Please select a role to continue.');
      return;
    }
    setRoleError('');
    try {
      await api.patch('/users/me/role', { role: selectedRole });
      updateUser({ role: selectedRole });
      setStep('profile');
    } catch (err) {
      setRoleError(err.response?.data?.error || 'Failed to save role');
    }
  };

  const onSubmit = async (data) => {
    setSaveError('');
    // Parse skills from comma-separated string to array
    const payload = {
      ...data,
      skills: data.skills
        ? data.skills.split(',').map(s => s.trim()).filter(Boolean)
        : [],
      funding_needs: data.funding_needs ? Number(data.funding_needs) : null,
      max_investment: data.max_investment ? Number(data.max_investment) : null,
    };
    try {
      if (isNew) {
        await api.post('/profile', payload);
      } else {
        await api.put('/profile', payload);
      }
      navigation.goBack();
    } catch (err) {
      setSaveError(err.response?.data?.error || 'Failed to save profile');
    }
  };

  const role = selectedRole || currentUser?.role;

  // ── Role selection step ──
  if (step === 'role') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.inner}>
          <Text style={styles.stepLabel}>STEP 01 OF 04 · PROFILE SETUP</Text>
          <Text style={styles.roleTitle}>
            How do you want{'\n'}to <Text style={styles.roleTitleAccent}>engage?</Text>
          </Text>
          <Text style={styles.roleSubtitle}>
            Select your primary role. This helps us curate your matches and network experience.
          </Text>

          {ROLE_OPTIONS.map(opt => (
            <RoleCard
              key={opt.value}
              option={opt}
              selected={selectedRole === opt.value}
              onSelect={setSelectedRole}
            />
          ))}

          {roleError ? <Text style={styles.error}>{roleError}</Text> : null}

          <TouchableOpacity style={styles.continueBtn} onPress={handleRoleContinue}>
            <Text style={styles.continueBtnText}>Continue</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Profile form step ──
  const isInvestor = role === 'investor';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.inner}>
        <TouchableOpacity style={styles.backBtn} onPress={() => isNew && !hasRole ? setStep('role') : navigation.goBack()}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.formTitle}>{isNew ? 'Create Profile' : 'Edit Profile'}</Text>

        <Text style={styles.fieldLabel}>Bio</Text>
        <Controller
          control={control}
          name="bio"
          render={({ field: { onChange, value } }) => (
            <TextInput
              style={[styles.input, { height: 88 }]}
              multiline
              placeholder="Tell us about yourself..."
              onChangeText={onChange}
              value={value}
              placeholderTextColor={colors.onSurfaceVariant}
            />
          )}
        />

        <Text style={styles.fieldLabel}>Skills (comma separated)</Text>
        <Controller
          control={control}
          name="skills"
          render={({ field: { onChange, value } }) => (
            <TextInput
              style={styles.input}
              placeholder="e.g. React, Finance, Marketing"
              onChangeText={onChange}
              value={value}
              placeholderTextColor={colors.onSurfaceVariant}
            />
          )}
        />

        {!isInvestor && (
          <>
            <Text style={styles.fieldLabel}>Venture Stage</Text>
            <Controller
              control={control}
              name="venture_stage"
              render={({ field: { onChange, value } }) => (
                <View style={styles.chipRow}>
                  {['idea', 'mvp', 'growth', 'scale'].map(s => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.stageChip, value === s && styles.stageChipActive]}
                      onPress={() => onChange(s)}
                    >
                      <Text style={[styles.stageChipText, value === s && styles.stageChipTextActive]}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            />

            <Text style={styles.fieldLabel}>Funding Needed ($)</Text>
            <Controller
              control={control}
              name="funding_needs"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 500000"
                  keyboardType="numeric"
                  onChangeText={onChange}
                  value={value}
                  placeholderTextColor={colors.onSurfaceVariant}
                />
              )}
            />
          </>
        )}

        {isInvestor && (
          <>
            <Text style={styles.fieldLabel}>Investment Domain</Text>
            <Controller
              control={control}
              name="investment_domain"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={styles.input}
                  placeholder="e.g. FinTech, HealthTech, SaaS"
                  onChangeText={onChange}
                  value={value}
                  placeholderTextColor={colors.onSurfaceVariant}
                />
              )}
            />

            <Text style={styles.fieldLabel}>Preferred Stage</Text>
            <Controller
              control={control}
              name="preferred_stage"
              render={({ field: { onChange, value } }) => (
                <View style={styles.chipRow}>
                  {['idea', 'mvp', 'growth', 'scale'].map(s => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.stageChip, value === s && styles.stageChipActive]}
                      onPress={() => onChange(s)}
                    >
                      <Text style={[styles.stageChipText, value === s && styles.stageChipTextActive]}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            />

            <Text style={styles.fieldLabel}>Max Investment ($)</Text>
            <Controller
              control={control}
              name="max_investment"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 2000000"
                  keyboardType="numeric"
                  onChangeText={onChange}
                  value={value}
                  placeholderTextColor={colors.onSurfaceVariant}
                />
              )}
            />
          </>
        )}

        {saveError ? <Text style={styles.error}>{saveError}</Text> : null}

        <TouchableOpacity style={styles.saveBtn} onPress={handleSubmit(onSubmit)}>
          <Text style={styles.saveBtnText}>Save Profile</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  inner: { flexGrow: 1, padding: 24, paddingBottom: 40 },

  // Role step
  stepLabel: {
    fontSize: 10, fontWeight: '700', color: colors.onSurfaceVariant,
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 16,
  },
  roleTitle: {
    fontSize: 32, fontWeight: '800', color: colors.onSurface,
    letterSpacing: -0.6, marginBottom: 10, lineHeight: 38,
  },
  roleTitleAccent: { color: colors.primary },
  roleSubtitle: {
    fontSize: 14, color: colors.onSurfaceVariant, lineHeight: 20, marginBottom: 28,
  },

  roleCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 16, padding: 16, marginBottom: 12, gap: 14,
    borderWidth: 1.5, borderColor: colors.outlineVariant,
    shadowColor: '#131b2e', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04, shadowRadius: 12, elevation: 2,
  },
  roleCardSelected: { borderColor: colors.primary, backgroundColor: '#f0efff' },
  roleCardEmoji: { fontSize: 28 },
  roleCardBody: { flex: 1 },
  roleCardTitle: { fontSize: 16, fontWeight: '700', color: colors.onSurface, marginBottom: 3 },
  roleCardTitleSelected: { color: colors.primary },
  roleCardSubtitle: { fontSize: 12, color: colors.onSurfaceVariant, lineHeight: 17 },
  roleCardCheck: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  roleCardCheckText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  continueBtn: {
    backgroundColor: colors.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 16,
  },
  continueBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Profile form
  backBtn: { marginBottom: 20 },
  backBtnText: { fontSize: 15, color: colors.primary, fontWeight: '600' },
  formTitle: {
    fontSize: 24, fontWeight: '800', color: colors.onSurface,
    letterSpacing: -0.4, marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 12, fontWeight: '600', color: colors.onSurfaceVariant,
    letterSpacing: 0.3, marginBottom: 6, marginTop: 14,
  },
  input: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 10, padding: 14, fontSize: 14,
    color: colors.onSurface, marginBottom: 4,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  stageChip: {
    borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1, borderColor: 'transparent',
  },
  stageChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  stageChipText: { fontSize: 13, fontWeight: '600', color: colors.onSurfaceVariant },
  stageChipTextActive: { color: '#fff' },

  saveBtn: {
    backgroundColor: colors.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 28,
  },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  error: { color: colors.error, marginTop: 8, textAlign: 'center', fontSize: 13 },
});
