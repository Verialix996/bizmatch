import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { showAlert } from '../../services/alert';
import useAppStore from '../../store/appStore';
import { colors, investorColors, radius, cardShadow, typography } from '../../theme';
import { compareFounders, recomputeMatches } from '../../services/matches.service';
import { DIMENSION_LABELS } from '../../services/founders.service';
import AppShell from '../../components/AppShell';
import { ADMIN_NAV_ITEMS } from '../../config/nav';

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
      <AppShell navigation={navigation} active="matching" items={ADMIN_NAV_ITEMS}>
        <View style={styles.centered}><ActivityIndicator size="large" color={C.primary} /></View>
      </AppShell>
    );
  }

  if (!detail) {
    return (
      <AppShell navigation={navigation} active="matching" items={ADMIN_NAV_ITEMS}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No compatibility computed for this pair yet.</Text>
          <TouchableOpacity style={[styles.btnPrimary, { marginTop: 16 }]} onPress={handleRecompute} disabled={recomputing} activeOpacity={0.85}>
            {recomputing ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Compute Now</Text>}
          </TouchableOpacity>
        </View>
      </AppShell>
    );
  }

  const positives = detail.explanation?.positives || [];
  const risks = detail.explanation?.risks || [];
  const breakdown = detail.dimension_breakdown || {};

  return (
    <AppShell navigation={navigation} active="matching" items={ADMIN_NAV_ITEMS}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backRow}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

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

        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.btnSecondary, { flex: 1 }, recomputing && styles.btnDisabled]} onPress={handleRecompute} disabled={recomputing} activeOpacity={0.85}>
            {recomputing ? <ActivityIndicator color={C.primary} /> : <Text style={styles.btnSecondaryText}>Recompute</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btnPrimary, { flex: 1 }]}
            onPress={() => navigation.navigate('TeamCreation', { founderIds: [a, b] })}
            activeOpacity={0.85}
          >
            <Text style={styles.btnPrimaryText}>Create Team</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </AppShell>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
    emptyText: { ...typography.bodyMedium, color: C.textHint, textAlign: 'center' },
    backRow: { paddingHorizontal: 20, paddingTop: 16 },
    backText: { color: C.primary, ...typography.labelLarge },
    scrollContent: { padding: 20, paddingTop: 8, paddingBottom: 48, maxWidth: 700, width: '100%', alignSelf: 'center' },
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

    actionsRow: { flexDirection: 'row', gap: 12 },
    btnPrimary: { backgroundColor: C.primary, borderRadius: radius.pill, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center' },
    btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    btnSecondary: { backgroundColor: C.surface, borderRadius: radius.pill, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: C.surfaceBorder },
    btnSecondaryText: { color: C.primary, fontWeight: '700', fontSize: 14 },
    btnDisabled: { opacity: 0.6 },
  });
}
