import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { login } from '../../services/auth.service';
import useAuthStore from '../../store/authStore';

export default function LoginScreen({ navigation }) {
  const { control, handleSubmit } = useForm();
  const setAuth = useAuthStore(s => s.setAuth);
  const [error, setError] = useState('');

  const onSubmit = async ({ email, password }) => {
    setError('');
    try {
      const { data } = await login({ email, password });
      if (data.requires2FA) {
        navigation.navigate('Verify2FA', { userId: data.userId });
      } else {
        await setAuth(data.token, data.user);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>BizMatch</Text>
      <Text style={styles.subtitle}>Connect. Match. Grow.</Text>

      <Controller
        control={control}
        name="email"
        rules={{ required: true }}
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={styles.input}
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={onChange}
            value={value}
          />
        )}
      />

      <Controller
        control={control}
        name="password"
        rules={{ required: true }}
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={styles.input}
            placeholder="Password"
            secureTextEntry
            onChangeText={onChange}
            value={value}
          />
        )}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.button} onPress={handleSubmit(onSubmit)}>
        <Text style={styles.buttonText}>Login</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
        <Text style={styles.link}>Forgot password?</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Register')}>
        <Text style={styles.link}>Don't have an account? Sign up</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title:     { fontSize: 32, fontWeight: 'bold', textAlign: 'center', color: '#1A1A2E' },
  subtitle:  { fontSize: 16, textAlign: 'center', color: '#888', marginBottom: 32 },
  input:     { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 12 },
  button:    { backgroundColor: '#1A1A2E', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  buttonText:{ color: '#fff', fontWeight: 'bold', fontSize: 16 },
  link:      { textAlign: 'center', color: '#1A1A2E', marginTop: 12 },
  error:     { color: '#e74c3c', marginBottom: 8, textAlign: 'center' },
});
