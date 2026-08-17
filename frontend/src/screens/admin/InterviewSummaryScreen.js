import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Share,
} from 'react-native';
import { useState, useEffect, useMemo, useRef } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import useAppStore from '../../store/appStore';
import { colors, investorColors, radius, typography, cardShadow } from '../../theme';
import { getFounderInterview } from '../../services/interviews.service';
import { showAlert } from '../../services/alert';
import AppShell from '../../components/AppShell';
import { ADMIN_NAV_ITEMS } from '../../config/nav';
import { SectionCard, Avatar } from '../../components/ui';
import RecordingPlayer from '../../components/interview/RecordingPlayer';
import { formatAnswerForReview, formatDuration, groupBookmarksBySection } from '../../interview/formatAnswer';

import { compileTree, computeActivePath } from '../../interview/engine/InterviewEngine';
import { substituteQuestionPlaceholders } from '../../interview/engine/textPlaceholders';
import { questionTree } from '../../interview/data/questionTree.bizmatch';

const TREE = compileTree(questionTree);

// Read-only view of a completed interview: full section-grouped Q&A, the
// recording (if any) with a tap-to-jump bookmark outline, and a "Share"
// action that exports the same content as plain text.
export default function InterviewSummaryScreen({ route, navigation }) {
  const darkMode = useAppStore(s => s.darkMode);
  const C = darkMode ? investorColors : colors;
  const styles = makeStyles(C);

  const interviewId = route.params?.interviewId;
  const playerRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [interview, setInterview] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await getFounderInterview(interviewId);
        setInterview(data);
      } catch {
        showAlert('Error', 'Could not load this interview.');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    })();
  }, [interviewId]);

  const activePath = useMemo(
    () => (interview ? computeActivePath(TREE, interview.answers || {}) : []),
    [interview],
  );

  const reviewIds = useMemo(
    () => activePath.filter((id) => {
      const q = TREE.byId[id];
      return q && q.type !== 'info' && q.type !== 'end';
    }),
    [activePath],
  );

  const bookmarkGroups = useMemo(() => {
    if (!interview?.recordingBookmarks?.length) return [];
    const sorted = [...interview.recordingBookmarks].sort((a, b) => a.timeSeconds - b.timeSeconds);
    return groupBookmarksBySection(TREE, sorted);
  }, [interview]);

  const handleShare = async () => {
    if (!interview) return;
    const lines = [`Interview: ${interview.meta?.entrepreneurName || 'Unnamed founder'}`];
    if (interview.meta?.ventureName) lines.push(`Venture: ${interview.meta.ventureName}`);
    if (interview.completedAt) lines.push(`Completed: ${new Date(interview.completedAt).toLocaleDateString()}`);
    lines.push('');
    let lastSection = null;
    for (const id of reviewIds) {
      const question = TREE.byId[id];
      const section = TREE.sections.find((s) => s.id === question.section);
      if (section?.label !== lastSection) {
        lines.push(`\n${section?.label?.toUpperCase() || ''}`);
        lastSection = section?.label;
      }
      lines.push(`Q: ${substituteQuestionPlaceholders(question.text, interview.meta || {})}`);
      lines.push(`A: ${formatAnswerForReview(question, interview.answers?.[id])}`);
      const note = interview.answers?.[id]?.interviewerNote;
      if (note) lines.push(`   Note: ${note}`);
    }
    const text = lines.join('\n');
    try {
      await Share.share({ message: text });
      // Note: RN's Share.share resolves (doesn't throw) when the user simply dismisses the
      // native share sheet — a caught error here is a genuine failure, most commonly the web
      // fallback below: react-native-web's Share wraps navigator.share, which is unavailable
      // on most desktop browsers (and always over plain http://localhost).
    } catch {
      try {
        await Clipboard.setStringAsync(text);
        showAlert('Copied to clipboard', "Sharing isn't available in this browser, so the summary was copied instead.");
      } catch {
        showAlert('Error', 'Could not share or copy the summary.');
      }
    }
  };

  if (loading) {
    return (
      <AppShell navigation={navigation} active="interviews" items={ADMIN_NAV_ITEMS}>
        <View style={styles.centered}><ActivityIndicator size="large" color={C.primary} /></View>
      </AppShell>
    );
  }

  if (!interview) return null;

  return (
    <AppShell navigation={navigation} active="interviews" items={ADMIN_NAV_ITEMS}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backRow}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.headerRow}>
          <Avatar photoUrl={interview.founderPhotoUrl} name={interview.meta?.entrepreneurName} size={48} C={C} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{interview.meta?.entrepreneurName || 'Unnamed founder'}</Text>
            <Text style={styles.subtitle}>
              {interview.interviewerName ? `Interviewer: ${interview.interviewerName} · ` : ''}
              Completed {interview.completedAt ? new Date(interview.completedAt).toLocaleDateString() : '—'}
            </Text>
          </View>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
            <Ionicons name="share-outline" size={16} color="#fff" />
            <Text style={styles.shareBtnText}>Share</Text>
          </TouchableOpacity>
        </View>

        {interview.recordingSegments?.length > 0 && (
          <SectionCard title="Recording" icon="mic-outline" C={C} style={{ marginTop: 16 }}>
            <RecordingPlayer ref={playerRef} segments={interview.recordingSegments} C={C} />
            {bookmarkGroups.length > 0 && (
              <View style={{ marginTop: 12 }}>
                {bookmarkGroups.map((group) => (
                  <View key={group.sectionId} style={{ marginTop: 8 }}>
                    <Text style={styles.bookmarkSectionLabel}>{group.sectionLabel}</Text>
                    {group.bookmarks.map((b) => {
                      const q = TREE.byId?.[b.questionId];
                      return (
                        <TouchableOpacity
                          key={b.questionId}
                          style={styles.bookmarkRow}
                          onPress={() => playerRef.current?.seekAndPlay(b.segmentIndex, b.timeSeconds)}
                          activeOpacity={0.75}
                        >
                          <Text style={styles.bookmarkTime}>{formatDuration(b.timeSeconds)}</Text>
                          <Text style={styles.bookmarkQuestion} numberOfLines={1}>{q?.text ?? b.questionId}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>
            )}
          </SectionCard>
        )}

        <SectionCard title="Answers" icon="document-text-outline" C={C} style={{ marginTop: 16 }}>
          {reviewIds.map((id) => {
            const question = TREE.byId[id];
            const section = TREE.sections.find((s) => s.id === question.section);
            const note = interview.answers?.[id]?.interviewerNote;
            return (
              <View key={id} style={styles.reviewRow}>
                <Text style={styles.reviewSectionLabel}>{section?.label}</Text>
                <Text style={styles.reviewQuestion}>{substituteQuestionPlaceholders(question.text, interview.meta || {})}</Text>
                <Text style={styles.reviewAnswer}>{formatAnswerForReview(question, interview.answers?.[id])}</Text>
                {note ? (
                  <View style={styles.reviewNoteRow}>
                    <Ionicons name="create-outline" size={13} color={C.textHint} />
                    <Text style={styles.reviewNoteText}>{note}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </SectionCard>
      </ScrollView>
    </AppShell>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
    container: { padding: 20, paddingBottom: 60, maxWidth: 680, width: '100%', alignSelf: 'center' },

    backRow: { marginBottom: 12 },
    backText: { ...typography.labelLarge, color: C.primary },

    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    title: { ...typography.titleMedium, color: C.textPrimary },
    subtitle: { ...typography.bodySmall, color: C.textSecondary, marginTop: 2 },
    shareBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: C.primary, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9, ...cardShadow,
    },
    shareBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

    bookmarkSectionLabel: { ...typography.caption, color: C.textHint, textTransform: 'uppercase', marginBottom: 4 },
    bookmarkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
    bookmarkTime: { ...typography.caption, color: C.primary, fontVariant: ['tabular-nums'], width: 42 },
    bookmarkQuestion: { ...typography.bodySmall, color: C.textSecondary, flex: 1 },

    reviewRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.surfaceBorder },
    reviewSectionLabel: { ...typography.caption, color: C.textHint, textTransform: 'uppercase', marginBottom: 4 },
    reviewQuestion: { ...typography.bodyMedium, color: C.textPrimary, fontWeight: '600', marginBottom: 6 },
    reviewAnswer: { ...typography.bodyMedium, color: C.textSecondary },
    reviewNoteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8, backgroundColor: C.surfaceElevated, borderRadius: radius.sm, padding: 8 },
    reviewNoteText: { ...typography.bodySmall, color: C.textSecondary, flex: 1, fontStyle: 'italic' },
  });
}
