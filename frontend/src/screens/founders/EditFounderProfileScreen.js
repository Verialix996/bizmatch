import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Platform, Linking,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { showAlert } from '../../services/alert';
import useAuthStore from '../../store/authStore';
import useAppStore from '../../store/appStore';
import { colors, investorColors, radius, typography } from '../../theme';
import {
  getFounder, updateFounderProfile, updateFounderCapabilities,
  updatePartnerRequirements, updateDealBreakers, CAPABILITIES,
  uploadFounderCv, uploadFounderCvWeb,
} from '../../services/founders.service';
import AppShell from '../../components/AppShell';
import CapabilityPriorityList from '../../components/founder/CapabilityPriorityList';
import { ADMIN_NAV_ITEMS, FOUNDER_NAV_ITEMS } from '../../config/nav';
import { SectionCard, useIsDesktop } from '../../components/ui';

const STAGES = ['idea', 'mvp', 'growth', 'scale'];
const STAGE_LABELS = { idea: 'Idea', mvp: 'MVP', growth: 'Growth', scale: 'Scale' };
const COMMITMENT_TYPES = ['full_time', 'part_time'];
const COMMITMENT_LABELS = { full_time: 'Full Time', part_time: 'Part Time' };
const DEAL_BREAKER_SUGGESTIONS = ['Dishonesty', 'Part-time', 'Low accountability', 'Major values mismatch'];

// The backend still stores a per-capability `score` (used elsewhere), but the
// UI is now a ranked priority list rather than a numeric rating — this
// derives that score from list position (top = highest) right before saving.
function scoreByRank(list) {
  return list.map((item, index) => ({ ...item, score: Math.max(10, 100 - index * 10) }));
}

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

function TagList({ items, onRemove, C, styles }) {
  if (!items.length) return null;
  return (
    <View style={styles.chipRow}>
      {items.map((item) => (
        <View key={item} style={[styles.tag, { borderColor: C.primary }]}>
          <Text style={styles.tagText}>{item}</Text>
          <TouchableOpacity onPress={() => onRemove(item)} hitSlop={8}>
            <Ionicons name="close" size={13} color={C.primary} />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

function TagInput({ placeholder, onAdd, C, styles }) {
  const [value, setValue] = useState('');
  const submit = () => {
    const trimmed = value.trim();
    if (trimmed) onAdd(trimmed);
    setValue('');
  };
  return (
    <View style={styles.tagInputRow}>
      <TextInput
        style={[styles.input, { flex: 1 }]}
        placeholder={placeholder}
        placeholderTextColor={C.textHint}
        value={value}
        onChangeText={setValue}
        onSubmitEditing={submit}
        returnKeyType="done"
      />
      <TouchableOpacity style={styles.addBtn} onPress={submit} activeOpacity={0.85}>
        <Ionicons name="add" size={18} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

export default function EditFounderProfileScreen({ route, navigation }) {
  const currentUser = useAuthStore(s => s.user);
  const darkMode = useAppStore(s => s.darkMode);
  const C = darkMode ? investorColors : colors;
  const styles = makeStyles(C);
  const isDesktop = useIsDesktop();

  const founderId = route.params?.founderId || currentUser?.id;
  const isAdmin = currentUser?.role === 'admin';
  const navItems = isAdmin ? ADMIN_NAV_ITEMS : FOUNDER_NAV_ITEMS;
  const activeNav = isAdmin ? 'founders' : 'home';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [basics, setBasics] = useState({ role_title: '', venture_name: '', industry: '', location: '', current_stage: '' });
  const [commitment, setCommitment] = useState({ commitment_hours: '', commitment_type: '', commitment_risk_appetite: '' });
  const [provides, setProvides] = useState([]); // [{ capability, score }]
  const [needs, setNeeds] = useState([]);
  const [partner, setPartner] = useState({ role_wanted: '', commitment_required: '', ambition_required: '' });
  const [mustProvide, setMustProvide] = useState([]);
  const [preferredTraits, setPreferredTraits] = useState([]);
  const [dealBreakers, setDealBreakers] = useState([]);
  const [cvUrl, setCvUrl] = useState(null);
  const [cvUploading, setCvUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: founder } = await getFounder(founderId);
      setBasics({
        role_title: founder.currentRole || '',
        venture_name: founder.ventureName || '',
        industry: founder.industry || '',
        location: founder.location || '',
        current_stage: founder.currentStage || '',
      });
      setCommitment({
        commitment_hours: founder.commitmentHours != null ? String(founder.commitmentHours) : '',
        commitment_type: founder.commitmentType || '',
        commitment_risk_appetite: founder.commitmentRiskAppetite || '',
      });
      setProvides(founder.provides || []);
      setNeeds(founder.needs || []);
      setPartner({
        role_wanted: founder.partnerRequirements?.roleWanted || '',
        commitment_required: founder.partnerRequirements?.commitmentRequired || '',
        ambition_required: founder.partnerRequirements?.ambitionRequired || '',
      });
      setMustProvide(founder.partnerRequirements?.mustProvide || []);
      setPreferredTraits(founder.partnerRequirements?.preferredTraits || []);
      setDealBreakers(founder.dealBreakers || []);
      setCvUrl(founder.cvUrl || null);
    } catch {
      showAlert('Error', 'Could not load your profile.');
    } finally {
      setLoading(false);
    }
  }, [founderId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handlePickCv = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];

    setCvUploading(true);
    try {
      const { data } = Platform.OS === 'web' && asset.file
        ? await uploadFounderCvWeb(founderId, asset.file, asset.name || 'cv.pdf')
        : await uploadFounderCv(founderId, asset.uri, asset.name || 'cv.pdf');
      setCvUrl(data.cvUrl);
    } catch (err) {
      showAlert('Error', err.response?.data?.error || 'Could not upload CV.');
    } finally {
      setCvUploading(false);
    }
  };

  const toggleCapability = (list, setList, capability) => {
    if (list.some(c => c.capability === capability)) {
      setList(list.filter(c => c.capability !== capability));
    } else {
      setList([...list, { capability, score: 0 }]);
    }
  };
  const toggleMustProvide = (capability) => {
    setMustProvide(mustProvide.includes(capability) ? mustProvide.filter(c => c !== capability) : [...mustProvide, capability]);
  };
  const toggleDealBreakerSuggestion = (label) => {
    setDealBreakers(dealBreakers.includes(label) ? dealBreakers.filter(d => d !== label) : [...dealBreakers, label]);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      // Unlike onboarding's first-time save, this founder_profiles row is
      // guaranteed to already exist (you can only reach Edit Profile after
      // onboarding completes) — no creation-order dependency, so every write
      // here is safe to run together.
      await Promise.all([
        updateFounderProfile(founderId, {
          ...basics,
          commitment_hours: commitment.commitment_hours ? Number(commitment.commitment_hours) : null,
          commitment_type: commitment.commitment_type || null,
          commitment_risk_appetite: commitment.commitment_risk_appetite || null,
        }),
        updateFounderCapabilities(founderId, 'provide', scoreByRank(provides)),
        updateFounderCapabilities(founderId, 'need', scoreByRank(needs)),
        updatePartnerRequirements(founderId, {
          ...partner,
          must_provide: mustProvide,
          preferred_traits: preferredTraits,
        }),
        updateDealBreakers(founderId, dealBreakers),
      ]);
      navigation.goBack();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppShell navigation={navigation} active={activeNav} items={navItems}>
        <View style={styles.centered}><ActivityIndicator size="large" color={C.primary} /></View>
      </AppShell>
    );
  }

  return (
    <AppShell navigation={navigation} active={activeNav} items={navItems}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.titleRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backRow}>
            <Ionicons name="arrow-back" size={16} color={C.primary} />
            <Text style={styles.backText}>Founder Profile</Text>
          </TouchableOpacity>
          <Text style={styles.pageTitle}>Edit Profile</Text>
        </View>

        <SectionCard title="Basics" icon="person-outline" C={C} style={styles.card}>
          <Text style={styles.fieldLabel}>ROLE / BACKGROUND</Text>
          <TextInput style={styles.input} placeholder="e.g. Technical Co-Founder" placeholderTextColor={C.textHint}
            value={basics.role_title} onChangeText={(v) => setBasics({ ...basics, role_title: v })} />

          <Text style={styles.fieldLabel}>VENTURE NAME</Text>
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
        </SectionCard>

        <SectionCard title="Commitment" icon="time-outline" C={C} style={styles.card}>
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

          <Text style={styles.fieldLabel}>RISK APPETITE</Text>
          <TextInput style={[styles.input, styles.inputMultiline]} multiline
            placeholder="How much risk are you willing to take on this venture?" placeholderTextColor={C.textHint}
            value={commitment.commitment_risk_appetite}
            onChangeText={(v) => setCommitment({ ...commitment, commitment_risk_appetite: v })} />
        </SectionCard>

        <SectionCard title="Capability profile" icon="bar-chart-outline" C={C} style={styles.card}>
          <Text style={styles.fieldLabel}>WHAT YOU PROVIDE</Text>
          <View style={styles.chipRow}>
            {CAPABILITIES.map(c => (
              <Chip key={c} label={c} selected={provides.some(p => p.capability === c)}
                onPress={() => toggleCapability(provides, setProvides, c)} C={C} styles={styles} />
            ))}
          </View>
          {provides.length > 0 && (
            <Text style={styles.helperText}>Order these by priority — use the arrows to move your strongest capability to the top.</Text>
          )}
          <CapabilityPriorityList items={provides} onChange={setProvides} C={C} color={C.primary} />

          <Text style={[styles.fieldLabel, { marginTop: 20 }]}>WHAT YOU NEED</Text>
          <View style={styles.chipRow}>
            {CAPABILITIES.map(c => (
              <Chip key={c} label={c} selected={needs.some(n => n.capability === c)}
                onPress={() => toggleCapability(needs, setNeeds, c)} C={C} styles={styles} />
            ))}
          </View>
          {needs.length > 0 && (
            <Text style={styles.helperText}>Order these by priority — use the arrows to move what matters most to the top.</Text>
          )}
          <CapabilityPriorityList items={needs} onChange={setNeeds} C={C} color={C.warning} />
        </SectionCard>

        <SectionCard title="Resume / CV" icon="document-text-outline" C={C} style={styles.card}>
          {cvUrl ? (
            <View style={styles.cvRow}>
              <TouchableOpacity style={styles.cvViewBtn} onPress={() => Linking.openURL(cvUrl)} activeOpacity={0.75}>
                <Ionicons name="document-text" size={16} color={C.primary} />
                <Text style={styles.cvViewText}>View current CV</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnOutline} onPress={handlePickCv} disabled={cvUploading} activeOpacity={0.85}>
                {cvUploading ? <ActivityIndicator color={C.textSecondary} /> : <Text style={styles.btnOutlineText}>Replace</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={[styles.btnPrimary, { maxWidth: 220 }, cvUploading && styles.btnDisabled]} onPress={handlePickCv} disabled={cvUploading} activeOpacity={0.85}>
              {cvUploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Upload CV (PDF)</Text>}
            </TouchableOpacity>
          )}
        </SectionCard>

        <SectionCard title="Partner requirements" icon="person-add-outline" C={C} style={styles.card}>
          <Text style={styles.fieldLabel}>ROLE WANTED</Text>
          <TextInput style={styles.input} placeholder="e.g. Technical Co-Founder" placeholderTextColor={C.textHint}
            value={partner.role_wanted} onChangeText={(v) => setPartner({ ...partner, role_wanted: v })} />

          <Text style={styles.fieldLabel}>COMMITMENT REQUIRED</Text>
          <TextInput style={styles.input} placeholder="e.g. Full Time" placeholderTextColor={C.textHint}
            value={partner.commitment_required} onChangeText={(v) => setPartner({ ...partner, commitment_required: v })} />

          <Text style={styles.fieldLabel}>AMBITION</Text>
          <TextInput style={styles.input} placeholder="e.g. Venture Scale" placeholderTextColor={C.textHint}
            value={partner.ambition_required} onChangeText={(v) => setPartner({ ...partner, ambition_required: v })} />

          <Text style={[styles.fieldLabel, { marginTop: 20 }]}>MUST PROVIDE</Text>
          <View style={styles.chipRow}>
            {CAPABILITIES.map(c => (
              <Chip key={c} label={c} selected={mustProvide.includes(c)}
                onPress={() => toggleMustProvide(c)} C={C} styles={styles} />
            ))}
          </View>

          <Text style={[styles.fieldLabel, { marginTop: 20 }]}>PREFERRED TRAITS</Text>
          <TagList items={preferredTraits} onRemove={(t) => setPreferredTraits(preferredTraits.filter(x => x !== t))} C={C} styles={styles} />
          <TagInput placeholder="e.g. Long-term commitment & resilience" onAdd={(t) => setPreferredTraits([...preferredTraits, t])} C={C} styles={styles} />
        </SectionCard>

        <SectionCard title="Deal breakers" icon="close-circle-outline" C={C} style={styles.card}>
          <Text style={styles.fieldLabel}>QUICK ADD</Text>
          <View style={styles.chipRow}>
            {DEAL_BREAKER_SUGGESTIONS.map(d => (
              <Chip key={d} label={d} selected={dealBreakers.includes(d)}
                onPress={() => toggleDealBreakerSuggestion(d)} C={C} styles={styles} />
            ))}
          </View>

          <Text style={[styles.fieldLabel, { marginTop: 20 }]}>YOUR DEAL BREAKERS</Text>
          <TagList items={dealBreakers} onRemove={(d) => setDealBreakers(dealBreakers.filter(x => x !== d))} C={C} styles={styles} />
          <TagInput placeholder="e.g. Avoids conflict or difficult conversations" onAdd={(d) => setDealBreakers([...dealBreakers, d])} C={C} styles={styles} />
        </SectionCard>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={[styles.footer, isDesktop && styles.footerDesktop]}>
          <TouchableOpacity style={styles.btnOutline} onPress={() => navigation.goBack()} disabled={saving}>
            <Text style={styles.btnOutlineText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btnPrimary, saving && styles.btnDisabled]} onPress={handleSave} disabled={saving}>
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnPrimaryText}>Save Changes</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </AppShell>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
    scrollContent: { paddingBottom: 48, paddingHorizontal: 20, maxWidth: 800, width: '100%', alignSelf: 'center' },

    titleRow: { marginTop: 20, marginBottom: 16 },
    backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    backText: { color: C.primary, ...typography.labelLarge },
    pageTitle: { ...typography.displayMedium, color: C.textPrimary },

    card: { marginBottom: 16 },

    fieldLabel: { ...typography.labelSmall, color: C.textSecondary, marginBottom: 8, marginTop: 14, textTransform: 'uppercase' },
    helperText: { ...typography.caption, color: C.textHint, marginTop: 8 },
    input: {
      backgroundColor: C.backgroundSoft, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 12,
      fontSize: 15, color: C.textPrimary, borderWidth: 1, borderColor: C.surfaceBorder,
    },
    inputMultiline: { height: 80, textAlignVertical: 'top' },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9,
      backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.surfaceBorder,
    },
    chipText: { fontSize: 13, fontWeight: '600', color: C.textSecondary },

    tag: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1,
    },
    tagText: { fontSize: 12, fontWeight: '600', color: C.textPrimary },
    tagInputRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
    addBtn: { backgroundColor: C.primary, borderRadius: radius.md, width: 44, alignItems: 'center', justifyContent: 'center' },

    cvRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
    cvViewBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1,
      backgroundColor: C.backgroundSoft, borderRadius: radius.md, borderWidth: 1, borderColor: C.surfaceBorder,
      paddingHorizontal: 14, paddingVertical: 12,
    },
    cvViewText: { color: C.primary, fontWeight: '700', fontSize: 13 },

    errorText: { color: C.error, fontSize: 13, textAlign: 'center', marginTop: 8, marginBottom: 8 },

    footer: { flexDirection: 'row', gap: 12, marginTop: 8 },
    footerDesktop: { justifyContent: 'flex-end' },
    btnOutline: {
      flex: 1, borderRadius: radius.pill, paddingVertical: 14, alignItems: 'center',
      borderWidth: 1.5, borderColor: C.surfaceBorder, maxWidth: 160,
    },
    btnOutlineText: { color: C.textSecondary, fontWeight: '700', fontSize: 14 },
    btnPrimary: { flex: 2, backgroundColor: C.primary, borderRadius: radius.pill, paddingVertical: 14, alignItems: 'center', maxWidth: 220 },
    btnDisabled: { opacity: 0.6 },
    btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  });
}
