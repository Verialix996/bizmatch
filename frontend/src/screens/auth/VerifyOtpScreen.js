import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useState } from 'react';
import { verifyEmail, resendOtp } from '../../services/auth.service';
import useAuthStore from '../../store/authStore';

export default function VerifyOtpScreen({ route }) {
  const { email } = route.params;
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const setAuth = useAuthStore(s => s.setAuth);

  const onVerify = async () => {
    setError('');
    try {
      const { data } = await verifyEmail(email, code);
      await setAuth(data.token, null);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid code');
    }
  };

  const onResend = async () => {
    setMessage('');
    setError('');
    try {
      await resendOtp(email);
      setMessage('A new code was sent to your email.');
    } catch {
      setError('Failed to resend code.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify Email</Text>
      <Text style={styles.sub}>Enter the 6-digit code sent to {email}</Text>

      <TextInput
        style={styles.input}
        placeholder="000000"
        keyboardType="number-pad"
        maxLength={6}
        textAlign="center"
        onChangeText={setCode}
        value={code}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}

      <TouchableOpacity style={styles.button} onPress={onVerify}>
        <Text style={styles.buttonText}>Verify</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onResend}>
        <Text style={styles.link}>Resend code</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title:     { fontSize: 26, fontWeight: 'bold', textAlign: 'center', color: '#1A1A2E', marginBottom: 8 },
  sub:       { textAlign: 'center', color: '#888', marginBottom: 24 },
  input:     { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 24, letterSpacing: 8 },
  button:    { backgroundColor: '#1A1A2E', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText:{ color: '#fff', fontWeight: 'bold', fontSize: 16 },
  link:      { textAlign: 'center', color: '#1A1A2E', marginTop: 16 },
  error:     { color: '#e74c3c', marginBottom: 8, textAlign: 'center' },
  success:   { color: '#27ae60', marginBottom: 8, textAlign: 'center' },
});
