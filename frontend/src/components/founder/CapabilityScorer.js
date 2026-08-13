import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, typography } from '../../theme';

const MIN_SCORE = 10;
const MAX_SCORE = 100;
const STEP = 5;

// Lets a founder rate how strong they are at each capability they've
// selected, rather than everything silently defaulting to the same number.
export default function CapabilityScorer({ items, onChange, C, color }) {
  const styles = makeStyles(C);
  if (!items.length) return null;

  const adjust = (capability, delta) => {
    onChange(items.map(item => (
      item.capability === capability
        ? { ...item, score: Math.max(MIN_SCORE, Math.min(MAX_SCORE, item.score + delta)) }
        : item
    )));
  };

  return (
    <View style={styles.container}>
      {items.map(item => (
        <View key={item.capability} style={styles.row}>
          <Text style={styles.label} numberOfLines={1}>{item.capability}</Text>
          <View style={styles.stepper}>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => adjust(item.capability, -STEP)}
              disabled={item.score <= MIN_SCORE}
              hitSlop={8}
            >
              <Ionicons name="remove" size={15} color={item.score <= MIN_SCORE ? C.textHint : C.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.score, { color }]}>{item.score}</Text>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => adjust(item.capability, STEP)}
              disabled={item.score >= MAX_SCORE}
              hitSlop={8}
            >
              <Ionicons name="add" size={15} color={item.score >= MAX_SCORE ? C.textHint : C.textSecondary} />
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
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: C.backgroundSoft, borderRadius: radius.md, borderWidth: 1, borderColor: C.surfaceBorder,
      paddingHorizontal: 14, paddingVertical: 10, gap: 12,
    },
    label: { ...typography.bodySmall, color: C.textPrimary, fontWeight: '600', flex: 1 },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    stepBtn: {
      width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
      backgroundColor: C.surface, borderWidth: 1, borderColor: C.surfaceBorder,
    },
    score: { ...typography.bodySmall, fontWeight: '800', width: 26, textAlign: 'center' },
  });
}
