import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import useAppStore from '../../store/appStore';
import { colors, investorColors, radius, typography } from '../../theme';
import { getFounderInterview, saveFounderInterview, completeFounderInterview } from '../../services/interviews.service';
import { showAlert } from '../../services/alert';
import AppShell from '../../components/AppShell';
import { ADMIN_NAV_ITEMS } from '../../config/nav';

import { compileTree, computeActivePath, getCurrentFrontierId, isQuestionDynamicallyRequired } from '../../interview/engine/InterviewEngine';
import { getPreviousQuestionId } from '../../interview/engine/NavigationManager';
import { calculateProgress } from '../../interview/engine/ProgressCalculator';
import { substituteQuestionPlaceholders } from '../../interview/engine/textPlaceholders';
import { questionTree } from '../../interview/data/questionTree.bizmatch';

const TREE = compileTree(questionTree);
const DURATION_UNITS = ['minutes', 'hours', 'days', 'months', 'years'];

export default function InterviewRunnerScreen({ route, navigation }) {
  const darkMode = useAppStore(s => s.darkMode);
  const C = darkMode ? investorColors : colors;
  const styles = makeStyles(C);

  const interviewId = route.params?.interviewId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [answers, setAnswers] = useState({});
  const [meta, setMeta] = useState(null);
  const [status, setStatus] = useState('in_progress');
  const [draftText, setDraftText] = useState('');
  const [draftNumber, setDraftNumber] = useState('');
  const [draftDurationUnit, setDraftDurationUnit] = useState('minutes');
  const [draftMulti, setDraftMulti] = useState([]);

  const saveTimer = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await getFounderInterview(interviewId);
        setAnswers(data.answers || {});
        setMeta(data.meta || {});
        setStatus(data.status);
      } catch {
        showAlert('Error', 'Could not load this interview.');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    })();
  }, [interviewId]);

  const activePath = useMemo(() => computeActivePath(TREE, answers), [answers]);
  const currentQuestionId = getCurrentFrontierId(activePath);
  const currentQuestion = currentQuestionId ? TREE.byId[currentQuestionId] : undefined;
  const progress = useMemo(
    () => calculateProgress(TREE, activePath, answers, currentQuestionId),
    [activePath, answers, currentQuestionId],
  );

  // Reset the local draft input whenever the active question changes.
  useEffect(() => {
    setDraftText('');
    setDraftNumber('');
    setDraftDurationUnit('minutes');
    setDraftMulti([]);
  }, [currentQuestionId]);

  const scheduleSave = useCallback((nextAnswers) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await saveFounderInterview(interviewId, { answers: nextAnswers });
      } catch {
        // Silent — next successful save will catch up; nothing to lose locally.
      } finally {
        setSaving(false);
      }
    }, 600);
  }, [interviewId]);

  const recordAnswer = (value) => {
    const record = { value, updatedAt: new Date().toISOString() };
    const next = { ...answers, [currentQuestionId]: record };
    setAnswers(next);
    scheduleSave(next);
  };

  const skipQuestion = () => {
    const record = { skipped: true, updatedAt: new Date().toISOString() };
    const next = { ...answers, [currentQuestionId]: record };
    setAnswers(next);
    scheduleSave(next);
  };

  const goBack = () => {
    const prev = getPreviousQuestionId(activePath, currentQuestionId);
    if (!prev) return;
    // Reviewing an earlier answer: clear it so the frontier lands back there,
    // letting the interviewer re-answer it (and anything already answered
    // after it stays intact until it's overwritten by the new path).
    const record = answers[prev];
    if (!record) return;
    const trimmed = { ...answers };
    // Walk forward from prev, dropping every answer from there on so the
    // active path recomputes to stop exactly at `prev`.
    const idx = activePath.indexOf(prev);
    for (const id of activePath.slice(idx)) delete trimmed[id];
    setAnswers(trimmed);
    scheduleSave(trimmed);
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      await saveFounderInterview(interviewId, { answers });
      await completeFounderInterview(interviewId);
      showAlert('Interview complete', `${meta?.entrepreneurName || 'This interview'} has been saved.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch {
      showAlert('Error', 'Could not complete the interview. Your answers are saved — try finishing again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppShell navigation={navigation} active="founders" items={ADMIN_NAV_ITEMS}>
        <View style={styles.centered}><ActivityIndicator size="large" color={C.primary} /></View>
      </AppShell>
    );
  }

  if (!currentQuestion) {
    return (
      <AppShell navigation={navigation} active="founders" items={ADMIN_NAV_ITEMS}>
        <View style={styles.centered}><Text style={styles.emptyText}>This interview has no questions to show.</Text></View>
      </AppShell>
    );
  }

  const required = isQuestionDynamicallyRequired(currentQuestion);
  const section = TREE.sections.find(s => s.id === currentQuestion.section);

  return (
    <AppShell navigation={navigation} active="founders" items={ADMIN_NAV_ITEMS}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.entrepreneurName}>{meta?.entrepreneurName}</Text>
          {saving ? <Text style={styles.savingText}>Saving…</Text> : null}
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress.percent}%` }]} />
        </View>
        <Text style={styles.sectionLabel}>{section?.label} · {progress.completedCount}/{progress.totalActiveCount}</Text>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.questionText}>{substituteQuestionPlaceholders(currentQuestion.text, meta || {})}</Text>
          {currentQuestion.helpText ? <Text style={styles.helpText}>{currentQuestion.helpText}</Text> : null}

          {currentQuestion.type === 'info' && (
            <TouchableOpacity style={styles.primaryBtn} onPress={() => recordAnswer({ type: 'info', acknowledged: true })} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Continue</Text>
            </TouchableOpacity>
          )}

          {currentQuestion.type === 'end' && (
            <TouchableOpacity style={[styles.primaryBtn, saving && { opacity: 0.6 }]} onPress={handleFinish} disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Complete Interview</Text>}
            </TouchableOpacity>
          )}

          {currentQuestion.type === 'yes_no' && (
            <View style={styles.rowGap}>
              <TouchableOpacity style={styles.choiceBtn} onPress={() => recordAnswer({ type: 'yes_no', value: true })} activeOpacity={0.85}>
                <Text style={styles.choiceBtnText}>Yes</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.choiceBtn} onPress={() => recordAnswer({ type: 'yes_no', value: false })} activeOpacity={0.85}>
                <Text style={styles.choiceBtnText}>No</Text>
              </TouchableOpacity>
            </View>
          )}

          {currentQuestion.type === 'single_choice' && (
            <View style={styles.chipRow}>
              {(currentQuestion.options || []).map((opt) => (
                <TouchableOpacity key={opt.id} style={styles.choiceBtnFull} onPress={() => recordAnswer({ type: 'single_choice', optionId: opt.id })} activeOpacity={0.85}>
                  <Text style={styles.choiceBtnText}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {currentQuestion.type === 'multi_choice' && (
            <View>
              <View style={styles.chipRow}>
                {(currentQuestion.options || []).map((opt) => {
                  const on = draftMulti.includes(opt.id);
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[styles.chip, on && { backgroundColor: C.primary, borderColor: C.primary }]}
                      onPress={() => setDraftMulti(on ? draftMulti.filter(o => o !== opt.id) : [...draftMulti, opt.id])}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.chipText, on && { color: '#fff' }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => recordAnswer({ type: 'multi_choice', optionIds: draftMulti })} activeOpacity={0.85}>
                <Text style={styles.primaryBtnText}>Continue</Text>
              </TouchableOpacity>
            </View>
          )}

          {(currentQuestion.type === 'short_text' || currentQuestion.type === 'long_text') && (
            <View>
              <TextInput
                style={[styles.input, currentQuestion.type === 'long_text' && styles.inputMultiline]}
                multiline={currentQuestion.type === 'long_text'}
                placeholder="Type the answer…"
                placeholderTextColor={C.textHint}
                value={draftText}
                onChangeText={setDraftText}
              />
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => recordAnswer({ type: currentQuestion.type, text: draftText })}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>Continue</Text>
              </TouchableOpacity>
            </View>
          )}

          {currentQuestion.type === 'number' && (
            <View>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={C.textHint}
                value={draftNumber}
                onChangeText={setDraftNumber}
              />
              <TouchableOpacity style={styles.primaryBtn} onPress={() => recordAnswer({ type: 'number', value: Number(draftNumber) || 0 })} activeOpacity={0.85}>
                <Text style={styles.primaryBtnText}>Continue</Text>
              </TouchableOpacity>
            </View>
          )}

          {currentQuestion.type === 'duration' && (
            <View>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="Amount"
                placeholderTextColor={C.textHint}
                value={draftNumber}
                onChangeText={setDraftNumber}
              />
              <View style={[styles.chipRow, { marginTop: 10 }]}>
                {DURATION_UNITS.map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.chip, draftDurationUnit === u && { backgroundColor: C.primary, borderColor: C.primary }]}
                    onPress={() => setDraftDurationUnit(u)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, draftDurationUnit === u && { color: '#fff' }]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => recordAnswer({ type: 'duration', amount: Number(draftNumber) || 0, unit: draftDurationUnit })}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>Continue</Text>
              </TouchableOpacity>
            </View>
          )}

          {!required && currentQuestion.type !== 'info' && currentQuestion.type !== 'end' && (
            <TouchableOpacity onPress={skipQuestion} style={{ marginTop: 14 }}>
              <Text style={styles.skipText}>Skip this question</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity onPress={goBack} disabled={!getPreviousQuestionId(activePath, currentQuestionId)}>
            <Text style={[styles.backText, !getPreviousQuestionId(activePath, currentQuestionId) && { opacity: 0.4 }]}>← Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    </AppShell>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
    emptyText: { ...typography.bodyMedium, color: C.textHint },

    container: { flex: 1, maxWidth: 680, width: '100%', alignSelf: 'center', paddingHorizontal: 20, paddingTop: 16 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    entrepreneurName: { ...typography.titleMedium, color: C.textPrimary },
    savingText: { ...typography.caption, color: C.textHint },

    progressTrack: { height: 5, borderRadius: 3, backgroundColor: C.surfaceBorder, marginTop: 10, overflow: 'hidden' },
    progressFill: { height: 5, borderRadius: 3, backgroundColor: C.primary },
    sectionLabel: { ...typography.caption, color: C.textHint, marginTop: 6 },

    scrollContent: { paddingVertical: 24, paddingBottom: 60 },
    questionText: {
      ...typography.displayMedium, fontSize: 22, color: C.textPrimary, marginBottom: 8,
    },
    helpText: {
      ...typography.bodySmall, color: C.textSecondary, marginBottom: 16,
    },

    rowGap: { flexDirection: 'row', gap: 12, marginTop: 8 },
    choiceBtn: { flex: 1, backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.surfaceBorder, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center' },
    choiceBtnFull: { backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.surfaceBorder, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 8 },
    choiceBtnText: { ...typography.bodyMedium, fontWeight: '700', color: C.textPrimary },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    chip: { borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.surfaceBorder },
    chipText: { fontSize: 13, fontWeight: '600', color: C.textSecondary },

    input: {
      backgroundColor: C.backgroundSoft, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 14,
      fontSize: 15, color: C.textPrimary, borderWidth: 1, borderColor: C.surfaceBorder, marginTop: 8,
    },
    inputMultiline: { height: 120, textAlignVertical: 'top' },

    primaryBtn: { backgroundColor: C.primary, borderRadius: radius.pill, paddingVertical: 16, alignItems: 'center', marginTop: 16 },
    primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

    skipText: { ...typography.labelLarge, color: C.textHint },

    footer: { paddingVertical: 16, borderTopWidth: 1, borderTopColor: C.surfaceBorder },
    backText: { ...typography.labelLarge, color: C.primary },
  });
}
