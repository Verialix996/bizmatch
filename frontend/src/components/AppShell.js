import { View, Text, Image, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import useAuthStore from '../store/authStore';
import useAppStore from '../store/appStore';
import { colors, investorColors, radius, typography } from '../theme';
import NotificationBell from './NotificationBell';
import HelpButton from './HelpButton';

const DESKTOP_BREAKPOINT = 768;

function LogoMark({ color }) {
  return (
    <View style={styles.logoWrap}>
      <View style={[styles.circle1, { borderColor: color }]} />
      <View style={[styles.circle2, { borderColor: color }]} />
    </View>
  );
}

function Avatar({ photoUrl, name, size, C }) {
  if (photoUrl) return <Image source={{ uri: photoUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2, backgroundColor: C.primary }]}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.4 }}>
        {name ? name[0].toUpperCase() : '?'}
      </Text>
    </View>
  );
}

// Responsive navigation shell: left sidebar on wide viewports, bottom tab bar
// on narrow ones — matches docs/desktop mockup and docs/mobile mockup.
// Screens render only their body content as children; AppShell owns the
// SafeAreaView, background, and persistent nav chrome around it.
export default function AppShell({ navigation, active, items, children }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const darkMode = useAppStore(s => s.darkMode);
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const C = darkMode ? investorColors : colors;
  const styles2 = makeStyles(C);
  const isDesktop = width >= DESKTOP_BREAKPOINT;

  const go = (item) => {
    if (item.key === active) return;
    navigation.navigate(item.route, item.params);
  };

  if (isDesktop) {
    return (
      <View style={[styles2.desktopRoot, { paddingTop: insets.top }]}>
        <View style={styles2.desktopTopBar}>
          <View style={styles2.topBarSide}>
            <HelpButton role={user?.role} tintColor={C.primary} />
          </View>
          <View style={styles2.searchBar}>
            <Ionicons name="search" size={15} color={C.textHint} />
            <Text style={styles2.searchPlaceholder}>Search founders, matches, or evidence…</Text>
          </View>
          <View style={[styles2.topBarSide, styles2.topBarSideRight]}>
            <NotificationBell tintColor={C.primary} />
          </View>
        </View>

        <View style={styles2.desktopBody}>
          <View style={[styles2.sidebar, { paddingTop: 20 }]}>
            <View style={styles2.sidebarBrand}>
              <LogoMark color={C.primary} />
              <Text style={[styles2.wordmark, { color: C.primary }]}>BizMatch</Text>
            </View>

            <View style={styles2.sidebarNav}>
              {items.map((item) => {
                const isActive = item.key === active;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles2.sidebarItem, isActive && styles2.sidebarItemActive]}
                    onPress={() => go(item)}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name={isActive ? item.activeIcon : item.icon}
                      size={20}
                      color={isActive ? C.primary : C.textSecondary}
                    />
                    <Text style={[styles2.sidebarLabel, isActive && { color: C.primary, fontWeight: '700' }]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={{ flex: 1 }} />

            <TouchableOpacity
              style={styles2.sidebarFooterUser}
              onPress={() => navigation.navigate('AccountSettings')}
              activeOpacity={0.75}
            >
              <Avatar photoUrl={user?.photoUrl} name={user?.name} size={34} C={C} />
              <View style={{ flex: 1 }}>
                <Text style={styles2.footerName} numberOfLines={1}>{user?.name || 'Account'}</Text>
                <Text style={styles2.footerSub}>Settings</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles2.sidebarLogout} onPress={logout} activeOpacity={0.75}>
              <Ionicons name="log-out-outline" size={18} color={C.textSecondary} />
              <Text style={styles2.footerSub}>Log Out</Text>
            </TouchableOpacity>
          </View>

          <View style={styles2.desktopMain}>
            <View style={styles2.desktopContent}>
              {children}
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles2.mobileRoot, { paddingTop: insets.top }]}>
      <View style={styles2.mobileHeader}>
        <View style={styles2.mobileBrand}>
          <LogoMark color={C.primary} />
          <Text style={[styles2.wordmark, { color: C.primary }]}>BizMatch</Text>
          <HelpButton role={user?.role} tintColor={C.primary} />
        </View>
        <View style={styles2.mobileHeaderActions}>
          <NotificationBell tintColor={C.textPrimary} />
          <TouchableOpacity onPress={() => navigation.navigate('AccountSettings')}>
            <Avatar photoUrl={user?.photoUrl} name={user?.name} size={32} C={C} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles2.mobileContent}>
        {children}
      </View>

      <View style={[styles2.tabBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {items.map((item) => {
          const isActive = item.key === active;
          return (
            <TouchableOpacity
              key={item.key}
              style={styles2.tabItem}
              onPress={() => go(item)}
              activeOpacity={0.75}
            >
              <Ionicons
                name={isActive ? item.activeIcon : item.icon}
                size={22}
                color={isActive ? C.tabBarActive : C.tabBarInactive}
              />
              <Text style={[styles2.tabLabel, { color: isActive ? C.tabBarActive : C.tabBarInactive }]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  logoWrap: { width: 30, height: 30, position: 'relative' },
  circle1: { width: 18, height: 18, borderRadius: 9, borderWidth: 2.5, position: 'absolute', left: 0, top: 5 },
  circle2: { width: 18, height: 18, borderRadius: 9, borderWidth: 2.5, opacity: 0.55, position: 'absolute', right: 0, top: 5 },
  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
});

function makeStyles(C) {
  return StyleSheet.create({
    wordmark: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },

    // ── Desktop sidebar layout ──────────────────────────────
    desktopRoot: { flex: 1, flexDirection: 'column', backgroundColor: C.backgroundSoft },
    desktopBody: { flex: 1, flexDirection: 'row' },
    sidebar: {
      width: 250, backgroundColor: C.surface, borderRightWidth: 1, borderRightColor: C.surfaceBorder,
      paddingHorizontal: 16, paddingBottom: 16,
    },
    sidebarBrand: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, marginBottom: 28 },
    sidebarNav: { gap: 4 },
    sidebarItem: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 11, paddingHorizontal: 12, borderRadius: radius.md,
    },
    sidebarItemActive: { backgroundColor: C.surfaceElevated },
    sidebarLabel: { ...typography.bodyMedium, color: C.textSecondary, fontWeight: '600' },
    sidebarFooterUser: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 10, paddingVertical: 10, borderRadius: radius.md,
      borderTopWidth: 1, borderTopColor: C.surfaceBorder, marginTop: 8,
    },
    footerName: { ...typography.labelLarge, color: C.textPrimary },
    footerSub: { ...typography.caption, color: C.textHint },
    sidebarLogout: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },

    desktopMain: { flex: 1 },
    desktopTopBar: {
      flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 24, paddingVertical: 14,
      backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.surfaceBorder,
    },
    desktopContent: { flex: 1 },

    topBarSide: { flex: 1 },
    topBarSideRight: { flexDirection: 'row', justifyContent: 'flex-end' },

    searchBar: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: C.backgroundSoft, borderRadius: radius.pill,
      paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: C.surfaceBorder,
      width: 420, maxWidth: '100%',
    },
    searchPlaceholder: { ...typography.bodySmall, color: C.textHint },

    // ── Mobile header + tab bar layout ──────────────────────
    mobileRoot: { flex: 1, backgroundColor: C.backgroundSoft },
    mobileHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingVertical: 10,
      backgroundColor: C.background, borderBottomWidth: 1, borderBottomColor: C.surfaceBorder,
    },
    mobileBrand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    mobileHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    mobileContent: { flex: 1 },

    tabBar: {
      flexDirection: 'row', backgroundColor: C.tabBarBackground,
      borderTopWidth: 1, borderTopColor: C.tabBarBorder, paddingTop: 8,
    },
    tabItem: { flex: 1, alignItems: 'center', gap: 3 },
    tabLabel: { fontSize: 11, fontWeight: '600' },
  });
}
