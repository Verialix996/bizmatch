import { useRef, useState } from 'react';
import { View, Text, Image, StyleSheet, useWindowDimensions, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { radius, cardShadow, typography, brandGradient } from '../../theme';

const DESKTOP_BREAKPOINT = 768;

// Shared responsive check — screens use this to switch between the mobile
// single-column layout and the desktop two-column grid seen in the mockups.
export function useIsDesktop() {
  const { width } = useWindowDimensions();
  return width >= DESKTOP_BREAKPOINT;
}

// Colored circle with an Ionicons glyph inside — the recurring section-header
// and stat-tile icon treatment across every mockup screen.
export function IconCircle({ name, color, bg, size = 40, iconSize }) {
  return (
    <View style={[styles.iconCircle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Ionicons name={name} size={iconSize || size * 0.5} color={color} />
    </View>
  );
}

// Card with a big number, label, and optional icon — dashboard/program
// overview tiles. Pass onPress to make it a drill-down into what the number
// actually counts (e.g. the founders behind "Missing Info") — plain View
// otherwise, so tiles with nowhere useful to go don't look falsely tappable.
export function StatTile({ icon, iconColor, iconBg, value, label, warn, C, onPress }) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      style={[styles.statTile, { backgroundColor: C.surface }, cardShadow]}
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
    >
      <View style={styles.statTileTop}>
        {icon ? <IconCircle name={icon} color={iconColor || C.primary} bg={iconBg || C.surfaceElevated} size={40} /> : null}
        {onPress ? <Ionicons name="chevron-forward" size={16} color={C.textHint} /> : null}
      </View>
      <Text style={[styles.statValue, { color: warn ? C.warning : C.textPrimary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: C.textSecondary }]}>{label}</Text>
    </Wrapper>
  );
}

// Deep-navy → azure gradient banner used for the Dashboard "program" hero and
// the Founder Profile header.
export function GradientHero({ children, style }) {
  return (
    <LinearGradient
      colors={[brandGradient.start, brandGradient.middle, brandGradient.end]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.hero, style]}
    >
      {children}
    </LinearGradient>
  );
}

// Rounded status/label pill — "Active", "Looking for Team", "92% Match", etc.
export function Pill({ label, color, bg, outline, C }) {
  return (
    <View style={[
      styles.pill,
      { backgroundColor: outline ? 'transparent' : (bg || C.surfaceElevated) },
      outline && { borderWidth: 1, borderColor: color || C.primary },
    ]}>
      <Text style={[styles.pillText, { color: color || C.textSecondary }]}>{label}</Text>
    </View>
  );
}

// White card with an icon-circle + title header — "Team Strengths",
// "Potential Gaps", etc. throughout the Team/Founder mockups.
export function SectionCard({ icon, iconColor, iconBg, title, children, C, style, right }) {
  return (
    <View style={[styles.sectionCard, { backgroundColor: C.surface }, cardShadow, style]}>
      {title ? (
        <View style={styles.sectionCardHeader}>
          <View style={styles.sectionCardHeaderLeft}>
            {icon ? <IconCircle name={icon} color={iconColor || C.primary} bg={iconBg || C.surfaceElevated} size={32} iconSize={16} /> : null}
            <Text style={[styles.sectionCardTitle, { color: C.textPrimary }]}>{title}</Text>
          </View>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function Avatar({ photoUrl, name, size = 44, C }) {
  if (photoUrl) return <Image source={{ uri: photoUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2, backgroundColor: C.primary }]}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.4 }}>
        {name ? name[0].toUpperCase() : '?'}
      </Text>
    </View>
  );
}

// PERF-01: section-level loading placeholder — a SectionCard's contents
// swap to this while that section's own fetch is still pending, instead of
// blocking the whole page behind one full-page spinner until every section
// (including ones the viewer doesn't scroll to) has loaded. Deliberately
// static (no pulse animation) rather than Animated, to sidestep RN Web's
// animation quirks this project already hit elsewhere this session.
export function SkeletonLines({ count = 3, C }) {
  return (
    <View style={{ gap: 10 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            height: 14, borderRadius: 4, backgroundColor: C.surfaceElevated,
            width: i === count - 1 ? '60%' : '100%',
          }}
        />
      ))}
    </View>
  );
}

// Simple responsive row that becomes a column below the desktop breakpoint —
// the "two cards side by side on desktop, stacked on mobile" pattern used
// throughout the mockups.
export function ResponsiveRow({ children, gap = 16, style }) {
  const isDesktop = useIsDesktop();
  return (
    <View style={[{ flexDirection: isDesktop ? 'row' : 'column', gap }, style]}>
      {children}
    </View>
  );
}

// iOS-widget-style vertical stack — one page fills a fixed-height box and a
// swipe/scroll up or down slides to the next or previous page, instead of
// every page's content just stacking into one long scroll. Web-only (relies
// on CSS scroll-snap); RN Native would need a gesture-based carousel, out of
// scope here since this app only ships to web.
export function WidgetStack({ pages, height = 440, C }) {
  const scrollRef = useRef(null);
  const [index, setIndex] = useState(0);

  const goTo = (i) => {
    const next = Math.max(0, Math.min(pages.length - 1, i));
    scrollRef.current?.scrollTo({ y: next * height, animated: true });
    setIndex(next);
  };

  const onScroll = (e) => {
    const y = e.nativeEvent.contentOffset.y;
    const next = Math.round(y / height);
    if (next !== index) setIndex(Math.max(0, Math.min(pages.length - 1, next)));
  };

  if (pages.length === 1) return pages[0].node;

  return (
    <View>
      <View style={[styles.widgetStackFrame, { height }]}>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          style={Platform.OS === 'web' ? { scrollSnapType: 'y mandatory' } : null}
        >
          {pages.map((p) => (
            <View
              key={p.key}
              style={[{ height }, Platform.OS === 'web' ? { scrollSnapAlign: 'start', scrollSnapStop: 'always' } : null]}
            >
              <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
                {p.node}
              </ScrollView>
            </View>
          ))}
        </ScrollView>
        {index > 0 && (
          <TouchableOpacity style={[styles.widgetStackChevron, { top: 8 }]} onPress={() => goTo(index - 1)} activeOpacity={0.75}>
            <Ionicons name="chevron-up" size={16} color={C.textSecondary} />
          </TouchableOpacity>
        )}
        {index < pages.length - 1 && (
          <TouchableOpacity style={[styles.widgetStackChevron, { bottom: 8 }]} onPress={() => goTo(index + 1)} activeOpacity={0.75}>
            <Ionicons name="chevron-down" size={16} color={C.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.widgetStackDots}>
        {pages.map((p, i) => (
          <TouchableOpacity key={p.key} onPress={() => goTo(i)} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
            <View style={[styles.widgetStackDot, { backgroundColor: i === index ? C.primary : C.surfaceBorder }]} />
          </TouchableOpacity>
        ))}
        <Text style={[styles.widgetStackLabel, { color: C.textHint }]}>{pages[index].label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  iconCircle: { justifyContent: 'center', alignItems: 'center' },

  statTile: { flex: 1, minWidth: 150, borderRadius: radius.lg, padding: 16, gap: 10 },
  statTileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statValue: { fontSize: 26, fontWeight: '800' },
  statLabel: { ...typography.bodySmall },

  hero: { borderRadius: radius.xl, overflow: 'hidden' },

  pill: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  pillText: { fontSize: 11, fontWeight: '700' },

  // No flex/height here on purpose — SectionCard is used both inside
  // ResponsiveRow (where equal-height matters) and standalone in plain
  // column ScrollViews (where a forced flex:1 or height:'100%' previously
  // caused cards to swallow the rest of the page, hiding every sibling
  // below them — React Native Web's flexbox resolves these differently
  // than plain CSS). Equal-height-in-a-row is opt-in per call site via the
  // `style` prop instead (see FounderProfileScreen.js's ResponsiveRow
  // usages), so standalone cards are never at risk.
  sectionCard: { borderRadius: radius.lg, padding: 18 },
  sectionCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionCardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionCardTitle: { ...typography.titleSmall },

  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },

  widgetStackFrame: { borderRadius: radius.lg, overflow: 'hidden', position: 'relative' },
  widgetStackChevron: {
    position: 'absolute', right: 8, width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center',
  },
  widgetStackDots: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, justifyContent: 'center' },
  widgetStackDot: { width: 6, height: 6, borderRadius: 3 },
  widgetStackLabel: { ...typography.caption, marginLeft: 8 },
});
