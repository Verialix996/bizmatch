import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { showAlert } from '../../services/alert';
import useAppStore from '../../store/appStore';
import { colors, investorColors, radius, cardShadow, typography } from '../../theme';
import { listFounders, DIMENSION_LABELS } from '../../services/founders.service';
import { previewTeam, createTeam } from '../../services/teams.service';
import AppShell from '../../components/AppShell';
import { ADMIN_NAV_ITEMS } from '../../config/nav';
import { Avatar, Pill, ResponsiveRow, SectionCard } from '../../components/ui';

// MVP screen 9 — Team Creation: select founders, team name, member list,
// compatibility/skills/gaps summary before creating, Create Team -> Team Profile.
export default function TeamCreationScreen({ route, navigation }) {
  const darkMode = useAppStore(s => s.darkMode);
  const C = darkMode ? investorColors : colors;
  const styles = makeStyles(C);

  const [name, setName] = useState('');
  const [allFounders, setAllFounders] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set(route.params?.founderIds || []));
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // team_founders.founder_id is unique (one team per founder) — exclude
    // anyone already on a team so picking them can't hit that constraint.
    listFounders({}).then(({ data }) => setAllFounders(data.filter(f => f.teamStatus !== 'in_team'))).catch(() => {});
  }, []);

  const toggleFounder = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const loadPreview = useCallback(async () => {
    const ids = [...selectedIds];
    if (ids.length < 2) { setPreview(null); setPreviewError(false); return; }
    setPreviewing(true);
    setPreviewError(false);
    try {
      const { data } = await previewTeam(ids);
      setPreview(data.profile);
    } catch {
      setPreview(null);
      setPreviewError(true);
    } finally {
      setPreviewing(false);
    }
  }, [selectedIds]);

  useEffect(() => { loadPreview(); }, [loadPreview]);

  const handleCreate = async () => {
    if (!name.trim()) { showAlert('Missing Name', 'Give this team a name.'); return; }
    if (selectedIds.size < 2) { showAlert('Not Enough Members', 'Select at least two founders.'); return; }
    if (previewing) { showAlert('Please Wait', 'Still checking this team’s compatibility — try again in a moment.'); return; }
    // Creating without a successful preview means the evaluator never saw
    // the coverage/risk warnings the preview surfaces — block it rather
    // than let a transient failure silently skip that review step.
    if (previewError || !preview) {
      showAlert('Preview Unavailable', 'Could not check this team’s compatibility. Try again before creating.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await createTeam({ name: name.trim(), founderIds: [...selectedIds] });
      navigation.replace('TeamProfile', { teamId: data.id });
    } catch (err) {
      showAlert('Error', err.response?.data?.error || 'Could not create team.');
    } finally {
      setSaving(false);
    }
  };

  const selectedFounders = allFounders.filter(f => selectedIds.has(f.id));
  const unselectedFounders = allFounders.filter(f => !selectedIds.has(f.id));

  return (
    <AppShell navigation={navigation} active="teams" items={ADMIN_NAV_ITEMS}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backRow}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Team</Text>
        <Text style={styles.headerSubtitle}>Select founders and review compatibility before creating the team.</Text>

        <ResponsiveRow gap={16} style={{ marginTop: 20 }}>
          <View style={{ flex: 1, gap: 14 }}>
            <View style={styles.card}>
              <Text style={styles.label}>Team Name</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. FinBridge" placeholderTextColor={C.textHint} />
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Selected Founders ({selectedIds.size})</Text>
              {selectedFounders.length === 0 ? (
                <Text style={styles.emptyText}>No founders selected yet.</Text>
              ) : (
                selectedFounders.map(f => (
                  <View key={f.id} style={styles.selectedRow}>
                    <Avatar photoUrl={f.photoUrl} name={f.name} size={36} C={C} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.founderName}>{f.name || 'Unnamed'}</Text>
                      <Text style={styles.founderRole}>{f.role || ''}</Text>
                    </View>
                    <TouchableOpacity onPress={() => toggleFounder(f.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle" size={20} color={C.error} />
                    </TouchableOpacity>
                  </View>
                ))
              )}

              <Text style={[styles.label, { marginTop: 16 }]}>Add Founders</Text>
              {unselectedFounders.map(f => (
                <TouchableOpacity key={f.id} style={styles.checkRow} onPress={() => toggleFounder(f.id)} activeOpacity={0.7}>
                  <View style={styles.checkbox} />
                  <Avatar photoUrl={f.photoUrl} name={f.name} size={32} C={C} />
                  <Text style={styles.founderName}>{f.name || 'Unnamed'}</Text>
                  <Text style={styles.founderRole}>{f.role || ''}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <SectionCard title="Team Review" icon="git-compare-outline" C={C}>
              {selectedIds.size < 2 ? (
                <Text style={styles.emptyText}>Select at least two founders to preview compatibility.</Text>
              ) : previewing ? (
                <ActivityIndicator color={C.primary} />
              ) : preview ? (
                <>
                  <View style={styles.scoreBlock}>
                    <Text style={styles.previewScore}>{preview.compatibility ?? '—'}%</Text>
                    <Text style={styles.previewScoreLabel}>Compatibility</Text>
                  </View>

                  {preview.complementarySkills.length > 0 && (
                    <View style={styles.reviewSection}>
                      <Text style={styles.reviewLabel}>Complementary Skills</Text>
                      <View style={styles.chipWrap}>
                        {preview.complementarySkills.map(s => (
                          <Pill key={s} label={s} C={C} bg={C.successLight} color={C.success} />
                        ))}
                      </View>
                    </View>
                  )}

                  {preview.strengths.length > 0 && (
                    <View style={styles.reviewSection}>
                      <Text style={styles.reviewLabel}>Working Compatibility</Text>
                      {preview.strengths.map(d => (
                        <View key={d} style={styles.checkLine}>
                          <Ionicons name="checkmark-circle" size={16} color={C.success} />
                          <Text style={styles.checkLineText}>{DIMENSION_LABELS[d] || d}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {(preview.capabilityGaps.length > 0 || preview.potentialFriction.length > 0) && (
                    <View style={[styles.reviewSection, styles.riskBox]}>
                      <Text style={[styles.reviewLabel, { color: C.warning }]}>Potential Gaps / Risks</Text>
                      {preview.capabilityGaps.map(g => (
                        <Text key={g} style={styles.riskLine}>⚠ No coverage: {g}</Text>
                      ))}
                      {preview.potentialFriction.map((f, i) => (
                        <Text key={i} style={styles.riskLine}>⚠ {f}</Text>
                      ))}
                    </View>
                  )}
                </>
              ) : previewError ? (
                <Text style={[styles.emptyText, { color: C.error }]}>Couldn't check compatibility — Create is disabled until this succeeds.</Text>
              ) : (
                <Text style={styles.emptyText}>Not enough evidence yet to preview.</Text>
              )}
            </SectionCard>
          </View>
        </ResponsiveRow>

        <TouchableOpacity
          style={[styles.btnPrimary, (saving || previewError || previewing) && styles.btnDisabled]}
          onPress={handleCreate}
          disabled={saving || previewError || previewing}
          activeOpacity={0.85}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Create Team</Text>}
        </TouchableOpacity>
      </ScrollView>
    </AppShell>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    scrollContent: { padding: 20, paddingBottom: 48, maxWidth: 1100, width: '100%', alignSelf: 'center' },
    backRow: { marginBottom: 8 },
    backText: { color: C.primary, ...typography.labelLarge },
    headerTitle: { ...typography.displayMedium, color: C.textPrimary },
    headerSubtitle: { ...typography.bodyMedium, color: C.textSecondary, marginTop: 4 },

    card: { backgroundColor: C.surface, borderRadius: radius.lg, padding: 16, ...cardShadow },
    label: { ...typography.labelLarge, color: C.textSecondary, marginBottom: 10 },
    input: {
      backgroundColor: C.backgroundSoft, borderRadius: radius.md, padding: 12,
      color: C.textPrimary, fontSize: 14, borderWidth: 1, borderColor: C.surfaceBorder,
    },

    selectedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.surfaceBorder },
    checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
    checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: C.surfaceBorder },
    founderName: { ...typography.bodyMedium, color: C.textPrimary, fontWeight: '600' },
    founderRole: { ...typography.bodySmall, color: C.textHint, marginLeft: 'auto' },
    emptyText: { ...typography.bodyMedium, color: C.textHint },

    scoreBlock: { alignItems: 'center', marginBottom: 16 },
    previewScore: { fontSize: 36, fontWeight: '800', color: C.success },
    previewScoreLabel: { ...typography.bodySmall, color: C.textHint, marginTop: 2 },

    reviewSection: { marginBottom: 16 },
    reviewLabel: { ...typography.labelSmall, textTransform: 'uppercase', color: C.textHint, marginBottom: 8 },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    checkLine: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
    checkLineText: { ...typography.bodySmall, color: C.textPrimary },

    riskBox: { backgroundColor: C.warningLight, borderRadius: radius.md, padding: 12, marginBottom: 0 },
    riskLine: { ...typography.bodySmall, color: C.warning, marginTop: 4 },

    btnPrimary: { backgroundColor: C.primary, borderRadius: radius.pill, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
    btnDisabled: { opacity: 0.6 },
    btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  });
}
