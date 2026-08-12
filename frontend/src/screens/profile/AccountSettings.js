import {
  View, Text, TextInput, TouchableOpacity, Switch, Image,
  StyleSheet, SafeAreaView, ScrollView, ActivityIndicator, Modal, StatusBar
} from 'react-native';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import api from '../../services/api';
import { uploadPhoto } from '../../services/auth.service';
import useAuthStore from '../../store/authStore';
import useAppStore from '../../store/appStore';
import { colors, investorColors, typography, radius, cardShadow } from '../../theme';

export default function AccountSettingsScreen({ navigation }) {
  const user = useAuthStore(s => s.user);
  const updateUser = useAuthStore(s => s.updateUser);
  const logout = useAuthStore(s => s.logout);
  const darkMode = useAppStore(s => s.darkMode);
  const setDarkMode = useAppStore(s => s.setDarkMode);
  const C = darkMode ? investorColors : colors;
  const styles = makeStyles(C);

  const [name, setName] = useState(user?.name || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState(user?.verification_status || 'none');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(user?.photoUrl || user?.photo_url || null);

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

  const handlePickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library access is needed to change your picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]?.base64) return;

    const asset = result.assets[0];
    const mimeType = asset.mimeType || 'image/jpeg';
    const dataUri = `data:${mimeType};base64,${asset.base64}`;

    setError('');
    setPhotoUploading(true);
    try {
      const { data } = await uploadPhoto(dataUri);
      setPhotoUrl(data.photo_url);
      updateUser({ ...user, photoUrl: data.photo_url, photo_url: data.photo_url });
    } catch (err) {
      setError(err.response?.data?.error || 'Could not upload photo.');
    } finally {
      setPhotoUploading(false);
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
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />

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
          <Text style={styles.sectionHelper}>
            Account-level details only — your name and photo here. Founder profile fields (role, capabilities, partner requirements) live in Edit Profile, and none of this affects your evidence or DNA scores.
          </Text>

          <View style={styles.photoRow}>
            <TouchableOpacity onPress={handlePickPhoto} disabled={photoUploading} activeOpacity={0.8}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.photo} />
              ) : (
                <View style={[styles.photo, styles.photoPlaceholder]}>
                  <Text style={styles.photoPlaceholderText}>{user?.name ? user.name[0].toUpperCase() : '?'}</Text>
                </View>
              )}
              {photoUploading ? (
                <View style={styles.photoOverlay}><ActivityIndicator color="#fff" /></View>
              ) : null}
            </TouchableOpacity>
            <TouchableOpacity onPress={handlePickPhoto} disabled={photoUploading}>
              <Text style={styles.changePhotoText}>{photoUrl ? 'Change photo' : 'Add photo'}</Text>
            </TouchableOpacity>
          </View>

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
            placeholderTextColor={C.textHint}
          />

          <Text style={styles.fieldLabel}>EMAIL ADDRESS</Text>
          <View style={[styles.input, styles.inputDisabled]}>
            <Text style={{ color: C.textSecondary }}>{user?.email}</Text>
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
          <Text style={styles.sectionLabel}>IDENTITY VERIFICATION</Text>
          {verificationStatus === 'verified' ? (
            <Text style={[styles.dangerText, { color: C.success }]}>
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

        {/* Appearance */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>APPEARANCE</Text>
          <View style={styles.switchRow}>
            <View>
              <Text style={styles.switchLabel}>Dark Mode</Text>
              <Text style={styles.switchSub}>Use a dark color scheme</Text>
            </View>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: colors.surfaceBorder, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <View style={styles.card}>
          <TouchableOpacity style={styles.btnLogout} onPress={logout}>
            <Text style={styles.btnLogoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, styles.dangerZone]}>
          <Text style={[styles.sectionLabel, { color: C.error }]}>DANGER ZONE</Text>
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

function makeStyles(C) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: C.backgroundSoft },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.surfaceBorder,
  },
  backBtn: { flex: 1 },
  backText: { color: C.primary, ...typography.labelLarge },
  headerTitle: { ...typography.titleLarge, color: C.textPrimary, flex: 2, textAlign: 'center' },

  scrollContent: { padding: 20 },

  card: {
    backgroundColor: C.surface,
    borderRadius: radius.lg,
    padding: 20,
    marginBottom: 20,
    ...cardShadow,
  },
  sectionLabel: { ...typography.labelSmall, color: C.textHint, marginBottom: 8 },
  sectionHelper: { ...typography.caption, color: C.textHint, marginBottom: 20, lineHeight: 16 },
  photoRow: { alignItems: 'center', gap: 10, marginBottom: 20 },
  photo: { width: 84, height: 84, borderRadius: 42, backgroundColor: C.surfaceElevated },
  photoPlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: C.primary },
  photoPlaceholderText: { color: '#fff', fontSize: 30, fontWeight: '800' },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject, borderRadius: 42, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  changePhotoText: { color: C.primary, ...typography.labelLarge, fontWeight: '700' },
  fieldLabel: { ...typography.labelLarge, color: C.textSecondary, marginBottom: 8 },
  input: {
    backgroundColor: C.backgroundSoft,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...typography.bodyLarge,
    color: C.textPrimary,
    marginBottom: 16,
  },
  inputDisabled: { backgroundColor: C.surfaceElevated || C.backgroundSoft, justifyContent: 'center' },
  helperText: { ...typography.caption, color: C.textHint, marginTop: -8, marginBottom: 20 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { ...typography.bodyLarge, color: C.textPrimary, fontWeight: '600' },
  btnLogout: { paddingVertical: 6, alignItems: 'center' },
  btnLogoutText: { ...typography.bodyLarge, color: C.textPrimary, fontWeight: '700' },
  switchSub: { ...typography.bodySmall, color: C.textSecondary, marginTop: 2 },
  errorText: { color: C.error, ...typography.bodySmall, textAlign: 'center', marginBottom: 16 },
  successText: { color: C.success, ...typography.bodySmall, textAlign: 'center', marginBottom: 16 },

  btnPrimary: { backgroundColor: C.buttonPrimary, borderRadius: radius.pill, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.7 },
  btnPrimaryText: { color: C.buttonPrimaryText, ...typography.labelLarge },
  btnCancel: {
    borderWidth: 1, borderColor: C.surfaceBorder,
    borderRadius: radius.pill, paddingVertical: 14, alignItems: 'center',
  },
  btnCancelText: { color: C.textSecondary, ...typography.labelLarge },
  dangerZone: { borderWidth: 1, borderColor: C.errorLight || '#FFCDD2', backgroundColor: C.surface },
  dangerText: { ...typography.bodyMedium, color: C.textSecondary, marginBottom: 24 },
  btnDelete: { backgroundColor: C.errorLight || '#FFCDD2', borderRadius: radius.pill, paddingVertical: 16, alignItems: 'center' },
  btnDeleteText: { color: C.buttonDestructive || C.error, ...typography.labelLarge },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 36, 102, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: C.surface,
    borderRadius: radius.xl,
    padding: 28,
    width: '100%',
    maxWidth: 400,
    ...cardShadow,
  },
  modalTitle: { ...typography.titleMedium, color: C.textPrimary, textAlign: 'center', marginBottom: 12 },
  modalBody: { ...typography.bodyMedium, color: C.textSecondary, textAlign: 'center', marginBottom: 28, lineHeight: 22 },
  successIcon: { fontSize: 40, textAlign: 'center', marginBottom: 12 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtnCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalBtnCancelText: { color: C.textSecondary, ...typography.labelLarge },
  btnConfirmDelete: {
    flex: 1,
    backgroundColor: C.error,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnConfirmDeleteText: { color: '#fff', ...typography.labelLarge },
}); }
