import {
  View, Text, TextInput, TouchableOpacity, Image,
  StyleSheet, ScrollView, SafeAreaView, StatusBar,
} from 'react-native';
import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import * as ImagePicker from 'expo-image-picker';
import api from '../../services/api';
import { uploadPhoto } from '../../services/auth.service';
import useAuthStore from '../../store/authStore';
import { colors, radius, cardShadow } from '../../theme';

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

const STAGES = ['idea', 'mvp', 'growth', 'scale'];
const STAGE_LABELS = { idea: 'Idea', mvp: 'MVP', growth: 'Growth', scale: 'Scale' };

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
      {selected && (
        <View style={styles.roleCardCheck}>
          <Text style={styles.roleCardCheckText}>✓</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function FieldLabel({ children }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

function parseSkills(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return raw.split(',').map(s => s.trim()).filter(Boolean);
  }
}

function SkillsInput({ value, onChange }) {
  const [inputText, setInputText] = useState('');

  const addSkill = () => {
    const trimmed = inputText.trim();
    if (!trimmed || value.includes(trimmed)) {
      setInputText('');
      return;
    }
    onChange([...value, trimmed]);
    setInputText('');
  };

  const removeSkill = (skill) => {
    onChange(value.filter(s => s !== skill));
  };

  return (
    <View>
      <View style={styles.skillInputRow}>
        <TextInput
          style={[styles.input, styles.skillTextInput]}
          placeholder="e.g. React, Finance..."
          placeholderTextColor={colors.textHint}
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={addSkill}
          returnKeyType="done"
          blurOnSubmit={false}
        />
        <TouchableOpacity style={styles.skillAddBtn} onPress={addSkill} activeOpacity={0.8}>
          <Text style={styles.skillAddBtnText}>+</Text>
        </TouchableOpacity>
      </View>
      {value.length > 0 && (
        <View style={styles.skillBubbleRow}>
          {value.map((skill) => (
            <TouchableOpacity
              key={skill}
              style={styles.skillBubble}
              onPress={() => removeSkill(skill)}
              activeOpacity={0.7}
            >
              <Text style={styles.skillBubbleText}>{skill}</Text>
              <Text style={styles.skillBubbleRemove}>×</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

export default function EditProfileScreen({ route, navigation }) {
  const existing = route.params?.profile;
  const forceStep = route.params?.forceStep;
  const updateUser = useAuthStore(s => s.updateUser);
  const currentUser = useAuthStore(s => s.user);

  // forceStep='role' means the user is changing role — treat as an update (profile already exists)
  const isNew = forceStep === 'role' ? false : !existing?.bio;
  const hasRole = !!currentUser?.role;

  const [step, setStep] = useState(forceStep === 'role' ? 'role' : (isNew && !hasRole ? 'role' : 'profile'));
  const [selectedRole, setSelectedRole] = useState(currentUser?.role || '');
  const [roleError, setRoleError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [photoUri, setPhotoUri] = useState(currentUser?.photo_url || null);
  const [photoUploading, setPhotoUploading] = useState(false);

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setPhotoUri(asset.uri);
    setPhotoUploading(true);
    try {
      const fileName = asset.uri.split('/').pop() || 'photo.jpg';
      const { data } = await uploadPhoto(asset.uri, fileName);
      updateUser({ photo_url: data.photo_url });
    } catch {
      // photo still previews locally even if upload fails
    } finally {
      setPhotoUploading(false);
    }
  };

  // When changing role, start with a blank form (old role-specific data is irrelevant)
  const profileDefaults = forceStep === 'role' ? null : existing;
  const { control, handleSubmit } = useForm({
    defaultValues: {
      bio: profileDefaults?.bio || '',
      skills: parseSkills(profileDefaults?.skills),
      venture_stage: profileDefaults?.venture_stage || '',
      funding_needs: profileDefaults?.funding_needs ? String(profileDefaults.funding_needs) : '',
      investment_domain: profileDefaults?.investment_domain || '',
      preferred_stage: profileDefaults?.preferred_stage || '',
      max_investment: profileDefaults?.max_investment ? String(profileDefaults.max_investment) : '',
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
    const payload = {
      ...data,
      skills: Array.isArray(data.skills) ? data.skills : [],
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

  // ── Role selection step ──────────────────────
  if (step === 'role') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <ScrollView
          contentContainerStyle={styles.scrollInner}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.stepLabel}>STEP 01 · PROFILE SETUP</Text>
          <Text style={styles.roleTitle}>
            How do you want{'\n'}to{' '}
            <Text style={styles.roleTitleAccent}>engage?</Text>
          </Text>
          <Text style={styles.roleSubtitle}>
            Select your primary role. This shapes your matches and network experience.
          </Text>

          {ROLE_OPTIONS.map(opt => (
            <RoleCard
              key={opt.value}
              option={opt}
              selected={selectedRole === opt.value}
              onSelect={setSelectedRole}
            />
          ))}

          {roleError ? <Text style={styles.errorText}>{roleError}</Text> : null}

          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={handleRoleContinue}
            activeOpacity={0.85}
          >
            <Text style={styles.btnPrimaryText}>Continue</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Profile form step ────────────────────────
  const isInvestor = role === 'investor';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => (isNew && !hasRole ? setStep('role') : navigation.goBack())}
        >
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.formTitle}>
          {isNew ? 'Create Profile' : 'Edit Profile'}
        </Text>

        {/* Photo */}
        <TouchableOpacity style={styles.photoArea} onPress={handlePickPhoto} activeOpacity={0.8}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photoImage} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoPlaceholderText}>📷</Text>
              <Text style={styles.photoPlaceholderLabel}>Add Photo</Text>
            </View>
          )}
          <View style={styles.photoBadge}>
            <Text style={styles.photoBadgeText}>{photoUploading ? '…' : '✎'}</Text>
          </View>
        </TouchableOpacity>

        {/* Bio */}
        <FieldLabel>BIO</FieldLabel>
        <Controller
          control={control}
          name="bio"
          render={({ field: { onChange, value } }) => (
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              multiline
              placeholder="Tell us about yourself..."
              placeholderTextColor={colors.textHint}
              onChangeText={onChange}
              value={value}
            />
          )}
        />

        {/* Skills */}
        <FieldLabel>SKILLS</FieldLabel>
        <Controller
          control={control}
          name="skills"
          render={({ field: { onChange, value } }) => (
            <SkillsInput value={value} onChange={onChange} />
          )}
        />

        {/* Entrepreneur fields */}
        {!isInvestor && (
          <>
            <FieldLabel>VENTURE STAGE</FieldLabel>
            <Controller
              control={control}
              name="venture_stage"
              render={({ field: { onChange, value } }) => (
                <View style={styles.stageRow}>
                  {STAGES.map(s => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.stageChip, value === s && styles.stageChipActive]}
                      onPress={() => onChange(s)}
                      activeOpacity={0.8}
                    >
                      <Text style={[
                        styles.stageChipText,
                        value === s && styles.stageChipTextActive,
                      ]}>
                        {STAGE_LABELS[s]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            />

            <FieldLabel>FUNDING NEEDED ($)</FieldLabel>
            <Controller
              control={control}
              name="funding_needs"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 500000"
                  placeholderTextColor={colors.textHint}
                  keyboardType="numeric"
                  onChangeText={onChange}
                  value={value}
                />
              )}
            />
          </>
        )}

        {/* Investor fields */}
        {isInvestor && (
          <>
            <FieldLabel>INVESTMENT DOMAIN</FieldLabel>
            <Controller
              control={control}
              name="investment_domain"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={styles.input}
                  placeholder="e.g. FinTech, HealthTech, SaaS"
                  placeholderTextColor={colors.textHint}
                  onChangeText={onChange}
                  value={value}
                />
              )}
            />

            <FieldLabel>PREFERRED STAGE</FieldLabel>
            <Controller
              control={control}
              name="preferred_stage"
              render={({ field: { onChange, value } }) => (
                <View style={styles.stageRow}>
                  {STAGES.map(s => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.stageChip, value === s && styles.stageChipActive]}
                      onPress={() => onChange(s)}
                      activeOpacity={0.8}
                    >
                      <Text style={[
                        styles.stageChipText,
                        value === s && styles.stageChipTextActive,
                      ]}>
                        {STAGE_LABELS[s]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            />

            <FieldLabel>MAX INVESTMENT ($)</FieldLabel>
            <Controller
              control={control}
              name="max_investment"
              render={({ field: { onChange, value } }) => (
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 2000000"
                  placeholderTextColor={colors.textHint}
                  keyboardType="numeric"
                  onChangeText={onChange}
                  value={value}
                />
              )}
            />
          </>
        )}

        {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}

        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={handleSubmit(onSubmit)}
          activeOpacity={0.85}
        >
          <Text style={styles.btnPrimaryText}>Save Profile</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSoft,
  },
  scrollInner: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 48,
  },

  // ── Role step ──────────────────────────────
  stepLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textHint,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 20,
  },
  roleTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: -0.6,
    lineHeight: 40,
    marginBottom: 10,
  },
  roleTitleAccent: { color: colors.primary },
  roleSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 28,
  },

  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
    gap: 14,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    ...cardShadow,
    shadowOpacity: 0.03,
  },
  roleCardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#F0F4FF',
  },
  roleCardEmoji: { fontSize: 26 },
  roleCardBody: { flex: 1 },
  roleCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primaryDark,
    marginBottom: 3,
  },
  roleCardTitleSelected: { color: colors.primary },
  roleCardSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  roleCardCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleCardCheckText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Profile form ───────────────────────────
  backBtn: { marginBottom: 20 },
  backBtnText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '600',
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: -0.4,
    marginBottom: 24,
  },

  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1.0,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.primaryDark,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  inputMultiline: {
    height: 100,
    textAlignVertical: 'top',
  },

  skillInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  skillTextInput: {
    flex: 1,
  },
  skillAddBtn: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skillAddBtnText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '600',
    lineHeight: 28,
  },
  skillBubbleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  skillBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
    gap: 6,
  },
  skillBubbleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  skillBubbleRemove: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 18,
  },

  stageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stageChip: {
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
  },
  stageChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stageChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  stageChipTextActive: { color: '#fff' },

  errorText: {
    color: colors.error,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
  },

  btnPrimary: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  btnPrimaryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.3,
  },

  photoArea: {
    alignSelf: 'center',
    marginBottom: 28,
    position: 'relative',
  },
  photoImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surfaceBorder,
  },
  photoPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 2,
    borderColor: colors.surfaceBorder,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: { fontSize: 24 },
  photoPlaceholderLabel: { fontSize: 11, color: colors.textHint, marginTop: 2 },
  photoBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  photoBadgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});