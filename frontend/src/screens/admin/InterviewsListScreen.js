import {
  View, Text, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useState, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import useAppStore from '../../store/appStore';
import { colors, investorColors, radius, cardShadow, typography } from '../../theme';
import { listAllInterviews } from '../../services/interviews.service';
import AppShell from '../../components/AppShell';
import { ADMIN_NAV_ITEMS } from '../../config/nav';
import { Avatar, Pill } from '../../components/ui';

const FILTERS = ['all', 'in_progress', 'completed'];
const FILTER_LABELS = { all: 'All', in_progress: 'In Progress', completed: 'Completed' };
const STATUS_LABELS = { in_progress: 'In Progress', completed: 'Completed' };

// Promotes interviews out of being buried inside each founder's profile
// into their own top-level nav item — a cohort-wide dashboard of every
// interview (any founder, any status), reusing the existing NewInterview/
// InterviewRunner flows rather than duplicating them (per the informal
// interview-notes doc's main ask).
export default function InterviewsListScreen({ navigation }) {
  const darkMode = useAppStore(s => s.darkMode);
  const C = darkMode ? investorColors : colors;
  const styles = makeStyles(C);

  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await listAllInterviews();
      setInterviews(data);
    } catch {
      // silent — empty list renders its own "no interviews" state
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    if (filter === 'all') return interviews;
    return interviews.filter(iv => iv.status === filter);
  }, [interviews, filter]);

  const counts = useMemo(() => ({
    total: interviews.length,
    inProgress: interviews.filter(iv => iv.status === 'in_progress').length,
    completed: interviews.filter(iv => iv.status === 'completed').length,
  }), [interviews]);

  return (
    <AppShell navigation={navigation} active="interviews" items={ADMIN_NAV_ITEMS}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Interviews</Text>
            <Text style={styles.headerSubtitle}>Run and review dimension-mapping interviews across the cohort.</Text>
          </View>
          <TouchableOpacity style={styles.newBtn} onPress={() => navigation.navigate('NewInterview')} activeOpacity={0.85}>
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={styles.newBtnText}>New Interview</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statRow}>
          <View style={styles.statTile}>
            <Text style={styles.statValue}>{counts.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={[styles.statValue, { color: C.warning }]}>{counts.inProgress}</Text>
            <Text style={styles.statLabel}>In Progress</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={[styles.statValue, { color: C.success }]}>{counts.completed}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
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
            <Text style={styles.emptyText}>No interviews {filter === 'all' ? 'yet' : `in "${FILTER_LABELS[filter]}"`}</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.row}
                onPress={() => navigation.navigate(
                  item.status === 'completed' ? 'InterviewSummary' : 'InterviewRunner',
                  { interviewId: item.id },
                )}
                activeOpacity={0.75}
              >
                <Avatar photoUrl={item.founderPhotoUrl} name={item.founderName} size={40} C={C} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{item.founderName || 'Unnamed founder'}</Text>
                  <Text style={styles.rowMeta}>
                    {item.interviewerName ? `Interviewer: ${item.interviewerName} · ` : ''}
                    {item.status === 'completed' && item.completedAt
                      ? `Completed ${new Date(item.completedAt).toLocaleDateString()}`
                      : `Started ${new Date(item.startedAt || item.createdAt).toLocaleDateString()}${item.answeredCount ? ` · ${item.answeredCount} answered` : ''}`}
                  </Text>
                </View>
                <Pill
                  label={STATUS_LABELS[item.status] || item.status}
                  C={C}
                  bg={item.status === 'completed' ? C.successLight : C.warningLight}
                  color={item.status === 'completed' ? C.success : C.warning}
                />
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

    statRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    statTile: {
      flex: 1, backgroundColor: C.surface, borderRadius: radius.lg, padding: 14, alignItems: 'center', ...cardShadow,
    },
    statValue: { fontSize: 24, fontWeight: '800', color: C.textPrimary },
    statLabel: { ...typography.caption, color: C.textHint, marginTop: 2 },

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
