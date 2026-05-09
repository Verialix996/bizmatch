import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import { colors, radius } from '../../theme';

const BENEFITS = [
  { icon: '∞', title: 'Unlimited Swipes', desc: 'No daily cap — swipe as much as you want.' },
  { icon: '★', title: 'Super Like', desc: "Stand out — super likes show up prominently in your match's feed." },
  { icon: '👀', title: 'Who Liked You', desc: 'See everyone who already swiped right on you.' },
];

export default function PremiumScreen() {
  const navigation = useNavigation();
  const updateUser = useAuthStore(s => s.updateUser);
  const [loading, setLoading] = useState(false);

  const activate = async () => {
    setLoading(true);
    try {
      const res = await api.post('/users/me/premium/activate');
      updateUser({ is_premium: true, premium_expires_at: res.data.expiresAt });
      Alert.alert('Premium Activated!', 'You now have 30 days of free premium. Enjoy!', [
        { text: 'Awesome', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Error', 'Could not activate premium. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Premium</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.heroIcon}>★</Text>
          <Text style={styles.heroTitle}>Unlock Premium</Text>
          <Text style={styles.heroSub}>Everything you need to find your perfect business match</Text>
        </View>

        <View style={styles.benefits}>
          {BENEFITS.map(b => (
            <View key={b.title} style={styles.benefitRow}>
              <View style={styles.benefitIcon}>
                <Text style={styles.benefitIconText}>{b.icon}</Text>
              </View>
              <View style={styles.benefitText}>
                <Text style={styles.benefitTitle}>{b.title}</Text>
                <Text style={styles.benefitDesc}>{b.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.activateBtn, loading && styles.activateBtnDisabled]}
          onPress={activate}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Text style={styles.activateBtnText}>
            {loading ? 'Activating…' : 'Activate Free Trial (30 days)'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>No payment required — for demo purposes</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F8',
  },
  back: {
    fontSize: 22,
    color: colors.primary,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  content: {
    padding: 24,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 32,
  },
  heroIcon: {
    fontSize: 64,
    color: '#F5A623',
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  heroSub: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  benefits: {
    gap: 20,
    marginBottom: 36,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  benefitIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF8E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitIconText: {
    fontSize: 20,
    color: '#F5A623',
  },
  benefitText: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  benefitDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  activateBtn: {
    backgroundColor: '#F5A623',
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  activateBtnDisabled: {
    opacity: 0.6,
  },
  activateBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  disclaimer: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.textHint,
  },
});
