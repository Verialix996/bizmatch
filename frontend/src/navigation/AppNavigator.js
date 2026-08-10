import { View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import useAuthStore from '../store/authStore';
import AppHeader from '../components/AppHeader';
import InAppNotificationBanner from '../components/InAppNotificationBanner';
import AlertModal from '../components/AlertModal';

import WelcomeScreen        from '../screens/auth/WelcomeScreen';
import LoginScreen          from '../screens/auth/LoginScreen';
import RegisterScreen       from '../screens/auth/RegisterScreen';
import VerifyOtpScreen      from '../screens/auth/VerifyOtpScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen  from '../screens/auth/ResetPasswordScreen';
import OnboardingScreen     from '../screens/onboarding/OnboardingScreen';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import FounderListScreen    from '../screens/admin/FounderListScreen';
import FounderProfileScreen from '../screens/founders/FounderProfileScreen';
import EvaluationScreen     from '../screens/founders/EvaluationScreen';
import ComingSoonScreen     from '../screens/founders/ComingSoonScreen';
import ActivitiesListScreen from '../screens/admin/ActivitiesListScreen';
import ActivityDetailScreen from '../screens/admin/ActivityDetailScreen';
import MatchingScreen       from '../screens/admin/MatchingScreen';
import MatchDetailScreen    from '../screens/admin/MatchDetailScreen';
import AccountSettings      from '../screens/profile/AccountSettings';

const Stack = createNativeStackNavigator();

export const linking = {
  prefixes: ['http://localhost:8081', 'https://localhost:8081', 'bizmatch://'],
  config: {
    screens: {
      ResetPassword: 'reset-password',
    },
  },
};

// Admin/evaluator persona — management console shape, no bottom tab bar.
// FounderList/Evaluation/AccountSettings render their own in-screen headers;
// AdminDashboard (the root) gets the shared AppHeader.
function AdminNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ header: () => <AppHeader /> }} />
      <Stack.Screen name="FounderList" component={FounderListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="FounderProfile" component={FounderProfileScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Evaluation" component={EvaluationScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Activities" component={ActivitiesListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ActivityDetail" component={ActivityDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Matching" component={MatchingScreen} options={{ headerShown: false }} />
      <Stack.Screen name="MatchDetail" component={MatchDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ComingSoon" component={ComingSoonScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AccountSettings" component={AccountSettings} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

// Founder persona — read-only own profile/insights, essentially the whole
// app for this role. No tab bar; FounderProfileScreen defaults founderId to
// the current user when no param is passed.
function FounderNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="FounderProfile" component={FounderProfileScreen} options={{ header: () => <AppHeader /> }} />
      <Stack.Screen name="Activities" component={ActivitiesListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ActivityDetail" component={ActivityDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="AccountSettings" component={AccountSettings} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

function FounderOnboardingNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const token             = useAuthStore(s => s.token);
  const user              = useAuthStore(s => s.user);
  const hasSeenOnboarding = useAuthStore(s => s.hasSeenOnboarding);

  const isAdmin = user?.role === 'admin';

  return (
    <View style={{ flex: 1 }}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!token ? (
          <>
            <Stack.Screen name="Welcome"        component={WelcomeScreen} />
            <Stack.Screen name="Login"          component={LoginScreen} />
            <Stack.Screen name="Register"       component={RegisterScreen} />
            <Stack.Screen name="VerifyOtp"      component={VerifyOtpScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="ResetPassword"  component={ResetPasswordScreen} />
          </>
        ) : isAdmin ? (
          <Stack.Screen name="Admin" component={AdminNavigator} />
        ) : !hasSeenOnboarding ? (
          <Stack.Screen name="FounderOnboarding" component={FounderOnboardingNavigator} />
        ) : (
          <Stack.Screen name="Founder" component={FounderNavigator} />
        )}
      </Stack.Navigator>
      <InAppNotificationBanner />
      <AlertModal />
    </View>
  );
}
