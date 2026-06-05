import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Image, SafeAreaView, StatusBar, ActivityIndicator,
} from 'react-native';
import { useState, useEffect } from 'react';
import { colors, radius, cardShadow } from '../../theme';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

const stageLabel = {
  idea: 'Idea Stage', mvp: 'MVP Stage', growth: 'Growth', scale: 'Scale',
};

function Avatar({ photoUrl, name, size = 88 }) {
  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={{
          width: size, height: size,
          borderRadius: size / 2,
          resizeMode: 'cover',
          borderWidth: 3,
          borderColor: '#fff',
        }}
      />
    );
  }
  return (
    <View style={[
      styles.avatarPlaceholder,
      { width: size, height: size, borderRadius: size / 2 },
    ]}>
      <Text style={{ fontSize: size * 0.38, fontWeight: '800', color: '#fff' }}>
        {name ? name[0].toUpperCase() : '?'}
      </Text>
    </View>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      {children}
    </View>
  );
}

function ChipRow({ items }) {
  if (!items?.length) return null;
  return (
    <View style={styles.chipRow}>
      {items.map((item, i) => (
        <View key={i} style={styles.chip}>
          <Text style={styles.chipText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export default function ProfileDetailScreen({ route, navigation }) {
  const { profile, matchId } = route.params;
  const user = useAuthStore(s => s.user);

  const [compatibility, setCompatibility] = useState(null);
  const [compatibilityLoading, setCompatibilityLoading] = useState(true);
  const [compatibilityVisible, setCompatibilityVisible] = useState(true);
  const [ndaSigned, setNdaSigned] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);

  useEffect(() => {
    if (!profile?.userId) { setCompatibilityLoading(false); return; }
    api.get(`/match/compatibility/${profile.userId}`)
      .then(r => setCompatibility(r.data))
      .catch(() => {})
      .finally(() => setCompatibilityLoading(false));
  }, [profile?.userId]);

  useEffect(() => {
    if (!matchId || !profile?.projectId || user?.role !== 'investor') return;
    api.get(`/match/nda-status?matchId=${matchId}&projectId=${profile.projectId}`)
      .then(r => setNdaSigned(r.data.signed))
      .catch(() => {});
  }, [matchId, profile?.projectId, user?.role]);

  useEffect(() => {
    if (!profile?.projectId) return;
    api.get(`/projects/${profile.projectId}/partners`)
      .then(r => setTeamMembers(r.data || []))
      .catch(() => {});
  }, [profile?.projectId]);

  const roleLabel = profile.role === 'investor'
    ? `Investor · ${profile.investmentDomain || 'Multi-sector'}`
    : `Entrepreneur · ${stageLabel[profile.ventureStage] || 'Early Stage'}`;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={styles.heroArea}>
          <View style={styles.heroBg} />
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.heroContent}>
            <Avatar
              photoUrl={profile.photoUrl}
              name={profile.name}
              size={88}
            />
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>
                {roleLabel.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{profile.name}</Text>
            {profile.isPremium && (
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumBadgeText}>★ Premium</Text>
              </View>
            )}
          </View>

          {profile.bio ? (
            <Section title="ABOUT ME">
              <Text style={styles.bioText}>{profile.bio}</Text>
            </Section>
          ) : null}

          {profile.skills?.length > 0 && (
            <Section title="CORE EXPERTISE">
              <ChipRow items={profile.skills} />
            </Section>
          )}

          {/* Investor fields */}
          {profile.role === 'investor' && (
            <>
              {profile.investmentDomain ? (
                <Section title="INVESTMENT DOMAIN">
                  <Text style={styles.metaValue}>{profile.investmentDomain}</Text>
                </Section>
              ) : null}
              {profile.preferredStage ? (
                <Section title="TARGET STAGE">
                  <Text style={styles.metaValue}>
                    {stageLabel[profile.preferredStage] || profile.preferredStage}
                  </Text>
                </Section>
              ) : null}
              {profile.maxInvestment ? (
                <Section title="MAX INVESTMENT">
                  <Text style={styles.highlight}>
                    ${profile.maxInvestment.toLocaleString()}
                  </Text>
                </Section>
              ) : null}
            </>
          )}

          {/* Entrepreneur fields */}
          {profile.role === 'entrepreneur' && (
            <>
              {profile.ventureStage ? (
                <Section title="VENTURE STAGE">
                  <Text style={styles.metaValue}>
                    {stageLabel[profile.ventureStage] || profile.ventureStage}
                  </Text>
                </Section>
              ) : null}
              {profile.fundingNeeds ? (
                <Section title="SEEKING">
                  <Text style={styles.highlight}>
                    ${profile.fundingNeeds.toLocaleString()}
                  </Text>
                </Section>
              ) : null}
            </>
          )}

          {/* Project team members (shown when viewing a project card) */}
          {profile.projectId && teamMembers.length > 0 && (
            <Section title="TEAM">
              {teamMembers.map((m, i) => (
                <View key={i} style={styles.teamRow}>
                  <View style={[styles.teamAvatar, { backgroundColor: colors.primary }]}>
                    <Text style={styles.teamAvatarText}>{m.name ? m.name[0].toUpperCase() : '?'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.teamName}>{m.name}</Text>
                    {m.role ? (
                      <Text style={styles.teamRole}>
                        {m.isOwner ? 'Owner' : m.role}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </Section>
          )}

          {/* Match score */}
          {profile.score > 0 && (
            <View style={styles.scoreRow}>
              <Text style={styles.scoreLabel}>Match Score</Text>
              <Text style={styles.scoreValue}>{profile.score}</Text>
            </View>
          )}

          {/* AI compatibility breakdown */}
          {compatibilityLoading ? (
            <View style={styles.compatCard}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : compatibility && compatibilityVisible ? (
            <View style={styles.compatCard}>
              <View style={styles.compatHeader}>
                <Text style={styles.compatTitle}>AI COMPATIBILITY</Text>
                <TouchableOpacity onPress={() => setCompatibilityVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.compatClose}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.compatScoreRow}>
                <View style={styles.compatBarBg}>
                  <View style={[styles.compatBarFill, { width: `${compatibility.score}%` }]} />
                </View>
                <Text style={styles.compatScoreText}>{compatibility.score}%</Text>
              </View>
              {compatibility.pros?.length > 0 && (
                <View style={styles.compatList}>
                  {compatibility.pros.map((p, i) => (
                    <View key={i} style={styles.compatItem}>
                      <Text style={styles.compatIconGood}>✓</Text>
                      <Text style={styles.compatItemText}>{p}</Text>
                    </View>
                  ))}
                </View>
              )}
              {compatibility.cons?.length > 0 && (
                <View style={styles.compatList}>
                  {compatibility.cons.map((c, i) => (
                    <View key={i} style={styles.compatItem}>
                      <Text style={styles.compatIconWarn}>!</Text>
                      <Text style={styles.compatItemText}>{c}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : null}

          {/* NDA gate for investor viewing matched project */}
          {matchId && user?.role === 'investor' && ndaSigned === false && (
            <View style={styles.ndaGate}>
              <Text style={styles.ndaGateIcon}>🔒</Text>
              <Text style={styles.ndaGateTitle}>NDA Required</Text>
              <Text style={styles.ndaGateBody}>Sign an NDA to unlock full project details, pitch deck, and demo video.</Text>
              <TouchableOpacity
                style={styles.ndaGateBtn}
                onPress={() => navigation.navigate('Chat', {
                  match: { matchId, name: profile.name, photoUrl: profile.photoUrl, roleType: 'entrepreneur' },
                })}
              >
                <Text style={styles.ndaGateBtnText}>Go to Chat to Sign NDA</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* CTA */}
      {matchId && (
        <View style={styles.ctaBar}>
          <TouchableOpacity
            style={styles.messageBtn}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Chat', {
              match: {
                matchId,
                name: profile.name,
                photoUrl: profile.photoUrl,
              },
            })}
          >
            <Text style={styles.messageBtnText}>
              Message {profile.name?.split(' ')[0]}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSoft },

  heroArea: { height: 180, position: 'relative' },
  heroBg: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: colors.primary,
  },
  backBtn: {
    position: 'absolute',
    top: 16, left: 16,
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: { fontSize: 20, color: '#fff' },
  heroContent: {
    position: 'absolute',
    bottom: -44,
    left: 24,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  avatarPlaceholder: {
    backgroundColor: colors.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  roleBadge: {
    backgroundColor: colors.primaryDark,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 4,
    alignSelf: 'flex-end',
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.6,
  },

  body: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  name: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: -0.5,
  },
  premiumBadge: {
    backgroundColor: '#F5A623',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  premiumBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
  },

  section: { marginBottom: 20 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textHint,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  bioText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  metaValue: {
    fontSize: 15,
    color: colors.primaryDark,
    fontWeight: '600',
  },
  highlight: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.3,
  },

  teamRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  teamAvatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  teamAvatarText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  teamName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  teamRole: { fontSize: 11, color: colors.primary, fontWeight: '600', textTransform: 'capitalize', marginTop: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },

  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    ...cardShadow,
    shadowOpacity: 0.04,
  },
  scoreLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  scoreValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
  },

  // AI compatibility
  compatCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    ...cardShadow,
    shadowOpacity: 0.04,
  },
  compatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  compatTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textHint,
    letterSpacing: 1,
  },
  compatClose: {
    fontSize: 16,
    color: colors.textHint,
    fontWeight: '600',
  },
  compatScoreRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  compatBarBg: { flex: 1, height: 6, backgroundColor: '#E8ECF4', borderRadius: 3, overflow: 'hidden' },
  compatBarFill: { height: 6, backgroundColor: colors.primary, borderRadius: 3 },
  compatScoreText: { fontSize: 16, fontWeight: '800', color: colors.primary, minWidth: 36, textAlign: 'right' },
  compatList: { gap: 6, marginTop: 4 },
  compatItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  compatIconGood: { fontSize: 13, fontWeight: '800', color: '#2E7D32', marginTop: 1 },
  compatIconWarn: { fontSize: 13, fontWeight: '800', color: '#E65100', marginTop: 1 },
  compatItemText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },

  // NDA gate
  ndaGate: {
    backgroundColor: '#FFF8E1',
    borderRadius: radius.lg,
    padding: 20,
    marginTop: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  ndaGateIcon: { fontSize: 32, marginBottom: 8 },
  ndaGateTitle: { fontSize: 16, fontWeight: '800', color: colors.primaryDark, marginBottom: 6 },
  ndaGateBody: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 19, marginBottom: 16 },
  ndaGateBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  ndaGateBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  ctaBar: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
  },
  messageBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
  },
  messageBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});