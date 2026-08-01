import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, investorColors, investorThemeColors } from '../theme';
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
  const { darkMode, isInvestorTheme } = useAppStore();
  const C = darkMode ? investorColors : (isInvestorTheme ? investorThemeColors : colors);
  const headerBg = C.background || '#fff';
  const accentColor = C.primary;

  return (
    <View style={[
      styles.container,
      { paddingTop: insets.top, backgroundColor: headerBg, borderBottomColor: C.surfaceBorder },
    ]}>
      <View style={styles.inner}>
        <LogoMark color={accentColor} />
        <Text style={[styles.wordmark, { color: accentColor }]}>BizMatch</Text>
        <View style={{ flex: 1 }} />
        <View style={styles.rightActions}>
          <NotificationBell tintColor={accentColor} />
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
