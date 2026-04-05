import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import api from '../../services/api';

export default function EditProfileScreen({ route, navigation }) {
  const existing = route.params?.profile;
  const { control, handleSubmit } = useForm({ defaultValues: existing || {} });
  const isNew = !existing?.bio;
  const [error, setError] = useState('');

  const onSubmit = async (data) => {
    setError('');
    try {
      if (isNew) {
        await api.post('/profile', data);
      } else {
        await api.put('/profile', data);
      }
      navigation.goBack();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save profile');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{isNew ? 'Create Profile' : 'Edit Profile'}</Text>

      <Text style={styles.label}>Bio</Text>
      <Controller
        control={control}
        name="bio"
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={[styles.input, { height: 80 }]}
            multiline
            placeholder="Tell us about yourself..."
            onChangeText={onChange}
            value={value}
          />
        )}
      />

      <Text style={styles.label}>Skills (comma separated)</Text>
      <Controller
        control={control}
        name="skills"
        render={({ field: { onChange, value } }) => (
          <TextInput
            style={styles.input}
            placeholder="e.g. React, Node.js, Finance"
            onChangeText={onChange}
            value={typeof value === 'string' ? value : value?.join(', ')}
          />
        )}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.button} onPress={handleSubmit(onSubmit)}>
        <Text style={styles.buttonText}>Save</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:  { flexGrow: 1, padding: 24, backgroundColor: '#fff' },
  title:      { fontSize: 22, fontWeight: 'bold', color: '#1A1A2E', marginBottom: 20 },
  label:      { color: '#333', marginBottom: 4, marginTop: 12 },
  input:      { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 4 },
  button:     { backgroundColor: '#1A1A2E', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 24 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  error:      { color: '#e74c3c', marginBottom: 8, textAlign: 'center' },
});
