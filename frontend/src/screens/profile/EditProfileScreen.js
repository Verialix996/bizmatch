import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, SafeAreaView, Platform, UIManager, LayoutAnimation,
} from 'react-native';
import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import { colors } from '../../theme';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

const ProgressBar = ({ current, total = 3 }) => (
  <View style={styles.progressContainer}>
    {[...Array(total)].map((_, i) => (
      <View
        key={i}
        style={[
          styles.progressSegment,
          i + 1 <= current ? styles.progressActive : styles.progressInactive
        ]}
      />
    ))}
  </View>
);

export default function EditProfileScreen({ route, navigation }) {
  const existing = route.params?.profile;
  const updateUser = useAuthStore(s => s.updateUser);
  const currentUser = useAuthStore(s => s.user);

  const isDbRecordNew = !existing || Object.keys(existing).length === 0;
  const isProfileIncomplete = !existing?.bio;
  const hasRole = !!currentUser?.role;

  // Determine if we should show the Onboarding Flow (Steps 1-3) or the Edit Form ('edit')
  const isOnboarding = isDbRecordNew || isProfileIncomplete || !hasRole;
  
  const [step, setStep] = useState(isOnboarding ? 1 : 'edit');
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

  const changeStep = (nextStep) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStep(nextStep);
  };

  const handleRoleContinue = async () => {
    if (!selectedRole) {
      setRoleError('Please select a role to continue.');
      return;
    }
    setRoleError('');
    
    // Save to API if role changed or is new
    if (currentUser?.role !== selectedRole) {
      try {
        await api.patch('/users/me/role', { role: selectedRole });
        updateUser({ role: selectedRole });
      } catch (err) {
        setRoleError(err.response?.data?.error || 'Failed to save role');
        return;
      }
    }
    
    // Proceed to next step based on mode
    if (step === 'role_edit') {
      changeStep('edit'); // Return to single-page edit form
    } else {
      changeStep(2); // Proceed to Onboarding Step 2
    }
  };

  const onSubmit = async (data) => {
    setSaveError('');
    const payload = {
      ...data,
      skills: data.skills
        ? data.skills.split(',').map(s => s.trim()).filter(Boolean)
        : [],
      funding_needs: data.funding_needs ? Number(data.funding_needs) : null,
      max_investment: data.max_investment ? Number(data.max_investment) : null,
      venture_stage: data.venture_stage || null,
      preferred_stage: data.preferred_stage || null,
    };
    try {
      if (isDbRecordNew) {
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
  const isInvestor = role === 'investor';

  // ── ONBOARDING: STEP 1 (Or Role Edit) ──
  if (step === 1 || step === 'role_edit') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.inner}>
          {step === 'role_edit' && (
            <TouchableOpacity style={styles.backBtn} onPress={() => changeStep('edit')}>
              <Text style={styles.backBtnText}>← Back to Profile</Text>
            </TouchableOpacity>
          )}
          
          {step === 1 && <ProgressBar current={1} />}
          
          <Text style={styles.stepLabel}>
            {step === 1 ? 'STEP 01 OF 03 · ROLE' : 'UPDATE YOUR ROLE'}
          </Text>
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

  // ── ONBOARDING: STEP 2 ──
  if (step === 2) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.inner}>
          <ProgressBar current={2} />
          <Text style={styles.stepLabel}>STEP 02 OF 03 · BASICS</Text>
          <Text style={styles.roleTitle}>
            Tell us about{'\n'}<Text style={styles.roleTitleAccent}>yourself</Text>
          </Text>
          <Text style={styles.roleSubtitle}>
            Add a brief bio and your core skills to stand out.
          </Text>

          <Text style={styles.fieldLabel}>Bio</Text>
          <Controller
            control={control}
            name="bio"
            render={({ field: { onChange, value } }) => (
              <TextInput
                style={[styles.input, { height: 120 }]}
                multiline
                placeholder="I am passionate about..."
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
                placeholder="e.g. React, Finance, Leadership"
                onChangeText={onChange}
                value={value}
                placeholderTextColor={colors.onSurfaceVariant}
              />
            )}
          />

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBackBtn} onPress={() => changeStep(1)}>
              <Text style={styles.actionBackText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionNextBtn} onPress={() => changeStep(3)}>
              <Text style={styles.actionNextText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── ONBOARDING: STEP 3 ──
  if (step === 3) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.inner}>
          <ProgressBar current={3} />
          <Text style={styles.stepLabel}>STEP 03 OF 03 · DETAILS</Text>
          <Text style={styles.roleTitle}>
            What are you{'\n'}<Text style={styles.roleTitleAccent}>looking for?</Text>
          </Text>
          <Text style={styles.roleSubtitle}>
            {isInvestor 
              ? 'Define your investment domain and target stages.' 
              : 'Define your venture stage and funding goals.'}
          </Text>

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
                        onPress={() => onChange(value === s ? '' : s)}
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
                        onPress={() => onChange(value === s ? '' : s)}
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

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBackBtn} onPress={() => changeStep(2)}>
              <Text style={styles.actionBackText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionNextBtn} onPress={handleSubmit(onSubmit)}>
              <Text style={styles.actionNextText}>Complete Profile</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── EXISTING PROFILE: FLAT EDIT FORM ──
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.inner}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>← Cancel</Text>
        </TouchableOpacity>

        <Text style={styles.formTitle}>Edit Profile</Text>

        <Text style={styles.fieldLabel}>Primary Role</Text>
        <TouchableOpacity
          style={styles.roleDisplayBtn}
          onPress={() => changeStep('role_edit')}
          activeOpacity={0.7}
        >
          <Text style={styles.roleDisplayText}>
            {role === 'investor' ? '🏛  Investor' : role === 'entrepreneur' ? '🚀  Entrepreneur' : 'Select a role'}
          </Text>
          <Text style={styles.roleDisplayChange}>Change</Text>
        </TouchableOpacity>

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
                      onPress={() => onChange(value === s ? '' : s)}
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
                      onPress={() => onChange(value === s ? '' : s)}
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
          <Text style={styles.saveBtnText}>Save Changes</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  inner: { flexGrow: 1, padding: 24, paddingBottom: 40 },

  // Progress Bar
  progressContainer: { flexDirection: 'row', gap: 8, marginBottom: 28 },
  progressSegment: { height: 4, flex: 1, borderRadius: 2 },
  progressActive: { backgroundColor: colors.primary },
  progressInactive: { backgroundColor: colors.surfaceContainerHigh },

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

  // Action Row for wizard steps 2 & 3
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 32 },
  actionBackBtn: {
    flex: 1, paddingVertical: 16, alignItems: 'center',
    borderRadius: 14, backgroundColor: colors.surfaceContainerHigh,
  },
  actionBackText: { color: colors.onSurface, fontWeight: '700', fontSize: 15 },
  actionNextBtn: {
    flex: 2, paddingVertical: 16, alignItems: 'center',
    borderRadius: 14, backgroundColor: colors.primary,
  },
  actionNextText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Edit Form Styles
  backBtn: { marginBottom: 20 },
  backBtnText: { fontSize: 15, color: colors.primary, fontWeight: '600' },
  formTitle: {
    fontSize: 24, fontWeight: '800', color: colors.onSurface,
    letterSpacing: -0.4, marginBottom: 24,
  },
  roleDisplayBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 10, padding: 14, marginBottom: 4,
  },
  roleDisplayText: { fontSize: 14, color: colors.onSurface, fontWeight: '600' },
  roleDisplayChange: { fontSize: 13, color: colors.primary, fontWeight: '700' },

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