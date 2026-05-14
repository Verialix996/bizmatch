import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import useAuthStore from '../../store/authStore';
import { colors, radius, typography, cardShadow } from '../../theme';
import api from '../../services/api';

const STATUS_COLOR = {
  proposed:  colors.warning,
  confirmed: colors.success,
  declined:  colors.error,
  cancelled: colors.textHint,
};

function MeetingCard({ meeting, currentUserId, onPress }) {
  const isProposer = meeting.proposer_id === currentUserId;
  const otherName  = isProposer ? meeting.receiver_name : meeting.proposer_name;
  const date = new Date(meeting.scheduled_at).toLocaleString('en-IL', {
    dateStyle: 'medium', timeStyle: 'short',
  });

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.cardRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{meeting.title || 'Meeting'}</Text>
          <Text style={styles.cardWith}>with {otherName}</Text>
          <Text style={styles.cardDate}>{date}</Text>
        </View>
        <View style={styles.badges}>
          <View style={[styles.badge, { backgroundColor: meeting.location_type === 'virtual' ? colors.surfaceElevated : '#FFF3E0' }]}>
            <Ionicons
              name={meeting.location_type === 'virtual' ? 'videocam' : 'location'}
              size={12}
              color={meeting.location_type === 'virtual' ? colors.primary : colors.warning}
            />
            <Text style={[styles.badgeText, { color: meeting.location_type === 'virtual' ? colors.primary : colors.warning }]}>
              {meeting.location_type === 'virtual' ? 'Virtual' : 'In Person'}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: STATUS_COLOR[meeting.status] + '22', marginTop: 4 }]}>
            <Text style={[styles.badgeText, { color: STATUS_COLOR[meeting.status] }]}>
              {meeting.status.charAt(0).toUpperCase() + meeting.status.slice(1)}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function MeetingScreen({ navigation }) {
  const user = useAuthStore(s => s.user);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const { data } = await api.get('/meetings');
      setMeetings(data);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => {
    api.post('/notifications/read', { types: ['meeting'] }).catch(() => {});
    load();
  }, []));

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={meetings}
        keyExtractor={m => String(m.id)}
        renderItem={({ item }) => (
          <MeetingCard
            meeting={item}
            currentUserId={user?.id}
            onPress={() => navigation.navigate('MeetingDetail', { meeting: item })}
          />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={52} color={colors.textHint} />
            <Text style={styles.emptyText}>No meetings yet</Text>
            <Text style={styles.emptySubText}>Propose a meeting from any chat conversation.</Text>
          </View>
        }
        contentContainerStyle={meetings.length === 0 ? { flex: 1 } : { padding: 16 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSoft },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
    ...cardShadow,
  },
  cardRow:    { flexDirection: 'row', alignItems: 'flex-start' },
  cardTitle:  { ...typography.titleSmall, color: colors.textPrimary, marginBottom: 2 },
  cardWith:   { ...typography.bodySmall, color: colors.textSecondary, marginBottom: 4 },
  cardDate:   { ...typography.bodySmall, color: colors.primary },
  badges:     { alignItems: 'flex-end' },
  badge:      { flexDirection: 'row', alignItems: 'center', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3, gap: 3 },
  badgeText:  { ...typography.caption, fontWeight: '600' },
  empty:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  emptyText:  { ...typography.titleSmall, color: colors.textSecondary },
  emptySubText: { ...typography.bodySmall, color: colors.textHint, textAlign: 'center', paddingHorizontal: 32 },
});
