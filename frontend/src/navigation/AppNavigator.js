import { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import useAuthStore from '../store/authStore';
import useAppStore from '../store/appStore';
import { colors, investorColors, investorThemeColors } from '../theme';
import AppHeader from '../components/AppHeader';
import { getConversations } from '../services/match.service';

import WelcomeScreen        from '../screens/auth/WelcomeScreen';
import LoginScreen          from '../screens/auth/LoginScreen';
import RegisterScreen       from '../screens/auth/RegisterScreen';
import VerifyOtpScreen      from '../screens/auth/VerifyOtpScreen';
import ForgotPasswordScreen  from '../screens/auth/ForgotPasswordScreen';
import ResetPasswordScreen  from '../screens/auth/ResetPasswordScreen';
import Verify2FAScreen      from '../screens/auth/Verify2FAScreen';
import SwipeScreen          from '../screens/match/SwipeScreen';
import MatchesScreen        from '../screens/match/MatchesScreen';
import ChatScreen           from '../screens/match/ChatScreen';
import ProfileDetailScreen  from '../screens/match/ProfileDetailScreen';
import ProfileScreen        from '../screens/profile/ProfileScreen';
import EditProfileScreen    from '../screens/profile/EditProfileScreen';
import AccountSettings      from '../screens/profile/AccountSettings';
import ProjectsScreen       from '../screens/project/ProjectsScreen';
import MeetingScreen        from '../screens/meeting/MeetingScreen';
import MeetingDetailScreen  from '../screens/meeting/MeetingDetailScreen';
import ProposeMeetingScreen from '../screens/meeting/ProposeMeetingScreen';
import OnboardingScreen     from '../screens/onboarding/OnboardingScreen';
import PremiumScreen        from '../screens/premium/PremiumScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

export const linking = {
  prefixes: ['http://localhost:8081', 'https://localhost:8081', 'bizmatch://'],
  config: {
    screens: {
      ResetPassword: 'reset-password',
    },
  },
};

const TAB_ICONS = {
  Discover:  ['compass',       'compass-outline'],
  Matches:   ['chatbubbles',   'chatbubbles-outline'],
  Projects:  ['folder',        'folder-outline'],
  Profile:   ['person-circle', 'person-circle-outline'],
};

function MainTabs() {
  const newMatchCount  = useAuthStore(s => s.newMatchCount);
  const setNewMatchCount = useAuthStore(s => s.setNewMatchCount);
  const currentUser    = useAuthStore(s => s.user);
  const investorMode      = useAppStore(s => s.investorMode);
  const darkMode          = useAppStore(s => s.darkMode);
  const isInvestorTheme   = useAppStore(s => s.isInvestorTheme);
  const TC = darkMode ? investorColors : (isInvestorTheme ? investorThemeColors : (investorMode ? investorThemeColors : colors));

  useEffect(() => {
    const pollBadge = async () => {
      try {
        const res = await getConversations();
        const items = res.data || [];
        const readTs = useAuthStore.getState().readTimestamps;
        const noMsg   = items.filter(c => !c.lastMessage).length;
        const unread  = items.filter(c => {
          if (!c.lastMessage || c.lastMessageSenderId === currentUser?.id) return false;
          const t = c.lastMessageAt
            ? new Date(c.lastMessageAt.endsWith('Z') ? c.lastMessageAt : c.lastMessageAt + 'Z').getTime()
            : 0;
          return t > (readTs[c.matchId] || 0);
        }).length;
        setNewMatchCount(noMsg + unread);
      } catch {
        // silent — badge poll failure shouldn't surface
      }
    };

    pollBadge();
    const interval = setInterval(pollBadge, 15000);
    return () => clearInterval(interval);
  }, [setNewMatchCount, currentUser]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        header: () => <AppHeader showToggle={route.name === 'Discover'} />,
        tabBarStyle: {
          backgroundColor: TC.tabBarBackground,
          borderTopColor: TC.tabBarBorder,
          height: 66,
          paddingBottom: 10,
          paddingHorizontal: 10,
        },
        tabBarActiveTintColor: TC.tabBarActive,
        tabBarInactiveTintColor: TC.tabBarInactive,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
        tabBarIcon: ({ focused, color }) => {
          const [filled, outline] = TAB_ICONS[route.name];
          return <Ionicons name={focused ? filled : outline} size={24} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Discover"  component={SwipeScreen}    options={{ tabBarLabel: 'Discover' }} />
      <Tab.Screen name="Matches"   component={MatchesScreen}  options={{ tabBarLabel: 'Messages', tabBarBadge: newMatchCount > 0 ? newMatchCount : undefined }} />
      <Tab.Screen name="Projects"  component={ProjectsScreen} options={{ tabBarLabel: 'Projects' }} />
      <Tab.Screen name="Profile"   component={ProfileScreen}  options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const token              = useAuthStore(s => s.token);
  const user               = useAuthStore(s => s.user);
  const hasSeenOnboarding  = useAuthStore(s => s.hasSeenOnboarding);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!token ? (
        <>
          <Stack.Screen name="Welcome"       component={WelcomeScreen} />
          <Stack.Screen name="Login"         component={LoginScreen} />
          <Stack.Screen name="Register"      component={RegisterScreen} />
          <Stack.Screen name="VerifyOtp"     component={VerifyOtpScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="ResetPassword"  component={ResetPasswordScreen} />
          <Stack.Screen name="Verify2FA"      component={Verify2FAScreen} />
        </>
      ) : (!user?.role || user?.has_profile === false) ? (
        // No profile yet — EditProfile is first so it renders immediately, no flash
        <>
          <Stack.Screen name="EditProfile"      component={EditProfileScreen} />
          <Stack.Screen name="Onboarding"       component={OnboardingScreen} />
          <Stack.Screen name="Main"             component={MainTabs} />
          <Stack.Screen name="Chat"             component={ChatScreen} />
          <Stack.Screen name="ProfileDetail"    component={ProfileDetailScreen} />
          <Stack.Screen name="AccountSettings"  component={AccountSettings} />
          <Stack.Screen name="Meetings"         component={MeetingScreen} />
          <Stack.Screen name="MeetingDetail"    component={MeetingDetailScreen} />
          <Stack.Screen name="ProposeMeeting"   component={ProposeMeetingScreen} />
        </>
      ) : !hasSeenOnboarding ? (
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      ) : (
        <>
          <Stack.Screen name="Main"             component={MainTabs} />
          <Stack.Screen name="Chat"             component={ChatScreen} />
          <Stack.Screen name="ProfileDetail"    component={ProfileDetailScreen} />
          <Stack.Screen name="EditProfile"      component={EditProfileScreen} />
          <Stack.Screen name="AccountSettings"  component={AccountSettings} />
          <Stack.Screen name="Meetings"         component={MeetingScreen} />
          <Stack.Screen name="MeetingDetail"    component={MeetingDetailScreen} />
          <Stack.Screen name="ProposeMeeting"   component={ProposeMeetingScreen} />
          <Stack.Screen name="Premium"          component={PremiumScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}