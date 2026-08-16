import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import { useState } from 'react';
import { radius, typography } from '../../theme';
import { DNA_QUESTIONS, DNA_DIMENSIONS } from '../../config/dnaQuestions';
import { DIMENSION_LABELS, submitDnaSelfAssessment } from '../../services/founders.service';

const MAX_CHARS = 450;

function emptyAnswers() {
  return DNA_DIMENSIONS.reduce((acc, dim) => { acc[dim] = ''; return acc; }, {});
}

// Reused both as an inline onboarding step (with onSkip, deferring
// completion) and as a standalone screen for founders who skipped it — one
// interview-grounded question per DNA dimension (v2: was 5 questions/dimension),
// scored by Gemini in the background into 'self' evidence rows (see
// supabase/functions/dna-self-assessment) — submitting no longer waits on
// that scoring to complete, so a slow/failed AI call can't block onboarding.
// `answers`/`onAnswersChange` are optional — when the caller controls them
// (OnboardingScreen lifts this state up so it's included in its own
// AsyncStorage draft autosave, which previously excluded DNA answers
// entirely), this component just renders/mutates the caller's state. The
// standalone DnaQuestionnaireScreen doesn't pass them, so it falls back to
// managing its own internal state as before.
export default function DnaQuestionnaire({
  founderId, onComplete, onSkip, onBack, C,
  answers: controlledAnswers, onAnswersChange, dimIndex: controlledDimIndex, onDimIndexChange,
}) {
  const styles = makeStyles(C);
  const [internalDimIndex, setInternalDimIndex] = useState(0);
  const [internalAnswers, setInternalAnswers] = useState(emptyAnswers);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const answers = controlledAnswers ?? internalAnswers;
  const setAnswers = onAnswersChange ?? setInternalAnswers;
  const dimIndex = controlledDimIndex ?? internalDimIndex;
  const setDimIndex = onDimIndexChange ?? setInternalDimIndex;

  const dim = DNA_DIMENSIONS[dimIndex];
  const question = DNA_QUESTIONS[dim];
  const isLast = dimIndex === DNA_DIMENSIONS.length - 1;
  const answer = answers[dim];

  const setAnswer = (text) => {
    setAnswers(prev => ({ ...prev, [dim]: text.slice(0, MAX_CHARS) }));
  };

  const goNext = async () => {
    setError('');
    const trimmed = answer.trim();
    // DNA-02: save this question's answer to the server as soon as it's
    // completed, rather than accumulating all 8 locally and only submitting
    // once on Finish — the endpoint already upserts one dimension at a time
    // (ON CONFLICT DO UPDATE), so this is safe to call once per question.
    // Fast save-and-respond — scoring itself happens in the background, so
    // this resolves as soon as the answer is persisted server-side.
    if (trimmed) {
      setSubmitting(true);
      try {
        await submitDnaSelfAssessment(founderId, { [dim]: answer });
      } catch (e) {
        setError(e.response?.data?.error || 'Could not save your answer. Please try again.');
        setSubmitting(false);
        return;
      }
      setSubmitting(false);
    }
    if (!isLast) {
      setDimIndex(dimIndex + 1);
      return;
    }
    onComplete?.();
  };

  const goBack = () => {
    setError('');
    if (dimIndex > 0) setDimIndex(dimIndex - 1);
    else onBack?.();
  };

  return (
    <View style={styles.container}>
      <View style={styles.progressRow}>
        {DNA_DIMENSIONS.map((d, i) => (
          <View key={d} style={[styles.progressDot, i <= dimIndex && { backgroundColor: C.primary }]} />
        ))}
      </View>
      <Text style={styles.progressLabel}>Question {dimIndex + 1} of {DNA_DIMENSIONS.length}</Text>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{DIMENSION_LABELS[dim]}</Text>
        <Text style={styles.question}>{question.text}</Text>
        <Text style={styles.hint}>Use a real example. Focus on what you personally did.</Text>

        <TextInput
          style={[styles.input, styles.inputMultiline]}
          multiline
          maxLength={MAX_CHARS}
          placeholder="Your answer… (optional — leave blank to skip this question)"
          placeholderTextColor={C.textHint}
          value={answer}
          onChangeText={setAnswer}
        />
        <Text style={styles.charCount}>{answer.length} / {MAX_CHARS}</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        {(dimIndex > 0 || onBack) && (
          <TouchableOpacity style={styles.btnOutline} onPress={goBack} disabled={submitting}>
            <Text style={styles.btnOutlineText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.btnPrimary, submitting && styles.btnDisabled]} onPress={goNext} disabled={submitting}>
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnPrimaryText}>{isLast ? 'Finish' : 'Next'}</Text>
          }
        </TouchableOpacity>
      </View>

      {onSkip ? (
        <TouchableOpacity onPress={onSkip} disabled={submitting} style={styles.skipRow}>
          <Text style={styles.skipText}>Skip for now — I'll fill this in later</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    container: { flex: 1 },
    progressRow: { flexDirection: 'row', gap: 4, paddingBottom: 6 },
    progressDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: C.surfaceBorder },
    progressLabel: { ...typography.labelSmall, color: C.textHint, marginBottom: 12 },

    scrollContent: { paddingBottom: 24 },
    title: { ...typography.displayMedium, color: C.textPrimary, marginBottom: 10 },
    question: { ...typography.bodyLarge, color: C.textPrimary, marginBottom: 6, lineHeight: 24 },
    hint: { ...typography.bodySmall, color: C.textHint, marginBottom: 16, fontStyle: 'italic' },

    input: {
      backgroundColor: C.surface, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 14,
      fontSize: 15, color: C.textPrimary, borderWidth: 1, borderColor: C.surfaceBorder,
    },
    inputMultiline: { height: 180, textAlignVertical: 'top' },
    charCount: { ...typography.caption, color: C.textHint, textAlign: 'right', marginTop: 6 },

    errorText: { color: C.error, fontSize: 13, textAlign: 'center', marginTop: 16 },

    footer: { flexDirection: 'row', gap: 12, paddingTop: 16 },
    btnOutline: {
      flex: 1, borderRadius: radius.pill, paddingVertical: 16, alignItems: 'center',
      borderWidth: 1.5, borderColor: C.surfaceBorder,
    },
    btnOutlineText: { color: C.textSecondary, fontWeight: '700', fontSize: 14 },
    btnPrimary: { flex: 2, backgroundColor: C.primary, borderRadius: radius.pill, paddingVertical: 16, alignItems: 'center' },
    btnDisabled: { opacity: 0.6 },
    btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 14 },

    skipRow: { alignItems: 'center', paddingTop: 14 },
    skipText: { color: C.textHint, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
  });
}
