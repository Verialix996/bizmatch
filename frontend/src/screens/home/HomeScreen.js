import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import useAuthStore from '../../store/authStore';

export default function HomeScreen() {
  const { user, logout } = useAuthStore();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to BizMatch</Text>
      {user && <Text style={styles.sub}>Hello, {user.name}</Text>}
      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title:       { fontSize: 24, fontWeight: 'bold', color: '#1A1A2E', marginBottom: 8 },
  sub:         { color: '#888', marginBottom: 32 },
  logoutBtn:   { backgroundColor: '#e74c3c', borderRadius: 8, padding: 12, paddingHorizontal: 24 },
  logoutText:  { color: '#fff', fontWeight: 'bold' },
});
