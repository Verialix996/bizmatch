import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, SafeAreaView, StatusBar, ActivityIndicator,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { showAlert } from '../../services/alert';
import useAppStore from '../../store/appStore';
import { colors, investorColors, radius, typography } from '../../theme';
import { listFounders } from '../../services/founders.service';
import { getTopMatches, recomputeMatches } from '../../services/matches.service';
import MatchCard from '../../components/founder/MatchCard';

// MVP screen 8 — Matching: Suggested Matches list for a chosen founder.
// Reached from the Admin Dashboard's "Go to Matching" quick action with no
// founder pre-selected, so this screen doubles as a founder picker + the
// suggested-matches list once one is chosen.
export default function MatchingScreen({ route, navigation }) {
  const darkMode = useAppStore(s => s.darkMode);
  const C = darkMode ? investorColors : colors;
  const styles = makeStyles(C);

  const [founderId, setFounderId] = useState(route.params?.founderId ?? null);
  const [founderName, setFounderName] = useState(route.params?.founderName ?? null);

  const [search, setSearch] = useState('');
  const [founders, setFounders] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recomputing, setRecomputing] = useState(false);

  const loadFounders = useCallback(async (query) => {
    try {
      const { data } = await listFounders({ search: query || undefined });
      setFounders(data);
    } catch { /* silent */ }
  }, []);

  const loadMatches = useCallback(async (id) => {
    setLoading(true);
    try {
      const { data } = await getTopMatches(id);
      setMatches(data);
    } catch {
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    if (founderId) loadMatches(founderId);
    else loadFounders(search);
  }, [founderId, loadMatches, loadFounders]));

  const handleRecompute = async () => {
    setRecomputing(true);
    try {
      await recomputeMatches(founderId);
      await loadMatches(founderId);
    } catch {
      showAlert('Error', 'Could not recompute matches.');
    } finally {
      setRecomputing(false);
    }
  };

  if (!founderId) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Matching</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.searchWrap}>
          <Text style={styles.hint}>Pick a founder to see their suggested matches.</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search founders..."
            placeholderTextColor={C.textHint}
            value={search}
            onChangeText={(v) => { setSearch(v); loadFounders(v); }}
          />
        </View>
        <FlatList
          data={founders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.founderRow}
              onPress={() => { setFounderId(item.id); setFounderName(item.name); }}
              activeOpacity={0.75}
            >
              <Text style={styles.founderName}>{item.name || 'Unnamed'}</Text>
              <Text style={styles.founderRole}>{item.role || ''}</Text>
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setFounderId(null)}>
          <Text style={styles.backText}>← Change</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{founderName || 'Matches'}</Text>
        <TouchableOpacity onPress={handleRecompute} disabled={recomputing}>
          <Text style={styles.backText}>{recomputing ? '…' : 'Refresh'}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={C.primary} /></View>
      ) : matches.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No matches computed yet — tap Refresh.</Text>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(item) => item.founderId}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <MatchCard
              match={item}
              C={C}
              onPress={() => navigation.navigate('MatchDetail', { a: founderId, b: item.founderId })}
            />
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
    emptyText: { ...typography.bodyMedium, color: C.textHint, textAlign: 'center', paddingHorizontal: 32 },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingVertical: 14, backgroundColor: C.surface,
      borderBottomWidth: 1, borderBottomColor: C.surfaceBorder,
    },
    backText: { color: C.primary, ...typography.labelLarge },
    headerTitle: { ...typography.titleMedium, color: C.textPrimary, flex: 1, textAlign: 'center', marginHorizontal: 8 },
    searchWrap: { padding: 20, backgroundColor: C.surface },
    hint: { ...typography.bodySmall, color: C.textSecondary, marginBottom: 10 },
    searchInput: {
      backgroundColor: C.backgroundSoft, borderRadius: radius.pill, paddingHorizontal: 18,
      paddingVertical: 12, fontSize: 14, color: C.textPrimary, borderWidth: 1, borderColor: C.surfaceBorder,
    },
    listContent: { padding: 20 },
    founderRow: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      backgroundColor: C.surface, borderRadius: radius.lg, padding: 14, marginBottom: 10,
    },
    founderName: { ...typography.bodyMedium, color: C.textPrimary, fontWeight: '600' },
    founderRole: { ...typography.bodySmall, color: C.textHint },
  });
}
