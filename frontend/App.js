import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AppNavigator, { linking } from './src/navigation/AppNavigator';
import useAuthStore from './src/store/authStore';
import api from './src/services/api';

async function registerForPushNotifications() {
  if (!Device.isDevice) return;
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;
  const { data: token } = await Notifications.getExpoPushTokenAsync();
  try {
    await api.patch('/users/me/push-token', { pushToken: token });
  } catch { /* silent */ }
}

export default function App() {
  const token = useAuthStore(s => s.token);
  const restoreAuth = useAuthStore(s => s.restoreAuth);

  useEffect(() => {
    restoreAuth();
  }, []);

  useEffect(() => {
    if (token) registerForPushNotifications();
  }, [token]);

  return (
    <SafeAreaProvider>
      <NavigationContainer linking={linking}>
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
