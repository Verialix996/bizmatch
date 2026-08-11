import {
  View, Text, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { showAlert } from '../../services/alert';
import useAppStore from '../../store/appStore';
import { colors, investorColors, typography } from '../../theme';
import { getTopPairs, recomputeMatches } from '../../services/matches.service';
import MatchCard from '../../components/founder/MatchCard';
import AppShell from '../../components/AppShell';
import { ADMIN_NAV_ITEMS } from '../../config/nav';

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
          {scopedFounderId ? (
            <TouchableOpacity onPress={handleRecompute} disabled={recomputing}>
              <Text style={styles.backText}>{recomputing ? '…' : 'Refresh'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

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
                onCompare={() => navigation.navigate('MatchDetail', { a: item.a.id, b: item.b.id })}
                onViewMatch={() => navigation.navigate('MatchDetail', { a: item.a.id, b: item.b.id })}
              />
            )}
          />
        )}
      </View>
    </AppShell>
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
    countLabel: { ...typography.bodySmall, color: C.textHint, marginTop: 12, marginBottom: 12 },
    listContent: { paddingBottom: 40 },
  });
}
