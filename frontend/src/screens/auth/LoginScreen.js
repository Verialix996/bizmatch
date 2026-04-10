import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, StatusBar, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { login } from '../../services/auth.service';
import useAuthStore from '../../store/authStore';
import { colors, brandGradient, radius } from '../../theme';
import { API_BASE_URL } from '../../config/constants';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen({ navigation }) {
  const { control, handleSubmit } = useForm();
  const setAuth = useAuthStore(s => s.setAuth);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const handleGoogleSignIn = async () => {
    setError('');
    try {
      if (Platform.OS === 'web') {
        const popup = window.open(`${API_BASE_URL}/auth/google`, 'google-auth', 'width=500,height=600,left=200,top=100');
        if (!popup) { setError('Allow popups for this site and try again.'); return; }
        await new Promise((resolve) => {
          const handler = (event) => {
            if (event.data?.type !== 'bizmatch-auth') return;
            window.removeEventListener('message', handler);
            clearInterval(closedPoll);
            const qs = event.data.params;
            const params = Object.fromEntries(qs.split('&').map(p => {
              const [k, v] = p.split('=');
              return [k, decodeURIComponent(v || '')];
            }));
            if (params.token) {
              setAuth(params.token, { id: Number(params.userId), email: params.email, name: params.name, role: params.role });
            }
            resolve();
          };
          window.addEventListener('message', handler);
          const closedPoll = setInterval(() => {
            if (popup.closed) { clearInterval(closedPoll); window.removeEventListener('message', handler); resolve(); }
          }, 500);
        });
      } else {
        const result = await WebBrowser.openAuthSessionAsync(`${API_BASE_URL}/auth/google`, 'bizmatch://');
        if (result.type === 'success' && result.url) {
          const qs = result.url.split('?')[1] || '';
          const params = Object.fromEntries(qs.split('&').map(p => {
            const [k, v] = p.split('=');
            return [k, decodeURIComponent(v || '')];
          }));
          if (params.token) {
            setAuth(params.token, { id: Number(params.userId), email: params.email, name: params.name, role: params.role });
          }
        }
      }
    } catch {
      setError('Google sign-in failed. Please try again.');
    }
  };

  const onSubmit = async ({ email, password }) => {
    setError('');
    setLoading(true);
    try {
      const { data } = await login({ email, password });
      if (data.requires2FA) {
        navigation.navigate('Verify2FA', { userId: data.userId });
      } else {
        await setAuth(data.token, data.user);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
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
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <Text style={styles.backText}>←</Text>
              </TouchableOpacity>
            </View>

            {/* Title */}
            <View style={styles.titleArea}>
              <Text style={styles.title}>Sign in</Text>
              <Text style={styles.subtitle}>Welcome back to BizMatch</Text>
            </View>

            {/* Fields */}
            <View style={styles.formArea}>
              <Text style={styles.fieldLabel}>EMAIL</Text>
              <Controller
                control={control}
                name="email"
                rules={{ required: true }}
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[styles.input, focusedField === 'email' && styles.inputFocused]}
                    placeholder="you@example.com"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    onChangeText={onChange}
                    value={value}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                  />
                )}
              />

              <Text style={styles.fieldLabel}>PASSWORD</Text>
              <Controller
                control={control}
                name="password"
                rules={{ required: true }}
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    style={[styles.input, focusedField === 'password' && styles.inputFocused]}
                    placeholder="Your password"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    secureTextEntry
                    onChangeText={onChange}
                    value={value}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                  />
                )}
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </View>

            {/* Bottom actions */}
            <View style={styles.bottomArea}>
              <TouchableOpacity
                style={[styles.btnPrimary, loading && styles.btnDisabled]}
                onPress={handleSubmit(onSubmit)}
                disabled={loading}
                activeOpacity={0.85}
              >
                <Text style={styles.btnPrimaryText}>
                  {loading ? 'SIGNING IN...' : 'SIGN IN'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnGoogle}
                onPress={handleGoogleSignIn}
                activeOpacity={0.85}
              >
                <Text style={styles.btnGoogleText}>G   CONTINUE WITH GOOGLE</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.navigate('ForgotPassword')}
                style={styles.linkBtn}
              >
                <Text style={styles.linkText}>Forgot password?</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gradient: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 40 },

  header: {
    paddingTop: 56,
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
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.65)',
  },

  formArea: {
    paddingHorizontal: 28,
    flex: 1,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1.2,
    marginBottom: 8,
    marginTop: 8,
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
    marginBottom: 12,
    textAlign: 'center',
  },

  bottomArea: {
    paddingHorizontal: 28,
    paddingTop: 12,
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
  btnGoogle: {
    backgroundColor: '#fff',
    borderRadius: radius.pill,
    paddingVertical: 17,
    alignItems: 'center',
  },
  btnGoogleText: {
    color: '#444',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  linkBtn: { alignItems: 'center' },
  linkText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
  },
});