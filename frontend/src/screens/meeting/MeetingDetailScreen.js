import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import useAuthStore from '../../store/authStore';
import { colors, radius, typography, cardShadow } from '../../theme';
import api from '../../services/api';

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function BulletList({ items }) {
  return items.map((item, i) => (
    <View key={i} style={styles.bulletRow}>
      <Text style={styles.bullet}>{'•'}</Text>
      <Text style={styles.bulletText}>{item}</Text>
    </View>
  ));
}

export default function MeetingDetailScreen({ route, navigation }) {
  const { meeting: initialMeeting } = route.params;
  const user = useAuthStore(s => s.user);
  const [meeting, setMeeting] = useState(initialMeeting);
  const [briefing, setBriefing] = useState(null);
  const [loadingBriefing, setLoadingBriefing] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);

  const isProposer = meeting.proposer_id === user?.id;
  const isReceiver = meeting.receiver_id === user?.id;
  const otherName = isProposer ? meeting.receiver_name : meeting.proposer_name;
  const date = new Date(meeting.scheduled_at).toLocaleString('en-IL', { dateStyle: 'full', timeStyle: 'short' });

  const respond = async (status) => {
    setLoadingAction(true);
    try {
      const { data } = await api.put(`/meetings/${meeting.id}`, { status });
      setMeeting(data);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Action failed.');
    }
    setLoadingAction(false);
  };

  const fetchBriefing = async () => {
    setLoadingBriefing(true);
    try {
      const { data } = await api.get(`/meetings/${meeting.id}/briefing`);
      setBriefing(data);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Could not generate briefing.');
    }
    setLoadingBriefing(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={20} color={colors.primary} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <Text style={styles.title}>{meeting.title || 'Meeting'}</Text>
        <Text style={styles.with}>with {otherName}</Text>
        <Text style={styles.date}>{date}</Text>

        <View style={styles.typeBadge}>
          <Ionicons
            name={meeting.location_type === 'virtual' ? 'videocam' : 'location'}
            size={14}
            color={meeting.location_type === 'virtual' ? colors.primary : colors.warning}
          />
          <Text style={[styles.typeText, { color: meeting.location_type === 'virtual' ? colors.primary : colors.warning }]}>
            {meeting.location_type === 'virtual' ? 'Virtual Meeting' : 'In-Person Meeting'}
          </Text>
        </View>

        {meeting.location_type === 'virtual' && meeting.video_link && (
          <TouchableOpacity style={styles.joinBtn} onPress={() => Linking.openURL(meeting.video_link)}>
            <Ionicons name="videocam" size={16} color="#fff" />
            <Text style={styles.joinBtnText}>Join Call</Text>
          </TouchableOpacity>
        )}

        {meeting.location_type === 'in_person' && meeting.address && (
          <TouchableOpacity
            style={styles.mapBtn}
            onPress={() => {
              const encoded = encodeURIComponent(meeting.address);
              Linking.openURL(`https://maps.google.com/?q=${encoded}`);
            }}
          >
            <Ionicons name="map" size={16} color={colors.primary} />
            <Text style={styles.mapBtnText}>{meeting.address}</Text>
          </TouchableOpacity>
        )}
      </View>

      {isReceiver && meeting.status === 'proposed' && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.success }]}
            onPress={() => respond('confirmed')}
            disabled={loadingAction}
          >
            {loadingAction ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.actionBtnText}>Confirm</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.error }]}
            disabled={loadingAction}
            onPress={() =>
              Alert.alert(
                'Decline Meeting',
                'Would you like to decline or suggest a new time?',
                [
                  { text: 'Cancel' },
                  { text: 'Just Decline', style: 'destructive', onPress: () => respond('declined') },
                  {
                    text: 'Suggest New Time',
                    onPress: () => navigation.navigate('ProposeMeeting', {
                      matchId: meeting.match_id,
                      rescheduleId: meeting.id,
                      prefill: {
                        title: meeting.title,
                        locationType: meeting.location_type,
                        videoLink: meeting.video_link,
                        address: meeting.address,
                      },
                    }),
                  },
                ]
              )
            }
          >
            <Text style={styles.actionBtnText}>Decline</Text>
          </TouchableOpacity>
        </View>
      )}

      {isProposer && meeting.status === 'proposed' && (
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.error, alignSelf: 'stretch' }]}
          onPress={() => respond('cancelled')}
          disabled={loadingAction}
        >
          {loadingAction ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.actionBtnText}>Cancel Meeting</Text>}
        </TouchableOpacity>
      )}

      {(isProposer || isReceiver) && meeting.status === 'confirmed' && (
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.error, alignSelf: 'stretch' }]}
          onPress={() =>
            Alert.alert(
              'Cancel Meeting',
              'Are you sure you want to cancel this confirmed meeting?',
              [
                { text: 'Keep Meeting' },
                { text: 'Cancel Meeting', style: 'destructive', onPress: () => respond('cancelled') },
              ]
            )
          }
          disabled={loadingAction}
        >
          {loadingAction ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.actionBtnText}>Cancel Meeting</Text>}
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.briefingBtn} onPress={fetchBriefing} disabled={loadingBriefing}>
        {loadingBriefing ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            <Ionicons name="sparkles" size={18} color={colors.primary} />
            <Text style={styles.briefingBtnText}>Get AI Briefing on {otherName}</Text>
          </>
        )}
      </TouchableOpacity>

      {briefing && (
        <View style={styles.briefingCard}>
          <Text style={styles.briefingHeader}>AI Due Diligence Briefing</Text>

          <Section title={`About ${otherName}`}>
            <Text style={styles.bodyText}>{briefing.personSummary}</Text>
          </Section>

          <Section title="Why You Matched">
            <Text style={styles.bodyText}>{briefing.matchRationale}</Text>
          </Section>

          {briefing.talkingPoints?.length > 0 && (
            <Section title="Talking Points">
              <BulletList items={briefing.talkingPoints} />
            </Section>
          )}

          {briefing.questionsToAsk?.length > 0 && (
            <Section title="Questions to Ask">
              <BulletList items={briefing.questionsToAsk} />
            </Section>
          )}

          {briefing.watchOutFor?.length > 0 && (
            <Section title="Watch Out For">
              <BulletList items={briefing.watchOutFor} />
            </Section>
          )}
        </View>
      )}
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:     { flex: 1, backgroundColor: colors.backgroundSoft },
  container:    { flex: 1 },
  backBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16 },
  backText:     { ...typography.bodyMedium, color: colors.primary },
  card:         { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 20, marginBottom: 16, ...cardShadow },
  title:        { ...typography.titleLarge, color: colors.textPrimary, marginBottom: 4 },
  with:         { ...typography.bodyMedium, color: colors.textSecondary, marginBottom: 6 },
  date:         { ...typography.titleSmall, color: colors.primary, marginBottom: 12 },
  typeBadge:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  typeText:     { ...typography.labelLarge },
  joinBtn:      { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: 20, alignSelf: 'flex-start' },
  joinBtnText:  { ...typography.titleSmall, color: '#fff' },
  mapBtn:       { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surfaceElevated, borderRadius: radius.md, padding: 10 },
  mapBtnText:   { ...typography.bodyMedium, color: colors.textPrimary, flex: 1 },
  actionRow:    { flexDirection: 'row', gap: 12, marginBottom: 16 },
  actionBtn:    { flex: 1, borderRadius: radius.pill, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  actionBtnText:{ ...typography.titleSmall, color: '#fff' },
  briefingBtn:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surfaceElevated, borderRadius: radius.lg, padding: 16, marginBottom: 16, justifyContent: 'center' },
  briefingBtnText: { ...typography.titleSmall, color: colors.primary },
  briefingCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 20, ...cardShadow },
  briefingHeader: { ...typography.titleMedium, color: colors.primaryDark, marginBottom: 16 },
  section:      { marginBottom: 16 },
  sectionTitle: { ...typography.titleSmall, color: colors.textPrimary, marginBottom: 6 },
  bodyText:     { ...typography.bodyMedium, color: colors.textSecondary, lineHeight: 21 },
  bulletRow:    { flexDirection: 'row', gap: 8, marginBottom: 4 },
  bullet:       { ...typography.bodyMedium, color: colors.primary, marginTop: 1 },
  bulletText:   { ...typography.bodyMedium, color: colors.textSecondary, flex: 1 },
});
