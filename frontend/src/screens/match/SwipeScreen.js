import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, Animated, PanResponder,
  TouchableOpacity, ActivityIndicator, Modal, Image,
  SafeAreaView, StatusBar, Dimensions, Alert, FlatList,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 16;
const CARD_HEIGHT = Math.round(SCREEN_HEIGHT * 0.68);
const PHOTO_HEIGHT = Math.round(CARD_HEIGHT * 0.55);
const MODAL_WIDTH = Math.min(300, SCREEN_WIDTH * 0.85);
import { useNavigation } from '@react-navigation/native';
import { getFeed, swipe, getCompatibility } from '../../services/match.service';
import { getProjectFeed, swipeProject, getMyProjects } from '../../services/project.service';
import { Linking } from 'react-native';
import useAuthStore from '../../store/authStore';
import useAppStore from '../../store/appStore';
import { colors, investorColors, investorThemeColors, cardShadow, radius } from '../../theme';
import { BACKEND_BASE_URL } from '../../config/constants';

const toAbsoluteUrl = url => (!url ? null : url.startsWith('http') ? url : `${BACKEND_BASE_URL}${url}`);

// Cloudinary video URLs often lack a file extension; iOS AVPlayer needs .mp4 to pick the right codec pipeline
const toVideoUrl = url => {
  if (!url) return null;
  const abs = toAbsoluteUrl(url);
  if (abs && abs.includes('cloudinary.com') && !/\.(mp4|mov|m3u8)(\?|$)/i.test(abs)) {
    return abs + '.mp4';
  }
  return abs;
};

const SWIPE_THRESHOLD = 120;
const ROTATION_FACTOR = 12;

const stageLabel = {
  idea: 'Idea Stage', mvp: 'MVP Stage', growth: 'Growth', scale: 'Scale',
};

// Module-level styles used by sub-components (ProfileCard, ProjectCard, modals).
// makeStyles is a function declaration so it is hoisted — this call is valid.
const styles = makeStyles(colors);

function StageBadge({ stage }) {
  if (!stage) return null;
  return (
    <View style={styles.stageBadge}>
      <Text style={styles.stageBadgeText}>{stageLabel[stage] || stage}</Text>
    </View>
  );
}


function ProfileCard({ profile, panHandlers, position, likeOpacity, passOpacity, cardRotation, isTop, onCompatibility }) {
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
        {profile.isPremium && (
          <View style={styles.premiumBadge}>
            <Text style={styles.premiumBadgeText}>★ Premium</Text>
          </View>
        )}
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
        <View style={styles.roleLabelRow}>
          <Text style={styles.roleLabel}>{roleLabel}</Text>
          {profile.score > 0 && (
            <View style={[styles.scoreBadge, profile.score >= 70 ? styles.scoreHigh : profile.score >= 40 ? styles.scoreMid : styles.scoreLow]}>
              <Text style={styles.scoreBadgeText}>{profile.score}% match</Text>
            </View>
          )}
        </View>

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

        {isTop && onCompatibility && (
          <TouchableOpacity style={styles.compatBtn} onPress={onCompatibility} activeOpacity={0.8}>
            <Text style={styles.compatBtnText}>🔍 Compatibility</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

function ProjectCard({ project, panHandlers, position, likeOpacity, passOpacity, cardRotation, isTop, onWatchVideo }) {
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
        {project.isPremium && (
          <View style={styles.premiumBadge}>
            <Text style={styles.premiumBadgeText}>★ Premium</Text>
          </View>
        )}
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
        <View style={styles.roleLabelRow}>
          <Text style={styles.roleLabel}>
            {project.industry ? project.industry.toUpperCase() : 'VENTURE'} · SEEKING INVESTMENT
          </Text>
          {project.score > 0 && (
            <View style={[styles.scoreBadge, project.score >= 70 ? styles.scoreHigh : project.score >= 40 ? styles.scoreMid : styles.scoreLow]}>
              <Text style={styles.scoreBadgeText}>{Math.min(100, project.score)}% match</Text>
            </View>
          )}
        </View>

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
              onPress={() => {
                const token = useAuthStore.getState().token;
                Linking.openURL(`${BACKEND_BASE_URL}/api/projects/${project.projectId}/deck?token=${token}`);
              }}
            >
              <Text style={styles.linkBtnText}>📄 View Deck</Text>
            </TouchableOpacity>
          ) : null}
          {project.videoUrl ? (
            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => onWatchVideo && onWatchVideo(project.videoUrl)}
            >
              <Text style={styles.linkBtnText}>🎬 Watch Demo</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}

function MatchModal({ visible, matchedName, aiSummary, isProjectMatch, onClose, onMessage }) {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.modalBackdrop}>
        <View style={styles.modalBox}>
          <View style={styles.modalIconCircle}>
            <Text style={styles.modalIconText}>✦</Text>
          </View>
          <Text style={styles.modalTitle}>It's a Match!</Text>
          <Text style={styles.modalSub}>
            {isProjectMatch
              ? `In order to view the full details of "${matchedName}", an NDA signing is required.`
              : `You and ${matchedName} have connected.`}
          </Text>
          {!isProjectMatch && aiSummary ? (
            <Text style={styles.modalAiSummary}>{aiSummary}</Text>
          ) : null}
          <TouchableOpacity style={styles.modalBtn} onPress={onMessage} activeOpacity={0.85}>
            <Text style={styles.modalBtnText}>
              {isProjectMatch ? 'GO TO CHAT' : `MESSAGE ${matchedName?.toUpperCase()}`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.modalBtnSecondary} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.modalBtnSecondaryText}>KEEP SWIPING</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function CompatibilityModal({ visible, loading, score, pros, cons, onClose }) {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalBox, { alignItems: 'stretch' }]}>
          <TouchableOpacity style={styles.compatModalClose} onPress={onClose}>
            <Text style={styles.compatModalCloseText}>✕</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { textAlign: 'center' }]}>Compatibility</Text>
          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 24 }} />
          ) : score !== null ? (
            <>
              <View style={styles.compatScoreRow}>
                <Text style={styles.compatScore}>{score}</Text>
                <Text style={styles.compatScoreLabel}>/100</Text>
              </View>
              {pros.length > 0 && (
                <>
                  <Text style={styles.compatSectionTitle}>✓ Strengths</Text>
                  {pros.map((p, i) => <Text key={i} style={styles.compatItem}>• {p}</Text>)}
                </>
              )}
              {cons.length > 0 && (
                <>
                  <Text style={styles.compatSectionTitle}>⚠ Watch out</Text>
                  {cons.map((c, i) => <Text key={i} style={styles.compatItem}>• {c}</Text>)}
                </>
              )}
            </>
          ) : (
            <Text style={[styles.modalSub, { textAlign: 'center', marginVertical: 16 }]}>Could not load compatibility score.</Text>
          )}
          <TouchableOpacity style={[styles.modalBtn, { marginTop: 20 }]} onPress={onClose}>
            <Text style={styles.modalBtnText}>CLOSE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function VideoPlayerModal({ visible, player, onClose }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, backgroundColor: '#000' }}>
        <VideoView
          player={player}
          style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}
          contentFit="contain"
          allowsFullscreen
          allowsPictureInPicture
          nativeControls
        />
        <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
          <TouchableOpacity onPress={onClose} style={styles.videoCloseBtn}>
            <Text style={styles.videoCloseBtnText}>✕  Close</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function ProjectPickerModal({ visible, projects, onSelect, onClose }) {
  return (
    <Modal transparent visible={visible} animationType="slide">
      <View style={styles.pickerBackdrop}>
        <View style={styles.pickerSheet}>
          <Text style={styles.pickerTitle}>Find investors for which project?</Text>
          {projects.length === 0 ? (
            <View style={styles.pickerEmpty}>
              <Text style={styles.pickerEmptyText}>You don't have any projects yet. Create one in the Projects tab first.</Text>
            </View>
          ) : (
            <FlatList
              data={projects}
              keyExtractor={item => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.pickerRow} onPress={() => onSelect(item)} activeOpacity={0.75}>
                  <View>
                    <Text style={styles.pickerRowTitle}>{item.title}</Text>
                    {item.stage ? <Text style={styles.pickerRowSub}>{stageLabel[item.stage] || item.stage}</Text> : null}
                  </View>
                  <Text style={styles.pickerRowArrow}>›</Text>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.pickerSep} />}
            />
          )}
          <TouchableOpacity style={styles.pickerCancel} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.pickerCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function SwipeScreen() {
  const navigation = useNavigation();
  const user = useAuthStore(s => s.user);
  const isEntrepreneur = user?.role === 'entrepreneur';

  const { investorMode, selectedProject, setSelectedProject, showProjectPicker, closeProjectPicker, enterInvestorMode, openProjectPicker, darkMode, isInvestorTheme } = useAppStore();
  const mode = investorMode ? 'investors' : 'partners';
  const isPremium = !!(user?.is_premium && user?.premium_expires_at && new Date(user.premium_expires_at) > new Date());

  const [myProjects, setMyProjects] = useState([]);
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [swiping, setSwiping] = useState(false);
  const [matchModal, setMatchModal] = useState({ visible: false, name: '', matchId: null, photo: null, aiSummary: null, isProjectMatch: false });
  const [lastMatchSummary, setLastMatchSummary] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [videoModal, setVideoModal] = useState({ visible: false, url: null });
  const [compatModal, setCompatModal] = useState({ visible: false, loading: false, score: null, pros: [], cons: [] });

  const C = darkMode ? investorColors
          : isInvestorTheme ? investorThemeColors
          : investorMode ? investorColors
          : colors;
  const styles = useMemo(() => makeStyles(C), [C]);

  const videoPlayer = useVideoPlayer(videoModal.url || '', p => { p.loop = false; });
  useEffect(() => {
    if (videoModal.visible && videoModal.url) videoPlayer.play();
    else videoPlayer.pause();
  }, [videoModal.visible, videoModal.url]);

  const position = useRef(new Animated.ValueXY()).current;
  const superStarScale = useRef(new Animated.Value(1)).current;
  const superFlashOpacity = useRef(new Animated.Value(0)).current;
  const superBadgeScale = useRef(new Animated.Value(0.5)).current;
  const superBadgeOpacity = useRef(new Animated.Value(0)).current;
  const superRingScale = useRef(new Animated.Value(1)).current;
  const superRingOpacity = useRef(new Animated.Value(0)).current;
  const superParticles = useRef(
    Array.from({ length: 16 }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
    }))
  ).current;

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

  // Load entrepreneur's own projects once so they can pick one for the investor feed
  useEffect(() => {
    if (!isEntrepreneur) return;
    getMyProjects().then(res => setMyProjects(res.data || [])).catch(() => {});
  }, [isEntrepreneur]);

  const loadFeed = useCallback(async (feedMode, projectId = null) => {
    setLoading(true);
    try {
      const res = isEntrepreneur
        ? await getFeed(feedMode, projectId)
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

  useEffect(() => {
    if (isEntrepreneur && mode === 'investors') {
      // Don't auto-load: wait for project selection
      if (!selectedProject) return;
      loadFeed(mode, selectedProject.id);
    } else {
      loadFeed(mode);
    }
  }, [mode, selectedProject, loadFeed, isEntrepreneur]);

  const handleCompatibility = useCallback(async (targetUserId) => {
    setCompatModal({ visible: true, loading: true, score: null, pros: [], cons: [] });
    try {
      const res = await getCompatibility(targetUserId);
      setCompatModal({ visible: true, loading: false, score: res.data.score ?? null, pros: res.data.pros || [], cons: res.data.cons || [] });
    } catch {
      setCompatModal({ visible: true, loading: false, score: null, pros: [], cons: [] });
    }
  }, []);

  const sendSwipe = useCallback(async (direction, superLike = false) => {
    if (swiping) return;
    const item = feed[currentIndex];
    if (!item) return;

    setLastMatchSummary(null);
    setSwiping(true);
    const toX = direction === 'like' ? 500 : -500;

    const doCardFly = (callback) => {
      if (superLike) {
        // Star burst on the ★ button
        Animated.sequence([
          Animated.timing(superStarScale, { toValue: 2.2, duration: 180, useNativeDriver: true }),
          Animated.timing(superStarScale, { toValue: 1, duration: 120, useNativeDriver: true }),
        ]).start();
        // Glow ring pulse expanding from the button
        superRingScale.setValue(1);
        superRingOpacity.setValue(0);
        Animated.parallel([
          Animated.timing(superRingScale, { toValue: 3, duration: 400, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(superRingOpacity, { toValue: 0.8, duration: 80, useNativeDriver: true }),
            Animated.timing(superRingOpacity, { toValue: 0, duration: 320, useNativeDriver: true }),
          ]),
        ]).start();
        // Deeper gold flash overlay (0.75 opacity, 600ms fade)
        Animated.sequence([
          Animated.timing(superFlashOpacity, { toValue: 0.75, duration: 150, useNativeDriver: true }),
          Animated.timing(superFlashOpacity, { toValue: 0, duration: 600, useNativeDriver: true }),
        ]).start();
        // "⭐ SUPER LIKE!" badge — scale in then fade out
        superBadgeScale.setValue(0.5);
        superBadgeOpacity.setValue(0);
        Animated.sequence([
          Animated.parallel([
            Animated.timing(superBadgeOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
            Animated.spring(superBadgeScale, { toValue: 1.1, friction: 4, useNativeDriver: true }),
          ]),
          Animated.timing(superBadgeScale, { toValue: 1, duration: 100, useNativeDriver: true }),
          Animated.delay(700),
          Animated.timing(superBadgeOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start();
        // 16 particles in 2 rings radiating outward with staggered delay
        const ANGLES_16 = Array.from({ length: 16 }, (_, i) => i * 22.5);
        superParticles.forEach((p, i) => {
          p.x.setValue(0); p.y.setValue(0); p.opacity.setValue(0);
          const rad = (ANGLES_16[i] * Math.PI) / 180;
          const isOuter = i >= 8;
          const dist = isOuter ? 130 + Math.random() * 30 : 80 + Math.random() * 20;
          const delay = isOuter ? 80 : 0;
          Animated.sequence([
            Animated.delay(delay),
            Animated.parallel([
              Animated.timing(p.opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
              Animated.timing(p.x, { toValue: Math.cos(rad) * dist, duration: 500, useNativeDriver: true }),
              Animated.timing(p.y, { toValue: Math.sin(rad) * dist, duration: 500, useNativeDriver: true }),
            ]),
          ]).start(() => {
            Animated.timing(p.opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
          });
        });
        // Card flies up-right with rotation (use position Y to go up)
        Animated.timing(position, {
          toValue: { x: toX, y: -300 }, duration: 400, useNativeDriver: false,
        }).start(callback);
      } else {
        Animated.timing(position, {
          toValue: { x: toX, y: 0 }, duration: 250, useNativeDriver: false,
        }).start(callback);
      }
    };

    doCardFly(async () => {
      position.setValue({ x: 0, y: 0 });
      try {
        if (isEntrepreneur) {
          const res = await swipe(item.userId, direction, superLike);
          if (res.data.matched) {
            setMatchModal({ visible: true, name: item.name, matchId: res.data.matchId, photo: item.photoUrl ?? null, aiSummary: res.data.aiSummary ?? null, isProjectMatch: false });
            if (res.data.aiSummary) setLastMatchSummary(res.data.aiSummary);
          }
        } else {
          const res = await swipeProject(item.projectId, direction);
          if (res.data.matched) setMatchModal({ visible: true, name: item.title, matchId: res.data.matchId, photo: null, aiSummary: null, isProjectMatch: true });
        }
      } catch (e) {
        if (e.response?.status === 429 && e.response?.data?.upgradeRequired) {
          Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
          setSwiping(false);
          Alert.alert(
            'Daily Limit Reached',
            "You've used all 20 free swipes today. Upgrade to Premium for unlimited swipes!",
            [
              { text: 'Maybe Later' },
              { text: 'Go Premium', onPress: () => navigation.navigate('Premium') },
            ]
          );
          return;
        }
      }
      setCurrentIndex(i => i + 1);
      setSwiping(false);
    });
  }, [feed, currentIndex, swiping, position, superStarScale, superFlashOpacity, superBadgeScale, superBadgeOpacity, superParticles, superRingScale, superRingOpacity, isEntrepreneur, navigation]);

  const sendSwipeRef = useRef(sendSwipe);
  useEffect(() => { sendSwipeRef.current = sendSwipe; }, [sendSwipe]);

  const onTapRef = useRef(() => {});
  useEffect(() => {
    onTapRef.current = () => {
      const item = feed[currentIndex];
      if (!item) return;
      // Normalize project items so ProfileDetailScreen can render them
      const profile = item.projectId ? { ...item, name: item.ownerName, photoUrl: item.ownerPhoto } : item;
      navigation.navigate('ProfileDetail', { profile, matchId: null });
    };
  }, [feed, currentIndex, navigation]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => position.setValue({ x: g.dx, y: g.dy }),
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) < 6 && Math.abs(g.dy) < 6) {
          onTapRef.current();
          return;
        }
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
    <SafeAreaView style={[styles.container, { backgroundColor: (investorMode && !isInvestorTheme) ? '#0B3321' : (C.backgroundSoft || C.background) }]}>
      <StatusBar barStyle={(investorMode || darkMode || isInvestorTheme) ? 'light-content' : 'dark-content'} />

      {/* Deck */}
      <View style={styles.deckArea}>
        {isEntrepreneur && mode === 'investors' && !selectedProject ? (
          <TouchableOpacity style={styles.pickProjectBtn} onPress={() => useAppStore.getState().openProjectPicker()} activeOpacity={0.85}>
            <Text style={styles.pickProjectIcon}>📁</Text>
            <Text style={styles.pickProjectTitle}>Select a project</Text>
            <Text style={styles.pickProjectSub}>Choose which project to find investors for</Text>
          </TouchableOpacity>
        ) : loading ? (
          <ActivityIndicator size="large" color={C.primary} />
        ) : visibleCards.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>All caught up</Text>
            <Text style={styles.emptySub}>Check back later for new matches</Text>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={() => loadFeed(mode, selectedProject?.id ?? null)}
              activeOpacity={0.85}
            >
              <Text style={styles.refreshBtnText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.cardStack}>
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
                  onWatchVideo={(url) => setVideoModal({ visible: true, url: toVideoUrl(url) })}
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
                onCompatibility={() => handleCompatibility(visibleCards[0].userId)}
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
                onWatchVideo={(url) => setVideoModal({ visible: true, url: toVideoUrl(url) })}
              />
            )}
          </View>
        )}
      </View>

      {/* Action buttons */}
      {!loading && visibleCards.length > 0 && !(isEntrepreneur && mode === 'investors' && !selectedProject) && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.passBtn, (investorMode || darkMode) && { borderColor: C.surfaceBorder, backgroundColor: C.surface }]}
            onPress={() => sendSwipe('pass')}
            disabled={swiping}
            activeOpacity={0.8}
          >
            <Text style={[styles.passBtnText, (investorMode || darkMode) && { color: C.error }]}>✕</Text>
          </TouchableOpacity>

          <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                width: 48, height: 48, borderRadius: 24,
                borderWidth: 2, borderColor: '#FFD700',
                opacity: superRingOpacity,
                transform: [{ scale: superRingScale }],
              }}
            />
            <Animated.View style={{ transform: [{ scale: superStarScale }] }}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.starBtn, (investorMode || darkMode) && { borderColor: C.primary, backgroundColor: C.surface }]}
                onPress={() => {
                  if (!isPremium) {
                    Alert.alert('Premium Feature', 'Super Like is a Premium feature. Upgrade to send unlimited Super Likes!',
                      [{ text: 'Not now', style: 'cancel' }, { text: 'Upgrade', onPress: () => navigation.navigate('Premium') }]
                    );
                    return;
                  }
                  sendSwipe('like', true);
                }}
                disabled={swiping}
                activeOpacity={0.8}
              >
                <Text style={[styles.starBtnText, (investorMode || darkMode) && { color: C.primary }]}>★</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>

          <TouchableOpacity
            style={[styles.actionBtn, styles.likeBtn, (investorMode || darkMode) && { backgroundColor: C.primary, borderColor: C.primary }]}
            onPress={() => sendSwipe('like')}
            disabled={swiping}
            activeOpacity={0.8}
          >
            <Text style={[styles.likeBtnText, (investorMode || darkMode) && { color: C.textOnPrimary || '#0A0F1E' }]}>♥</Text>
          </TouchableOpacity>
        </View>
      )}

      {!!lastMatchSummary && (
        <View style={styles.matchSummaryBanner}>
          <Text style={styles.matchSummaryText}>{lastMatchSummary}</Text>
        </View>
      )}

      <MatchModal
        visible={matchModal.visible}
        matchedName={matchModal.name}
        aiSummary={matchModal.aiSummary}
        isProjectMatch={matchModal.isProjectMatch}
        onClose={() => setMatchModal({ visible: false, name: '', matchId: null, photo: null, aiSummary: null, isProjectMatch: false })}
        onMessage={() => {
          const { matchId, name, photo } = matchModal;
          setMatchModal({ visible: false, name: '', matchId: null, photo: null, aiSummary: null, isProjectMatch: false });
          navigation.navigate('Chat', {
            match: { matchId, name, photoUrl: photo },
          });
        }}
      />

      <CompatibilityModal
        visible={compatModal.visible}
        loading={compatModal.loading}
        score={compatModal.score}
        pros={compatModal.pros}
        cons={compatModal.cons}
        onClose={() => setCompatModal({ visible: false, loading: false, score: null, pros: [], cons: [] })}
      />

      <VideoPlayerModal
        visible={videoModal.visible}
        player={videoPlayer}
        onClose={() => setVideoModal({ visible: false, url: null })}
      />

      <ProjectPickerModal
        visible={showProjectPicker}
        projects={myProjects}
        onSelect={(project) => enterInvestorMode(project)}
        onClose={closeProjectPicker}
      />

      {/* Super Like gold flash overlay */}
      <Animated.View
        pointerEvents="none"
        style={[styles.superFlash, { opacity: superFlashOpacity }]}
      />

      {/* Super Like badge */}
      <Animated.View
        pointerEvents="none"
        style={[styles.superBadge, { opacity: superBadgeOpacity, transform: [{ scale: superBadgeScale }] }]}
      >
        <Text style={styles.superBadgeText}>⭐ SUPER LIKE!</Text>
      </Animated.View>

      {/* Particle stars */}
      {superParticles.map((p, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={[
            styles.superParticle,
            { opacity: p.opacity, transform: [{ translateX: p.x }, { translateY: p.y }] },
          ]}
        >
          <Text style={styles.superParticleText}>{['★', '✨', '💫', '✦', '⭐'][i % 5]}</Text>
        </Animated.View>
      ))}
    </SafeAreaView>
  );
}

function makeStyles(C) { return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.backgroundSoft,
  },
  superFlash: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#FFD700',
    zIndex: 99,
  },
  superBadge: {
    position: 'absolute',
    alignSelf: 'center',
    top: '40%',
    zIndex: 100,
    backgroundColor: '#FFD700',
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 14,
    shadowColor: '#FFD700',
    shadowOpacity: 0.9,
    shadowRadius: 20,
    elevation: 20,
  },
  superBadgeText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0A0F1E',
    letterSpacing: 1,
  },
  superParticle: {
    position: 'absolute',
    alignSelf: 'center',
    top: '45%',
    zIndex: 100,
  },
  superParticleText: {
    fontSize: 18,
    color: '#FFD700',
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
    color: C.primaryDark,
    letterSpacing: -0.4,
  },
  titleBlock: {
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: C.textHint,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: C.primaryDark,
    letterSpacing: -0.5,
  },

  deckArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 8,
  },

  cardStack: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    position: 'relative',
  },

  card: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 16,
    backgroundColor: C.surface,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    ...cardShadow,
  },
  cardBack: {
    shadowOpacity: 0.03,
  },

  cardPhoto: {
    width: '100%',
    height: PHOTO_HEIGHT,
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
    backgroundColor: C.primary,
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

  premiumBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(245,166,35,0.9)',
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  premiumBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#fff',
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
    borderColor: C.primary,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  overlayLikeText: {
    fontSize: 18,
    fontWeight: '800',
    color: C.primary,
  },
  overlayPass: {
    position: 'absolute',
    top: 20,
    right: 16,
    backgroundColor: 'rgba(192,57,43,0.15)',
    borderWidth: 2,
    borderColor: C.error,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  overlayPassText: {
    fontSize: 18,
    fontWeight: '800',
    color: C.error,
  },

  cardBody: {
    padding: 16,
  },
  roleLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: C.primary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    flex: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  chip: {
    backgroundColor: C.backgroundSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textSecondary,
  },
  bioQuote: {
    fontSize: 13,
    color: C.textHint,
    fontStyle: 'italic',
    lineHeight: 19,
  },
  metaLine: {
    fontSize: 12,
    color: C.textSecondary,
    marginTop: 6,
    fontWeight: '600',
  },
  linkRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  linkBtn: {
    backgroundColor: C.backgroundSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  linkBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.primary,
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
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.surfaceBorder,
    ...cardShadow,
    shadowOpacity: 0.04,
  },
  passBtn: { width: 56, height: 56 },
  passBtnText: { fontSize: 22, color: C.error },
  starBtn: { width: 48, height: 48 },
  starBtnText: { fontSize: 20, color: C.primary },
  likeBtn: {
    width: 64,
    height: 64,
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  likeBtnText: { fontSize: 26, color: '#fff' },

  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: C.primaryDark,
    marginBottom: 8,
  },
  emptySub: {
    color: C.textHint,
    marginBottom: 24,
    fontSize: 14,
  },
  refreshBtn: {
    backgroundColor: C.primary,
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
    backgroundColor: C.surface,
    borderRadius: radius.xl,
    padding: 32,
    alignItems: 'center',
    width: MODAL_WIDTH,
    ...cardShadow,
  },
  modalIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.primary,
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
    color: C.primaryDark,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  modalSub: {
    color: C.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 20,
    fontSize: 14,
  },
  matchSummaryBanner: {
    marginHorizontal: 24,
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: C.surface,
    borderLeftWidth: 3,
    borderLeftColor: C.primary,
  },
  matchSummaryText: {
    color: C.primary,
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 19,
    textAlign: 'center',
  },
  modalAiSummary: {
    color: C.primary,
    textAlign: 'center',
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 19,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  modalBtn: {
    backgroundColor: C.primary,
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
  modalBtnSecondary: {
    marginTop: 10,
    borderRadius: radius.md,
    paddingHorizontal: 32,
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
  },
  modalBtnSecondaryText: {
    color: C.textHint,
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 1,
  },

  // Score badge
  roleLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  scoreBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  scoreHigh: { backgroundColor: '#d1fae5' },
  scoreMid:  { backgroundColor: '#fef3c7' },
  scoreLow:  { backgroundColor: '#f1f5f9' },
  scoreBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.primaryDark,
  },

  // Project pill (selected project label)
  projectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 24,
    marginBottom: 8,
    backgroundColor: C.surface,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  projectPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.primaryDark,
    flex: 1,
    marginRight: 8,
  },
  projectPillChange: {
    fontSize: 12,
    fontWeight: '700',
    color: C.primary,
  },

  // Pick project placeholder
  pickProjectBtn: {
    alignItems: 'center',
    padding: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.surfaceBorder,
    borderStyle: 'dashed',
    backgroundColor: C.surface,
    width: '90%',
  },
  pickProjectIcon: { fontSize: 40, marginBottom: 12 },
  pickProjectTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: C.primaryDark,
    marginBottom: 6,
  },
  pickProjectSub: {
    fontSize: 13,
    color: C.textHint,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Project picker modal (bottom sheet style)
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,36,102,0.45)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '70%',
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: C.primaryDark,
    marginBottom: 16,
    textAlign: 'center',
  },
  pickerEmpty: { paddingVertical: 24, alignItems: 'center' },
  pickerEmptyText: {
    color: C.textHint,
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 14,
  },
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  pickerRowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: C.primaryDark,
  },
  pickerRowSub: {
    fontSize: 12,
    color: C.textHint,
    marginTop: 2,
  },
  pickerRowArrow: {
    fontSize: 22,
    color: C.primary,
  },
  pickerSep: {
    height: 1,
    backgroundColor: C.surfaceBorder,
  },
  pickerCancel: {
    marginTop: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: C.backgroundSoft,
  },
  pickerCancelText: {
    fontWeight: '700',
    color: C.textSecondary,
    fontSize: 14,
  },

  // Compatibility button (inside profile card)
  compatBtn: {
    marginTop: 10,
    backgroundColor: C.backgroundSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  compatBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.primary,
  },

  // Compatibility modal
  compatModalClose: {
    alignSelf: 'flex-end',
    padding: 4,
    marginBottom: 4,
  },
  compatModalCloseText: {
    fontSize: 16,
    color: C.textHint,
    fontWeight: '600',
  },
  compatScoreRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginVertical: 12,
  },
  compatScore: {
    fontSize: 52,
    fontWeight: '900',
    color: C.primary,
    letterSpacing: -2,
    lineHeight: 56,
  },
  compatScoreLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: C.textHint,
    marginBottom: 8,
    marginLeft: 4,
  },
  compatSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: C.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 6,
  },
  compatItem: {
    fontSize: 13,
    color: C.textHint,
    lineHeight: 19,
    marginBottom: 4,
  },

  // Video player modal
  videoCloseBtn: {
    padding: 16,
  },
  videoCloseBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
}); }