import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, cardShadow, typography } from '../../theme';
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

function formatJoined(dateStr) {
  if (!dateStr) return null;
  try {
    return `Joined ${new Date(dateStr).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`;
  } catch {
    return null;
  }
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


// Founder Profile identity card — bordered card with avatar, name/role/meta
// on the left and confidence/evidence/activity stat tiles on the right
// (row on desktop, stacked below identity on mobile), matching the profile
// page mockup.
export default function FounderHeader({ founder, insights, evidenceCount, activitiesCount, C, isAdmin, onTeamPress }) {
  const isDesktop = useIsDesktop();
  const styles2 = makeStyles(C);
  const status = STATUS_COLORS[founder?.status] || STATUS_COLORS.active;
  const confidencePct = insights?.profileConfidence ?? null;
  const level = confidenceLevel(confidencePct);
  const levelColor = level === 'High' ? C.success : level === 'Medium' ? C.warning : C.error;
  const commitment = formatCommitment(founder?.commitmentType);
  const joined = formatJoined(founder?.onboardingCompletedAt);

  return (
    <View style={[styles2.card, isDesktop && styles2.cardDesktop]}>
      <View style={[styles2.identity, isDesktop && styles2.identityDesktop]}>
        <Avatar photoUrl={founder?.photoUrl} name={founder?.name} size={isDesktop ? 76 : 88} C={C} />
        <View style={isDesktop ? { flex: 1 } : { alignItems: 'center' }}>
          {founder?.currentRole ? (
            <Text style={[styles2.role, !isDesktop && { textAlign: 'center' }]}>{founder.currentRole}</Text>
          ) : null}
          <View style={[styles2.metaRow, !isDesktop && { justifyContent: 'center' }]}>
            {founder?.industry ? (
              <View style={styles2.metaItem}>
                <Ionicons name="briefcase-outline" size={13} color={C.textHint} />
                <Text style={styles2.metaText}>{founder.industry}</Text>
              </View>
            ) : null}
            {founder?.location ? (
              <View style={styles2.metaItem}>
                <Ionicons name="location-outline" size={13} color={C.textHint} />
                <Text style={styles2.metaText}>{founder.location}</Text>
              </View>
            ) : null}
            {commitment ? (
              <View style={styles2.metaItem}>
                <Ionicons name="time-outline" size={13} color={C.textHint} />
                <Text style={styles2.metaText}>{commitment}</Text>
              </View>
            ) : null}
          </View>
          <View style={[styles2.badgeRow, !isDesktop && { justifyContent: 'center' }]}>
            <Pill label={status.label} C={C} bg={status.bg} color={status.text} />
            {joined ? <Text style={styles2.joined}>{joined}</Text> : null}
          </View>
          {(founder?.ventureName || founder?.team) ? (
            <View style={[styles2.ventureRow, !isDesktop && { justifyContent: 'center' }]}>
              {founder?.ventureName ? <Text style={styles2.venture}>Venture: {founder.ventureName}</Text> : null}
              {founder?.team ? (
                <TouchableOpacity onPress={onTeamPress} activeOpacity={0.75}>
                  <Text style={[styles2.venture, { color: C.primary, fontWeight: '700' }]}>Team: {founder.team.name} →</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles2.stats}>
        <View style={styles2.statLine}>
          <Text style={styles2.statLabel}>Profile confidence</Text>
          <Text style={styles2.statValue}>{confidencePct != null ? `${confidencePct}%` : '—'}</Text>
          {level ? (
            <>
              <Text style={styles2.statLabel}>·</Text>
              <Text style={[styles2.statValue, { color: levelColor }]}>{level}</Text>
            </>
          ) : null}
        </View>
        <View style={styles2.statLine}>
          {isAdmin ? (
            <>
              <Text style={styles2.statLabel}>{evidenceCount ?? 0} evidence points</Text>
              <Text style={styles2.statLabel}>·</Text>
            </>
          ) : null}
          <Text style={styles2.statLabel}>{activitiesCount ?? 0} activities</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
});

function makeStyles(C) {
  return StyleSheet.create({
    card: {
      backgroundColor: C.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: C.surfaceBorder,
      padding: 20, gap: 20, ...cardShadow,
    },
    cardDesktop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 24 },

    identity: { alignItems: 'center', gap: 12 },
    identityDesktop: { flexDirection: 'row', alignItems: 'center', flex: 1 },

    role: { ...typography.titleMedium, color: C.textPrimary },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 6 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { ...typography.bodySmall, color: C.textSecondary },

    badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
    joined: { ...typography.caption, color: C.textHint },

    ventureRow: { flexDirection: 'row', gap: 16, marginTop: 10, flexWrap: 'wrap' },
    venture: { ...typography.bodySmall, color: C.textSecondary },

    stats: { gap: 6, alignItems: 'flex-end' },

    statLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    statValue: { ...typography.bodyMedium, color: C.textPrimary, fontWeight: '700' },
    statLabel: { ...typography.bodyMedium, color: C.textSecondary },
  });
}
