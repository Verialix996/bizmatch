// Shared nav item config for AppShell (sidebar on desktop, tab bar on mobile).
// Route names refer to screens registered in AppNavigator's AdminNavigator /
// FounderNavigator stacks. `params` is passed to navigation.navigate as-is.

export const ADMIN_NAV_ITEMS = [
  { key: 'dashboard',  label: 'Dashboard',  icon: 'home-outline',        activeIcon: 'home',        route: 'AdminDashboard' },
  { key: 'founders',   label: 'Founders',   icon: 'people-outline',      activeIcon: 'people',      route: 'FounderList' },
  { key: 'activities', label: 'Activities', icon: 'calendar-outline',    activeIcon: 'calendar',    route: 'Activities' },
  { key: 'matching',   label: 'Matching',   icon: 'git-merge-outline',   activeIcon: 'git-merge',   route: 'Matching', params: {} },
  { key: 'teams', label: 'Teams', icon: 'people-circle-outline', activeIcon: 'people-circle', route: 'TeamList' },
];

// No 'Team' tab yet — TeamProfile requires an explicit teamId and there's no
// "my team" resolution endpoint; founders reach their team via the link on
// their own profile (FounderProfileScreen) instead.
export const FOUNDER_NAV_ITEMS = [
  { key: 'home',       label: 'Home',       icon: 'home-outline',      activeIcon: 'home',      route: 'FounderProfile', params: {} },
  { key: 'activities', label: 'Activities', icon: 'calendar-outline',  activeIcon: 'calendar',  route: 'Activities' },
];
