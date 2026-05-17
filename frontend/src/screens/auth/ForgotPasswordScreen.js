import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, StatusBar, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { forgotPassword } from '../../services/auth.service';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { brandGradient, radius } from '../../theme';

export default function ForgotPasswordScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  const onSubmit = async () => {
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    setMessage('');
    setError('');
    setLoading(true);
    try {
      await forgotPassword(email);
      setMessage('If that email exists, a reset link is on its way.');
      setTimeout(() => navigation.navigate('Login'), 3000);
    } catch {
      setError('Something went wrong. Please try again.');
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
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={styles.backText}>←</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.titleArea}>
            <Text style={styles.title}>Reset your{'\n'}password</Text>
            <Text style={styles.subtitle}>
              Enter your email and we'll send you a reset link.
            </Text>
          </View>

          <View style={styles.formArea}>
            <Text style={styles.fieldLabel}>EMAIL</Text>
            <TextInput
              style={[styles.input, focused && styles.inputFocused]}
              placeholder="you@example.com"
              placeholderTextColor="rgba(255,255,255,0.4)"
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={setEmail}
              value={email}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {message ? <Text style={styles.successText}>{message}</Text> : null}
          </View>

          <View style={styles.bottomArea}>
            <TouchableOpacity
              style={[styles.btnPrimary, loading && styles.btnDisabled]}
              onPress={onSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.btnPrimaryText}>
                {loading ? 'SENDING...' : 'SEND RESET LINK'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              style={styles.linkBtn}
            >
              <Text style={styles.linkText}>Back to sign in</Text>
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
    gap: 16,
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
  linkBtn: { alignItems: 'center' },
  linkText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
  },
});