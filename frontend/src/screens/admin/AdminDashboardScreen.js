import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { showAlert } from '../../services/alert';
import useAppStore from '../../store/appStore';
import { colors, investorColors, radius, cardShadow, typography } from '../../theme';
import { getDashboard } from '../../services/founders.service';
import AppShell from '../../components/AppShell';
import { ADMIN_NAV_ITEMS } from '../../config/nav';
import { GradientHero, StatTile, IconCircle, SectionCard, useIsDesktop } from '../../components/ui';

// MVP screen 2 — Admin Dashboard: program overview, recent activity, needs
// attention, quick actions. No complex charts/analytics/AI recommendations
// per the MVP screen spec.
export default function AdminDashboardScreen({ navigation }) {
  const darkMode = useAppStore(s => s.darkMode);
  const C = darkMode ? investorColors : colors;
  const styles = makeStyles(C);
  const isDesktop = useIsDesktop();

  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  // ERR-01: a failed load previously just left dashboard null, and every
  // stat tile below reads `dashboard?.x ?? 0` — indistinguishable from a
  // genuinely-empty cohort. This flag lets the page say so instead.
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getDashboard();
      setDashboard(data);
      setLoadError(false);
    } catch {
      setLoadError(true);
      showAlert('Error', 'Could not load dashboard data. Try refreshing the page.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const program = dashboard?.program;
  const incompleteFounders = dashboard?.needsAttention?.incompleteFounders || [];

  if (loading && !dashboard) {
    return (
      <AppShell navigation={navigation} active="dashboard" items={ADMIN_NAV_ITEMS}>
        <View style={styles.centered}><ActivityIndicator size="large" color={C.primary} /></View>
      </AppShell>
    );
  }

  return (
    <AppShell navigation={navigation} active="dashboard" items={ADMIN_NAV_ITEMS}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {loadError && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={16} color={C.error} />
            <Text style={styles.errorBannerText}>Couldn't load dashboard data — the numbers below may be stale or empty.</Text>
          </View>
        )}
        <GradientHero style={styles.hero}>
          <Text style={styles.heroLabel}>{program?.cohort_label || 'No active program'}</Text>
          <Text style={styles.heroTitle}>{program?.name || 'Admin Dashboard'}</Text>
        </GradientHero>

        <Text style={styles.sectionTitle}>Program Overview</Text>
        <View style={styles.statsGrid}>
          <StatTile
            icon="people-outline" value={dashboard?.activeFounderCount ?? 0} label="Active Founders" C={C}
          />
          <StatTile
            icon="checkmark-done-outline" value={dashboard?.completedEvaluationsCount ?? 0} label="Evaluations Done" C={C}
          />
          <StatTile
            icon="alert-circle-outline" value={dashboard?.missingInfoCount ?? 0} label="Missing Info" C={C}
            warn={(dashboard?.missingInfoCount ?? 0) > 0}
            iconColor={C.warning} iconBg={C.warningLight}
          />
          <StatTile
            icon="people-circle-outline" value={dashboard?.teamsCreatedCount ?? 0} label="Teams Created" C={C}
          />
        </View>

        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <ActionCard
            label="View Founders" icon="people-outline" C={C} styles={styles}
            onPress={() => navigation.navigate('FounderList')}
          />
          <ActionCard
            label="Add Evaluation" icon="clipboard-outline" C={C} styles={styles}
            onPress={() => navigation.navigate('FounderList')}
          />
          <ActionCard
            label="Go to Matching" icon="git-merge-outline" C={C} styles={styles} primary
            onPress={() => navigation.navigate('Matching', {})}
          />
          <ActionCard
            label="Create Activity" icon="calendar-outline" C={C} styles={styles}
            onPress={() => navigation.navigate('Activities')}
          />
          <ActionCard
            label="Create Team" icon="person-add-outline" C={C} styles={styles}
            onPress={() => navigation.navigate('TeamCreation', {})}
          />
        </View>

        <View style={isDesktop ? styles.bottomRow : null}>
          <View style={isDesktop ? styles.bottomCol : null}>
            <Text style={styles.sectionTitle}>Needs Attention</Text>
            <SectionCard C={C} style={styles.listCard}>
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
                    <IconCircle name="alert-circle" color={C.warning} bg={C.warningLight} size={32} iconSize={16} />
                    <Text style={styles.attentionText}>{f.name || 'Unnamed founder'} — profile incomplete</Text>
                    <Ionicons name="chevron-forward" size={16} color={C.textHint} />
                  </TouchableOpacity>
                ))
              )}
            </SectionCard>
          </View>

          <View style={isDesktop ? styles.bottomCol : null}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <SectionCard C={C} style={styles.listCard}>
              {(dashboard?.recentActivity || []).length === 0 ? (
                <Text style={styles.emptyText}>No recent activity yet.</Text>
              ) : (
                dashboard.recentActivity.map((item, i) => (
                  <View key={i} style={styles.activityRow}>
                    <IconCircle name="checkmark-circle" color={C.success} bg={C.successLight} size={32} iconSize={16} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activityText}>
                        {item.evaluatorName} evaluated {item.founderName}
                      </Text>
                    </View>
                    <Text style={styles.activityTime}>{new Date(item.at).toLocaleDateString()}</Text>
                  </View>
                ))
              )}
            </SectionCard>
          </View>
        </View>
      </ScrollView>
    </AppShell>
  );
}

function ActionCard({ label, icon, onPress, styles, C, primary }) {
  return (
    <TouchableOpacity style={[styles.actionCard, primary && styles.actionCardPrimary]} onPress={onPress} activeOpacity={0.8}>
      <Ionicons name={icon} size={24} color={primary ? '#fff' : C.primary} />
      <Text style={[styles.actionLabel, primary && { color: '#fff' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { padding: 20, paddingBottom: 48, maxWidth: 1200, width: '100%', alignSelf: 'center' },
    errorBanner: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: C.errorLight, borderRadius: radius.md, padding: 12, marginBottom: 16,
    },
    errorBannerText: { ...typography.bodySmall, color: C.error, flex: 1 },

    hero: { padding: 24, marginBottom: 24 },
    heroLabel: { ...typography.labelSmall, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase' },
    heroTitle: { ...typography.displayLarge, color: '#fff', marginTop: 4 },

    sectionTitle: { ...typography.titleSmall, color: C.textPrimary, marginBottom: 12, marginTop: 4 },

    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },

    actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
    actionCard: {
      width: '31%', minWidth: 140, backgroundColor: C.surface, borderRadius: radius.lg, padding: 16,
      alignItems: 'center', gap: 8, ...cardShadow,
    },
    actionCardPrimary: { backgroundColor: C.primary },
    actionLabel: { ...typography.bodySmall, fontWeight: '700', color: C.textPrimary, textAlign: 'center' },

    bottomRow: { flexDirection: 'row', gap: 24 },
    bottomCol: { flex: 1 },

    listCard: { marginBottom: 24, padding: 8 },
    emptyText: { ...typography.bodyMedium, color: C.textHint, textAlign: 'center', paddingVertical: 16 },
    attentionRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: C.surfaceBorder,
    },
    attentionText: { ...typography.bodyMedium, color: C.textPrimary, flex: 1 },
    activityRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: C.surfaceBorder,
    },
    activityText: { ...typography.bodyMedium, color: C.textPrimary },
    activityTime: { ...typography.caption, color: C.textHint },
  });
}
