import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import useAuthStore from '../../store/authStore';
import useAppStore from '../../store/appStore';
import { colors, investorColors, investorThemeColors, radius, typography, cardShadow } from '../../theme';
import api from '../../services/api';

function MeetingCard({ meeting, currentUserId, onPress, C, styles }) {
  const STATUS_COLOR = {
    proposed:  C.warning,
    confirmed: C.success,
    declined:  C.error,
    cancelled: C.textHint,
  };
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
          <View style={[styles.badge, { backgroundColor: meeting.location_type === 'virtual' ? C.surfaceElevated : '#FFF3E0' }]}>
            <Ionicons
              name={meeting.location_type === 'virtual' ? 'videocam' : 'location'}
              size={12}
              color={meeting.location_type === 'virtual' ? C.primary : C.warning}
            />
            <Text style={[styles.badgeText, { color: meeting.location_type === 'virtual' ? C.primary : C.warning }]}>
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
  const darkMode = useAppStore(s => s.darkMode);
  const isInvestorTheme = useAppStore(s => s.isInvestorTheme);
  const C = darkMode ? investorColors : (isInvestorTheme ? investorThemeColors : colors);
  const styles = makeStyles(C);
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
    return <View style={styles.center}><ActivityIndicator size="large" color={C.primary} /></View>;
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
            C={C} styles={styles}
            onPress={() => navigation.navigate('MeetingDetail', { meeting: item })}
          />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={52} color={C.textHint} />
            <Text style={styles.emptyText}>No meetings yet</Text>
            <Text style={styles.emptySubText}>Propose a meeting from any chat conversation.</Text>
          </View>
        }
        contentContainerStyle={meetings.length === 0 ? { flex: 1 } : { padding: 16 }}
      />
    </View>
  );
}

function makeStyles(C) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.backgroundSoft },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    backgroundColor: C.surface,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
    ...cardShadow,
  },
  cardRow:    { flexDirection: 'row', alignItems: 'flex-start' },
  cardTitle:  { ...typography.titleSmall, color: C.textPrimary, marginBottom: 2 },
  cardWith:   { ...typography.bodySmall, color: C.textSecondary, marginBottom: 4 },
  cardDate:   { ...typography.bodySmall, color: C.primary },
  badges:     { alignItems: 'flex-end' },
  badge:      { flexDirection: 'row', alignItems: 'center', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3, gap: 3 },
  badgeText:  { ...typography.caption, fontWeight: '600' },
  empty:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  emptyText:  { ...typography.titleSmall, color: C.textSecondary },
  emptySubText: { ...typography.bodySmall, color: C.textHint, textAlign: 'center', paddingHorizontal: 32 },
}); }
