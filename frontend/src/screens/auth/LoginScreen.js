import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, StatusBar, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { LinearGradient } from 'expo-linear-gradient';
import { login } from '../../services/auth.service';
import useAuthStore from '../../store/authStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, brandGradient, radius } from '../../theme';

export default function LoginScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { control, handleSubmit } = useForm({ defaultValues: { email: '', password: '' } });
  const setAuth = useAuthStore(s => s.setAuth);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

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
      if (err.response?.data?.needsVerification) {
        navigation.navigate('VerifyOtp', { email });
        return;
      }
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
            <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
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