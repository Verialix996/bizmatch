import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import useAppStore from '../../store/appStore';
import { colors, investorColors, radius, typography } from '../../theme';
import { listFounders } from '../../services/founders.service';
import { createProspectFounder, createFounderInterview } from '../../services/interviews.service';
import { showAlert } from '../../services/alert';
import AppShell from '../../components/AppShell';
import { ADMIN_NAV_ITEMS } from '../../config/nav';
import { SectionCard, Avatar } from '../../components/ui';

export default function NewInterviewScreen({ route, navigation }) {
  const darkMode = useAppStore(s => s.darkMode);
  const C = darkMode ? investorColors : colors;
  const styles = makeStyles(C);

  const preselectedFounderId = route.params?.founderId;
  const preselectedFounderName = route.params?.founderName;

  const [mode, setMode] = useState(preselectedFounderId ? 'existing' : 'existing');
  const [search, setSearch] = useState('');
  const [founders, setFounders] = useState([]);
  const [loadingFounders, setLoadingFounders] = useState(!preselectedFounderId);
  const [selected, setSelected] = useState(
    preselectedFounderId ? { id: preselectedFounderId, name: preselectedFounderName } : null,
  );

  const [prospect, setProspect] = useState({ name: '', email: '', roleTitle: '', industry: '', location: '' });

  const [ventureField, setVentureField] = useState('');
  const [ventureName, setVentureName] = useState('');
  const [starting, setStarting] = useState(false);

  const loadFounders = useCallback(async () => {
    if (preselectedFounderId) return;
    setLoadingFounders(true);
    try {
      const { data } = await listFounders({ search: search || undefined });
      setFounders(data);
    } catch {
      showAlert('Error', 'Could not load founders.');
    } finally {
      setLoadingFounders(false);
    }
  }, [search, preselectedFounderId]);

  useFocusEffect(useCallback(() => { loadFounders(); }, [loadFounders]));

  const startInterview = async () => {
    if (!ventureField.trim()) {
      showAlert('Missing field', 'Venture field is required to start the interview.');
      return;
    }
    setStarting(true);
    try {
      let founderId = selected?.id;
      let entrepreneurName = selected?.name;

      if (mode === 'new') {
        if (!prospect.name.trim() || !prospect.email.trim()) {
          showAlert('Missing fields', 'Name and email are required to add a new candidate.');
          setStarting(false);
          return;
        }
        const { data } = await createProspectFounder(prospect);
        founderId = data.id;
        entrepreneurName = prospect.name;
      }

      if (!founderId) {
        showAlert('Pick a founder', 'Select an existing founder or add a new candidate first.');
        setStarting(false);
        return;
      }

      const meta = {
        entrepreneurName,
        ventureField: ventureField.trim(),
        ventureName: ventureName.trim() || undefined,
        interviewDate: new Date().toISOString(),
      };
      const { data } = await createFounderInterview(founderId, meta);
      navigation.replace('InterviewRunner', { interviewId: data.id });
    } catch (err) {
      showAlert('Error', err.response?.data?.error || 'Could not start the interview.');
    } finally {
      setStarting(false);
    }
  };

  return (
    <AppShell navigation={navigation} active="founders" items={ADMIN_NAV_ITEMS}>
      <View style={styles.container}>
        <Text style={styles.title}>New Interview</Text>

        {!preselectedFounderId && (
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'existing' && styles.modeBtnActive]}
              onPress={() => setMode('existing')}
            >
              <Text style={[styles.modeBtnText, mode === 'existing' && styles.modeBtnTextActive]}>Existing Founder</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'new' && styles.modeBtnActive]}
              onPress={() => setMode('new')}
            >
              <Text style={[styles.modeBtnText, mode === 'new' && styles.modeBtnTextActive]}>New Candidate</Text>
            </TouchableOpacity>
          </View>
        )}

        {mode === 'existing' && !preselectedFounderId && (
          <SectionCard title="Pick a founder" icon="people-outline" C={C} style={{ marginTop: 16 }}>
            <TextInput
              style={styles.input}
              placeholder="Search founders by name"
              placeholderTextColor={C.textHint}
              value={search}
              onChangeText={setSearch}
            />
            {loadingFounders ? (
              <ActivityIndicator color={C.primary} style={{ marginTop: 16 }} />
            ) : (
              founders.map((f) => (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.founderRow, selected?.id === f.id && styles.founderRowSelected]}
                  onPress={() => setSelected({ id: f.id, name: f.name })}
                  activeOpacity={0.75}
                >
                  <Avatar photoUrl={f.photoUrl} name={f.name} size={36} C={C} />
                  <Text style={styles.founderName}>{f.name}</Text>
                </TouchableOpacity>
              ))
            )}
          </SectionCard>
        )}

        {preselectedFounderId && (
          <SectionCard title="Founder" icon="person-outline" C={C} style={{ marginTop: 16 }}>
            <Text style={styles.founderName}>{preselectedFounderName}</Text>
          </SectionCard>
        )}

        {mode === 'new' && !preselectedFounderId && (
          <SectionCard title="New candidate" icon="person-add-outline" C={C} style={{ marginTop: 16 }}>
            <Text style={styles.fieldLabel}>NAME</Text>
            <TextInput style={styles.input} placeholder="Full name" placeholderTextColor={C.textHint}
              value={prospect.name} onChangeText={(v) => setProspect({ ...prospect, name: v })} />
            <Text style={styles.fieldLabel}>EMAIL</Text>
            <TextInput style={styles.input} placeholder="email@example.com" placeholderTextColor={C.textHint}
              autoCapitalize="none" keyboardType="email-address"
              value={prospect.email} onChangeText={(v) => setProspect({ ...prospect, email: v })} />
            <Text style={styles.fieldLabel}>ROLE (optional)</Text>
            <TextInput style={styles.input} placeholder="e.g. Technical Co-Founder" placeholderTextColor={C.textHint}
              value={prospect.roleTitle} onChangeText={(v) => setProspect({ ...prospect, roleTitle: v })} />
            <Text style={styles.fieldLabel}>INDUSTRY (optional)</Text>
            <TextInput style={styles.input} placeholder="e.g. FinTech" placeholderTextColor={C.textHint}
              value={prospect.industry} onChangeText={(v) => setProspect({ ...prospect, industry: v })} />
          </SectionCard>
        )}

        <SectionCard title="Interview details" icon="mic-outline" C={C} style={{ marginTop: 16 }}>
          <Text style={styles.fieldLabel}>VENTURE FIELD</Text>
          <TextInput style={styles.input} placeholder="e.g. HealthTech" placeholderTextColor={C.textHint}
            value={ventureField} onChangeText={setVentureField} />
          <Text style={styles.fieldLabel}>VENTURE NAME (optional)</Text>
          <TextInput style={styles.input} placeholder="Startup name" placeholderTextColor={C.textHint}
            value={ventureName} onChangeText={setVentureName} />
        </SectionCard>

        <TouchableOpacity style={[styles.startBtn, starting && { opacity: 0.6 }]} onPress={startInterview} disabled={starting} activeOpacity={0.85}>
          {starting ? <ActivityIndicator color="#fff" /> : <Text style={styles.startBtnText}>Start Interview</Text>}
        </TouchableOpacity>
      </View>
    </AppShell>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    container: { padding: 20, maxWidth: 640, width: '100%', alignSelf: 'center' },
    title: { ...typography.displayMedium, color: C.textPrimary, marginBottom: 4 },

    modeRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
    modeBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.pill, alignItems: 'center', backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.surfaceBorder },
    modeBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
    modeBtnText: { fontWeight: '700', fontSize: 13, color: C.textSecondary },
    modeBtnTextActive: { color: '#fff' },

    fieldLabel: { ...typography.labelSmall, color: C.textSecondary, marginBottom: 8, marginTop: 14, textTransform: 'uppercase' },
    input: {
      backgroundColor: C.backgroundSoft, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 12,
      fontSize: 15, color: C.textPrimary, borderWidth: 1, borderColor: C.surfaceBorder,
    },

    founderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.surfaceBorder },
    founderRowSelected: { backgroundColor: C.surfaceElevated, borderRadius: radius.md },
    founderName: { ...typography.bodyMedium, fontWeight: '700', color: C.textPrimary },

    startBtn: { backgroundColor: C.primary, borderRadius: radius.pill, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
    startBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  });
}
