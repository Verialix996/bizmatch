import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, SafeAreaView, StatusBar, ActivityIndicator,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { showAlert } from '../../services/alert';
import useAppStore from '../../store/appStore';
import { colors, investorColors, radius, cardShadow, typography } from '../../theme';
import { compareFounders, recomputeMatches } from '../../services/matches.service';
import { DIMENSION_LABELS } from '../../services/founders.service';

// MVP screen 8 — Founder A vs Founder B compare card: Match Score, why
// (positives), Potential Friction/Risk, dimension-by-dimension breakdown.
export default function MatchDetailScreen({ route, navigation }) {
  const { a, b } = route.params || {};
  const darkMode = useAppStore(s => s.darkMode);
  const C = darkMode ? investorColors : colors;
  const styles = makeStyles(C);

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await compareFounders(a, b);
      setDetail(data);
    } catch {
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [a, b]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleRecompute = async () => {
    setRecomputing(true);
    try {
      await recomputeMatches(a);
      await load();
    } catch {
      showAlert('Error', 'Could not recompute this match.');
    } finally {
      setRecomputing(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}><ActivityIndicator size="large" color={C.primary} /></View>
      </SafeAreaView>
    );
  }

  if (!detail) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No compatibility computed for this pair yet.</Text>
          <TouchableOpacity style={[styles.btnPrimary, { marginTop: 16 }]} onPress={handleRecompute} disabled={recomputing} activeOpacity={0.85}>
            {recomputing ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Compute Now</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const positives = detail.explanation?.positives || [];
  const risks = detail.explanation?.risks || [];
  const breakdown = detail.dimension_breakdown || {};

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Match Detail</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <View style={styles.namesRow}>
            <Text style={styles.founderName}>{detail.a_name || 'Founder A'}</Text>
            <Text style={styles.vsText}>vs</Text>
            <Text style={styles.founderName}>{detail.b_name || 'Founder B'}</Text>
          </View>
          <Text style={styles.scoreValue}>{detail.score}</Text>
          <Text style={styles.scoreLabel}>Match Score</Text>
          {detail.requires_admin_review ? (
            <View style={styles.reviewBanner}>
              <Text style={styles.reviewBannerText}>⚠ Deal breakers stated — needs admin review before pairing.</Text>
            </View>
          ) : null}
        </View>

        {positives.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Why it works</Text>
            {positives.map((p, i) => <Text key={i} style={styles.bullet}>• {p}</Text>)}
          </View>
        )}

        {risks.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Potential Friction</Text>
            {risks.map((r, i) => <Text key={i} style={[styles.bullet, { color: C.warning }]}>• {r}</Text>)}
          </View>
        )}

        {(detail.deal_breaker_flags || []).length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Stated Deal Breakers</Text>
            {detail.deal_breaker_flags.map((f, i) => <Text key={i} style={[styles.bullet, { color: C.error }]}>• {f}</Text>)}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Dimension Breakdown</Text>
          {Object.keys(breakdown).map((dim) => {
            const row = breakdown[dim];
            return (
              <View key={dim} style={styles.dimRow}>
                <Text style={styles.dimLabel}>{DIMENSION_LABELS[dim] || dim}</Text>
                <Text style={styles.dimValues}>
                  {row.a ?? '—'} / {row.b ?? '—'}
                  {row.gap != null ? `  (gap ${row.gap})` : ''}
                </Text>
              </View>
            );
          })}
        </View>

        <TouchableOpacity style={[styles.btnSecondary, recomputing && styles.btnDisabled]} onPress={handleRecompute} disabled={recomputing} activeOpacity={0.85}>
          {recomputing ? <ActivityIndicator color={C.primary} /> : <Text style={styles.btnSecondaryText}>Recompute</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.backgroundSoft },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
    emptyText: { ...typography.bodyMedium, color: C.textHint, textAlign: 'center' },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingVertical: 14, backgroundColor: C.surface,
      borderBottomWidth: 1, borderBottomColor: C.surfaceBorder,
    },
    backText: { color: C.primary, ...typography.labelLarge },
    headerTitle: { ...typography.titleMedium, color: C.textPrimary },
    scrollContent: { padding: 20, paddingBottom: 48 },
    card: { backgroundColor: C.surface, borderRadius: radius.lg, padding: 18, marginBottom: 14, ...cardShadow },

    namesRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12 },
    founderName: { ...typography.titleSmall, color: C.textPrimary },
    vsText: { ...typography.bodySmall, color: C.textHint },
    scoreValue: { fontSize: 40, fontWeight: '800', color: C.primary, textAlign: 'center' },
    scoreLabel: { ...typography.bodySmall, color: C.textHint, textAlign: 'center', marginTop: 2 },

    reviewBanner: { backgroundColor: C.warningLight, borderRadius: radius.md, padding: 10, marginTop: 14 },
    reviewBannerText: { color: C.warning, ...typography.bodySmall, fontWeight: '700', textAlign: 'center' },

    sectionLabel: { ...typography.labelSmall, textTransform: 'uppercase', color: C.textHint, marginBottom: 10 },
    bullet: { ...typography.bodyMedium, color: C.textPrimary, marginBottom: 6, lineHeight: 20 },

    dimRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.surfaceBorder,
    },
    dimLabel: { ...typography.bodyMedium, color: C.textPrimary },
    dimValues: { ...typography.bodySmall, color: C.textSecondary },

    btnPrimary: { backgroundColor: C.primary, borderRadius: radius.pill, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center' },
    btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    btnSecondary: { backgroundColor: C.surface, borderRadius: radius.pill, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: C.surfaceBorder },
    btnSecondaryText: { color: C.primary, fontWeight: '700', fontSize: 14 },
    btnDisabled: { opacity: 0.6 },
  });
}
