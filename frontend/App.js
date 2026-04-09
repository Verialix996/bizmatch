import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator, { linking } from './src/navigation/AppNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer linking={linking}>
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
