import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, ScrollView, StatusBar, ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { showAlert } from '../../services/alert';
import useAppStore from '../../store/appStore';
import { colors, investorColors, radius, cardShadow, typography } from '../../theme';
import { submitAssessment } from '../../services/founders.service';

// Interview / Evaluation form (MVP screen 6) — mixes open questions, 1-5
// scales, and yes/no, per the reconciled screen spec. Each scaled/yes-no
// answer is tagged with a dimension so the backend can fan it out into
// evidence; the open question is captured as evaluation notes only.
const QUESTIONS = [
  { key: 'execution_scale', text: 'How would you rate their execution and follow-through?', type: 'scale_1_5', dimension: 'execution' },
  { key: 'execution_ownership', text: 'Did they take ownership without being asked?', type: 'yes_no', dimension: 'execution' },
  { key: 'integrity_scale', text: 'How honest and consistent were they between words and actions?', type: 'scale_1_5', dimension: 'integrity' },
  { key: 'commitment_scale', text: 'How committed and available did they seem?', type: 'scale_1_5', dimension: 'commitment' },
  { key: 'communication_scale', text: 'How direct and clear was their communication?', type: 'scale_1_5', dimension: 'communication' },
  { key: 'conflict_scale', text: 'How did they handle disagreement or critique?', type: 'scale_1_5', dimension: 'conflict' },
  { key: 'resilience_scale', text: 'How did they handle pressure or setbacks?', type: 'scale_1_5', dimension: 'resilience' },
  { key: 'ego_yesno', text: 'Were they coachable and open to feedback?', type: 'yes_no', dimension: 'ego' },
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
  const darkMode = useAppStore(s => s.darkMode);
  const C = darkMode ? investorColors : colors;
  const styles2 = makeStyles(C);

  const [answers, setAnswers] = useState({});
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const setAnswer = (key, value) => setAnswers(prev => ({ ...prev, [key]: value }));

  const answeredCount = QUESTIONS.filter(q => answers[q.key] !== undefined).length;

  const handleSubmit = async () => {
    if (answeredCount === 0) {
      setError('Answer at least one question before submitting.');
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
      await submitAssessment({ founderId, notes: notes.trim() || null, items });
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
    <SafeAreaView style={styles2.container}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      <View style={styles2.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles2.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles2.headerTitle}>Add Evaluation</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles2.scrollContent} keyboardShouldPersistTaps="handled">
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
    </SafeAreaView>
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
