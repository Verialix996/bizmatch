import { View, Text, Image, StyleSheet } from 'react-native';
import { radius, cardShadow, typography } from '../../theme';

const STATUS_COLORS = {
  active: { bg: '#E8F7F2', text: '#1A9E6A', label: 'Active' },
  inactive: { bg: '#FEF6EC', text: '#E67E22', label: 'Inactive' },
  dropped: { bg: '#FDECEA', text: '#C0392B', label: 'Dropped' },
};

function Avatar({ photoUrl, name, C }) {
  if (photoUrl) {
    return <Image source={{ uri: photoUrl }} style={[styles.avatarImg, { borderColor: C.surface }]} />;
  }
  return (
    <View style={[styles.avatarPlaceholder, { backgroundColor: C.primary, borderColor: C.surface }]}>
      <Text style={styles.avatarInitial}>{name ? name[0].toUpperCase() : '?'}</Text>
    </View>
  );
}

// Founder Profile header (spec sections 1-2): name, role/background, industry,
// location, team status. This is raw profile data, not a derived insight.
export default function FounderHeader({ founder, C }) {
  const status = STATUS_COLORS[founder?.status] || STATUS_COLORS.active;
  const teamLabel = founder?.team ? `In Team · ${founder.team.name}` : 'Looking for Team';

  return (
    <View style={styles.container}>
      <Avatar photoUrl={founder?.photoUrl} name={founder?.name} C={C} />
      <Text style={[styles.name, { color: C.textPrimary }]}>{founder?.name}</Text>
      {founder?.currentRole ? (
        <Text style={[styles.role, { color: C.primary }]}>{founder.currentRole}</Text>
      ) : null}
      <Text style={[styles.meta, { color: C.textSecondary }]}>
        {[founder?.industry, founder?.location].filter(Boolean).join(' · ') || 'No details yet'}
      </Text>
      <View style={styles.badgeRow}>
        <View style={[styles.badge, { backgroundColor: status.bg }]}>
          <Text style={[styles.badgeText, { color: status.text }]}>● {status.label}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: C.surfaceElevated }]}>
          <Text style={[styles.badgeText, { color: C.textSecondary }]}>{teamLabel}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingTop: 32, paddingBottom: 20, paddingHorizontal: 24 },
  avatarImg: { width: 88, height: 88, borderRadius: 44, borderWidth: 3 },
  avatarPlaceholder: { width: 88, height: 88, borderRadius: 44, borderWidth: 3, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 32, fontWeight: '800', color: '#fff' },
  name: { ...typography.displayMedium, marginTop: 14, textAlign: 'center' },
  role: { ...typography.titleSmall, marginTop: 4, textAlign: 'center' },
  meta: { ...typography.bodyMedium, marginTop: 4, textAlign: 'center' },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5 },
  badgeText: { fontSize: 12, fontWeight: '700' },
});
