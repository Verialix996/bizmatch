import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import useAppStore from '../../store/appStore';
import { colors, investorColors, radius, cardShadow, typography } from '../../theme';
import { listFounders } from '../../services/founders.service';
import AppShell from '../../components/AppShell';
import { ADMIN_NAV_ITEMS } from '../../config/nav';
import { Avatar, Pill } from '../../components/ui';

// MVP screen 3 — Founders List: search by name, photo/name/short role, team
// status only. No Add Founder button, no completion %, no evaluation
// counts, no bulk actions (all explicitly excluded from the MVP screen).
export default function FounderListScreen({ navigation }) {
  const darkMode = useAppStore(s => s.darkMode);
  const activeProgramId = useAppStore(s => s.activeProgramId);
  const C = darkMode ? investorColors : colors;
  const styles2 = makeStyles(C);

  const [search, setSearch] = useState('');
  const [founders, setFounders] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (query) => {
    setLoading(true);
    try {
      const { data } = await listFounders({ search: query || undefined, programId: activeProgramId || undefined });
      setFounders(data);
    } catch {
      // silent — empty list renders its own "no founders" state
    } finally {
      setLoading(false);
    }
  }, [activeProgramId]);

  useFocusEffect(useCallback(() => { load(search); }, [load]));

  return (
    <AppShell navigation={navigation} active="founders" items={ADMIN_NAV_ITEMS}>
      <View style={styles2.content}>
        <View style={styles2.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles2.headerTitle}>Founders</Text>
            <Text style={styles2.headerSubtitle}>
              {loading ? 'Loading…' : `${founders.length} founder${founders.length === 1 ? '' : 's'} in cohort`}
            </Text>
          </View>
          <TouchableOpacity style={styles2.newInterviewBtn} onPress={() => navigation.navigate('NewInterview')} activeOpacity={0.85}>
            <Ionicons name="mic-outline" size={15} color="#fff" />
            <Text style={styles2.newInterviewBtnText}>New Interview</Text>
          </TouchableOpacity>
        </View>

        <View style={styles2.searchWrap}>
          <Ionicons name="search-outline" size={18} color={C.textHint} style={styles2.searchIcon} />
          <TextInput
            style={styles2.searchInput}
            placeholder="Search founders by name"
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
                <Avatar photoUrl={item.photoUrl} name={item.name} size={44} C={C} />
                <View style={styles2.rowBody}>
                  <Text style={styles2.rowName}>{item.name || 'Unnamed'}</Text>
                  <Text style={styles2.rowRole}>{item.role || 'No role set'}</Text>
                </View>
                <View style={styles2.pillStack}>
                  <Pill
                    label={item.teamStatus === 'in_team' ? 'In Team' : 'Looking for Team'}
                    C={C}
                    bg={item.teamStatus === 'in_team' ? C.successLight : C.surfaceElevated}
                    color={item.teamStatus === 'in_team' ? C.success : C.textSecondary}
                  />
                  {!item.profileComplete && (
                    <Pill label="Incomplete Profile" C={C} bg={C.warningLight} color={C.warning} />
                  )}
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.textHint} />
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </AppShell>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    content: { flex: 1, padding: 20, maxWidth: 1000, width: '100%', alignSelf: 'center' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
    emptyText: { ...typography.bodyMedium, color: C.textHint },

    header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
    headerTitle: { ...typography.displayMedium, color: C.textPrimary },
    headerSubtitle: { ...typography.bodyMedium, color: C.textSecondary, marginTop: 4 },
    newInterviewBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: C.primary, borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: 16,
    },
    newInterviewBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

    searchWrap: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: C.surface, borderRadius: radius.pill, paddingHorizontal: 16,
      borderWidth: 1, borderColor: C.surfaceBorder, marginBottom: 16,
    },
    searchIcon: {},
    searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: C.textPrimary },

    listContent: { paddingBottom: 40 },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: C.surface, borderRadius: radius.lg, padding: 14, marginBottom: 10, ...cardShadow,
    },
    rowBody: { flex: 1 },
    pillStack: { alignItems: 'flex-end', gap: 6 },
    rowName: { ...typography.titleSmall, color: C.textPrimary },
    rowRole: { ...typography.bodySmall, color: C.textSecondary, marginTop: 2 },
  });
}
