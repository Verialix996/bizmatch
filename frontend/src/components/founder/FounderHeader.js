import { View, Text, Image, StyleSheet } from 'react-native';
import { radius, typography } from '../../theme';
import { Pill, useIsDesktop } from '../ui';

const STATUS_COLORS = {
  active: { bg: '#E8F7F2', text: '#1A9E6A', label: 'Active' },
  inactive: { bg: '#FEF6EC', text: '#E67E22', label: 'Inactive' },
  dropped: { bg: '#FDECEA', text: '#C0392B', label: 'Dropped' },
};

function confidenceLevel(pct) {
  if (pct == null) return null;
  if (pct >= 70) return 'High';
  if (pct >= 40) return 'Medium';
  return 'Low';
}

function formatCommitment(type) {
  if (!type) return null;
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function Avatar({ photoUrl, name, size, C }) {
  if (photoUrl) return <Image source={{ uri: photoUrl }} style={{ width: size, height: size, borderRadius: radius.lg }} />;
  return (
    <View style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: radius.lg, backgroundColor: C.primary }]}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.36 }}>
        {name ? name[0].toUpperCase() : '?'}
      </Text>
    </View>
  );
}

// Founder Profile header — flat (no gradient), matching the profile-page
// mockup: avatar, name + status pill, role/background, industry/location/
// commitment, and profile-confidence + evidence/activity counts as plain
// stats (row on desktop, boxed card on mobile).
export default function FounderHeader({ founder, insights, evidenceCount, activitiesCount, C }) {
  const isDesktop = useIsDesktop();
  const styles2 = makeStyles(C);
  const status = STATUS_COLORS[founder?.status] || STATUS_COLORS.active;
  const level = confidenceLevel(insights?.profileConfidence);
  const levelColor = level === 'High' ? C.success : level === 'Medium' ? C.warning : C.error;
  const commitment = formatCommitment(founder?.commitmentType);

  const statsBlock = (
    <View style={isDesktop ? styles2.statsDesktop : styles2.statsMobile}>
      <View style={styles2.statsLine}>
        <Text style={styles2.statsLabel}>Profile confidence</Text>
        <Text style={styles2.statsValue}>{insights?.profileConfidence ?? '—'}%</Text>
        {level ? <Text style={[styles2.statsLevel, { color: levelColor }]}> · {level}</Text> : null}
      </View>
      <Text style={styles2.statsSub}>
        {evidenceCount ?? 0} evidence point{evidenceCount === 1 ? '' : 's'} · {activitiesCount ?? 0} activit{activitiesCount === 1 ? 'y' : 'ies'}
      </Text>
    </View>
  );

  return (
    <View style={[styles2.container, isDesktop && styles2.containerDesktop]}>
      <View style={[styles2.identity, isDesktop && styles2.identityDesktop]}>
        <Avatar photoUrl={founder?.photoUrl} name={founder?.name} size={isDesktop ? 76 : 88} C={C} />
        <View style={isDesktop ? { flex: 1 } : { alignItems: 'center' }}>
          <View style={[styles2.nameRow, !isDesktop && { justifyContent: 'center' }]}>
            <Text style={styles2.name}>{founder?.name}</Text>
            <Pill label={status.label} C={C} bg={status.bg} color={status.text} />
          </View>
          {founder?.currentRole ? <Text style={styles2.role}>{founder.currentRole}</Text> : null}
          <Text style={styles2.meta}>
            {[founder?.industry, founder?.location, commitment].filter(Boolean).join(' · ') || 'No details yet'}
          </Text>
        </View>
      </View>
      {statsBlock}
    </View>
  );
}

const styles = StyleSheet.create({
  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
});

function makeStyles(C) {
  return StyleSheet.create({
    container: { paddingTop: 20, paddingBottom: 20, alignItems: 'center' },
    containerDesktop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },

    identity: { alignItems: 'center', gap: 12 },
    identityDesktop: { flexDirection: 'row', alignItems: 'center', flex: 1 },

    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
    name: { ...typography.displayMedium, color: C.textPrimary },
    role: { ...typography.bodyMedium, color: C.textSecondary, marginTop: 4, textAlign: 'center' },
    meta: { ...typography.bodySmall, color: C.textHint, marginTop: 2, textAlign: 'center' },

    statsDesktop: { alignItems: 'flex-end', paddingTop: 4 },
    statsMobile: {
      marginTop: 16, backgroundColor: C.surfaceElevated, borderRadius: radius.lg,
      padding: 14, alignItems: 'center', alignSelf: 'stretch',
    },
    statsLine: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
    statsLabel: { ...typography.bodySmall, color: C.textSecondary },
    statsValue: { ...typography.titleSmall, color: C.textPrimary, fontWeight: '800' },
    statsLevel: { ...typography.bodySmall, fontWeight: '700' },
    statsSub: { ...typography.caption, color: C.textHint, marginTop: 4 },
  });
}
