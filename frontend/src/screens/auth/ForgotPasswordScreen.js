import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useState } from 'react';
import { forgotPassword } from '../../services/auth.service';

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const onSubmit = async () => {
    setMessage('');
    setError('');
    try {
      await forgotPassword(email);
      setMessage('If that email exists, a reset link was sent.');
      setTimeout(() => navigation.navigate('Login'), 2000);
    } catch {
      setError('Something went wrong.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Forgot Password</Text>
      <Text style={styles.sub}>Enter your email and we'll send you a reset link.</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        onChangeText={setEmail}
        value={email}
      />

      {message ? <Text style={styles.success}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.button} onPress={onSubmit}>
        <Text style={styles.buttonText}>Send Reset Link</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.link}>Back to login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title:     { fontSize: 26, fontWeight: 'bold', textAlign: 'center', color: '#1A1A2E', marginBottom: 8 },
  sub:       { textAlign: 'center', color: '#888', marginBottom: 24 },
  input:     { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 12 },
  button:    { backgroundColor: '#1A1A2E', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText:{ color: '#fff', fontWeight: 'bold', fontSize: 16 },
  link:      { textAlign: 'center', color: '#1A1A2E', marginTop: 16 },
  success:   { color: '#27ae60', marginBottom: 8, textAlign: 'center' },
  error:     { color: '#e74c3c', marginBottom: 8, textAlign: 'center' },
});
