import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, SafeAreaView, StatusBar, ActivityIndicator,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import useAuthStore from '../../store/authStore';
import useAppStore from '../../store/appStore';
import { colors, investorColors, radius, cardShadow, typography } from '../../theme';
import { getDashboard } from '../../services/founders.service';

// MVP screen 2 — Admin Dashboard: program overview, recent activity, needs
// attention, quick actions. No complex charts/analytics/AI recommendations
// per the MVP screen spec.
export default function AdminDashboardScreen({ navigation }) {
  const logout = useAuthStore(s => s.logout);
  const darkMode = useAppStore(s => s.darkMode);
  const C = darkMode ? investorColors : colors;
  const styles = makeStyles(C);

  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getDashboard();
      setDashboard(data);
    } catch {
      // silent — stat tiles just render 0/empty
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading && !dashboard) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}><ActivityIndicator size="large" color={C.primary} /></View>
      </SafeAreaView>
    );
  }

  const program = dashboard?.program;
  const incompleteFounders = dashboard?.needsAttention?.incompleteFounders || [];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View>
            <Text style={styles.programLabel}>{program?.cohort_label || 'No active program'}</Text>
            <Text style={styles.programName}>{program?.name || 'Admin Dashboard'}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => navigation.navigate('AccountSettings')}>
              <Text style={styles.logoutText}>Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={logout}>
              <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Program Overview stat tiles */}
        <View style={styles.statsGrid}>
          <StatTile label="Active Founders" value={dashboard?.activeFounderCount ?? 0} C={C} styles={styles} />
          <StatTile label="Evaluations Done" value={dashboard?.completedEvaluationsCount ?? 0} C={C} styles={styles} />
          <StatTile label="Missing Info" value={dashboard?.missingInfoCount ?? 0} C={C} styles={styles} warn />
          <StatTile label="Teams Created" value={dashboard?.teamsCreatedCount ?? 0} C={C} styles={styles} />
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <ActionCard label="View Founders" icon="👥" onPress={() => navigation.navigate('FounderList')} styles={styles} />
          <ActionCard label="Add Evaluation" icon="📝" onPress={() => navigation.navigate('FounderList')} styles={styles} />
          <ActionCard
            label="Go to Matching"
            icon="🤝"
            onPress={() => navigation.navigate('Matching', {})}
            styles={styles}
          />
          <ActionCard
            label="Create Activity"
            icon="📅"
            onPress={() => navigation.navigate('Activities')}
            styles={styles}
          />
        </View>

        {/* Needs Attention */}
        <Text style={styles.sectionTitle}>Needs Attention</Text>
        <View style={styles.card}>
          {incompleteFounders.length === 0 ? (
            <Text style={styles.emptyText}>Nothing needs attention right now.</Text>
          ) : (
            incompleteFounders.map((f) => (
              <TouchableOpacity
                key={f.id}
                style={styles.attentionRow}
                onPress={() => navigation.navigate('FounderProfile', { founderId: f.id })}
                activeOpacity={0.75}
              >
                <Text style={styles.attentionText}>{f.name || 'Unnamed founder'} — profile incomplete</Text>
                <Text style={styles.attentionArrow}>→</Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Recent Activity */}
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <View style={styles.card}>
          {(dashboard?.recentActivity || []).length === 0 ? (
            <Text style={styles.emptyText}>No recent activity yet.</Text>
          ) : (
            dashboard.recentActivity.map((item, i) => (
              <View key={i} style={styles.activityRow}>
                <Text style={styles.activityText}>
                  {item.evaluatorName} evaluated {item.founderName}
                </Text>
                <Text style={styles.activityTime}>{new Date(item.at).toLocaleDateString()}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatTile({ label, value, C, styles, warn }) {
  return (
    <View style={styles.statTile}>
      <Text style={[styles.statValue, warn && value > 0 && { color: C.warning }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActionCard({ label, icon, onPress, styles }) {
  return (
    <TouchableOpacity style={styles.actionCard} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.actionIcon}>{icon}</Text>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.backgroundSoft },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { padding: 20, paddingBottom: 48 },

    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
    programLabel: { ...typography.labelSmall, color: C.textHint, textTransform: 'uppercase' },
    programName: { ...typography.displayMedium, color: C.textPrimary, marginTop: 2 },
    headerActions: { alignItems: 'flex-end', gap: 8 },
    logoutText: { ...typography.labelLarge, color: C.textSecondary },

    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
    statTile: {
      width: '47%', backgroundColor: C.surface, borderRadius: radius.lg, padding: 16, ...cardShadow,
    },
    statValue: { fontSize: 28, fontWeight: '800', color: C.textPrimary },
    statLabel: { ...typography.bodySmall, color: C.textSecondary, marginTop: 4 },

    sectionTitle: { ...typography.titleSmall, color: C.textPrimary, marginBottom: 12, marginTop: 4 },
    actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
    actionCard: {
      width: '47%', backgroundColor: C.surface, borderRadius: radius.lg, padding: 16,
      alignItems: 'center', ...cardShadow,
    },
    actionIcon: { fontSize: 24, marginBottom: 6 },
    actionLabel: { ...typography.bodySmall, fontWeight: '700', color: C.textPrimary, textAlign: 'center' },

    card: { backgroundColor: C.surface, borderRadius: radius.lg, padding: 16, marginBottom: 24, ...cardShadow },
    emptyText: { ...typography.bodyMedium, color: C.textHint, textAlign: 'center', paddingVertical: 8 },
    attentionRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.surfaceBorder,
    },
    attentionText: { ...typography.bodyMedium, color: C.textPrimary, flex: 1 },
    attentionArrow: { color: C.textHint, fontSize: 16 },
    activityRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.surfaceBorder,
    },
    activityText: { ...typography.bodyMedium, color: C.textPrimary, flex: 1 },
    activityTime: { ...typography.caption, color: C.textHint },
  });
}
