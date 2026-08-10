import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, SafeAreaView, StatusBar, ActivityIndicator,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { showAlert } from '../../services/alert';
import useAppStore from '../../store/appStore';
import { colors, investorColors, radius, cardShadow, typography } from '../../theme';
import { listFounders, DIMENSION_LABELS } from '../../services/founders.service';
import { previewTeam, createTeam } from '../../services/teams.service';

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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listFounders({}).then(({ data }) => setAllFounders(data)).catch(() => {});
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
    if (ids.length < 2) { setPreview(null); return; }
    setPreviewing(true);
    try {
      const { data } = await previewTeam(ids);
      setPreview(data.profile);
    } catch {
      setPreview(null);
    } finally {
      setPreviewing(false);
    }
  }, [selectedIds]);

  useEffect(() => { loadPreview(); }, [loadPreview]);

  const handleCreate = async () => {
    if (!name.trim()) { showAlert('Missing Name', 'Give this team a name.'); return; }
    if (selectedIds.size < 2) { showAlert('Not Enough Members', 'Select at least two founders.'); return; }
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Team</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.label}>Team Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Team Alpha" placeholderTextColor={C.textHint} />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Members ({selectedIds.size} selected)</Text>
          {allFounders.map(f => (
            <TouchableOpacity key={f.id} style={styles.checkRow} onPress={() => toggleFounder(f.id)} activeOpacity={0.7}>
              <View style={[styles.checkbox, selectedIds.has(f.id) && styles.checkboxChecked]} />
              <Text style={styles.founderName}>{f.name || 'Unnamed'}</Text>
              <Text style={styles.founderRole}>{f.role || ''}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {selectedIds.size >= 2 && (
          <View style={styles.card}>
            <Text style={styles.label}>Preview</Text>
            {previewing ? (
              <ActivityIndicator color={C.primary} />
            ) : preview ? (
              <>
                <Text style={styles.previewScore}>{preview.compatibility ?? '—'}</Text>
                <Text style={styles.previewScoreLabel}>Compatibility</Text>
                {preview.complementarySkills.length > 0 && (
                  <Text style={styles.previewLine}>Skills: {preview.complementarySkills.join(', ')}</Text>
                )}
                {preview.capabilityGaps.length > 0 && (
                  <Text style={[styles.previewLine, { color: C.warning }]}>Gaps: {preview.capabilityGaps.join(', ')}</Text>
                )}
                {preview.strengths.length > 0 && (
                  <Text style={styles.previewLine}>Strengths: {preview.strengths.map(d => DIMENSION_LABELS[d]).join(', ')}</Text>
                )}
              </>
            ) : (
              <Text style={styles.emptyText}>Not enough evidence yet to preview.</Text>
            )}
          </View>
        )}

        <TouchableOpacity style={[styles.btnPrimary, saving && styles.btnDisabled]} onPress={handleCreate} disabled={saving} activeOpacity={0.85}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Create Team</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.backgroundSoft },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingVertical: 14, backgroundColor: C.surface,
      borderBottomWidth: 1, borderBottomColor: C.surfaceBorder,
    },
    backText: { color: C.primary, ...typography.labelLarge },
    headerTitle: { ...typography.titleMedium, color: C.textPrimary },
    scrollContent: { padding: 20, paddingBottom: 48 },
    card: { backgroundColor: C.surface, borderRadius: radius.lg, padding: 16, marginBottom: 14, ...cardShadow },
    label: { ...typography.labelLarge, color: C.textSecondary, marginBottom: 10 },
    input: {
      backgroundColor: C.backgroundSoft, borderRadius: radius.md, padding: 12,
      color: C.textPrimary, fontSize: 14, borderWidth: 1, borderColor: C.surfaceBorder,
    },
    checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
    checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: C.surfaceBorder },
    checkboxChecked: { backgroundColor: C.primary, borderColor: C.primary },
    founderName: { ...typography.bodyMedium, color: C.textPrimary, flex: 1 },
    founderRole: { ...typography.bodySmall, color: C.textHint },
    emptyText: { ...typography.bodyMedium, color: C.textHint },
    previewScore: { fontSize: 32, fontWeight: '800', color: C.primary, textAlign: 'center' },
    previewScoreLabel: { ...typography.bodySmall, color: C.textHint, textAlign: 'center', marginBottom: 10 },
    previewLine: { ...typography.bodyMedium, color: C.textPrimary, marginTop: 6 },
    btnPrimary: { backgroundColor: C.primary, borderRadius: radius.pill, paddingVertical: 16, alignItems: 'center' },
    btnDisabled: { opacity: 0.6 },
    btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  });
}
