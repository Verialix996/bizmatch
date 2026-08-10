import {
  View, Text, TouchableOpacity, FlatList,
  StyleSheet, SafeAreaView, StatusBar, ActivityIndicator,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import useAuthStore from '../../store/authStore';
import useAppStore from '../../store/appStore';
import { colors, investorColors, radius, cardShadow, typography } from '../../theme';
import { listActivities, ACTIVITY_TYPE_LABELS } from '../../services/activities.service';

const STATUS_LABELS = { upcoming: 'Upcoming', active: 'Active', completed: 'Completed' };

// MVP screen 5 — Activities: list with type, date, participant count, status.
// No calendar/drag-drop/per-activity analytics per the MVP screen spec.
export default function ActivitiesListScreen({ navigation }) {
  const isAdmin = useAuthStore(s => s.user?.role === 'admin');
  const darkMode = useAppStore(s => s.darkMode);
  const C = darkMode ? investorColors : colors;
  const styles = makeStyles(C);

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await listActivities();
      setActivities(data);
    } catch {
      // silent — empty list renders its own "no activities" state
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Activities</Text>
        {isAdmin ? (
          <TouchableOpacity onPress={() => navigation.navigate('ActivityDetail', {})}>
            <Text style={styles.backText}>+ New</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 50 }} />}
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={C.primary} /></View>
      ) : activities.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No activities scheduled yet</Text>
        </View>
      ) : (
        <FlatList
          data={activities}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => navigation.navigate('ActivityDetail', { activityId: item.id })}
              activeOpacity={0.75}
            >
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowMeta}>
                  {ACTIVITY_TYPE_LABELS[item.type] || item.type}
                  {item.scheduledAt ? ` · ${new Date(item.scheduledAt).toLocaleDateString()}` : ''}
                  {' · '}{item.participantCount} participant{item.participantCount === 1 ? '' : 's'}
                </Text>
              </View>
              <View style={[styles.statusBadge, item.status === 'active' && styles.statusBadgeActive, item.status === 'completed' && styles.statusBadgeCompleted]}>
                <Text style={styles.statusBadgeText}>{STATUS_LABELS[item.status] || item.status}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.backgroundSoft },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { ...typography.bodyMedium, color: C.textHint },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingVertical: 14, backgroundColor: C.surface,
      borderBottomWidth: 1, borderBottomColor: C.surfaceBorder,
    },
    backText: { color: C.primary, ...typography.labelLarge },
    headerTitle: { ...typography.titleMedium, color: C.textPrimary },
    listContent: { padding: 20 },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: C.surface, borderRadius: radius.lg, padding: 14, marginBottom: 10, ...cardShadow,
    },
    rowBody: { flex: 1 },
    rowTitle: { ...typography.titleSmall, color: C.textPrimary },
    rowMeta: { ...typography.bodySmall, color: C.textSecondary, marginTop: 2 },
    statusBadge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: C.surfaceElevated },
    statusBadgeActive: { backgroundColor: C.warningLight },
    statusBadgeCompleted: { backgroundColor: C.successLight },
    statusBadgeText: { fontSize: 11, fontWeight: '700', color: C.textSecondary },
  });
}
