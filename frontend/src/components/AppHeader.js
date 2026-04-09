import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

function LogoMark() {
  return (
    <View style={styles.logoWrap}>
      <View style={styles.circle1} />
      <View style={styles.circle2} />
    </View>
  );
}

export default function AppHeader() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.inner}>
        <LogoMark />
        <Text style={styles.wordmark}>BizMatch</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
  },
  logoWrap: {
    width: 32,
    height: 32,
    position: 'relative',
  },
  circle1: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2.5,
    borderColor: colors.primary,
    position: 'absolute',
    left: 0,
    top: 6,
  },
  circle2: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2.5,
    borderColor: colors.primary,
    opacity: 0.55,
    position: 'absolute',
    right: 0,
    top: 6,
  },
  wordmark: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
  },
});
