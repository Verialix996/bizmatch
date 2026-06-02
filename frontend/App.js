import { useEffect } from 'react';
import { View, ActivityIndicator, Linking } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AppNavigator, { linking } from './src/navigation/AppNavigator';
import useAuthStore from './src/store/authStore';
import useAppStore from './src/store/appStore';
import api from './src/services/api';

function parseOAuthUrl(url) {
  if (!url || !url.startsWith('bizmatch://auth')) return null;
  const qs = url.split('?')[1] || '';
  const params = Object.fromEntries(
    qs.split('&').map(p => {
      const [k, v] = p.split('=');
      return [k, decodeURIComponent(v || '')];
    })
  );
  return params.token ? params : null;
}

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
  const isRestoring = useAuthStore(s => s.isRestoring);
  const restoreAuth = useAuthStore(s => s.restoreAuth);
  const setAuth = useAuthStore(s => s.setAuth);

  const initDarkMode = useAppStore(s => s.initDarkMode);
  const setInvestorTheme = useAppStore(s => s.setInvestorTheme);
  const userRole = useAuthStore(s => s.user?.role);

  useEffect(() => {
    restoreAuth();
    initDarkMode();
  }, []);

  useEffect(() => {
    setInvestorTheme(userRole === 'investor');
  }, [userRole]);

  useEffect(() => {
    if (token) registerForPushNotifications();
  }, [token]);

  // Handle bizmatch://auth?token=... deep links (Google OAuth redirect on Android)
  useEffect(() => {
    const handleUrl = ({ url }) => {
      const params = parseOAuthUrl(url);
      if (params) {
        setAuth(params.token, {
          id: Number(params.userId),
          email: params.email,
          name: params.name,
          role: params.role,
          has_profile: params.has_profile === 'true',
          is_premium: params.is_premium === '1' || params.is_premium === 'true' ? 1 : 0,
          premium_expires_at: params.premium_expires_at || null,
          photo_url: params.photo_url || null,
        });
      }
    };

    // Handle URL if the app was opened from a cold start via the deep link
    Linking.getInitialURL().then(url => {
      if (url) handleUrl({ url });
    });

    const sub = Linking.addEventListener('url', handleUrl);
    return () => sub.remove();
  }, [setAuth]);

  if (isRestoring) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FC' }}>
          <ActivityIndicator size="large" color="#022466" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer linking={linking}>
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
