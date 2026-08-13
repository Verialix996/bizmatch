import {
  View, Text, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useState, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import useAuthStore from '../../store/authStore';
import useAppStore from '../../store/appStore';
import { colors, investorColors, radius, cardShadow, typography } from '../../theme';
import { listActivities, ACTIVITY_TYPE_LABELS } from '../../services/activities.service';
import AppShell from '../../components/AppShell';
import { ADMIN_NAV_ITEMS, FOUNDER_NAV_ITEMS } from '../../config/nav';
import { IconCircle, Pill } from '../../components/ui';

const STATUS_LABELS = { upcoming: 'Upcoming', active: 'Active', completed: 'Completed' };
const ADMIN_FILTERS = ['all', 'upcoming', 'active', 'completed'];
// Founders never see an "all" bucket — Upcoming is the browse/sign-up list,
// Active/Completed only ever contain activities they're approved into.
const FOUNDER_FILTERS = ['upcoming', 'active', 'completed'];
const FILTER_LABELS = { all: 'All', upcoming: 'Upcoming', active: 'Active', completed: 'Completed' };

const MY_STATUS_LABELS = { pending: 'Pending approval', approved: 'Registered', rejected: 'Not approved' };
const MY_STATUS_COLORS = {
  pending: (C) => ({ bg: C.warningLight, color: C.warning }),
  approved: (C) => ({ bg: C.successLight, color: C.success }),
  rejected: (C) => ({ bg: C.surfaceElevated, color: C.textSecondary }),
};

const TYPE_ICONS = {
  hackathon: 'flash-outline',
  workshop: 'people-outline',
  interview: 'person-outline',
  team_challenge: 'trophy-outline',
  work_trial: 'briefcase-outline',
};

// MVP screen 5 — Activities: list with type, date, participant count, status.
// No calendar/drag-drop/per-activity analytics per the MVP screen spec.
export default function ActivitiesListScreen({ navigation }) {
  const isAdmin = useAuthStore(s => s.user?.role === 'admin');
  const darkMode = useAppStore(s => s.darkMode);
  const C = darkMode ? investorColors : colors;
  const styles = makeStyles(C);

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(isAdmin ? 'all' : 'upcoming');
  const FILTERS = isAdmin ? ADMIN_FILTERS : FOUNDER_FILTERS;

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

  const filtered = useMemo(() => {
    if (filter === 'all') return activities;
    if (isAdmin) return activities.filter(a => a.status === filter);
    // Founder tabs are registration-status-driven, not activity-lifecycle-
    // driven, and mutually exclusive: the moment a request is approved it
    // moves out of Upcoming and into Active — it doesn't wait for the
    // activity itself to be marked 'active', and it no longer clutters the
    // browse/sign-up list once you're already in.
    if (filter === 'upcoming') return activities.filter(a => a.status === 'upcoming' && a.myStatus !== 'approved');
    if (filter === 'active') return activities.filter(a => a.myStatus === 'approved' && a.status !== 'completed');
    return activities.filter(a => a.status === 'completed' && a.myStatus === 'approved');
  }, [activities, filter, isAdmin]);

  return (
    <AppShell navigation={navigation} active="activities" items={isAdmin ? ADMIN_NAV_ITEMS : FOUNDER_NAV_ITEMS}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Activities</Text>
            <Text style={styles.headerSubtitle}>Manage interviews, workshops, pitches and cohort activities.</Text>
          </View>
          {isAdmin ? (
            <TouchableOpacity style={styles.newBtn} onPress={() => navigation.navigate('ActivityDetail', {})} activeOpacity={0.85}>
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.newBtnText}>Create Activity</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.filterRow}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={() => setFilter(f)}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
                {FILTER_LABELS[f]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color={C.primary} /></View>
        ) : filtered.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No activities {filter === 'all' ? 'scheduled yet' : `in "${FILTER_LABELS[filter]}"`}</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.row}
                onPress={() => navigation.navigate('ActivityDetail', { activityId: item.id })}
                activeOpacity={0.75}
              >
                <IconCircle name={TYPE_ICONS[item.type] || 'calendar-outline'} color={C.primary} bg={C.surfaceElevated} size={40} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{item.title}</Text>
                  <Text style={styles.rowMeta}>
                    {ACTIVITY_TYPE_LABELS[item.type] || item.type}
                    {item.scheduledAt ? ` · ${new Date(item.scheduledAt).toLocaleDateString()}` : ''}
                    {' · '}{item.participantCount} participant{item.participantCount === 1 ? '' : 's'}
                  </Text>
                </View>
                {!isAdmin && item.myStatus ? (
                  <Pill
                    label={MY_STATUS_LABELS[item.myStatus] || item.myStatus}
                    C={C}
                    bg={MY_STATUS_COLORS[item.myStatus](C).bg}
                    color={MY_STATUS_COLORS[item.myStatus](C).color}
                  />
                ) : (
                  <Pill
                    label={STATUS_LABELS[item.status] || item.status}
                    C={C}
                    bg={item.status === 'active' ? C.warningLight : item.status === 'completed' ? C.successLight : C.surfaceElevated}
                    color={item.status === 'active' ? C.warning : item.status === 'completed' ? C.success : C.textSecondary}
                  />
                )}
                <Ionicons name="chevron-forward" size={18} color={C.textHint} />
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </AppShell>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    content: { flex: 1, padding: 20, maxWidth: 1000, width: '100%', alignSelf: 'center' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
    emptyText: { ...typography.bodyMedium, color: C.textHint },

    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12, flexWrap: 'wrap' },
    headerTitle: { ...typography.displayMedium, color: C.textPrimary },
    headerSubtitle: { ...typography.bodyMedium, color: C.textSecondary, marginTop: 4 },
    newBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: C.primary, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 10,
    },
    newBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

    filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: C.surface, borderWidth: 1, borderColor: C.surfaceBorder },
    filterChipActive: { backgroundColor: C.surfaceElevated, borderColor: C.primary },
    filterChipText: { fontSize: 13, fontWeight: '600', color: C.textSecondary },
    filterChipTextActive: { color: C.primary },

    listContent: { paddingBottom: 40 },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: C.surface, borderRadius: radius.lg, padding: 14, marginBottom: 10, ...cardShadow,
    },
    rowBody: { flex: 1 },
    rowTitle: { ...typography.titleSmall, color: C.textPrimary },
    rowMeta: { ...typography.bodySmall, color: C.textSecondary, marginTop: 2 },
  });
}
