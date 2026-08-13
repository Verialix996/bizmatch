import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import { useState } from 'react';
import { radius, typography } from '../../theme';
import { DNA_QUESTIONS, DNA_DIMENSIONS } from '../../config/dnaQuestions';
import { DIMENSION_LABELS, submitDnaSelfAssessment } from '../../services/founders.service';

function emptyAnswers() {
  return DNA_DIMENSIONS.reduce((acc, dim) => {
    acc[dim] = DNA_QUESTIONS[dim].map(() => '');
    return acc;
  }, {});
}

// Reused both as an inline onboarding step (with onSkip, deferring
// completion) and as a standalone screen for founders who skipped it —
// scores 5 open-ended answers per DNA dimension via Gemini into 'self'
// evidence rows (see supabase/functions/dna-self-assessment).
export default function DnaQuestionnaire({ founderId, onComplete, onSkip, onBack, C }) {
  const styles = makeStyles(C);
  const [dimIndex, setDimIndex] = useState(0);
  const [answers, setAnswers] = useState(emptyAnswers);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const dim = DNA_DIMENSIONS[dimIndex];
  const questions = DNA_QUESTIONS[dim];
  const isLast = dimIndex === DNA_DIMENSIONS.length - 1;

  const setAnswer = (qIndex, text) => {
    setAnswers(prev => ({
      ...prev,
      [dim]: prev[dim].map((a, i) => (i === qIndex ? text : a)),
    }));
  };

  const goNext = async () => {
    if (answers[dim].some(a => !a.trim())) {
      setError('Please answer all 5 questions before continuing.');
      return;
    }
    setError('');
    if (!isLast) {
      setDimIndex(dimIndex + 1);
      return;
    }
    setSubmitting(true);
    try {
      await submitDnaSelfAssessment(founderId, answers);
      onComplete?.();
    } catch (e) {
      setError(e.response?.data?.error || 'Could not score your answers. Please try again.');
    } finally {
      setSubmitting(false);
    }
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

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{DIMENSION_LABELS[dim]}</Text>
        <Text style={styles.subtitle}>Answer honestly and specifically — vague answers score lower than concrete ones.</Text>

        {questions.map((q, i) => (
          <View key={i} style={{ marginTop: 16 }}>
            <Text style={styles.question}>{q}</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              multiline
              placeholder="Your answer…"
              placeholderTextColor={C.textHint}
              value={answers[dim][i]}
              onChangeText={(v) => setAnswer(i, v)}
            />
          </View>
        ))}

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
    progressRow: { flexDirection: 'row', gap: 4, paddingBottom: 12 },
    progressDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: C.surfaceBorder },

    scrollContent: { paddingBottom: 24 },
    title: { ...typography.displayMedium, color: C.textPrimary, marginBottom: 6 },
    subtitle: { ...typography.bodyMedium, color: C.textSecondary },

    question: { ...typography.labelSmall, color: C.textSecondary, marginBottom: 8 },
    input: {
      backgroundColor: C.surface, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 14,
      fontSize: 15, color: C.textPrimary, borderWidth: 1, borderColor: C.surfaceBorder,
    },
    inputMultiline: { height: 90, textAlignVertical: 'top' },

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
