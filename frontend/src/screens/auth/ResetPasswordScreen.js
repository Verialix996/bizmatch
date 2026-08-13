import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, StatusBar, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { resetPassword } from '../../services/auth.service';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { brandGradient, radius } from '../../theme';
import useAuthStore from '../../store/authStore';

export default function ResetPasswordScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(null);
  const clearPasswordRecovery = useAuthStore(s => s.clearPasswordRecovery);

  const onSubmit = async () => {
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await resetPassword(password);
      await clearPasswordRecovery();
      setMessage('Password reset! Redirecting to login...');
      setTimeout(() => navigation.navigate('Login'), 2500);
    } catch (e) {
      setError(e.message || 'Invalid or expired reset link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[brandGradient.start, brandGradient.middle, brandGradient.end]}
        style={styles.gradient}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
      >
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
            <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.backBtn}>
              <Text style={styles.backText}>←</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.titleArea}>
            <Text style={styles.title}>New{'\n'}Password</Text>
            <Text style={styles.subtitle}>Choose a strong password for your account.</Text>
          </View>

          <View style={styles.formArea}>
            <Text style={styles.fieldLabel}>NEW PASSWORD</Text>
            <TextInput
              style={[styles.input, focused === 'password' && styles.inputFocused]}
              placeholder="At least 6 characters"
              placeholderTextColor="rgba(255,255,255,0.4)"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocused('password')}
              onBlur={() => setFocused(null)}
              autoCapitalize="none"
            />

            <Text style={styles.fieldLabel}>CONFIRM PASSWORD</Text>
            <TextInput
              style={[styles.input, focused === 'confirm' && styles.inputFocused]}
              placeholder="Repeat your password"
              placeholderTextColor="rgba(255,255,255,0.4)"
              secureTextEntry
              value={confirm}
              onChangeText={setConfirm}
              onFocus={() => setFocused('confirm')}
              onBlur={() => setFocused(null)}
              autoCapitalize="none"
            />

            {!!error   && <Text style={styles.errorText}>{error}</Text>}
            {!!message && <Text style={styles.successText}>{message}</Text>}
          </View>

          <View style={styles.bottomArea}>
            <TouchableOpacity
              style={[styles.btnPrimary, (loading || !password) && styles.btnDisabled]}
              onPress={onSubmit}
              disabled={loading || !password}
              activeOpacity={0.85}
            >
              <Text style={styles.btnPrimaryText}>
                {loading ? 'RESETTING...' : 'RESET PASSWORD'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gradient: { flex: 1 },

  header: {
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  backBtn: { padding: 4, alignSelf: 'flex-start' },
  backText: { fontSize: 26, color: '#fff' },

  titleArea: {
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 40,
  },
  title: {
    fontSize: 38,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -1,
    lineHeight: 44,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 22,
  },

  formArea: {
    paddingHorizontal: 28,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.md,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 15,
    color: '#fff',
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  inputFocused: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.7)',
  },
  errorText: {
    fontSize: 13,
    color: '#FFB3AE',
    textAlign: 'center',
    marginBottom: 8,
  },
  successText: {
    fontSize: 13,
    color: '#A8FFCB',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 20,
  },

  bottomArea: {
    paddingHorizontal: 28,
    paddingTop: 8,
  },
  btnPrimary: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.pill,
    paddingVertical: 17,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnPrimaryText: {
    color: '#022466',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
});
