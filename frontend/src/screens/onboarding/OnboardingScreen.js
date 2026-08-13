import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, ScrollView, StatusBar, ActivityIndicator,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import useAppStore from '../../store/appStore';
import { colors, investorColors, radius, typography } from '../../theme';
import {
  updateFounderProfile, updateFounderCapabilities,
  updatePartnerRequirements, updateDealBreakers, completeOnboarding,
  CAPABILITIES,
} from '../../services/founders.service';
import CapabilityScorer from '../../components/founder/CapabilityScorer';

// Founder Profile creation wizard (spec sections 20-21), replacing the old
// swipe-app walkthrough. Values Scenarios / Work Style steps are omitted
// for this pass — the scenario→dimension weight mapping is unauthored
// product content (flagged in the plan as a content dependency), so this
// wizard only covers steps backed by real, working endpoints.
const STAGES = ['idea', 'mvp', 'growth', 'scale'];
const STAGE_LABELS = { idea: 'Idea', mvp: 'MVP', growth: 'Growth', scale: 'Scale' };
const COMMITMENT_TYPES = ['full_time', 'part_time'];
const COMMITMENT_LABELS = { full_time: 'Full Time', part_time: 'Part Time' };
const DEAL_BREAKER_SUGGESTIONS = ['Dishonesty', 'Part-time', 'Low accountability', 'Major values mismatch'];
const DEFAULT_CAPABILITY_SCORE = 75;

const STEPS = ['basics', 'commitment', 'provides', 'needs', 'partner', 'dealbreakers'];
const DRAFT_KEY = 'onboardingDraft';

function Chip({ label, selected, onPress, C, styles }) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && { backgroundColor: C.primary, borderColor: C.primary }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.chipText, selected && { color: '#fff' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function TagInput({ value, onAdd, styles, C }) {
  const [text, setText] = useState('');
  const submit = () => {
    const trimmed = text.trim();
    if (trimmed && !value.includes(trimmed)) onAdd(trimmed);
    setText('');
  };
  return (
    <View style={styles.tagInputRow}>
      <TextInput
        style={[styles.input, { flex: 1 }]}
        placeholder="Add your own…"
        placeholderTextColor={C.textHint}
        value={text}
        onChangeText={setText}
        onSubmitEditing={submit}
        returnKeyType="done"
      />
      <TouchableOpacity style={styles.tagAddBtn} onPress={submit} activeOpacity={0.85}>
        <Ionicons name="add" size={18} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

export default function OnboardingScreen() {
  const currentUser = useAuthStore(s => s.user);
  const setHasSeenOnboarding = useAuthStore(s => s.setHasSeenOnboarding);
  const darkMode = useAppStore(s => s.darkMode);
  const C = darkMode ? investorColors : colors;
  const styles = makeStyles(C);

  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [draftLoaded, setDraftLoaded] = useState(false);
  const hydrating = useRef(true);

  const [basics, setBasics] = useState({ role_title: '', venture_name: '', industry: '', location: '', current_stage: '' });
  const [commitment, setCommitment] = useState({ commitment_hours: '', commitment_type: '', commitment_risk_appetite: '' });
  const [provides, setProvides] = useState([]); // [{ capability, score }]
  const [needs, setNeeds] = useState([]);
  const [partner, setPartner] = useState({ role_wanted: '', commitment_required: '', ambition_required: '' });
  const [dealBreakers, setDealBreakers] = useState([]);

  // Restore an in-progress draft once on mount so backgrounding/closing the
  // app mid-wizard doesn't lose everything the founder already entered.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(DRAFT_KEY);
        if (raw) {
          const draft = JSON.parse(raw);
          if (draft.basics) setBasics(draft.basics);
          if (draft.commitment) setCommitment(draft.commitment);
          if (draft.provides) setProvides(draft.provides);
          if (draft.needs) setNeeds(draft.needs);
          if (draft.partner) setPartner(draft.partner);
          if (draft.dealBreakers) setDealBreakers(draft.dealBreakers);
          if (typeof draft.stepIndex === 'number') setStepIndex(draft.stepIndex);
        }
      } catch {
        // Corrupt/missing draft — just start fresh.
      } finally {
        hydrating.current = false;
        setDraftLoaded(true);
      }
    })();
  }, []);

  // Persist the draft after every change, once initial hydration is done.
  useEffect(() => {
    if (hydrating.current) return;
    AsyncStorage.setItem(DRAFT_KEY, JSON.stringify({
      basics, commitment, provides, needs, partner, dealBreakers, stepIndex,
    })).catch(() => {});
  }, [basics, commitment, provides, needs, partner, dealBreakers, stepIndex]);

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  const toggleItem = (list, setList, item) => {
    setList(list.includes(item) ? list.filter(i => i !== item) : [...list, item]);
  };
  const toggleCapability = (list, setList, capability) => {
    if (list.some(c => c.capability === capability)) {
      setList(list.filter(c => c.capability !== capability));
    } else {
      setList([...list, { capability, score: DEFAULT_CAPABILITY_SCORE }]);
    }
  };

  const validateStep = () => {
    switch (step) {
      case 'basics':
        if (!basics.role_title.trim() || !basics.industry.trim() || !basics.location.trim() || !basics.current_stage) {
          return 'Fill in role, industry, location, and current stage to continue.';
        }
        return null;
      case 'commitment':
        if (!commitment.commitment_type || !commitment.commitment_hours || Number(commitment.commitment_hours) <= 0) {
          return 'Enter your hours per week and pick a commitment type.';
        }
        return null;
      case 'provides':
        if (provides.length === 0) return 'Select at least one capability you bring to a team.';
        return null;
      case 'needs':
        if (needs.length === 0) return 'Select at least one capability you need from a co-founder.';
        return null;
      case 'partner':
        if (!partner.role_wanted.trim() || !partner.commitment_required.trim()) {
          return 'Fill in the role and commitment you\'re looking for in a partner.';
        }
        return null;
      case 'dealbreakers':
        if (dealBreakers.length === 0) return 'Select or add at least one deal breaker.';
        return null;
      default:
        return null;
    }
  };

  const goNext = () => {
    const validationError = validateStep();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    if (!isLast) {
      setStepIndex(stepIndex + 1);
    } else {
      handleFinish();
    }
  };
  const goBack = () => {
    setError('');
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
  };

  const handleFinish = async () => {
    setSaving(true);
    setError('');
    try {
      const founderId = currentUser.id;
      // Every write below is a full-replace/upsert on the backend, so this
      // whole sequence is safe to simply retry from the same local state if
      // any single call fails partway through — nothing needs a rollback.
      await updateFounderProfile(founderId, {
        ...basics,
        commitment_hours: commitment.commitment_hours ? Number(commitment.commitment_hours) : null,
        commitment_type: commitment.commitment_type || null,
        commitment_risk_appetite: commitment.commitment_risk_appetite || null,
      });
      await updateFounderCapabilities(founderId, 'provide', provides);
      await updateFounderCapabilities(founderId, 'need', needs);
      await updatePartnerRequirements(founderId, partner);
      await updateDealBreakers(founderId, dealBreakers);
      await completeOnboarding(founderId);

      await AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
      setHasSeenOnboarding();
      await api.patch('/users/me/onboarding').catch(() => {});
      // No explicit navigation — AppNavigator's top-level conditional swaps
      // from FounderOnboardingNavigator to FounderNavigator automatically
      // once hasSeenOnboarding flips in the store.
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save your profile. Nothing was lost — you can just try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!draftLoaded) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={C.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.progressRow}>
        {STEPS.map((_, i) => (
          <View key={i} style={[styles.progressDot, i <= stepIndex && { backgroundColor: C.primary }]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {step === 'basics' && (
          <View>
            <Text style={styles.title}>The basics</Text>
            <Text style={styles.subtitle}>Tell us who you are and what you're building.</Text>

            <Text style={styles.fieldLabel}>ROLE / BACKGROUND</Text>
            <TextInput style={styles.input} placeholder="e.g. Technical Co-Founder" placeholderTextColor={C.textHint}
              value={basics.role_title} onChangeText={(v) => setBasics({ ...basics, role_title: v })} />

            <Text style={styles.fieldLabel}>VENTURE NAME (optional)</Text>
            <TextInput style={styles.input} placeholder="Your startup's name" placeholderTextColor={C.textHint}
              value={basics.venture_name} onChangeText={(v) => setBasics({ ...basics, venture_name: v })} />

            <Text style={styles.fieldLabel}>INDUSTRY</Text>
            <TextInput style={styles.input} placeholder="e.g. FinTech, HealthTech" placeholderTextColor={C.textHint}
              value={basics.industry} onChangeText={(v) => setBasics({ ...basics, industry: v })} />

            <Text style={styles.fieldLabel}>LOCATION</Text>
            <TextInput style={styles.input} placeholder="e.g. Tel Aviv" placeholderTextColor={C.textHint}
              value={basics.location} onChangeText={(v) => setBasics({ ...basics, location: v })} />

            <Text style={styles.fieldLabel}>CURRENT STAGE</Text>
            <View style={styles.chipRow}>
              {STAGES.map(s => (
                <Chip key={s} label={STAGE_LABELS[s]} selected={basics.current_stage === s}
                  onPress={() => setBasics({ ...basics, current_stage: s })} C={C} styles={styles} />
              ))}
            </View>
          </View>
        )}

        {step === 'commitment' && (
          <View>
            <Text style={styles.title}>Commitment</Text>
            <Text style={styles.subtitle}>How much time and risk are you putting into this?</Text>

            <Text style={styles.fieldLabel}>HOURS PER WEEK</Text>
            <TextInput style={styles.input} placeholder="e.g. 40" placeholderTextColor={C.textHint}
              keyboardType="numeric" value={commitment.commitment_hours}
              onChangeText={(v) => setCommitment({ ...commitment, commitment_hours: v })} />

            <Text style={styles.fieldLabel}>COMMITMENT TYPE</Text>
            <View style={styles.chipRow}>
              {COMMITMENT_TYPES.map(t => (
                <Chip key={t} label={COMMITMENT_LABELS[t]} selected={commitment.commitment_type === t}
                  onPress={() => setCommitment({ ...commitment, commitment_type: t })} C={C} styles={styles} />
              ))}
            </View>

            <Text style={styles.fieldLabel}>RISK APPETITE (optional)</Text>
            <TextInput style={[styles.input, styles.inputMultiline]} multiline
              placeholder="How much risk are you willing to take on this venture?" placeholderTextColor={C.textHint}
              value={commitment.commitment_risk_appetite}
              onChangeText={(v) => setCommitment({ ...commitment, commitment_risk_appetite: v })} />
          </View>
        )}

        {step === 'provides' && (
          <View>
            <Text style={styles.title}>What can you own?</Text>
            <Text style={styles.subtitle}>Select the capabilities you bring to a team, then rate how strong you are at each.</Text>
            <View style={styles.chipRow}>
              {CAPABILITIES.map(c => (
                <Chip key={c} label={c} selected={provides.some(p => p.capability === c)}
                  onPress={() => toggleCapability(provides, setProvides, c)} C={C} styles={styles} />
              ))}
            </View>
            <CapabilityScorer items={provides} onChange={setProvides} C={C} color={C.primary} />
          </View>
        )}

        {step === 'needs' && (
          <View>
            <Text style={styles.title}>What do you need?</Text>
            <Text style={styles.subtitle}>Select what you need from a co-founder, then rate how important each one is.</Text>
            <View style={styles.chipRow}>
              {CAPABILITIES.map(c => (
                <Chip key={c} label={c} selected={needs.some(n => n.capability === c)}
                  onPress={() => toggleCapability(needs, setNeeds, c)} C={C} styles={styles} />
              ))}
            </View>
            <CapabilityScorer items={needs} onChange={setNeeds} C={C} color={C.warning} />
          </View>
        )}

        {step === 'partner' && (
          <View>
            <Text style={styles.title}>Partner requirements</Text>
            <Text style={styles.subtitle}>What are you looking for in a co-founder?</Text>

            <Text style={styles.fieldLabel}>ROLE WANTED</Text>
            <TextInput style={styles.input} placeholder="e.g. Technical Co-Founder" placeholderTextColor={C.textHint}
              value={partner.role_wanted} onChangeText={(v) => setPartner({ ...partner, role_wanted: v })} />

            <Text style={styles.fieldLabel}>COMMITMENT REQUIRED</Text>
            <TextInput style={styles.input} placeholder="e.g. Full Time" placeholderTextColor={C.textHint}
              value={partner.commitment_required} onChangeText={(v) => setPartner({ ...partner, commitment_required: v })} />

            <Text style={styles.fieldLabel}>AMBITION (optional)</Text>
            <TextInput style={styles.input} placeholder="e.g. Venture Scale" placeholderTextColor={C.textHint}
              value={partner.ambition_required} onChangeText={(v) => setPartner({ ...partner, ambition_required: v })} />
          </View>
        )}

        {step === 'dealbreakers' && (
          <View>
            <Text style={styles.title}>Deal breakers</Text>
            <Text style={styles.subtitle}>What would make you walk away from a partnership?</Text>
            <View style={styles.chipRow}>
              {DEAL_BREAKER_SUGGESTIONS.map(d => (
                <Chip key={d} label={d} selected={dealBreakers.includes(d)}
                  onPress={() => toggleItem(dealBreakers, setDealBreakers, d)} C={C} styles={styles} />
              ))}
              {dealBreakers.filter(d => !DEAL_BREAKER_SUGGESTIONS.includes(d)).map(d => (
                <Chip key={d} label={d} selected
                  onPress={() => toggleItem(dealBreakers, setDealBreakers, d)} C={C} styles={styles} />
              ))}
            </View>
            <TagInput value={dealBreakers} onAdd={(d) => setDealBreakers([...dealBreakers, d])} styles={styles} C={C} />
          </View>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        {stepIndex > 0 && (
          <TouchableOpacity style={styles.btnOutline} onPress={goBack} disabled={saving}>
            <Text style={styles.btnOutlineText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.btnPrimary, saving && styles.btnDisabled]} onPress={goNext} disabled={saving}>
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnPrimaryText}>{isLast ? 'Finish' : 'Next'}</Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.backgroundSoft },
    progressRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
    progressDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: C.surfaceBorder },

    scrollContent: { padding: 24, paddingBottom: 40 },
    title: { ...typography.displayMedium, color: C.textPrimary, marginBottom: 6 },
    subtitle: { ...typography.bodyMedium, color: C.textSecondary, marginBottom: 24 },

    fieldLabel: { ...typography.labelSmall, color: C.textSecondary, marginBottom: 8, marginTop: 16, textTransform: 'uppercase' },
    input: {
      backgroundColor: C.surface, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 14,
      fontSize: 15, color: C.textPrimary, borderWidth: 1, borderColor: C.surfaceBorder,
    },
    inputMultiline: { height: 90, textAlignVertical: 'top' },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 10,
      backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.surfaceBorder,
    },
    chipText: { fontSize: 13, fontWeight: '600', color: C.textSecondary },

    tagInputRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
    tagAddBtn: { backgroundColor: C.primary, borderRadius: radius.md, width: 48, alignItems: 'center', justifyContent: 'center' },

    errorText: { color: C.error, fontSize: 13, textAlign: 'center', marginTop: 16 },

    footer: {
      flexDirection: 'row', gap: 12, padding: 20, paddingBottom: 28,
      backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.surfaceBorder,
    },
    btnOutline: {
      flex: 1, borderRadius: radius.pill, paddingVertical: 16, alignItems: 'center',
      borderWidth: 1.5, borderColor: C.surfaceBorder,
    },
    btnOutlineText: { color: C.textSecondary, fontWeight: '700', fontSize: 14 },
    btnPrimary: { flex: 2, backgroundColor: C.primary, borderRadius: radius.pill, paddingVertical: 16, alignItems: 'center' },
    btnDisabled: { opacity: 0.6 },
    btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  });
}
