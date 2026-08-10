import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import useAppStore from '../../store/appStore';
import { colors, investorColors, typography, radius } from '../../theme';

// Placeholder for Phase 2/3 screens (Activities, Matching, Team Creation,
// Team Profile) whose backend doesn't exist yet. Better than a dead link or
// a "Route not found" crash — names what's coming and why it's not here yet.
export default function ComingSoonScreen({ navigation, route }) {
  const darkMode = useAppStore(s => s.darkMode);
  const C = darkMode ? investorColors : colors;
  const styles = makeStyles(C);
  const { title, description } = route.params || {};

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.body}>
        <Text style={styles.emoji}>🚧</Text>
        <Text style={styles.title}>{title || 'Coming Soon'}</Text>
        <Text style={styles.description}>
          {description || 'This part of the product is planned for a later phase.'}
        </Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
          <Text style={styles.btnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.backgroundSoft },
    body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    emoji: { fontSize: 48, marginBottom: 16 },
    title: { ...typography.titleLarge, color: C.textPrimary, textAlign: 'center', marginBottom: 8 },
    description: { ...typography.bodyMedium, color: C.textSecondary, textAlign: 'center', lineHeight: 20 },
    btn: { marginTop: 28, backgroundColor: C.primary, borderRadius: radius.pill, paddingVertical: 14, paddingHorizontal: 28 },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  });
}
