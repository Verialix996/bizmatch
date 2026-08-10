import {
  View, Text, TextInput, TouchableOpacity, Image, FlatList,
  StyleSheet, SafeAreaView, StatusBar, ActivityIndicator,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import useAppStore from '../../store/appStore';
import { colors, investorColors, radius, cardShadow, typography } from '../../theme';
import { listFounders } from '../../services/founders.service';

function Avatar({ photoUrl, name, C }) {
  if (photoUrl) return <Image source={{ uri: photoUrl }} style={styles.avatarImg} />;
  return (
    <View style={[styles.avatarPlaceholder, { backgroundColor: C.primary }]}>
      <Text style={styles.avatarInitial}>{name ? name[0].toUpperCase() : '?'}</Text>
    </View>
  );
}

// MVP screen 3 — Founders List: search by name, photo/name/short role, team
// status only. No Add Founder button, no completion %, no evaluation
// counts, no bulk actions (all explicitly excluded from the MVP screen).
export default function FounderListScreen({ navigation }) {
  const darkMode = useAppStore(s => s.darkMode);
  const C = darkMode ? investorColors : colors;
  const styles2 = makeStyles(C);

  const [search, setSearch] = useState('');
  const [founders, setFounders] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (query) => {
    setLoading(true);
    try {
      const { data } = await listFounders({ search: query || undefined });
      setFounders(data);
    } catch {
      // silent — empty list renders its own "no founders" state
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(search); }, [load]));

  return (
    <SafeAreaView style={styles2.container}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      <View style={styles2.header}>
        <Text style={styles2.headerTitle}>Founders</Text>
      </View>

      <View style={styles2.searchWrap}>
        <TextInput
          style={styles2.searchInput}
          placeholder="Search by name..."
          placeholderTextColor={C.textHint}
          value={search}
          onChangeText={(v) => { setSearch(v); load(v); }}
        />
      </View>

      {loading ? (
        <View style={styles2.centered}><ActivityIndicator size="large" color={C.primary} /></View>
      ) : founders.length === 0 ? (
        <View style={styles2.centered}>
          <Text style={styles2.emptyText}>No founders found</Text>
        </View>
      ) : (
        <FlatList
          data={founders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles2.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles2.row}
              onPress={() => navigation.navigate('FounderProfile', { founderId: item.id })}
              activeOpacity={0.75}
            >
              <Avatar photoUrl={item.photoUrl} name={item.name} C={C} />
              <View style={styles2.rowBody}>
                <Text style={styles2.rowName}>{item.name || 'Unnamed'}</Text>
                <Text style={styles2.rowRole}>{item.role || 'No role set'}</Text>
              </View>
              <View style={[styles2.statusBadge, item.teamStatus === 'in_team' && styles2.statusBadgeInTeam]}>
                <Text style={[styles2.statusBadgeText, item.teamStatus === 'in_team' && styles2.statusBadgeTextInTeam]}>
                  {item.teamStatus === 'in_team' ? 'In Team' : 'Looking for Team'}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { color: '#fff', fontWeight: '800', fontSize: 16 },
});

function makeStyles(C) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.backgroundSoft },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { ...typography.bodyMedium, color: C.textHint },
    header: {
      paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
      backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.surfaceBorder,
    },
    headerTitle: { ...typography.displayMedium, color: C.textPrimary },
    searchWrap: { paddingHorizontal: 20, paddingVertical: 14, backgroundColor: C.surface },
    searchInput: {
      backgroundColor: C.backgroundSoft, borderRadius: radius.pill, paddingHorizontal: 18,
      paddingVertical: 12, fontSize: 14, color: C.textPrimary, borderWidth: 1, borderColor: C.surfaceBorder,
    },
    listContent: { padding: 20, paddingTop: 8 },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: C.surface, borderRadius: radius.lg, padding: 14, marginBottom: 10, ...cardShadow,
    },
    rowBody: { flex: 1 },
    rowName: { ...typography.titleSmall, color: C.textPrimary },
    rowRole: { ...typography.bodySmall, color: C.textSecondary, marginTop: 2 },
    statusBadge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: C.surfaceElevated },
    statusBadgeInTeam: { backgroundColor: C.successLight },
    statusBadgeText: { fontSize: 11, fontWeight: '700', color: C.textSecondary },
    statusBadgeTextInTeam: { color: C.success },
  });
}
