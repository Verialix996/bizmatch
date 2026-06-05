import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors, investorColors, investorThemeColors, radius } from '../theme';
import useAppStore from '../store/appStore';
import useAuthStore from '../store/authStore';
import NotificationBell from './NotificationBell';

function LogoMark({ color }) {
  return (
    <View style={styles.logoWrap}>
      <View style={[styles.circle1, { borderColor: color }]} />
      <View style={[styles.circle2, { borderColor: color }]} />
    </View>
  );
}

export default function AppHeader({ showToggle = false }) {
  const insets = useSafeAreaInsets();
  const { investorMode, darkMode, isInvestorTheme, openProjectPicker, exitInvestorMode } = useAppStore();
  const C = darkMode ? investorColors : (isInvestorTheme ? investorThemeColors : colors);
  // investorMode colors only apply on the Discover (SwipeScreen) tab — showToggle is true only there
  const isInvestorSwipe = investorMode && showToggle && !isInvestorTheme;
  const IC = investorColors;
  const headerBg = isInvestorSwipe ? IC.background : (C.background || '#fff');
  const accentColor = isInvestorTheme && !darkMode ? investorThemeColors.primary : (isInvestorSwipe || darkMode) ? IC.primary : colors.primary;
  const user = useAuthStore(s => s.user);
  const navigation = useNavigation();

  const isEntrepreneur = user?.role === 'entrepreneur';
  const isPremium = !!(user?.is_premium && user?.premium_expires_at && new Date(user.premium_expires_at) > new Date());
  const showModeToggle = showToggle && isEntrepreneur;

  const handleToggle = (toInvestor) => {
    if (!toInvestor) { exitInvestorMode(); return; }
    if (!isPremium) {
      Alert.alert(
        'Premium Required',
        'Investor search mode is a Premium feature. Upgrade to find investors for your project.',
        [{ text: 'Not now', style: 'cancel' }, { text: 'Upgrade', onPress: () => navigation.navigate('Premium') }]
      );
      return;
    }
    openProjectPicker();
  };

  return (
    <View style={[
      styles.container,
      { paddingTop: insets.top, backgroundColor: headerBg, borderBottomColor: isInvestorSwipe ? IC.surfaceBorder : C.surfaceBorder },
    ]}>
      <View style={styles.inner}>
        <LogoMark color={accentColor} />
        <Text style={[styles.wordmark, { color: accentColor }]}>BizMatch</Text>

        {showModeToggle ? (
          <View style={[styles.modeToggleBar, { backgroundColor: isInvestorSwipe ? IC.surface : C.surface, borderColor: isInvestorSwipe ? IC.surfaceBorder : C.surfaceBorder }]}>
            <TouchableOpacity
              style={[styles.modeToggleBtn, !investorMode && styles.modeToggleBtnActive]}
              onPress={() => handleToggle(false)}
              activeOpacity={0.85}
            >
              <Text style={[styles.modeToggleBtnText, { color: investorMode ? IC.textHint : C.textHint }, !investorMode && styles.modeToggleBtnTextActive]}>
                🤝 Partners
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeToggleBtn, investorMode && styles.modeToggleBtnInvestorActive]}
              onPress={() => handleToggle(true)}
              activeOpacity={0.85}
            >
              <Text style={[styles.modeToggleBtnText, { color: investorMode ? IC.textHint : C.textHint }, investorMode && styles.modeToggleBtnTextInvestorActive]}>
                💼 Investors
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}

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

  modeToggleBar: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: radius.lg,
    padding: 3,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  modeToggleBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeToggleBtnActive: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  modeToggleBtnInvestorActive: {
    backgroundColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  modeToggleBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modeToggleBtnTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  modeToggleBtnTextInvestorActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 'auto',
  },
});
