import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, ActivityIndicator,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { showAlert } from '../../services/alert';
import useAuthStore from '../../store/authStore';
import useAppStore from '../../store/appStore';
import { colors, investorColors, radius, cardShadow, typography } from '../../theme';
import { getFounder, getFounderInsights, listEvidence, setFounderStatus } from '../../services/founders.service';
import FounderHeader from '../../components/founder/FounderHeader';
import CapabilityList from '../../components/founder/CapabilityList';
import PartnerRequirementsCard from '../../components/founder/PartnerRequirementsCard';
import InsightsList from '../../components/founder/InsightsList';
import EvidenceTimeline from '../../components/founder/EvidenceTimeline';

const STATUS_OPTIONS = ['active', 'inactive', 'dropped'];

// MVP screens 4 (Founder Profile — raw data) and 7 (Founder Insights —
// derived, distinct from Profile) live as tabs of one screen so admins and
// founders reuse the same shared components (per the reconciled plan) —
// admins get edit/evaluation actions, founders get a read-only view.
export default function FounderProfileScreen({ route, navigation }) {
  const currentUser = useAuthStore(s => s.user);
  const darkMode = useAppStore(s => s.darkMode);
  const C = darkMode ? investorColors : colors;
  const styles = makeStyles(C);

  const founderId = route.params?.founderId || currentUser?.id;
  const isAdmin = currentUser?.role === 'admin';
  const isSelf = founderId === currentUser?.id;

  const [tab, setTab] = useState('overview');
  const [founder, setFounder] = useState(null);
  const [insights, setInsights] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [founderRes, insightsRes, evidenceRes] = await Promise.all([
        getFounder(founderId),
        getFounderInsights(founderId),
        listEvidence(founderId),
      ]);
      setFounder(founderRes.data);
      setInsights(insightsRes.data);
      setEvidence(evidenceRes.data);
    } catch (err) {
      showAlert('Error', 'Could not load this founder profile.');
    } finally {
      setLoading(false);
    }
  }, [founderId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleChangeStatus = () => {
    showAlert(
      'Change Status',
      `Current status: ${founder?.status}`,
      STATUS_OPTIONS.filter(s => s !== founder?.status).map(s => ({
        text: s.charAt(0).toUpperCase() + s.slice(1),
        onPress: async () => {
          setStatusUpdating(true);
          try {
            await setFounderStatus(founderId, s);
            setFounder(prev => ({ ...prev, status: s }));
          } catch {
            showAlert('Error', 'Could not update status.');
          } finally {
            setStatusUpdating(false);
          }
        },
      })).concat([{ text: 'Cancel', style: 'cancel' }]),
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}><ActivityIndicator size="large" color={C.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        {navigation.canGoBack() ? (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        ) : <View />}
        {isSelf && (
          <TouchableOpacity onPress={() => navigation.navigate('AccountSettings')}>
            <Text style={styles.backText}>Settings</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <FounderHeader founder={founder} C={C} />

        <View style={styles.tabRow}>
          <TabButton label="Overview" active={tab === 'overview'} onPress={() => setTab('overview')} styles={styles} />
          <TabButton label="Insights" active={tab === 'insights'} onPress={() => setTab('insights')} styles={styles} />
        </View>

        {tab === 'overview' ? (
          <View style={styles.body}>
            <View style={styles.card}>
              <CapabilityList title="Provides" items={founder?.provides} C={C} />
              <CapabilityList title="Needs" items={founder?.needs} C={C} />
              <PartnerRequirementsCard requirements={founder?.partnerRequirements} dealBreakers={founder?.dealBreakers} C={C} />
              {founder?.ventureName ? (
                <Text style={[styles.venture, { color: C.textSecondary }]}>Venture: {founder.ventureName}</Text>
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={[styles.sectionLabel, { color: C.textHint }]}>Recent Evidence</Text>
              <EvidenceTimeline evidence={evidence.slice(0, 5)} C={C} />
            </View>

            {isAdmin && (
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.btnPrimary}
                  onPress={() => navigation.navigate('Evaluation', { founderId })}
                  activeOpacity={0.85}
                >
                  <Text style={styles.btnPrimaryText}>+ Add Evaluation</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.btnSecondary}
                  onPress={handleChangeStatus}
                  disabled={statusUpdating}
                  activeOpacity={0.85}
                >
                  <Text style={styles.btnSecondaryText}>
                    {statusUpdating ? 'Updating…' : 'Change Status'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.btnSecondary}
                  onPress={() => navigation.navigate('Matching', { founderId, founderName: founder?.name })}
                  activeOpacity={0.85}
                >
                  <Text style={styles.btnSecondaryText}>View Matches</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.body}>
            <View style={styles.card}>
              <InsightsList insights={insights} C={C} />
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TabButton({ label, active, onPress, styles }) {
  return (
    <TouchableOpacity style={[styles.tabBtn, active && styles.tabBtnActive]} onPress={onPress} activeOpacity={0.8}>
      <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.backgroundSoft },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingVertical: 12,
      backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.surfaceBorder,
    },
    backBtn: {},
    backText: { color: C.primary, ...typography.labelLarge },
    scrollContent: { paddingBottom: 48 },

    tabRow: { flexDirection: 'row', paddingHorizontal: 24, gap: 8, marginBottom: 8 },
    tabBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.pill, alignItems: 'center', backgroundColor: C.surface, borderWidth: 1, borderColor: C.surfaceBorder },
    tabBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
    tabBtnText: { fontSize: 13, fontWeight: '700', color: C.textSecondary },
    tabBtnTextActive: { color: '#fff' },

    body: { paddingHorizontal: 20, marginTop: 12 },
    card: { backgroundColor: C.surface, borderRadius: radius.lg, padding: 20, marginBottom: 16, ...cardShadow },
    sectionLabel: { ...typography.labelSmall, textTransform: 'uppercase', marginBottom: 12 },
    venture: { ...typography.bodyMedium, marginTop: 12 },

    actionsRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
    btnPrimary: { flex: 1, backgroundColor: C.primary, borderRadius: radius.pill, paddingVertical: 14, alignItems: 'center' },
    btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    btnSecondary: { flex: 1, backgroundColor: C.surface, borderRadius: radius.pill, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: C.surfaceBorder },
    btnSecondaryText: { color: C.textSecondary, fontWeight: '700', fontSize: 13 },
  });
}
