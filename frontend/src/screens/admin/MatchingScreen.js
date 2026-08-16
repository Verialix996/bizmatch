import {
  View, Text, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { showAlert } from '../../services/alert';
import useAppStore from '../../store/appStore';
import { colors, investorColors, typography, radius, cardShadow } from '../../theme';
import { getTopPairs, recomputeMatches, compareFounders } from '../../services/matches.service';
import { DIMENSION_LABELS } from '../../services/founders.service';
import MatchCard from '../../components/founder/MatchCard';
import AppShell from '../../components/AppShell';
import { ADMIN_NAV_ITEMS } from '../../config/nav';

const DIMENSIONS = ['execution', 'integrity', 'commitment', 'communication', 'conflict', 'resilience', 'ego', 'values'];

// MVP screen 8 — Suggested Matches: cohort-wide ranked founder pairs. When
// reached from a founder's profile ("View Matches"), route.params.founderId
// scopes the same ranked list to pairs involving just that founder — a
// filtered lens on this screen rather than a separate one-sided flow.
export default function MatchingScreen({ route, navigation }) {
  const darkMode = useAppStore(s => s.darkMode);
  const C = darkMode ? investorColors : colors;
  const styles = makeStyles(C);

  const scopedFounderId = route.params?.founderId ?? null;
  const scopedFounderName = route.params?.founderName ?? null;

  const [pairs, setPairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);

  // MAT-06: evaluator-side mirror of the founder's own "compare my matches"
  // feature — pick two pairs from the cohort-wide list and see both pairs'
  // full detail side by side.
  const [compareMode, setCompareMode] = useState(false);
  const [selectedPairs, setSelectedPairs] = useState([]); // up to 2 pair keys
  const [comparing, setComparing] = useState(false);
  const [compareResults, setCompareResults] = useState(null); // [detailA, detailB]

  const pairKey = (p) => `${p.a.id}-${p.b.id}`;

  const toggleCompareMode = () => {
    setCompareMode(v => !v);
    setSelectedPairs([]);
    setCompareResults(null);
  };

  const toggleSelectPair = (p) => {
    const key = pairKey(p);
    setCompareResults(null);
    setSelectedPairs(prev => {
      if (prev.includes(key)) return prev.filter(k => k !== key);
      if (prev.length >= 2) return [prev[1], key]; // keep it a max-2 selection, drop the oldest
      return [...prev, key];
    });
  };

  const handleCompareSelected = async () => {
    if (selectedPairs.length !== 2) return;
    setComparing(true);
    setCompareResults(null);
    try {
      const [keyA, keyB] = selectedPairs;
      const pairA = pairs.find(p => pairKey(p) === keyA);
      const pairB = pairs.find(p => pairKey(p) === keyB);
      const [resA, resB] = await Promise.all([
        compareFounders(pairA.a.id, pairA.b.id),
        compareFounders(pairB.a.id, pairB.b.id),
      ]);
      setCompareResults([resA.data, resB.data]);
    } catch {
      showAlert('Error', 'Could not load comparison detail for one or both pairs.');
    } finally {
      setComparing(false);
    }
  };

  const loadPairs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getTopPairs(20, scopedFounderId ?? undefined);
      setPairs(data);
    } catch {
      setPairs([]);
    } finally {
      setLoading(false);
    }
  }, [scopedFounderId]);

  useFocusEffect(useCallback(() => { loadPairs(); }, [loadPairs]));

  const handleRecompute = async () => {
    if (!scopedFounderId) return;
    setRecomputing(true);
    try {
      await recomputeMatches(scopedFounderId);
      await loadPairs();
    } catch {
      showAlert('Error', 'Could not recompute matches.');
    } finally {
      setRecomputing(false);
    }
  };

  return (
    <AppShell navigation={navigation} active="matching" items={ADMIN_NAV_ITEMS}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            {scopedFounderId ? (
              <TouchableOpacity onPress={() => navigation.setParams({ founderId: undefined, founderName: undefined })}>
                <Text style={styles.backText}>← All suggestions</Text>
              </TouchableOpacity>
            ) : null}
            <Text style={styles.headerTitle}>Suggested Matches</Text>
            <Text style={styles.headerSubtitle}>
              {scopedFounderId
                ? `Pairs involving ${scopedFounderName || 'this founder'}`
                : 'Review potential founder pairs based on skills, goals, work style, and values.'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            {scopedFounderId ? (
              <TouchableOpacity onPress={handleRecompute} disabled={recomputing}>
                <Text style={styles.backText}>{recomputing ? '…' : 'Refresh'}</Text>
              </TouchableOpacity>
            ) : null}
            {pairs.length >= 2 && (
              <TouchableOpacity onPress={toggleCompareMode}>
                <Text style={styles.backText}>{compareMode ? 'Cancel compare' : 'Compare'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {compareMode && (
          <View style={styles.compareBar}>
            <Text style={styles.compareBarText}>
              {selectedPairs.length === 2 ? '2 pairs selected' : `Select ${2 - selectedPairs.length} more pair${selectedPairs.length === 0 ? 's' : ''} to compare`}
            </Text>
            <TouchableOpacity
              style={[styles.btnPrimary, (selectedPairs.length !== 2 || comparing) && styles.btnDisabled]}
              onPress={handleCompareSelected}
              disabled={selectedPairs.length !== 2 || comparing}
              activeOpacity={0.85}
            >
              {comparing ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Compare Selected</Text>}
            </TouchableOpacity>
          </View>
        )}

        {compareResults && (
          <View style={styles.compareResultRow}>
            {compareResults.map((detail, i) => (
              <CompareDetailCard key={i} detail={detail} C={C} styles={styles} />
            ))}
          </View>
        )}

        <Text style={styles.countLabel}>{loading ? 'Loading…' : `${pairs.length} suggestion${pairs.length === 1 ? '' : 's'}`}</Text>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color={C.primary} /></View>
        ) : pairs.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>No compatibility computed yet for this cohort.</Text>
          </View>
        ) : (
          <FlatList
            data={pairs}
            keyExtractor={(item) => `${item.a.id}-${item.b.id}`}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <MatchCard
                pair={item}
                C={C}
                onCreateTeam={() => navigation.navigate('TeamCreation', { founderIds: [item.a.id, item.b.id] })}
                onViewMatch={() => navigation.navigate('MatchDetail', { a: item.a.id, b: item.b.id })}
                selectable={compareMode}
                selected={selectedPairs.includes(pairKey(item))}
                onToggleSelect={() => toggleSelectPair(item)}
              />
            )}
          />
        )}
      </View>
    </AppShell>
  );
}

// One pair's full detail (score, positives/risks, dimension breakdown) —
// rendered twice, side by side, when two pairs are selected for compare.
function CompareDetailCard({ detail, C, styles }) {
  const breakdown = detail.dimension_breakdown || {};
  return (
    <View style={styles.compareCard}>
      <Text style={styles.compareCardName}>{detail.a_name || 'Unnamed'} × {detail.b_name || 'Unnamed'}</Text>
      <Text style={styles.compareCardScore}>{detail.score}%{detail.is_provisional ? ' · Provisional' : ''}</Text>
      {(detail.explanation?.positives || []).slice(0, 3).map((p, i) => (
        <Text key={`p${i}`} style={[styles.compareBullet, { color: C.success }]}>+ {p}</Text>
      ))}
      {(detail.explanation?.risks || []).slice(0, 3).map((r, i) => (
        <Text key={`r${i}`} style={[styles.compareBullet, { color: C.warning }]}>! {r}</Text>
      ))}
      {DIMENSIONS.map((dim) => (
        breakdown[dim] ? (
          <View key={dim} style={styles.compareDimRow}>
            <Text style={styles.compareDimLabel}>{DIMENSION_LABELS[dim] || dim}</Text>
            <Text style={styles.compareDimValue}>gap {breakdown[dim].gap ?? '—'}</Text>
          </View>
        ) : null
      ))}
    </View>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    content: { flex: 1, padding: 20, maxWidth: 900, width: '100%', alignSelf: 'center' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
    emptyText: { ...typography.bodyMedium, color: C.textHint, textAlign: 'center', paddingHorizontal: 32 },
    header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 4 },
    headerTitle: { ...typography.displayMedium, color: C.textPrimary },
    headerSubtitle: { ...typography.bodyMedium, color: C.textSecondary, marginTop: 4 },
    backText: { color: C.primary, ...typography.labelLarge },
    headerActions: { flexDirection: 'row', gap: 16, alignItems: 'center' },
    countLabel: { ...typography.bodySmall, color: C.textHint, marginTop: 12, marginBottom: 12 },
    listContent: { paddingBottom: 40 },

    compareBar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      backgroundColor: C.surfaceElevated, borderRadius: radius.md, padding: 12, marginTop: 12,
    },
    compareBarText: { ...typography.bodySmall, color: C.textSecondary, flex: 1 },
    btnPrimary: { backgroundColor: C.primary, borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: 18 },
    btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    btnDisabled: { opacity: 0.6 },

    compareResultRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
    compareCard: {
      flex: 1, minWidth: 260, backgroundColor: C.surface, borderRadius: radius.lg, padding: 16, ...cardShadow,
    },
    compareCardName: { ...typography.titleSmall, color: C.textPrimary },
    compareCardScore: { fontSize: 24, fontWeight: '800', color: C.primary, marginTop: 4, marginBottom: 10 },
    compareBullet: { ...typography.bodySmall, marginTop: 4 },
    compareDimRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderTopWidth: 1, borderTopColor: C.surfaceBorder, marginTop: 8 },
    compareDimLabel: { ...typography.bodySmall, color: C.textSecondary },
    compareDimValue: { ...typography.bodySmall, color: C.textPrimary, fontWeight: '600' },
  });
}
