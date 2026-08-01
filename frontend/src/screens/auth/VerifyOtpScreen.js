import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, StatusBar, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { verifySignupOtp, resendOtp } from '../../services/auth.service';
import useAuthStore from '../../store/authStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { brandGradient, radius } from '../../theme';

export default function VerifyOtpScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { email } = route.params;
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const setAuth = useAuthStore(s => s.setAuth);

  const onVerify = async () => {
    if (code.length < 6) {
      setError('Please enter the full 6-digit code.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const session = await verifySignupOtp(email, code);
      await setAuth(session);
    } catch (err) {
      setError(err.message || 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    setMessage('');
    setError('');
    setResending(true);
    try {
      await resendOtp(email);
      setMessage('A new code was sent to your email.');
    } catch {
      setError('Failed to resend code. Please try again.');
    } finally {
      setResending(false);
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
            <Text style={styles.title}>Check your{'\n'}email</Text>
            <Text style={styles.subtitle}>
              We sent a 6-digit code to
            </Text>
            <Text style={styles.emailHighlight}>{email}</Text>
          </View>

          <View style={styles.formArea}>
            <Text style={styles.fieldLabel}>VERIFICATION CODE</Text>
            <TextInput
              style={[styles.codeInput, code.length > 0 && styles.codeInputActive]}
              placeholder="000000"
              placeholderTextColor="rgba(255,255,255,0.3)"
              keyboardType="number-pad"
              maxLength={6}
              textAlign="center"
              onChangeText={setCode}
              value={code}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {message ? <Text style={styles.successText}>{message}</Text> : null}
          </View>

          <View style={styles.bottomArea}>
            <TouchableOpacity
              style={[styles.btnPrimary, (loading || code.length < 6) && styles.btnDisabled]}
              onPress={onVerify}
              disabled={loading || code.length < 6}
              activeOpacity={0.85}
            >
              <Text style={styles.btnPrimaryText}>
                {loading ? 'VERIFYING...' : 'VERIFY EMAIL'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnOutline}
              onPress={onResend}
              disabled={resending}
              activeOpacity={0.85}
            >
              <Text style={styles.btnOutlineText}>
                {resending ? 'Sending...' : 'Resend code'}
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
    paddingBottom: 36,
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
    marginBottom: 4,
  },
  emailHighlight: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },

  formArea: {
    paddingHorizontal: 28,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  codeInput: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.md,
    paddingVertical: 20,
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    letterSpacing: 16,
    marginBottom: 20,
  },
  codeInputActive: {
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
  },

  bottomArea: {
    paddingHorizontal: 28,
    paddingTop: 8,
    gap: 12,
  },
  btnPrimary: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.pill,
    paddingVertical: 17,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.45 },
  btnPrimaryText: {
    color: '#022466',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  btnOutline: {
    borderRadius: radius.pill,
    paddingVertical: 17,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  btnOutlineText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});