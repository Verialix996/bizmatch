import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { showAlert } from '../../services/alert';
import useAuthStore from '../../store/authStore';
import useAppStore from '../../store/appStore';
import { colors, investorColors, radius, cardShadow, typography } from '../../theme';
import { submitAssessment, getFounder } from '../../services/founders.service';
import AppShell from '../../components/AppShell';
import { ADMIN_NAV_ITEMS, FOUNDER_NAV_ITEMS } from '../../config/nav';
import { Avatar } from '../../components/ui';

// Interview / Evaluation form (MVP screen 6) — one question per canonical
// evidence dimension (must match _shared/founderScoring.ts's DIMENSIONS
// exactly — previously this asked about "execution" twice and never asked
// about "values" at all, so a submitted evaluation silently never produced
// Values evidence no matter how many questions were answered).
const QUESTIONS = [
  { key: 'execution_scale', text: 'How would you rate their execution and follow-through?', type: 'scale_1_5', dimension: 'execution' },
  { key: 'integrity_scale', text: 'How honest and consistent were they between words and actions?', type: 'scale_1_5', dimension: 'integrity' },
  { key: 'commitment_scale', text: 'How committed and available did they seem?', type: 'scale_1_5', dimension: 'commitment' },
  { key: 'communication_scale', text: 'How direct and clear was their communication?', type: 'scale_1_5', dimension: 'communication' },
  { key: 'conflict_scale', text: 'How did they handle disagreement or critique?', type: 'scale_1_5', dimension: 'conflict' },
  { key: 'resilience_scale', text: 'How did they handle pressure or setbacks?', type: 'scale_1_5', dimension: 'resilience' },
  { key: 'ego_yesno', text: 'Were they coachable and open to feedback?', type: 'yes_no', dimension: 'ego' },
  { key: 'values_scale', text: 'How well did their actions reflect a clear, consistent set of values?', type: 'scale_1_5', dimension: 'values' },
];

function ScaleInput({ value, onChange, C }) {
  return (
    <View style={styles.scaleRow}>
      {[1, 2, 3, 4, 5].map(n => (
        <TouchableOpacity
          key={n}
          style={[styles.scaleBtn, { borderColor: C.surfaceBorder }, value === n && { backgroundColor: C.primary, borderColor: C.primary }]}
          onPress={() => onChange(n)}
          activeOpacity={0.8}
        >
          <Text style={[styles.scaleBtnText, { color: value === n ? '#fff' : C.textSecondary }]}>{n}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function YesNoInput({ value, onChange, C }) {
  return (
    <View style={styles.yesNoRow}>
      <TouchableOpacity
        style={[styles.yesNoBtn, { borderColor: C.surfaceBorder }, value === true && { backgroundColor: C.success, borderColor: C.success }]}
        onPress={() => onChange(true)}
        activeOpacity={0.8}
      >
        <Text style={[styles.yesNoBtnText, { color: value === true ? '#fff' : C.textSecondary }]}>Yes</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.yesNoBtn, { borderColor: C.surfaceBorder }, value === false && { backgroundColor: C.error, borderColor: C.error }]}
        onPress={() => onChange(false)}
        activeOpacity={0.8}
      >
        <Text style={[styles.yesNoBtnText, { color: value === false ? '#fff' : C.textSecondary }]}>No</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function EvaluationScreen({ route, navigation }) {
  const founderId = route.params?.founderId;
  const activityId = route.params?.activityId;
  const isAdmin = useAuthStore(s => s.user?.role === 'admin');
  const darkMode = useAppStore(s => s.darkMode);
  const C = darkMode ? investorColors : colors;
  const styles2 = makeStyles(C);

  const [founder, setFounder] = useState(null);
  const [answers, setAnswers] = useState({});
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadFounder = useCallback(async () => {
    if (!founderId) return;
    try {
      const { data } = await getFounder(founderId);
      setFounder(data);
    } catch { /* silent — header just omits the founder card */ }
  }, [founderId]);

  useEffect(() => { loadFounder(); }, [loadFounder]);

  const setAnswer = (key, value) => setAnswers(prev => ({ ...prev, [key]: value }));

  const answeredCount = QUESTIONS.filter(q => answers[q.key] !== undefined).length;
  const progressPct = Math.round((answeredCount / QUESTIONS.length) * 100);

  const handleSubmit = async () => {
    if (answeredCount < QUESTIONS.length) {
      setError(`Answer all ${QUESTIONS.length} questions before submitting — a partial evaluation would leave some dimensions with no evidence at all.`);
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const items = QUESTIONS.filter(q => answers[q.key] !== undefined).map(q => ({
        questionText: q.text,
        answerType: q.type,
        answer: answers[q.key],
        criteriaTag: q.dimension,
      }));
      await submitAssessment({ founderId, activityId: activityId ?? null, notes: notes.trim() || null, items });
      showAlert('Evaluation Submitted', 'Data added to founder profile.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit evaluation.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell navigation={navigation} active="founders" items={isAdmin ? ADMIN_NAV_ITEMS : FOUNDER_NAV_ITEMS}>
      <ScrollView contentContainerStyle={styles2.scrollContent} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles2.backRow}>
          <Text style={styles2.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles2.headerTitle}>Founder Evaluation</Text>

        {founder ? (
          <View style={styles2.founderCard}>
            <Avatar photoUrl={founder.photoUrl} name={founder.name} size={48} C={C} />
            <View style={{ flex: 1 }}>
              <Text style={styles2.founderName}>{founder.name || 'Unnamed'}</Text>
              {founder.currentRole ? <Text style={styles2.founderRole}>{founder.currentRole}</Text> : null}
            </View>
          </View>
        ) : null}

        <View style={styles2.progressCard}>
          <Text style={styles2.progressLabel}>{answeredCount} of {QUESTIONS.length} questions answered</Text>
          <View style={styles2.progressTrack}>
            <View style={[styles2.progressFill, { width: `${progressPct}%` }]} />
          </View>
        </View>

        {QUESTIONS.map((q) => (
          <View key={q.key} style={styles2.card}>
            <Text style={styles2.question}>{q.text}</Text>
            {q.type === 'scale_1_5' ? (
              <ScaleInput value={answers[q.key]} onChange={(v) => setAnswer(q.key, v)} C={C} />
            ) : (
              <YesNoInput value={answers[q.key]} onChange={(v) => setAnswer(q.key, v)} C={C} />
            )}
          </View>
        ))}

        <View style={styles2.card}>
          <Text style={styles2.question}>Additional observations (optional)</Text>
          <TextInput
            style={styles2.notesInput}
            multiline
            placeholder="Open notes about this founder's performance..."
            placeholderTextColor={C.textHint}
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        {error ? <Text style={styles2.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles2.btnPrimary, submitting && styles2.btnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles2.btnPrimaryText}>Submit Evaluation ({answeredCount}/{QUESTIONS.length})</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scaleRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  scaleBtn: { flex: 1, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center' },
  scaleBtnText: { fontWeight: '700', fontSize: 15 },
  yesNoRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  yesNoBtn: { flex: 1, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center' },
  yesNoBtnText: { fontWeight: '700', fontSize: 14 },
});

function makeStyles(C) {
  return StyleSheet.create({
    scrollContent: { padding: 20, paddingBottom: 48, maxWidth: 800, width: '100%', alignSelf: 'center' },
    backRow: { marginBottom: 8 },
    backText: { color: C.primary, ...typography.labelLarge },
    headerTitle: { ...typography.displayMedium, color: C.textPrimary, marginBottom: 16 },

    founderCard: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: C.surface, borderRadius: radius.lg, padding: 16, marginBottom: 14, ...cardShadow,
    },
    founderName: { ...typography.titleSmall, color: C.textPrimary },
    founderRole: { ...typography.bodySmall, color: C.textSecondary, marginTop: 2 },

    progressCard: { backgroundColor: C.surface, borderRadius: radius.lg, padding: 16, marginBottom: 14, ...cardShadow },
    progressLabel: { ...typography.bodySmall, color: C.textSecondary, marginBottom: 8, fontWeight: '600' },
    progressTrack: { height: 8, borderRadius: radius.sm, backgroundColor: C.surfaceElevated, overflow: 'hidden' },
    progressFill: { height: 8, borderRadius: radius.sm, backgroundColor: C.primary },

    card: { backgroundColor: C.surface, borderRadius: radius.lg, padding: 16, marginBottom: 14, ...cardShadow },
    question: { ...typography.bodyLarge, fontWeight: '600', color: C.textPrimary, marginBottom: 10 },
    notesInput: {
      backgroundColor: C.backgroundSoft, borderRadius: radius.md, padding: 14, minHeight: 90,
      textAlignVertical: 'top', color: C.textPrimary, fontSize: 14,
    },
    errorText: { color: C.error, textAlign: 'center', marginBottom: 12, fontSize: 13 },
    btnPrimary: { backgroundColor: C.primary, borderRadius: radius.pill, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
    btnDisabled: { opacity: 0.6 },
    btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  });
}
