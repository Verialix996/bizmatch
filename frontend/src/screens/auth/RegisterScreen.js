import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { register } from '../../services/auth.service';

export default function RegisterScreen({ navigation }) {
  const { control, handleSubmit } = useForm();
  const [error, setError] = useState('');

  const onSubmit = async (data) => {
    setError('');
    try {
      await register(data);
      navigation.navigate('VerifyOtp', { email: data.email });
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Create Account</Text>

      {['name', 'email', 'password'].map((field) => (
        <Controller
          key={field}
          control={control}
          name={field}
          rules={{ required: true }}
          render={({ field: { onChange, value } }) => (
            <TextInput
              style={styles.input}
              placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
              secureTextEntry={field === 'password'}
              autoCapitalize={field === 'email' ? 'none' : 'words'}
              keyboardType={field === 'email' ? 'email-address' : 'default'}
              onChangeText={onChange}
              value={value}
            />
          )}
        />
      ))}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.button} onPress={handleSubmit(onSubmit)}>
        <Text style={styles.buttonText}>Sign Up</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.link}>Already have an account? Login</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:  { flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title:      { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 24, color: '#1A1A2E' },
  input:      { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 12 },
  button:     { backgroundColor: '#1A1A2E', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  link:       { textAlign: 'center', color: '#1A1A2E', marginTop: 16 },
  error:      { color: '#e74c3c', marginBottom: 8, textAlign: 'center' },
});
