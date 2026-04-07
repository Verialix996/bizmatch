import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import useAuthStore from '../store/authStore';
import { colors } from '../theme';

import LoginScreen          from '../screens/auth/LoginScreen';
import RegisterScreen       from '../screens/auth/RegisterScreen';
import VerifyOtpScreen      from '../screens/auth/VerifyOtpScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import SwipeScreen          from '../screens/match/SwipeScreen';
import MatchesScreen        from '../screens/match/MatchesScreen';
import ChatScreen           from '../screens/match/ChatScreen';
import ProfileDetailScreen  from '../screens/match/ProfileDetailScreen';
import ProfileScreen        from '../screens/profile/ProfileScreen';
import EditProfileScreen    from '../screens/profile/EditProfileScreen';
import ProjectsScreen       from '../screens/project/ProjectsScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

function TabIcon({ label, focused }) {
  const icons = { Discover: '🔍', Matches: '💬', Projects: '📁', Profile: '👤' };
  return <Text style={{ fontSize: focused ? 22 : 19, opacity: focused ? 1 : 0.5 }}>{icons[label]}</Text>;
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surfaceContainerLowest,
          borderTopColor: colors.surfaceContainerLow,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.onSurfaceVariant,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
        tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen name="Discover"  component={SwipeScreen}    options={{ tabBarLabel: 'Discover' }} />
      <Tab.Screen name="Matches"   component={MatchesScreen}  options={{ tabBarLabel: 'Matches' }} />
      <Tab.Screen name="Projects"  component={ProjectsScreen} options={{ tabBarLabel: 'Projects' }} />
      <Tab.Screen name="Profile"   component={ProfileScreen}  options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const token = useAuthStore(s => s.token);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {token ? (
        <>
          <Stack.Screen name="Main"          component={MainTabs} />
          <Stack.Screen name="Chat"          component={ChatScreen} />
          <Stack.Screen name="ProfileDetail" component={ProfileDetailScreen} />
          <Stack.Screen name="EditProfile"   component={EditProfileScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Login"          component={LoginScreen} />
          <Stack.Screen name="Register"       component={RegisterScreen} />
          <Stack.Screen name="VerifyOtp"      component={VerifyOtpScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
