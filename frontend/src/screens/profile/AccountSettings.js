import {
  View, Text, TextInput, TouchableOpacity, 
  StyleSheet, SafeAreaView, Alert, ScrollView, ActivityIndicator
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

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name cannot be empty.');
      return;
    }
    
    setError('');
    setSuccess('');
    setLoading(true);
    
    try {
      // 1. Update the database
      await api.patch('/users/me', { name: name.trim() });
      
      // 2. Update the local store so ProfileScreen updates immediately
      updateUser({ ...user, name: name.trim() });
      
      setSuccess('Account updated successfully.');
      setTimeout(() => navigation.goBack(), 1500); 
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update account.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure? This will permanently erase your profile, matches, and messages. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete Everything", 
          style: "destructive", 
          onPress: async () => {
            try {
              setLoading(true);
              await api.delete('/users/me'); 
              logout(); 
            } catch (err) {
              setLoading(false);
              Alert.alert("Error", "Could not delete profile. Please try again.");
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
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
            onPress={handleDeleteAccount} 
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
  scrollContent: { padding: 20 },
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
  btnPrimary: { backgroundColor: colors.buttonPrimary, borderRadius: radius.pill, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.7 },
  btnPrimaryText: { color: colors.buttonPrimaryText, ...typography.labelLarge },
  dangerZone: { borderWidth: 1, borderColor: colors.errorLight, backgroundColor: '#FFFAFA' },
  dangerText: { ...typography.bodyMedium, color: colors.textSecondary, marginBottom: 24 },
  btnDelete: { backgroundColor: colors.errorLight, borderRadius: radius.pill, paddingVertical: 16, alignItems: 'center' },
  btnDeleteText: { color: colors.buttonDestructive, ...typography.labelLarge },
});