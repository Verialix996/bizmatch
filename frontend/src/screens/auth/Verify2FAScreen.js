import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, StatusBar, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import useAuthStore from '../../store/authStore';
import { colors, brandGradient, radius, typography } from '../../theme';
import api from '../../services/api';

export default function Verify2FAScreen({ route, navigation }) {
  const { userId } = route.params;
  const setAuth = useAuthStore(s => s.setAuth);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onVerify = async () => {
    if (token.length !== 6) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/2fa/login', { userId, token });
      await setAuth(data.token, data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid code. Please try again.');
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
      >
        <View style={styles.card}>
          <Text style={styles.title}>Two-Factor Authentication</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit code from your authenticator app.
          </Text>

          <TextInput
            style={styles.input}
            value={token}
            onChangeText={t => setToken(t.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            placeholder="123456"
            placeholderTextColor={colors.textHint}
            maxLength={6}
            autoFocus
          />

          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity style={styles.btn} onPress={onVerify} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Verify</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
            <Text style={styles.backText}>Back to login</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.xl,
    padding: 28,
    alignItems: 'center',
  },
  title: { ...typography.titleLarge, color: colors.primaryDark, marginBottom: 8, textAlign: 'center' },
  subtitle: { ...typography.bodyMedium, color: colors.textSecondary, textAlign: 'center', marginBottom: 24 },
  input: {
    width: '100%',
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  error: { ...typography.bodySmall, color: colors.error, marginBottom: 12, textAlign: 'center' },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    width: '100%',
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 16,
  },
  btnText: { ...typography.titleSmall, color: '#fff' },
  back: { paddingVertical: 4 },
  backText: { ...typography.bodyMedium, color: colors.textSecondary },
});
