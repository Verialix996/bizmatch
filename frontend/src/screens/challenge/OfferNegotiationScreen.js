import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, SafeAreaView, StatusBar, ActivityIndicator,
} from 'react-native';
import { showAlert } from '../../services/alert';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import useAppStore from '../../store/appStore';
import useAuthStore from '../../store/authStore';
import { colors, investorColors, investorThemeColors, radius, cardShadow } from '../../theme';
import {
  getOfferHistory, createOffer, counterOffer, acceptOffer, declineOffer,
} from '../../services/challenge.service';

export default function OfferNegotiationScreen({ route, navigation }) {
  const { challengeId, teamId } = route.params;
  const darkMode = useAppStore(s => s.darkMode);
  const isInvestorTheme = useAppStore(s => s.isInvestorTheme);
  const C = darkMode ? investorColors : (isInvestorTheme ? investorThemeColors : colors);
  const styles = makeStyles(C);
  const user = useAuthStore(s => s.user);

  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [showCounterForm, setShowCounterForm] = useState(false);
  const [form, setForm] = useState({ amount: '', equityPercent: '', valuation: '', terms: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getOfferHistory(challengeId, teamId);
      setHistory(data || []);
    } catch (e) {
      console.error('Failed to load offer history', e);
    } finally {
      setLoading(false);
    }
  }, [challengeId, teamId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const current = history[history.length - 1];
  const isInvestor = user?.role === 'investor';
  const myTurn = current ? current.direction !== (isInvestor ? 'investor' : 'team') : isInvestor;
  const isTerminal = current && (current.status === 'accepted' || current.status === 'declined');

  const buildPayload = () => ({
    amount: Number(form.amount),
    equityPercent: Number(form.equityPercent),
    valuation: form.valuation ? Number(form.valuation) : undefined,
    terms: form.terms || undefined,
  });

  const handleFirstOffer = async () => {
    if (!form.amount || !form.equityPercent) return showAlert('Missing fields', 'Amount and equity % are required.');
    setBusy(true);
    try {
      await createOffer(challengeId, teamId, buildPayload());
      setShowCounterForm(false);
      load();
    } catch (e) {
      showAlert('Could not send offer', e.response?.data?.error || 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleCounter = async () => {
    if (!form.amount || !form.equityPercent) return showAlert('Missing fields', 'Amount and equity % are required.');
    setBusy(true);
    try {
      await counterOffer(challengeId, teamId, buildPayload());
      setShowCounterForm(false);
      load();
    } catch (e) {
      showAlert('Could not counter', e.response?.data?.error || 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleAccept = async () => {
    setBusy(true);
    try {
      await acceptOffer(challengeId, teamId);
      load();
    } catch (e) {
      showAlert('Could not accept', e.response?.data?.error || 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleDecline = async () => {
    setBusy(true);
    try {
      await declineOffer(challengeId, teamId);
      load();
    } catch (e) {
      showAlert('Could not decline', e.response?.data?.error || 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}><ActivityIndicator size="large" color={C.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Investment Offer</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {history.length === 0 ? (
          <View style={styles.section}>
            <Text style={styles.bodyText}>No offer yet.</Text>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>NEGOTIATION HISTORY</Text>
            {history.map(o => (
              <View key={o.id} style={styles.round}>
                <Text style={styles.roundTitle}>Round {o.round} — {o.direction === 'investor' ? 'Investor' : 'Team'} proposed</Text>
                <Text style={styles.roundDetail}>${Number(o.amount).toLocaleString()} for {o.equity_percent}% equity</Text>
                {o.valuation ? <Text style={styles.roundDetail}>Valuation: ${Number(o.valuation).toLocaleString()}</Text> : null}
                {o.terms ? <Text style={styles.roundDetail}>{o.terms}</Text> : null}
                <Text style={styles.roundStatus}>{o.status}</Text>
              </View>
            ))}
          </View>
        )}

        {!isTerminal && myTurn && !showCounterForm ? (
          <View style={styles.actionsRow}>
            {current ? (
              <>
                <TouchableOpacity style={styles.declineBtn} onPress={handleDecline} disabled={busy}>
                  <Text style={styles.declineBtnText}>Decline</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.counterBtn} onPress={() => setShowCounterForm(true)} disabled={busy}>
                  <Text style={styles.counterBtnText}>Counter</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept} disabled={busy}>
                  <Text style={styles.acceptBtnText}>Accept</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={styles.acceptBtn} onPress={() => setShowCounterForm(true)}>
                <Text style={styles.acceptBtnText}>Send Offer</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        {!isTerminal && !myTurn ? (
          <View style={styles.section}>
            <Text style={styles.bodyText}>Waiting for the other party to respond.</Text>
          </View>
        ) : null}

        {showCounterForm ? (
          <View style={styles.section}>
            <Text style={styles.fieldLabel}>AMOUNT ($)</Text>
            <TextInput style={styles.input} value={form.amount} onChangeText={v => setForm(f => ({ ...f, amount: v }))} keyboardType="numeric" placeholderTextColor={C.textHint} />
            <Text style={styles.fieldLabel}>EQUITY (%)</Text>
            <TextInput style={styles.input} value={form.equityPercent} onChangeText={v => setForm(f => ({ ...f, equityPercent: v }))} keyboardType="numeric" placeholderTextColor={C.textHint} />
            <Text style={styles.fieldLabel}>VALUATION ($, optional)</Text>
            <TextInput style={styles.input} value={form.valuation} onChangeText={v => setForm(f => ({ ...f, valuation: v }))} keyboardType="numeric" placeholderTextColor={C.textHint} />
            <Text style={styles.fieldLabel}>TERMS</Text>
            <TextInput style={[styles.input, styles.inputMultiline]} multiline value={form.terms} onChangeText={v => setForm(f => ({ ...f, terms: v }))} placeholderTextColor={C.textHint} />
            <View style={styles.formBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCounterForm(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={current ? handleCounter : handleFirstOffer} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Send</Text>}
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.backgroundSoft },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.surfaceBorder },
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    backIcon: { fontSize: 22, color: C.textPrimary },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: C.textPrimary },
    content: { padding: 16, paddingBottom: 40 },
    section: { backgroundColor: C.surface, marginBottom: 12, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: C.surfaceBorder, ...cardShadow, shadowOpacity: 0.04 },
    sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: C.textHint, marginBottom: 10 },
    bodyText: { fontSize: 14, color: C.textSecondary },
    round: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.surfaceBorder },
    roundTitle: { fontSize: 13, fontWeight: '700', color: C.primaryDark },
    roundDetail: { fontSize: 13, color: C.textSecondary, marginTop: 2 },
    roundStatus: { fontSize: 12, fontWeight: '700', color: C.primary, marginTop: 4, textTransform: 'uppercase' },
    actionsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    declineBtn: { flex: 1, borderWidth: 1.5, borderColor: C.error, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
    declineBtnText: { color: C.error, fontWeight: '700', fontSize: 13 },
    counterBtn: { flex: 1, borderWidth: 1.5, borderColor: C.surfaceBorder, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
    counterBtnText: { color: C.textSecondary, fontWeight: '700', fontSize: 13 },
    acceptBtn: { flex: 1, backgroundColor: C.primary, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
    acceptBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    fieldLabel: { fontSize: 11, fontWeight: '700', color: C.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6, marginTop: 12 },
    input: { backgroundColor: C.backgroundSoft, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.primaryDark, borderWidth: 1, borderColor: C.surfaceBorder },
    inputMultiline: { height: 70, textAlignVertical: 'top' },
    formBtnRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
    cancelBtn: { flex: 1, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: C.surfaceBorder },
    cancelBtnText: { color: C.textSecondary, fontWeight: '600' },
    saveBtn: { flex: 2, backgroundColor: C.primary, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
    saveBtnText: { color: '#fff', fontWeight: '700' },
  });
}
