import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { login } from '../../services/auth.service';
import useAuthStore from '../../store/authStore';

export default function LoginScreen({ navigation }) {
  const { control, handleSubmit } = useForm();
  const setAuth = useAuthStore(s => s.setAuth);

  const onSubmit = async ({ email, password }) => {
    try {
      const { data } = await login({ email, password });
      if (data.requires2FA) {
        navigation.navigate('Verify2FA', { userId: data.userId });
      } else {
        await setAuth(data.token, data.user);
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Login failed';
      Alert.alert('Error', msg);
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
});
