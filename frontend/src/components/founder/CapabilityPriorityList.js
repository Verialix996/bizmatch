import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, typography } from '../../theme';

// Lets a founder rank the capabilities they've selected by priority
// (top = highest priority) instead of assigning each an arbitrary number.
// `score` is still persisted per item (matches the existing backend
// contract), derived from rank at save time by the parent screen — this
// component only owns reordering.
export default function CapabilityPriorityList({ items, onChange, C, color }) {
  const styles = makeStyles(C);
  if (!items.length) return null;

  const move = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <View style={styles.container}>
      {items.map((item, index) => (
        <View key={item.capability} style={styles.row}>
          <View style={[styles.rankBadge, { backgroundColor: color }]}>
            <Text style={styles.rankText}>{index + 1}</Text>
          </View>
          <Text style={styles.label} numberOfLines={1}>{item.capability}</Text>
          <View style={styles.moveBtns}>
            <TouchableOpacity
              style={styles.moveBtn}
              onPress={() => move(index, -1)}
              disabled={index === 0}
              hitSlop={8}
            >
              <Ionicons name="chevron-up" size={16} color={index === 0 ? C.textHint : C.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.moveBtn}
              onPress={() => move(index, 1)}
              disabled={index === items.length - 1}
              hitSlop={8}
            >
              <Ionicons name="chevron-down" size={16} color={index === items.length - 1 ? C.textHint : C.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    container: { marginTop: 14, gap: 8 },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: C.backgroundSoft, borderRadius: radius.md, borderWidth: 1, borderColor: C.surfaceBorder,
      paddingHorizontal: 14, paddingVertical: 10,
    },
    rankBadge: {
      width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
    },
    rankText: { color: '#fff', fontSize: 11, fontWeight: '800' },
    label: { ...typography.bodySmall, color: C.textPrimary, fontWeight: '600', flex: 1 },
    moveBtns: { flexDirection: 'row', gap: 4 },
    moveBtn: {
      width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
      backgroundColor: C.surface, borderWidth: 1, borderColor: C.surfaceBorder,
    },
  });
}
