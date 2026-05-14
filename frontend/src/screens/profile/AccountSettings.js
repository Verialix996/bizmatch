import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, ScrollView, ActivityIndicator, Modal, Alert
} from 'react-native';
import { useState } from 'react';
import api from '../../services/api';
import { cancelPremium } from '../../services/auth.service';
import useAuthStore from '../../store/authStore';
import { colors, typography, radius, cardShadow } from '../../theme';

export default function AccountSettingsScreen({ navigation }) {
  const user = useAuthStore(s => s.user);
  const updateUser = useAuthStore(s => s.updateUser);
  const logout = useAuthStore(s => s.logout);

  const [name, setName] = useState(user?.name || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState(user?.verification_status || 'none');

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(!!user?.two_factor_enabled);
  const [twoFactorSetup, setTwoFactorSetup] = useState(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState('');
  const [disable2FAStep, setDisable2FAStep] = useState(false);
  const [disable2FACode, setDisable2FACode] = useState('');
  const [disable2FALoading, setDisable2FALoading] = useState(false);
  const [disable2FAError, setDisable2FAError] = useState('');

  // Premium state
  const isPremium = !!(user?.is_premium && user?.premium_expires_at && new Date(user.premium_expires_at) > new Date());
  const [premiumLoading, setPremiumLoading] = useState(false);

  const handleCancelPremium = () => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel your Premium subscription? You will lose access immediately.',
      [
        { text: 'Keep Premium', style: 'cancel' },
        {
          text: 'Cancel Subscription', style: 'destructive',
          onPress: async () => {
            setPremiumLoading(true);
            try {
              await cancelPremium();
              updateUser({ ...user, is_premium: 0, premium_expires_at: null });
            } catch {
              Alert.alert('Error', 'Could not cancel subscription. Please try again.');
            } finally {
              setPremiumLoading(false);
            }
          },
        },
      ]
    );
  };

  // Modal states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name cannot be empty.');
      return;
    }
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await api.patch('/users/me', { name: name.trim() });
      updateUser({ ...user, name: name.trim() });
      setSuccess('Account updated successfully.');
      setTimeout(() => navigation.goBack(), 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update account.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySelf = async () => {
    setVerifyLoading(true);
    try {
      await api.post('/users/me/verify-self');
      setVerificationStatus('verified');
      updateUser({ ...user, verification_status: 'verified' });
    } catch (err) {
      setError('Verification failed. Please try again.');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleSetup2FA = async () => {
    setTwoFactorLoading(true);
    setTwoFactorError('');
    try {
      const { data } = await api.post('/auth/2fa/setup');
      setTwoFactorSetup(data);
    } catch {
      setTwoFactorError('Failed to initialize 2FA. Please try again.');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    if (twoFactorCode.length !== 6) {
      setTwoFactorError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setTwoFactorLoading(true);
    setTwoFactorError('');
    try {
      await api.post('/auth/2fa/verify', { token: twoFactorCode });
      setTwoFactorEnabled(true);
      setTwoFactorSetup(null);
      updateUser({ two_factor_enabled: 1 });
    } catch {
      setTwoFactorError('Invalid code. Please try again.');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (disable2FACode.length !== 6) {
      setDisable2FAError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setDisable2FALoading(true);
    setDisable2FAError('');
    try {
      await api.post('/auth/2fa/disable', { token: disable2FACode });
      setTwoFactorEnabled(false);
      setDisable2FAStep(false);
      setDisable2FACode('');
      updateUser({ two_factor_enabled: 0 });
    } catch {
      setDisable2FAError('Invalid code. Please try again.');
    } finally {
      setDisable2FALoading(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    setShowConfirmModal(false);
    setLoading(true);
    try {
      await api.delete('/users/me');
      setShowSuccessModal(true);
    } catch (err) {
      setLoading(false);
      setError('Could not delete account. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>

      {/* ── Confirm Delete Modal ── */}
      <Modal visible={showConfirmModal} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Delete Account</Text>
            <Text style={styles.modalBody}>
              Are you sure? This will permanently erase your profile, matches, and messages.{'\n\n'}This cannot be undone.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.btnCancel}
                onPress={() => setShowConfirmModal(false)}
              >
                <Text style={styles.btnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnConfirmDelete}
                onPress={handleDeleteConfirmed}
              >
                <Text style={styles.btnConfirmDeleteText}>Delete Everything</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Success Modal ── */}
      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.modalTitle}>Account Deleted</Text>
            <Text style={styles.modalBody}>
              Your account has been successfully deleted.
            </Text>
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={() => {
                setShowSuccessModal(false);
                logout();
              }}
            >
              <Text style={styles.btnPrimaryText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account Settings</Text>
        <View style={{ flex: 1 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>PERSONAL DETAILS</Text>

          <Text style={styles.fieldLabel}>FULL NAME</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={(text) => {
              setName(text);
              setSuccess('');
              setError('');
            }}
            placeholder="Enter your full name"
            placeholderTextColor={colors.textHint}
          />

          <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
          <View style={[styles.input, styles.inputDisabled]}>
            <Text style={{ color: colors.textSecondary }}>{user?.email}</Text>
          </View>
          <Text style={styles.helperText}>Your email address cannot be changed.</Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {success ? <Text style={styles.successText}>{success}</Text> : null}

          <TouchableOpacity
            style={[styles.btnPrimary, loading && styles.btnDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnPrimaryText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>ACCOUNT</Text>
          <Text style={styles.dangerText}>
            Current role: <Text style={{ fontWeight: '700', color: colors.primary }}>
              {user?.role === 'entrepreneur' ? 'Entrepreneur' : user?.role === 'investor' ? 'Investor' : 'Not set'}
            </Text>
          </Text>
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => navigation.navigate('EditProfile', { forceStep: 'role' })}
          >
            <Text style={styles.btnPrimaryText}>Change Role</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>IDENTITY VERIFICATION</Text>
          {verificationStatus === 'verified' ? (
            <Text style={[styles.dangerText, { color: colors.success }]}>
              ✓ Your account is verified
            </Text>
          ) : (
            <>
              <Text style={styles.dangerText}>
                Verify your identity to build trust with matches.
                {verificationStatus === 'pending' ? ' Your document is under review.' : ''}
              </Text>
              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={handleVerifySelf}
                disabled={verifyLoading}
              >
                {verifyLoading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnPrimaryText}>Verify Account</Text>
                }
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>TWO-FACTOR AUTHENTICATION</Text>
          {twoFactorEnabled ? (
            <>
              <Text style={[styles.dangerText, { color: colors.success }]}>
                ✓ Two-factor authentication is enabled
              </Text>
              {disable2FAStep ? (
                <>
                  <Text style={styles.fieldLabel}>ENTER 6-DIGIT CODE TO DISABLE</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="000000"
                    placeholderTextColor={colors.textHint}
                    keyboardType="number-pad"
                    maxLength={6}
                    value={disable2FACode}
                    onChangeText={(t) => { setDisable2FACode(t); setDisable2FAError(''); }}
                  />
                  {disable2FAError ? <Text style={styles.errorText}>{disable2FAError}</Text> : null}
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity
                      style={[styles.btnCancel, { flex: 1 }]}
                      onPress={() => { setDisable2FAStep(false); setDisable2FACode(''); setDisable2FAError(''); }}
                    >
                      <Text style={styles.btnCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.btnDelete, { flex: 1 }, disable2FALoading && styles.btnDisabled]}
                      onPress={handleDisable2FA}
                      disabled={disable2FALoading}
                    >
                      {disable2FALoading
                        ? <ActivityIndicator color={colors.error} />
                        : <Text style={styles.btnDeleteText}>Confirm Disable</Text>
                      }
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.btnDelete}
                  onPress={() => setDisable2FAStep(true)}
                >
                  <Text style={styles.btnDeleteText}>Disable 2FA</Text>
                </TouchableOpacity>
              )}
            </>
          ) : twoFactorSetup ? (
            <>
              <Text style={styles.dangerText}>
                Open Google Authenticator or Authy → tap "+" → "Enter a setup key" → paste the key below.
              </Text>
              <Text style={styles.fieldLabel}>SETUP KEY</Text>
              <View style={[styles.input, styles.inputDisabled, { marginBottom: 16 }]}>
                <Text style={{ color: colors.textPrimary, fontWeight: '700', letterSpacing: 2 }}>
                  {twoFactorSetup.secret}
                </Text>
              </View>
              <Text style={styles.fieldLabel}>ENTER 6-DIGIT CODE TO ACTIVATE</Text>
              <TextInput
                style={styles.input}
                placeholder="000000"
                placeholderTextColor={colors.textHint}
                keyboardType="number-pad"
                maxLength={6}
                value={twoFactorCode}
                onChangeText={(t) => { setTwoFactorCode(t); setTwoFactorError(''); }}
              />
              {twoFactorError ? <Text style={styles.errorText}>{twoFactorError}</Text> : null}
              <TouchableOpacity
                style={[styles.btnPrimary, twoFactorLoading && styles.btnDisabled]}
                onPress={handleVerify2FA}
                disabled={twoFactorLoading}
              >
                {twoFactorLoading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnPrimaryText}>Activate 2FA</Text>
                }
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.dangerText}>
                Add an extra layer of security. You'll need an authenticator app (Google Authenticator or Authy).
              </Text>
              {twoFactorError ? <Text style={styles.errorText}>{twoFactorError}</Text> : null}
              <TouchableOpacity
                style={[styles.btnPrimary, twoFactorLoading && styles.btnDisabled]}
                onPress={handleSetup2FA}
                disabled={twoFactorLoading}
              >
                {twoFactorLoading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnPrimaryText}>Enable 2FA</Text>
                }
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Subscriptions */}
        <View style={[styles.card, isPremium && styles.premiumCard]}>
          <Text style={styles.sectionLabel}>SUBSCRIPTIONS</Text>
          {isPremium ? (
            <>
              <View style={styles.premiumTagRow}>
                <View style={styles.premiumTag}>
                  <Text style={styles.premiumTagText}>✦ PREMIUM</Text>
                </View>
              </View>
              <View style={styles.premiumBadgeRow}>
                <Text style={styles.premiumCrown}>👑</Text>
                <Text style={styles.premiumBadgeText}>Premium Member</Text>
              </View>
              <Text style={styles.premiumExpiry}>
                Expires {new Date(user.premium_expires_at).toLocaleDateString()}
              </Text>
              <TouchableOpacity
                style={styles.btnCancel}
                onPress={handleCancelPremium}
                disabled={premiumLoading}
              >
                {premiumLoading
                  ? <ActivityIndicator color={colors.textSecondary} />
                  : <Text style={styles.btnCancelText}>Cancel Subscription</Text>
                }
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.dangerText}>You are on the Free plan.</Text>
              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={() => navigation.navigate('Premium')}
              >
                <Text style={styles.btnPrimaryText}>Upgrade to Premium</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={[styles.card, styles.dangerZone]}>
          <Text style={[styles.sectionLabel, { color: colors.error }]}>DANGER ZONE</Text>
          <Text style={styles.dangerText}>
            Deleting your account will permanently erase all your data.
          </Text>
          <TouchableOpacity
            style={styles.btnDelete}
            onPress={() => setShowConfirmModal(true)}
            disabled={loading}
          >
            <Text style={styles.btnDeleteText}>Delete Account</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSoft },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  backBtn: { flex: 1 },
  backText: { color: colors.primary, ...typography.labelLarge },
  headerTitle: { ...typography.titleLarge, color: colors.textPrimary, flex: 2, textAlign: 'center' },

  // Scroll
  scrollContent: { padding: 20 },

  // Card
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 20,
    marginBottom: 20,
    ...cardShadow,
  },
  sectionLabel: { ...typography.labelSmall, color: colors.textHint, marginBottom: 20 },
  fieldLabel: { ...typography.labelLarge, color: colors.textSecondary, marginBottom: 8 },
  input: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...typography.bodyLarge,
    color: colors.textPrimary,
    marginBottom: 16,
  },
  inputDisabled: { backgroundColor: '#ECEEF2', justifyContent: 'center' },
  helperText: { ...typography.caption, color: colors.textHint, marginTop: -8, marginBottom: 20 },
  errorText: { color: colors.error, ...typography.bodySmall, textAlign: 'center', marginBottom: 16 },
  successText: { color: colors.success, ...typography.bodySmall, textAlign: 'center', marginBottom: 16 },

  // Buttons
  btnPrimary: { backgroundColor: colors.buttonPrimary, borderRadius: radius.pill, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.7 },
  btnPrimaryText: { color: colors.buttonPrimaryText, ...typography.labelLarge },
  premiumCard: { borderWidth: 2, borderColor: '#D4AF37', backgroundColor: '#FFFDF0' },
  premiumTagRow: { marginBottom: 12 },
  premiumTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#D4AF37',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  premiumTagText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  premiumBadgeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  premiumCrown: { fontSize: 22 },
  premiumBadgeText: { ...typography.titleSmall, color: '#B8860B', fontWeight: '700' },
  premiumExpiry: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: 20 },
  btnCancel: {
    borderWidth: 1, borderColor: colors.surfaceBorder,
    borderRadius: radius.pill, paddingVertical: 14, alignItems: 'center',
  },
  btnCancelText: { color: colors.textSecondary, ...typography.labelLarge },
  dangerZone: { borderWidth: 1, borderColor: colors.errorLight, backgroundColor: '#FFFAFA' },
  dangerText: { ...typography.bodyMedium, color: colors.textSecondary, marginBottom: 24 },
  btnDelete: { backgroundColor: colors.errorLight, borderRadius: radius.pill, paddingVertical: 16, alignItems: 'center' },
  btnDeleteText: { color: colors.buttonDestructive, ...typography.labelLarge },

  // Modal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 36, 102, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 28,
    width: '100%',
    maxWidth: 400,
    ...cardShadow,
  },
  modalTitle: { ...typography.titleMedium, color: colors.textPrimary, textAlign: 'center', marginBottom: 12 },
  modalBody: { ...typography.bodyMedium, color: colors.textSecondary, textAlign: 'center', marginBottom: 28, lineHeight: 22 },
  successIcon: { fontSize: 40, textAlign: 'center', marginBottom: 12 },
  modalActions: { flexDirection: 'row', gap: 12 },
  btnCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnCancelText: { color: colors.textSecondary, ...typography.labelLarge },
  btnConfirmDelete: {
    flex: 1,
    backgroundColor: colors.error,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnConfirmDeleteText: { color: '#fff', ...typography.labelLarge },
});
