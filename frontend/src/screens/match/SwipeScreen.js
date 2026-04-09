import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, Animated, PanResponder,
  TouchableOpacity, ActivityIndicator, Modal, Image,
  SafeAreaView, StatusBar,
} from 'react-native';
import { getFeed, swipe } from '../../services/match.service';
import { getProjectFeed, swipeProject } from '../../services/project.service';
import { Linking } from 'react-native';
import useAuthStore from '../../store/authStore';
import { colors, cardShadow, radius } from '../../theme';

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

function NotifButton() {
  return (
    <View style={styles.notifBtn}>
      <Text style={styles.notifIcon}>🔔</Text>
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
  } : { transform: [{ scale: 0.96 }, { translateY: 12 }] };

  const roleLabel = profile.role === 'investor'
    ? `INVESTOR · ${profile.investmentDomain || 'Multi-sector'}`
    : `ENTREPRENEUR · ${stageLabel[profile.ventureStage] || 'Early Stage'}`;

  return (
    <Animated.View
      style={[styles.card, animatedStyle, !isTop && styles.cardBack]}
      {...(isTop ? panHandlers : {})}
    >
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
              <Text style={styles.overlayLikeText}>LIKE</Text>
            </Animated.View>
            <Animated.View style={[styles.overlayPass, { opacity: passOpacity }]}>
              <Text style={styles.overlayPassText}>PASS</Text>
            </Animated.View>
          </>
        )}
      </View>

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
                <Text style={styles.chipText}>+{profile.skills.length - 3}</Text>
              </View>
            )}
          </View>
        )}

        {profile.bio ? (
          <Text style={styles.bioQuote} numberOfLines={2}>"{profile.bio}"</Text>
        ) : null}

        {profile.fundingNeeds ? (
          <Text style={styles.metaLine}>
            Seeking ${profile.fundingNeeds.toLocaleString()}
          </Text>
        ) : null}
        {profile.maxInvestment ? (
          <Text style={styles.metaLine}>
            Invests up to ${profile.maxInvestment.toLocaleString()}
          </Text>
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
  } : { transform: [{ scale: 0.96 }, { translateY: 12 }] };

  return (
    <Animated.View
      style={[styles.card, animatedStyle, !isTop && styles.cardBack]}
      {...(isTop ? panHandlers : {})}
    >
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
              <Text style={styles.overlayLikeText}>LIKE</Text>
            </Animated.View>
            <Animated.View style={[styles.overlayPass, { opacity: passOpacity }]}>
              <Text style={styles.overlayPassText}>PASS</Text>
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
              <View key={i} style={styles.chip}>
                <Text style={styles.chipText}>{s}</Text>
              </View>
            ))}
          </View>
        )}

        {project.description ? (
          <Text style={styles.bioQuote} numberOfLines={2}>"{project.description}"</Text>
        ) : null}

        {project.fundingNeeded ? (
          <Text style={styles.metaLine}>
            Seeking ${project.fundingNeeded.toLocaleString()}
          </Text>
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
          <View style={styles.modalIconCircle}>
            <Text style={styles.modalIconText}>✦</Text>
          </View>
          <Text style={styles.modalTitle}>It's a Match!</Text>
          <Text style={styles.modalSub}>
            You and {matchedName} have connected.
          </Text>
          <TouchableOpacity style={styles.modalBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.modalBtnText}>KEEP SWIPING</Text>
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
  const [currentIndex, setCurrentIndex] = useState(0);

  const position = useRef(new Animated.ValueXY()).current;

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
      setCurrentIndex(0);
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
    const item = feed[currentIndex];
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
          if (res.data.matched) setMatchModal({ visible: true, name: item.name });
        } else {
          const res = await swipeProject(item.projectId, direction);
          if (res.data.matched) setMatchModal({ visible: true, name: item.title });
        }
      } catch (e) {
        console.error('Swipe failed', e);
      }
      setCurrentIndex(i => i + 1);
      setSwiping(false);
    });
  }, [feed, currentIndex, swiping, position, isEntrepreneur]);

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
          Animated.spring(position, {
            toValue: { x: 0, y: 0 }, useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  const visibleCards = feed.slice(currentIndex, currentIndex + 2);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>BizMatch</Text>
        <NotifButton />
      </View>

      {/* Title */}
      <View style={styles.titleBlock}>
        <Text style={styles.sectionLabel}>DISCOVERY FEED</Text>
        <Text style={styles.pageTitle}>
          {isEntrepreneur ? 'New Connections' : 'New Projects'}
        </Text>
      </View>

      {/* Mode toggle — entrepreneurs only */}
      {isEntrepreneur && (
        <View style={styles.toggle}>
          {['investors', 'partners'].map(m => (
            <TouchableOpacity
              key={m}
              style={[styles.toggleBtn, mode === m && styles.toggleBtnActive]}
              onPress={() => setMode(m)}
              activeOpacity={0.8}
            >
              <Text style={[
                styles.toggleBtnText,
                mode === m && styles.toggleBtnTextActive,
              ]}>
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
        ) : visibleCards.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>All caught up</Text>
            <Text style={styles.emptySub}>Check back later for new matches</Text>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={() => loadFeed(mode)}
              activeOpacity={0.85}
            >
              <Text style={styles.refreshBtnText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {visibleCards[1] ? (
              isEntrepreneur ? (
                <ProfileCard
                  key={`back-${visibleCards[1].userId}`}
                  profile={visibleCards[1]}
                  isTop={false}
                  position={position}
                  likeOpacity={likeOpacity}
                  passOpacity={passOpacity}
                  cardRotation={cardRotation}
                />
              ) : (
                <ProjectCard
                  key={`back-${visibleCards[1].projectId}`}
                  project={visibleCards[1]}
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
                key={`top-${visibleCards[0].userId}`}
                profile={visibleCards[0]}
                isTop={true}
                panHandlers={panResponder.panHandlers}
                position={position}
                likeOpacity={likeOpacity}
                passOpacity={passOpacity}
                cardRotation={cardRotation}
              />
            ) : (
              <ProjectCard
                key={`top-${visibleCards[0].projectId}`}
                project={visibleCards[0]}
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
      {!loading && visibleCards.length > 0 && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.passBtn]}
            onPress={() => sendSwipe('pass')}
            disabled={swiping}
            activeOpacity={0.8}
          >
            <Text style={styles.passBtnText}>✕</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.starBtn]}
            activeOpacity={0.8}
          >
            <Text style={styles.starBtnText}>★</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.likeBtn]}
            onPress={() => sendSwipe('like')}
            disabled={swiping}
            activeOpacity={0.8}
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
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSoft,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
  },
  logo: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: -0.4,
  },
  notifBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifIcon: { fontSize: 16 },

  titleBlock: {
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textHint,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: -0.5,
  },

  toggle: {
    flexDirection: 'row',
    marginHorizontal: 24,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 3,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: colors.primary,
  },
  toggleBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textHint,
  },
  toggleBtnTextActive: {
    color: '#fff',
  },

  deckArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  card: {
    position: 'absolute',
    width: 340,
    borderRadius: 20,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    ...cardShadow,
  },
  cardBack: {
    shadowOpacity: 0.03,
  },

  cardPhoto: {
    width: '100%',
    height: 210,
    position: 'relative',
  },
  photoImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoInitial: {
    fontSize: 72,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.9)',
  },
  cardPhotoOverlay: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 80,
    backgroundColor: 'rgba(2,36,102,0.5)',
  },
  cardNameBlock: {
    position: 'absolute',
    bottom: 12,
    left: 16,
  },
  cardName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.4,
  },
  cardLocation: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },

  stageBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  stageBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },

  overlayLike: {
    position: 'absolute',
    top: 20,
    left: 16,
    backgroundColor: 'rgba(0,77,186,0.15)',
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  overlayLikeText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
  },
  overlayPass: {
    position: 'absolute',
    top: 20,
    right: 16,
    backgroundColor: 'rgba(192,57,43,0.15)',
    borderWidth: 2,
    borderColor: colors.error,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  overlayPassText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.error,
  },

  cardBody: {
    padding: 16,
  },
  roleLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  chip: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  bioQuote: {
    fontSize: 13,
    color: colors.textHint,
    fontStyle: 'italic',
    lineHeight: 19,
  },
  metaLine: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 6,
    fontWeight: '600',
  },
  linkRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  linkBtn: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  linkBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },

  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingBottom: 20,
    paddingTop: 12,
  },
  actionBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    ...cardShadow,
    shadowOpacity: 0.04,
  },
  passBtn: { width: 56, height: 56 },
  passBtnText: { fontSize: 22, color: colors.error },
  starBtn: { width: 48, height: 48 },
  starBtnText: { fontSize: 20, color: colors.primary },
  likeBtn: {
    width: 64,
    height: 64,
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  likeBtnText: { fontSize: 26, color: '#fff' },

  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primaryDark,
    marginBottom: 8,
  },
  emptySub: {
    color: colors.textHint,
    marginBottom: 24,
    fontSize: 14,
  },
  refreshBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: 28,
    paddingVertical: 13,
  },
  refreshBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,36,102,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 32,
    alignItems: 'center',
    width: 300,
    ...cardShadow,
  },
  modalIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalIconText: {
    fontSize: 24,
    color: '#fff',
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  modalSub: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
    fontSize: 14,
  },
  modalBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: 32,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
  modalBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 1,
  },
});