import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Image, SafeAreaView, StatusBar,
} from 'react-native';
import { colors, radius, cardShadow } from '../../theme';

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
          <Text style={styles.name}>{profile.name}</Text>

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

          {/* Match score */}
          {profile.score > 0 && (
            <View style={styles.scoreRow}>
              <Text style={styles.scoreLabel}>Match Score</Text>
              <Text style={styles.scoreValue}>{profile.score}</Text>
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
  name: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: -0.5,
    marginBottom: 20,
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