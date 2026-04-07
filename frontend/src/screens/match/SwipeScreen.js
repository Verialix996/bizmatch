import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Animated, PanResponder,
  TouchableOpacity, ActivityIndicator, Modal, Image,
  SafeAreaView,
} from 'react-native';
import { getFeed, swipe } from '../../services/match.service';
import { getProjectFeed, swipeProject } from '../../services/project.service';
import { Linking } from 'react-native';
import useAuthStore from '../../store/authStore';
import { colors, cardShadow } from '../../theme';

const SWIPE_THRESHOLD = 120;
const ROTATION_FACTOR = 12;

const stageLabel = {
  idea: 'Idea Stage', mvp: 'MVP Stage', growth: 'Growth', scale: 'Scale',
};

function StageBadge({ stage }) {
  if (!stage) return null;
  return (
    <View style={styles.stageBadge}>
      <Text style={styles.stageBadgeText}>{stageLabel[stage] || stage}</Text>
    </View>
  );
}

function ProfileCard({ profile, panHandlers, position, likeOpacity, passOpacity, cardRotation, isTop }) {
  const animatedStyle = isTop ? {
    transform: [
      { translateX: position.x },
      { translateY: position.y },
      { rotate: cardRotation },
    ],
  } : { transform: [{ scale: 0.96 }, { translateY: 14 }] };

  const roleLabel = profile.role === 'investor'
    ? `INVESTOR · ${profile.investmentDomain || 'Multi-sector'}`
    : `ENTREPRENEUR · Looking for ${profile.role === 'investor' ? 'Deals' : 'Co-founder'}`;

  return (
    <Animated.View
      style={[styles.card, animatedStyle, !isTop && styles.cardBack]}
      {...(isTop ? panHandlers : {})}
    >
      {/* Photo area */}
      <View style={styles.cardPhoto}>
        {profile.photoUrl ? (
          <Image source={{ uri: profile.photoUrl }} style={styles.photoImg} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoInitial}>
              {profile.name ? profile.name[0].toUpperCase() : '?'}
            </Text>
          </View>
        )}
        <StageBadge stage={profile.ventureStage || profile.preferredStage} />
        <View style={styles.cardPhotoOverlay} />
        <View style={styles.cardNameBlock}>
          <Text style={styles.cardName}>{profile.name}</Text>
          {profile.location ? (
            <Text style={styles.cardLocation}>{profile.location}</Text>
          ) : null}
        </View>
        {isTop && (
          <>
            <Animated.View style={[styles.overlayLike, { opacity: likeOpacity }]}>
              <Text style={styles.overlayText}>LIKE</Text>
            </Animated.View>
            <Animated.View style={[styles.overlayPass, { opacity: passOpacity }]}>
              <Text style={styles.overlayText}>PASS</Text>
            </Animated.View>
          </>
        )}
      </View>

      {/* Card body */}
      <View style={styles.cardBody}>
        <Text style={styles.roleLabel}>{roleLabel}</Text>

        {profile.skills?.length > 0 && (
          <View style={styles.chipRow}>
            {profile.skills.slice(0, 3).map((s, i) => (
              <View key={i} style={styles.chip}>
                <Text style={styles.chipText}>{s}</Text>
              </View>
            ))}
            {profile.skills.length > 3 && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>+{profile.skills.length - 3} more</Text>
              </View>
            )}
          </View>
        )}

        {profile.bio ? (
          <Text style={styles.bioQuote} numberOfLines={2}>"{profile.bio}"</Text>
        ) : null}

        {profile.fundingNeeds ? (
          <Text style={styles.metaLine}>Seeking ${profile.fundingNeeds.toLocaleString()}</Text>
        ) : null}
        {profile.maxInvestment ? (
          <Text style={styles.metaLine}>Invests up to ${profile.maxInvestment.toLocaleString()}</Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

function ProjectCard({ project, panHandlers, position, likeOpacity, passOpacity, cardRotation, isTop }) {
  const animatedStyle = isTop ? {
    transform: [
      { translateX: position.x },
      { translateY: position.y },
      { rotate: cardRotation },
    ],
  } : { transform: [{ scale: 0.96 }, { translateY: 14 }] };

  return (
    <Animated.View
      style={[styles.card, animatedStyle, !isTop && styles.cardBack]}
      {...(isTop ? panHandlers : {})}
    >
      {/* Photo / placeholder area */}
      <View style={styles.cardPhoto}>
        {project.ownerPhoto ? (
          <Image source={{ uri: project.ownerPhoto }} style={styles.photoImg} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoInitial}>
              {project.ownerName ? project.ownerName[0].toUpperCase() : '?'}
            </Text>
          </View>
        )}
        <StageBadge stage={project.stage} />
        <View style={styles.cardPhotoOverlay} />
        <View style={styles.cardNameBlock}>
          <Text style={styles.cardName}>{project.title}</Text>
          <Text style={styles.cardLocation}>by {project.ownerName}</Text>
        </View>
        {isTop && (
          <>
            <Animated.View style={[styles.overlayLike, { opacity: likeOpacity }]}>
              <Text style={styles.overlayText}>LIKE</Text>
            </Animated.View>
            <Animated.View style={[styles.overlayPass, { opacity: passOpacity }]}>
              <Text style={styles.overlayText}>PASS</Text>
            </Animated.View>
          </>
        )}
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.roleLabel}>
          {project.industry ? project.industry.toUpperCase() : 'VENTURE'} · SEEKING INVESTMENT
        </Text>

        {project.ownerSkills?.length > 0 && (
          <View style={styles.chipRow}>
            {project.ownerSkills.slice(0, 3).map((s, i) => (
              <View key={i} style={styles.chip}><Text style={styles.chipText}>{s}</Text></View>
            ))}
          </View>
        )}

        {project.description ? (
          <Text style={styles.bioQuote} numberOfLines={2}>"{project.description}"</Text>
        ) : null}

        {project.fundingNeeded ? (
          <Text style={styles.metaLine}>Seeking ${project.fundingNeeded.toLocaleString()}</Text>
        ) : null}

        <View style={styles.linkRow}>
          {project.deckUrl ? (
            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => Linking.openURL(project.deckUrl)}
            >
              <Text style={styles.linkBtnText}>📄 View Deck</Text>
            </TouchableOpacity>
          ) : null}
          {project.videoUrl ? (
            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => Linking.openURL(project.videoUrl)}
            >
              <Text style={styles.linkBtnText}>🎬 Watch Demo</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}

function MatchModal({ visible, matchedName, onClose }) {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.modalBackdrop}>
        <View style={styles.modalBox}>
          <View style={styles.modalIconRow}>
            <Text style={styles.modalEmoji}>✦</Text>
          </View>
          <Text style={styles.modalTitle}>It's a Match!</Text>
          <Text style={styles.modalSub}>You and {matchedName} have connected.</Text>
          <TouchableOpacity style={styles.modalBtn} onPress={onClose}>
            <Text style={styles.modalBtnText}>Keep Swiping</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function SwipeScreen() {
  const user = useAuthStore(s => s.user);
  const isEntrepreneur = user?.role === 'entrepreneur';

  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [swiping, setSwiping] = useState(false);
  const [matchModal, setMatchModal] = useState({ visible: false, name: '' });
  const [mode, setMode] = useState('investors');

  const position = useRef(new Animated.ValueXY()).current;
  const currentIndex = useRef(0);

  const likeOpacity = position.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD], outputRange: [0, 1], extrapolate: 'clamp',
  });
  const passOpacity = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp',
  });
  const cardRotation = position.x.interpolate({
    inputRange: [-200, 0, 200],
    outputRange: [`-${ROTATION_FACTOR}deg`, '0deg', `${ROTATION_FACTOR}deg`],
  });

  const loadFeed = useCallback(async (feedMode) => {
    setLoading(true);
    try {
      const res = isEntrepreneur
        ? await getFeed(feedMode)
        : await getProjectFeed();
      setFeed(res.data);
      currentIndex.current = 0;
      position.setValue({ x: 0, y: 0 });
    } catch (e) {
      console.error('Failed to load feed', e);
    } finally {
      setLoading(false);
    }
  }, [position, isEntrepreneur]);

  useEffect(() => { loadFeed(mode); }, [mode, loadFeed]);

  const sendSwipe = useCallback(async (direction) => {
    if (swiping) return;
    const item = feed[currentIndex.current];
    if (!item) return;

    setSwiping(true);
    const toX = direction === 'like' ? 500 : -500;

    Animated.timing(position, {
      toValue: { x: toX, y: 0 }, duration: 250, useNativeDriver: false,
    }).start(async () => {
      position.setValue({ x: 0, y: 0 });
      try {
        if (isEntrepreneur) {
          const res = await swipe(item.userId, direction);
          if (res.data.matched) {
            setMatchModal({ visible: true, name: item.name });
          }
        } else {
          const res = await swipeProject(item.projectId, direction);
          if (res.data.matched) {
            setMatchModal({ visible: true, name: item.title });
          }
        }
      } catch (e) {
        console.error('Swipe failed', e);
      }
      currentIndex.current += 1;
      setSwiping(false);
    });
  }, [feed, swiping, position, isEntrepreneur]);

  const sendSwipeRef = useRef(sendSwipe);
  useEffect(() => { sendSwipeRef.current = sendSwipe; }, [sendSwipe]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => position.setValue({ x: g.dx, y: g.dy }),
      onPanResponderRelease: (_, g) => {
        if (g.dx > SWIPE_THRESHOLD) {
          sendSwipeRef.current('like');
        } else if (g.dx < -SWIPE_THRESHOLD) {
          sendSwipeRef.current('pass');
        } else {
          Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
        }
      },
    })
  ).current;

  const visibleProfiles = feed.slice(currentIndex.current, currentIndex.current + 2);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>BizMatch</Text>
        <TouchableOpacity style={styles.notifBtn}>
          <Text style={styles.notifIcon}>🔔</Text>
        </TouchableOpacity>
      </View>

      {/* Title */}
      <View style={styles.titleBlock}>
        <Text style={styles.sectionLabel}>DISCOVERY FEED</Text>
        <Text style={styles.pageTitle}>{isEntrepreneur ? 'New Connections' : 'New Projects'}</Text>
      </View>

      {/* Mode toggle (entrepreneurs only) */}
      {isEntrepreneur && (
        <View style={styles.toggle}>
          {['investors', 'partners'].map(m => (
            <TouchableOpacity
              key={m}
              style={[styles.toggleBtn, mode === m && styles.toggleBtnActive]}
              onPress={() => setMode(m)}
            >
              <Text style={[styles.toggleBtnText, mode === m && styles.toggleBtnTextActive]}>
                {m === 'investors' ? 'Find Investors' : 'Find Partners'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Deck */}
      <View style={styles.deckArea}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : visibleProfiles.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No more profiles</Text>
            <Text style={styles.emptySub}>Check back later for new matches</Text>
            <TouchableOpacity style={styles.refreshBtn} onPress={() => loadFeed(mode)}>
              <Text style={styles.refreshBtnText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {visibleProfiles[1] ? (
              isEntrepreneur ? (
                <ProfileCard
                  key={`back-${visibleProfiles[1].userId}`}
                  profile={visibleProfiles[1]}
                  isTop={false}
                  position={position}
                  likeOpacity={likeOpacity}
                  passOpacity={passOpacity}
                  cardRotation={cardRotation}
                />
              ) : (
                <ProjectCard
                  key={`back-${visibleProfiles[1].projectId}`}
                  project={visibleProfiles[1]}
                  isTop={false}
                  position={position}
                  likeOpacity={likeOpacity}
                  passOpacity={passOpacity}
                  cardRotation={cardRotation}
                />
              )
            ) : null}
            {isEntrepreneur ? (
              <ProfileCard
                key={`top-${visibleProfiles[0].userId}`}
                profile={visibleProfiles[0]}
                isTop={true}
                panHandlers={panResponder.panHandlers}
                position={position}
                likeOpacity={likeOpacity}
                passOpacity={passOpacity}
                cardRotation={cardRotation}
              />
            ) : (
              <ProjectCard
                key={`top-${visibleProfiles[0].projectId}`}
                project={visibleProfiles[0]}
                isTop={true}
                panHandlers={panResponder.panHandlers}
                position={position}
                likeOpacity={likeOpacity}
                passOpacity={passOpacity}
                cardRotation={cardRotation}
              />
            )}
          </>
        )}
      </View>

      {/* Action buttons */}
      {!loading && visibleProfiles.length > 0 && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.passBtn]}
            onPress={() => sendSwipe('pass')}
            disabled={swiping}
          >
            <Text style={styles.passBtnText}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.starBtn]}
            onPress={() => {}}
          >
            <Text style={styles.starBtnText}>★</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.likeBtn]}
            onPress={() => sendSwipe('like')}
            disabled={swiping}
          >
            <Text style={styles.likeBtnText}>♥</Text>
          </TouchableOpacity>
        </View>
      )}

      <MatchModal
        visible={matchModal.visible}
        matchedName={matchModal.name}
        onClose={() => setMatchModal({ visible: false, name: '' })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4,
  },
  logo: { fontSize: 20, fontWeight: '800', color: colors.onSurface, letterSpacing: -0.4 },
  notifBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  notifIcon: { fontSize: 20 },

  titleBlock: { paddingHorizontal: 24, paddingBottom: 8 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: colors.onSurfaceVariant,
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2,
  },
  pageTitle: { fontSize: 28, fontWeight: '800', color: colors.onSurface, letterSpacing: -0.5 },

  toggle: {
    flexDirection: 'row', alignSelf: 'center',
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 12, padding: 4, marginBottom: 8, marginHorizontal: 24,
  },
  toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: colors.primary },
  toggleBtnText: { fontSize: 13, fontWeight: '600', color: colors.onSurfaceVariant },
  toggleBtnTextActive: { color: '#fff' },

  deckArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  card: {
    position: 'absolute',
    width: 340,
    borderRadius: 20,
    backgroundColor: colors.surfaceContainerLowest,
    overflow: 'hidden',
    ...cardShadow,
  },
  cardBack: {},

  cardPhoto: { width: '100%', height: 220, position: 'relative' },
  photoImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  photoPlaceholder: {
    width: '100%', height: '100%',
    backgroundColor: colors.primaryContainer,
    justifyContent: 'center', alignItems: 'center',
  },
  photoInitial: { fontSize: 72, fontWeight: '800', color: '#fff' },
  cardPhotoOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
    backgroundColor: 'rgba(7,0,73,0.45)',
  },
  cardNameBlock: { position: 'absolute', bottom: 10, left: 14 },
  cardName: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.4 },
  cardLocation: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 1 },

  stageBadge: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: colors.primaryContainer,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  stageBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },

  overlayLike: {
    position: 'absolute', top: 20, left: 16,
    backgroundColor: 'rgba(46,160,113,0.2)',
    borderWidth: 2, borderColor: '#2ea071',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
  },
  overlayPass: {
    position: 'absolute', top: 20, right: 16,
    backgroundColor: 'rgba(186,26,26,0.2)',
    borderWidth: 2, borderColor: '#ba1a1a',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
  },
  overlayText: { fontSize: 18, fontWeight: '800', color: '#fff' },

  cardBody: { padding: 16 },
  roleLabel: {
    fontSize: 11, fontWeight: '700', color: colors.secondary,
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: colors.onSurfaceVariant },
  bioQuote: {
    fontSize: 13, color: colors.onSurfaceVariant, fontStyle: 'italic', lineHeight: 20,
  },
  metaLine: { fontSize: 12, color: colors.onSurfaceVariant, marginTop: 6 },
  linkRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  linkBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5,
  },
  linkBtnText: { fontSize: 12, fontWeight: '600', color: colors.secondary },

  actionRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 20, paddingBottom: 16, paddingTop: 12,
  },
  actionBtn: {
    justifyContent: 'center', alignItems: 'center', borderRadius: 999,
    shadowColor: '#131b2e', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  passBtn: {
    width: 56, height: 56,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1.5, borderColor: colors.outlineVariant,
  },
  passBtnText: { fontSize: 22, color: '#ba1a1a' },
  starBtn: {
    width: 48, height: 48,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1.5, borderColor: colors.outlineVariant,
  },
  starBtnText: { fontSize: 20, color: colors.secondary },
  likeBtn: {
    width: 64, height: 64,
    backgroundColor: colors.primary,
  },
  likeBtnText: { fontSize: 26, color: '#fff' },

  emptyState: { alignItems: 'center', padding: 24 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.onSurface, marginBottom: 8 },
  emptySub: { color: colors.onSurfaceVariant, marginBottom: 24 },
  refreshBtn: {
    backgroundColor: colors.primary, borderRadius: 12,
    paddingHorizontal: 28, paddingVertical: 12,
  },
  refreshBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(7,0,73,0.6)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalBox: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 24, padding: 32, alignItems: 'center', width: 300,
    shadowColor: '#131b2e', shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.12, shadowRadius: 32, elevation: 12,
  },
  modalIconRow: { marginBottom: 8 },
  modalEmoji: { fontSize: 36, color: colors.primary },
  modalTitle: {
    fontSize: 26, fontWeight: '800', color: colors.onSurface,
    letterSpacing: -0.5, marginBottom: 8,
  },
  modalSub: { color: colors.onSurfaceVariant, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  modalBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14, width: '100%', alignItems: 'center',
  },
  modalBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
