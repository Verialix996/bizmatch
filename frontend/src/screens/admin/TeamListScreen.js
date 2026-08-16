import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useState, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { showAlert } from '../../services/alert';
import useAppStore from '../../store/appStore';
import { colors, investorColors, radius, cardShadow, typography } from '../../theme';
import { listTeams } from '../../services/teams.service';
import AppShell from '../../components/AppShell';
import { ADMIN_NAV_ITEMS } from '../../config/nav';
import { Avatar, Pill, useIsDesktop } from '../../components/ui';

// Companion list screen for MVP screens 9/10 — a roster grid of every team
// in the cohort, linking into Team Profile. Not a dedicated MVP screen, but
// the Teams nav destination the mockups expect.
export default function TeamListScreen({ navigation }) {
  const darkMode = useAppStore(s => s.darkMode);
  const C = darkMode ? investorColors : colors;
  const styles = makeStyles(C);
  const isDesktop = useIsDesktop();

  const [search, setSearch] = useState('');
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  // ERR-01: a failed load previously just left teams=[], rendering the same
  // "No teams created yet" empty state as a genuinely-empty cohort.
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // listTeams() already returns members + complementary skills per team
      // in one call — no more per-team getTeam() enrichment round trips.
      const { data } = await listTeams();
      setTeams(data);
      setLoadError(false);
    } catch {
      setTeams([]);
      setLoadError(true);
      showAlert('Error', 'Could not load teams. Try refreshing the page.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    if (!search.trim()) return teams;
    const q = search.trim().toLowerCase();
    return teams.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.members.some(m => (m.name || '').toLowerCase().includes(q)),
    );
  }, [teams, search]);

  return (
    <AppShell navigation={navigation} active="teams" items={ADMIN_NAV_ITEMS}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Teams</Text>
            <Text style={styles.headerSubtitle}>
              {loading ? 'Loading…' : `${teams.length} team${teams.length === 1 ? '' : 's'} in the cohort`}
            </Text>
          </View>
          <TouchableOpacity style={styles.newBtn} onPress={() => navigation.navigate('TeamCreation', {})} activeOpacity={0.85}>
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={styles.newBtnText}>Create Team</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color={C.textHint} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search teams or founders..."
            placeholderTextColor={C.textHint}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color={C.primary} /></View>
        ) : filtered.length === 0 ? (
          <View style={styles.centered}>
            <Text style={loadError ? styles.errorText : styles.emptyText}>
              {loadError ? "Couldn't load teams — try refreshing the page." : teams.length === 0 ? 'No teams created yet' : 'No teams match your search'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            numColumns={isDesktop ? 2 : 1}
            key={isDesktop ? 'grid' : 'list'}
            columnWrapperStyle={isDesktop ? styles.row : undefined}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={[styles.card, isDesktop && styles.cardHalf]}>
                <Text style={styles.teamName}>{item.name}</Text>

                <View style={styles.avatarRow}>
                  {item.members.slice(0, 4).map((m, i) => (
                    <View key={m.id} style={[styles.avatarStack, i > 0 && { marginLeft: -10 }]}>
                      <Avatar photoUrl={m.photoUrl} name={m.name} size={36} C={C} />
                    </View>
                  ))}
                  <Text style={styles.memberNames} numberOfLines={1}>
                    {item.members.map(m => m.name || 'Unnamed').join(', ') || 'No members yet'}
                  </Text>
                </View>

                {item.skills.length > 0 && (
                  <View style={styles.chipWrap}>
                    {item.skills.slice(0, 4).map(s => (
                      <Pill key={s} label={s} C={C} bg={C.surfaceElevated} color={C.textSecondary} />
                    ))}
                  </View>
                )}

                <TouchableOpacity
                  style={styles.viewTeamBtn}
                  onPress={() => navigation.navigate('TeamProfile', { teamId: item.id })}
                  activeOpacity={0.75}
                >
                  <Text style={styles.viewTeamText}>View Team</Text>
                  <Ionicons name="arrow-forward" size={14} color={C.primary} />
                </TouchableOpacity>
              </View>
            )}
          />
        )}
      </View>
    </AppShell>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    content: { flex: 1, padding: 20, maxWidth: 1100, width: '100%', alignSelf: 'center' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
    emptyText: { ...typography.bodyMedium, color: C.textHint },
    errorText: { ...typography.bodyMedium, color: C.error },

    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12, flexWrap: 'wrap' },
    headerTitle: { ...typography.displayMedium, color: C.textPrimary },
    headerSubtitle: { ...typography.bodyMedium, color: C.textSecondary, marginTop: 4 },
    newBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: C.primary, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 10,
    },
    newBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

    searchWrap: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: C.surface, borderRadius: radius.pill, paddingHorizontal: 16,
      borderWidth: 1, borderColor: C.surfaceBorder, marginBottom: 16,
    },
    searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: C.textPrimary },

    listContent: { paddingBottom: 40 },
    row: { gap: 16 },
    card: {
      backgroundColor: C.surface, borderRadius: radius.lg, padding: 16, marginBottom: 16, ...cardShadow,
    },
    cardHalf: { flex: 1 },
    teamName: { ...typography.titleMedium, color: C.textPrimary, marginBottom: 12 },

    avatarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    avatarStack: { borderWidth: 2, borderColor: C.surface, borderRadius: 20 },
    memberNames: { ...typography.bodySmall, color: C.textSecondary, marginLeft: 10, flexShrink: 1 },

    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },

    viewTeamBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    viewTeamText: { color: C.primary, fontWeight: '700', fontSize: 13 },
  });
}
