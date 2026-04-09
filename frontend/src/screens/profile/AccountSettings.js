import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, ScrollView, ActivityIndicator, Modal
} from 'react-native';
import { useState } from 'react';
import api from '../../services/api';
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
