import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors, investorColors, radius } from '../theme';
import useAuthStore from '../store/authStore';
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
  const navigation = useNavigation();
  const user = useAuthStore(s => s.user);
  const { investorMode, selectedProject, openProjectPicker, exitInvestorMode } = useAppStore();

  const isEntrepreneur = user?.role === 'entrepreneur';
  const isPremium = !!(user?.is_premium && user?.premium_expires_at && new Date(user.premium_expires_at) > new Date());
  const C = investorMode ? investorColors : colors;

  const handleModeToggle = () => {
    if (investorMode) {
      exitInvestorMode();
    } else {
      if (!isPremium) {
        Alert.alert(
          'Premium Required',
          'Investor search mode is a Premium feature. Upgrade to find investors for your project.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Upgrade', onPress: () => navigation.navigate('Premium') },
          ]
        );
        return;
      }
      openProjectPicker();
    }
  };

  return (
    <View style={[
      styles.container,
      { paddingTop: insets.top, backgroundColor: C.background || '#fff', borderBottomColor: C.surfaceBorder },
    ]}>
      <View style={styles.inner}>
        {/* Logo + wordmark */}
        <LogoMark color={C.primary} />
        <Text style={[styles.wordmark, { color: C.primary }]}>BizMatch</Text>

        {/* In investor mode: show selected project chip */}
        {investorMode && selectedProject && (
          <TouchableOpacity style={styles.projectChip} onPress={openProjectPicker} activeOpacity={0.75}>
            <Text style={styles.projectChipText} numberOfLines={1}>⇄ {selectedProject.title}</Text>
          </TouchableOpacity>
        )}

        {/* Right actions */}
        <View style={styles.rightActions}>
          {isEntrepreneur && (
            <TouchableOpacity
              style={[styles.modeToggle, investorMode ? styles.modeToggleInvestor : styles.modeTogglePartner]}
              onPress={handleModeToggle}
              activeOpacity={0.8}
            >
              <Text style={[styles.modeToggleText, investorMode && styles.modeToggleTextInvestor]}>
                {investorMode ? '💼 Investor' : '🤝 Partners'}
              </Text>
            </TouchableOpacity>
          )}
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
    paddingHorizontal: 16,
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

  projectChip: {
    flex: 1,
    backgroundColor: 'rgba(232,213,163,0.15)',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(232,213,163,0.4)',
    marginHorizontal: 4,
  },
  projectChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E8D5A3',
  },

  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 'auto',
  },

  modeToggle: {
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1.5,
  },
  modeTogglePartner: {
    backgroundColor: 'transparent',
    borderColor: colors.surfaceBorder,
  },
  modeToggleInvestor: {
    backgroundColor: 'rgba(232,213,163,0.15)',
    borderColor: '#E8D5A3',
  },
  modeToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  modeToggleTextInvestor: {
    color: '#E8D5A3',
  },
});
