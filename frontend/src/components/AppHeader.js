import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, investorColors } from '../theme';
import useAppStore from '../store/appStore';
import NotificationBell from './NotificationBell';

function LogoMark({ color }) {
  return (
    <View style={styles.logoWrap}>
      <View style={[styles.circle1, { borderColor: color }]} />
      <View style={[styles.circle2, { borderColor: color }]} />
    </View>
  );
}

export default function AppHeader() {
  const insets = useSafeAreaInsets();
  const darkMode = useAppStore(s => s.darkMode);
  const C = darkMode ? investorColors : colors;

  return (
    <View style={[
      styles.container,
      { paddingTop: insets.top, backgroundColor: C.background, borderBottomColor: C.surfaceBorder },
    ]}>
      <View style={styles.inner}>
        <LogoMark color={C.primary} />
        <Text style={[styles.wordmark, { color: C.primary }]}>BizMatch</Text>
        <View style={{ flex: 1 }} />
        <View style={styles.rightActions}>
          <NotificationBell tintColor={C.primary} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 10,
    gap: 8,
  },
  logoWrap: {
    width: 30,
    height: 30,
    position: 'relative',
  },
  circle1: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2.5,
    position: 'absolute',
    left: 0,
    top: 5,
  },
  circle2: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2.5,
    opacity: 0.55,
    position: 'absolute',
    right: 0,
    top: 5,
  },
  wordmark: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 'auto',
  },
});
