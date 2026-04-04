import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { register } from '../../services/auth.service';

export default function RegisterScreen({ navigation }) {
  const { control, handleSubmit } = useForm();

  const onSubmit = async (data) => {
    try {
      await register(data);
      navigation.navigate('VerifyOtp', { email: data.email });
    } catch (err) {
      const msg = err.response?.data?.error || 'Registration failed';
      Alert.alert('Error', msg);
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

      <Text style={styles.label}>I am a:</Text>
      <Controller
        control={control}
        name="role"
        rules={{ required: true }}
        render={({ field: { onChange, value } }) => (
          <View style={styles.roleRow}>
            {['entrepreneur', 'investor'].map(r => (
              <TouchableOpacity
                key={r}
                style={[styles.roleBtn, value === r && styles.roleBtnActive]}
                onPress={() => onChange(r)}
              >
                <Text style={[styles.roleBtnText, value === r && styles.roleBtnTextActive]}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      />

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
  container:       { flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title:           { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 24, color: '#1A1A2E' },
  input:           { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 12 },
  label:           { marginBottom: 8, color: '#333' },
  roleRow:         { flexDirection: 'row', gap: 12, marginBottom: 20 },
  roleBtn:         { flex: 1, padding: 12, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, alignItems: 'center' },
  roleBtnActive:   { backgroundColor: '#1A1A2E', borderColor: '#1A1A2E' },
  roleBtnText:     { color: '#333' },
  roleBtnTextActive: { color: '#fff', fontWeight: 'bold' },
  button:          { backgroundColor: '#1A1A2E', borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonText:      { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  link:            { textAlign: 'center', color: '#1A1A2E', marginTop: 16 },
});
