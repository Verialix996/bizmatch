import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, StatusBar, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { LinearGradient } from 'expo-linear-gradient';
import { register } from '../../services/auth.service';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, brandGradient, radius } from '../../theme';

export default function RegisterScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { control, handleSubmit, formState: { errors } } = useForm();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const onSubmit = async (data) => {
    setError('');
    setLoading(true);
    try {
      await register(data);
      navigation.navigate('VerifyOtp', { email: data.email });
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    {
      name: 'name',
      label: 'FULL NAME',
      placeholder: 'Your full name',
      secure: false,
      capitalize: 'words',
      keyboard: 'default',
    },
    {
      name: 'email',
      label: 'EMAIL',
      placeholder: 'you@example.com',
      secure: false,
      capitalize: 'none',
      keyboard: 'email-address',
    },
    {
      name: 'password',
      label: 'PASSWORD',
      placeholder: '8+ chars, include a number',
      secure: true,
      capitalize: 'none',
      keyboard: 'default',
      rules: {
        required: 'Password is required',
        minLength: { value: 8, message: 'Password must be at least 8 characters' },
        pattern: { value: /(?=.*[A-Za-z])(?=.*\d)/, message: 'Password must contain a letter and a number' },
      },
    },
  ];

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
            <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <Text style={styles.backText}>←</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.titleArea}>
              <Text style={styles.title}>Create{'\n'}account</Text>
              <Text style={styles.subtitle}>Join the BizMatch network</Text>
            </View>

            <View style={styles.formArea}>
              {fields.map((f) => (
                <View key={f.name}>
                  <Text style={styles.fieldLabel}>{f.label}</Text>
                  <Controller
                    control={control}
                    name={f.name}
                    rules={f.rules ?? { required: true }}
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        style={[
                          styles.input,
                          focusedField === f.name && styles.inputFocused,
                          errors[f.name] && styles.inputError,
                        ]}
                        placeholder={f.placeholder}
                        placeholderTextColor="rgba(255,255,255,0.4)"
                        secureTextEntry={f.secure}
                        autoCapitalize={f.capitalize}
                        keyboardType={f.keyboard}
                        onChangeText={onChange}
                        value={value}
                        onFocus={() => setFocusedField(f.name)}
                        onBlur={() => setFocusedField(null)}
                      />
                    )}
                  />
                  {errors[f.name] && (
                    <Text style={styles.fieldError}>{errors[f.name].message || 'This field is required'}</Text>
                  )}
                </View>
              ))}

              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </View>

            <View style={styles.bottomArea}>
              <TouchableOpacity
                style={[styles.btnPrimary, loading && styles.btnDisabled]}
                onPress={handleSubmit(onSubmit)}
                disabled={loading}
                activeOpacity={0.85}
              >
                <Text style={styles.btnPrimaryText}>
                  {loading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.navigate('Login')}
                style={styles.linkBtn}
              >
                <Text style={styles.linkText}>
                  Already have an account?{' '}
                  <Text style={styles.linkTextBold}>Sign in</Text>
                </Text>
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
    paddingBottom: 32,
  },
  title: {
    fontSize: 38,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -1,
    lineHeight: 44,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.65)',
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
  inputError: {
    borderColor: '#FFB3AE',
  },
  fieldError: {
    fontSize: 12,
    color: '#FFB3AE',
    marginTop: -14,
    marginBottom: 14,
  },
  errorText: {
    fontSize: 13,
    color: '#FFB3AE',
    marginBottom: 12,
    textAlign: 'center',
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
  linkTextBold: {
    color: '#fff',
    fontWeight: '700',
  },
});