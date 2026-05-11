import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';
import { colors, radius } from '../../theme';

const BENEFITS = [
  {
    icon: '∞',
    title: 'Unlimited Swipes',
    desc: 'No daily cap — swipe as much as you want.',
    free: '20 / day',
    premium: 'Unlimited',
  },
  {
    icon: '★',
    title: 'Super Like',
    desc: 'Stand out — super likes are highlighted in your match\'s feed.',
    free: '—',
    premium: 'Included',
  },
  {
    icon: '👀',
    title: 'Who Liked You',
    desc: 'See everyone who already swiped right on you.',
    free: '—',
    premium: 'Included',
  },
  {
    icon: '📅',
    title: 'Unlimited Meetings',
    desc: 'Propose as many meetings as you need. No cap.',
    free: '3 active',
    premium: 'Unlimited',
  },
  {
    icon: '★',
    title: 'Premium Badge',
    desc: 'Stand out with a visible Premium badge on your profile.',
    free: '—',
    premium: 'Included',
  },
];

export default function PremiumScreen() {
  const navigation = useNavigation();
  const user = useAuthStore(s => s.user);
  const updateUser = useAuthStore(s => s.updateUser);
  const [loading, setLoading] = useState(false);

  const isPremium = user?.is_premium && user?.premium_expires_at && new Date(user.premium_expires_at) > new Date();
  const expiryDate = isPremium ? new Date(user.premium_expires_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null;

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

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.crownCircle}>
            <Text style={styles.crownIcon}>★</Text>
          </View>
          <Text style={styles.heroTitle}>BizMatch Premium</Text>
          {isPremium ? (
            <View style={styles.activePill}>
              <Text style={styles.activePillText}>Active until {expiryDate}</Text>
            </View>
          ) : (
            <Text style={styles.heroSub}>Everything you need to find your perfect business match</Text>
          )}
        </View>

        {/* Comparison table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.tableFeatureCol} />
            <View style={styles.tableCol}>
              <Text style={styles.tableColLabel}>Free</Text>
            </View>
            <View style={[styles.tableCol, styles.tableColPremium]}>
              <Text style={[styles.tableColLabel, styles.tableColLabelPremium]}>Premium</Text>
            </View>
          </View>
          {BENEFITS.map((b, i) => (
            <View key={b.title} style={[styles.tableRow, i % 2 === 0 && styles.tableRowAlt]}>
              <View style={styles.tableFeatureCol}>
                <Text style={styles.tableFeatureIcon}>{b.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tableFeatureTitle}>{b.title}</Text>
                  <Text style={styles.tableFeatureDesc}>{b.desc}</Text>
                </View>
              </View>
              <View style={styles.tableCol}>
                <Text style={styles.tableFreeVal}>{b.free}</Text>
              </View>
              <View style={[styles.tableCol, styles.tableColPremium]}>
                <Text style={styles.tablePremiumVal}>{b.premium}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* CTA */}
        {!isPremium && (
          <>
            <TouchableOpacity
              style={[styles.activateBtn, loading && styles.activateBtnDisabled]}
              onPress={activate}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.activateBtnText}>
                {loading ? 'Activating…' : 'Activate Free Trial — 30 days'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.disclaimer}>No payment required · For demo purposes</Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F8',
  },
  back: { fontSize: 22, color: colors.primary },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },

  content: { padding: 20, paddingBottom: 48 },

  hero: { alignItems: 'center', marginBottom: 28 },
  crownCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#022466',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#022466',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  crownIcon: { fontSize: 36, color: '#F5A623' },
  heroTitle: { fontSize: 26, fontWeight: '800', color: colors.textPrimary, marginBottom: 8 },
  heroSub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 21, paddingHorizontal: 20 },
  activePill: {
    backgroundColor: '#E8F5E9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginTop: 4,
  },
  activePillText: { fontSize: 13, fontWeight: '700', color: '#2E7D32' },

  // Comparison table
  table: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E8ECF4',
  },
  tableHeader: { flexDirection: 'row', backgroundColor: '#F0F3FB', paddingVertical: 10 },
  tableFeatureCol: { flex: 2.2, flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 12, gap: 8 },
  tableCol: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tableColPremium: { backgroundColor: 'rgba(2,36,102,0.06)' },
  tableColLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  tableColLabelPremium: { color: colors.primary },
  tableRow: { flexDirection: 'row', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F0F2F8' },
  tableRowAlt: { backgroundColor: '#FAFBFF' },
  tableFeatureIcon: { fontSize: 16, marginTop: 1 },
  tableFeatureTitle: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  tableFeatureDesc: { fontSize: 11, color: colors.textHint, lineHeight: 16, marginTop: 2 },
  tableFreeVal: { fontSize: 12, color: colors.textHint, fontWeight: '600', textAlign: 'center' },
  tablePremiumVal: { fontSize: 12, color: colors.primary, fontWeight: '800', textAlign: 'center' },

  activateBtn: {
    backgroundColor: '#022466',
    borderRadius: radius.pill,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#022466',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  activateBtnDisabled: { opacity: 0.6 },
  activateBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  disclaimer: { textAlign: 'center', fontSize: 12, color: colors.textHint },
});
