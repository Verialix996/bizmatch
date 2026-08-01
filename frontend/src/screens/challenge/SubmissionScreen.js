import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, SafeAreaView, StatusBar, ActivityIndicator,
} from 'react-native';
import { showAlert } from '../../services/alert';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import useAppStore from '../../store/appStore';
import { colors, investorColors, investorThemeColors, radius, cardShadow } from '../../theme';
import {
  uploadSubmissionDeck, uploadSubmissionVideo, getSubmissionAiReview, submitEntry,
} from '../../services/challenge.service';

// Note: SubmissionScreen doesn't have a dedicated "get signup by id" endpoint,
// so it tracks upload state locally and relies on the caller (ChallengeDetail)
// having already confirmed the signup exists; description/status are entered fresh.
export default function SubmissionScreen({ route, navigation }) {
  const { signupId } = route.params;
  const darkMode = useAppStore(s => s.darkMode);
  const isInvestorTheme = useAppStore(s => s.isInvestorTheme);
  const C = darkMode ? investorColors : (isInvestorTheme ? investorThemeColors : colors);
  const styles = makeStyles(C);

  const [description, setDescription] = useState('');
  const [deckUploaded, setDeckUploaded] = useState(false);
  const [videoUploaded, setVideoUploaded] = useState(false);
  const [videoProgress, setVideoProgress] = useState(null);
  const [review, setReview] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleUploadDeck = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf'] });
      if (result.canceled || !result.assets?.[0]) return;
      const file = result.assets[0];
      await uploadSubmissionDeck(signupId, file.uri, file.name, file.file || null);
      setDeckUploaded(true);
    } catch {
      showAlert('Upload Failed', 'Could not upload deck. Please try again.');
    }
  };

  const handleUploadVideo = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return showAlert('Permission Required', 'Photo library access is needed.');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType?.Videos ?? ImagePicker.MediaTypeOptions?.Videos,
        allowsEditing: false, quality: 1,
      });
      if (result.canceled || !result.assets?.[0]) return;
      setVideoProgress(0);
      await uploadSubmissionVideo(signupId, result.assets[0].uri, setVideoProgress, result.assets[0].file || null);
      setVideoProgress(null);
      setVideoUploaded(true);
    } catch {
      setVideoProgress(null);
      showAlert('Upload Failed', 'Could not upload video. Please try again.');
    }
  };

  const handleReview = async () => {
    try {
      const { data } = await getSubmissionAiReview(signupId);
      setReview(data);
    } catch (e) {
      showAlert('Error', e.response?.data?.error || 'Could not get AI feedback.');
    }
  };

  const handleSubmit = async () => {
    if (!description.trim()) return showAlert('Description required', 'Describe your submission before submitting.');
    setSubmitting(true);
    try {
      await submitEntry(signupId, description.trim());
      showAlert('Submitted!', 'Your entry has been submitted.');
      navigation.goBack();
    } catch (e) {
      showAlert('Could not submit', e.response?.data?.error || 'Upload a deck and video first.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Submit Entry</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PITCH DECK</Text>
          <TouchableOpacity style={styles.uploadBtn} onPress={handleUploadDeck}>
            <Text style={styles.uploadBtnText}>📄 {deckUploaded ? 'Deck uploaded ✓ (tap to replace)' : 'Upload PDF'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DEMO VIDEO</Text>
          <TouchableOpacity style={styles.uploadBtn} onPress={handleUploadVideo}>
            <Text style={styles.uploadBtnText}>
              🎬 {videoProgress != null ? `Uploading ${videoProgress}%` : videoUploaded ? 'Video uploaded ✓ (tap to replace)' : 'Upload Video'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DESCRIPTION</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            multiline
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your submission..."
            placeholderTextColor={C.textHint}
          />
        </View>

        {deckUploaded ? (
          <TouchableOpacity style={styles.aiBtn} onPress={handleReview}>
            <Text style={styles.aiBtnText}>✦ Get AI Feedback</Text>
          </TouchableOpacity>
        ) : null}

        {review ? (
          <View style={styles.section}>
            {review.overallScore != null ? (
              <>
                <Text style={styles.scoreText}>Overall Score: {review.overallScore}/10</Text>
                {[['Strengths', review.strengths], ['Weaknesses', review.weaknesses], ['Suggestions', review.suggestions]].map(([label, items]) =>
                  items?.length ? (
                    <View key={label} style={{ marginTop: 10 }}>
                      <Text style={styles.reviewLabel}>{label}</Text>
                      {items.map((it, i) => <Text key={i} style={styles.reviewItem}>• {it}</Text>)}
                    </View>
                  ) : null
                )}
              </>
            ) : (
              <>
                <Text style={styles.scoreText}>Cohesion Score: {review.cohesionScore}/100</Text>
                <Text style={styles.reviewItem}>{review.feedback}</Text>
              </>
            )}
          </View>
        ) : null}

        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitBtnText}>Submit Entry</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.backgroundSoft },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.surfaceBorder },
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    backIcon: { fontSize: 22, color: C.textPrimary },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: C.textPrimary },
    content: { padding: 16, paddingBottom: 40 },
    section: { backgroundColor: C.surface, marginBottom: 12, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: C.surfaceBorder, ...cardShadow, shadowOpacity: 0.04 },
    sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: C.textHint, marginBottom: 10 },
    uploadBtn: { backgroundColor: C.backgroundSoft, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: C.surfaceBorder, borderStyle: 'dashed' },
    uploadBtnText: { fontSize: 13, fontWeight: '600', color: C.primary },
    input: { backgroundColor: C.backgroundSoft, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.primaryDark, borderWidth: 1, borderColor: C.surfaceBorder },
    inputMultiline: { height: 100, textAlignVertical: 'top' },
    aiBtn: { backgroundColor: C.primaryLight || '#e8f0fe', borderRadius: radius.pill, paddingVertical: 10, alignItems: 'center', marginBottom: 12 },
    aiBtnText: { color: C.primary, fontWeight: '700', fontSize: 13 },
    scoreText: { fontSize: 16, fontWeight: '800', color: C.primary, marginBottom: 6 },
    reviewLabel: { fontSize: 12, fontWeight: '700', color: C.primaryDark, textTransform: 'uppercase' },
    reviewItem: { fontSize: 13, color: C.textSecondary, marginTop: 4, lineHeight: 19 },
    submitBtn: { backgroundColor: C.primary, borderRadius: radius.md, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
    submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  });
}
