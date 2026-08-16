import {
  View, Text, TouchableOpacity, Modal, FlatList,
  StyleSheet, TouchableWithoutFeedback, ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { listPrograms } from '../services/founders.service';
import useAppStore from '../store/appStore';
import { radius, typography } from '../theme';

// Top bar's cohort/program switcher — shown to every logged-in user.
// List-only for now, no create/edit flow — there's exactly one seeded
// program today, but the mechanism is real: selecting one threads
// activeProgramId into every program-scoped list/dashboard query.
export default function CohortSwitcher({ C }) {
  const activeProgramId = useAppStore(s => s.activeProgramId);
  const setActiveProgramId = useAppStore(s => s.setActiveProgramId);
  const [open, setOpen] = useState(false);
  const [programs, setPrograms] = useState(null);
  const styles = makeStyles(C);

  const activeName = programs?.find(p => p.id === activeProgramId)?.name || 'My Cohort';

  const handleOpen = () => {
    setOpen(true);
    if (programs === null) {
      listPrograms().then(({ data }) => setPrograms(data)).catch(() => setPrograms([]));
    }
  };

  return (
    <>
      <TouchableOpacity style={styles.pill} onPress={handleOpen} activeOpacity={0.75}>
        <Ionicons name="people-outline" size={15} color={C.primary} />
        <Text style={styles.pillText} numberOfLines={1}>{activeName}</Text>
        <Ionicons name="chevron-down" size={13} color={C.textHint} />
      </TouchableOpacity>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.dropdown}>
                <Text style={styles.dropdownTitle}>Switch cohort</Text>
                {programs === null ? (
                  <ActivityIndicator color={C.primary} style={{ marginVertical: 16 }} />
                ) : programs.length === 0 ? (
                  <Text style={styles.emptyText}>No cohorts yet.</Text>
                ) : (
                  <FlatList
                    data={programs}
                    keyExtractor={(p) => String(p.id)}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.row}
                        onPress={() => { setActiveProgramId(item.id); setOpen(false); }}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.rowText}>{item.name}</Text>
                        {item.id === activeProgramId && <Ionicons name="checkmark" size={16} color={C.primary} />}
                      </TouchableOpacity>
                    )}
                  />
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    pill: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: C.surfaceElevated, borderRadius: radius.pill,
      paddingHorizontal: 12, paddingVertical: 8, maxWidth: 200,
    },
    pillText: { ...typography.labelLarge, color: C.textPrimary, flexShrink: 1 },

    overlay: {
      flex: 1, backgroundColor: 'rgba(2,36,102,0.35)',
      justifyContent: 'flex-start', alignItems: 'flex-start',
      paddingTop: 80, paddingLeft: 24,
    },
    dropdown: {
      backgroundColor: C.surface, borderRadius: radius.lg, width: 260, maxHeight: 320, padding: 16,
      shadowColor: '#022466', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 20, elevation: 12,
    },
    dropdownTitle: { ...typography.labelSmall, color: C.textHint, marginBottom: 8, textTransform: 'uppercase' },
    emptyText: { ...typography.bodySmall, color: C.textHint, paddingVertical: 8 },
    row: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.surfaceBorder,
    },
    rowText: { ...typography.bodyMedium, color: C.textPrimary },
  });
}
