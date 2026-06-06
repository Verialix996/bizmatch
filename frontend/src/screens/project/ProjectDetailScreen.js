import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, StatusBar, ActivityIndicator, Linking, Modal, Dimensions,
} from 'react-native';
import { useState, useEffect } from 'react';
import { VideoView, useVideoPlayer } from 'expo-video';
import { getPartners } from '../../services/project.service';
import useAuthStore from '../../store/authStore';
import useAppStore from '../../store/appStore';
import { colors, investorColors, investorThemeColors, radius, cardShadow } from '../../theme';
import { BACKEND_BASE_URL } from '../../config/constants';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const STAGE_LABELS = { idea: 'Idea Stage', mvp: 'MVP Stage', growth: 'Growth', scale: 'Scale' };

function toAbsoluteUrl(url) {
  if (!url) return null;
  return url.startsWith('http') ? url : `${BACKEND_BASE_URL}${url}`;
}

function toVideoUrl(url) {
  if (!url) return null;
  const abs = toAbsoluteUrl(url);
  if (abs && abs.includes('cloudinary.com') && !/\.(mp4|mov|m3u8)(\?|$)/i.test(abs)) {
    return abs + '.mp4';
  }
  return abs;
}

function PartnerAvatar({ name, photoUrl, size = 40, C }) {
  if (photoUrl) {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
        <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.38 }}>
            {name ? name[0].toUpperCase() : '?'}
          </Text>
        </View>
      </View>
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: C.primary, justifyContent: 'center', alignItems: 'center',
    }}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.38 }}>
        {name ? name[0].toUpperCase() : '?'}
      </Text>
    </View>
  );
}

export default function ProjectDetailScreen({ route, navigation }) {
  const { project, ownerName } = route.params;
  const darkMode = useAppStore(s => s.darkMode);
  const isInvestorTheme = useAppStore(s => s.isInvestorTheme);
  const C = darkMode ? investorColors : (isInvestorTheme ? investorThemeColors : colors);
  const styles = makeStyles(C);

  const [partners, setPartners] = useState([]);
  const [partnersLoading, setPartnersLoading] = useState(true);
  const [videoModal, setVideoModal] = useState(false);

  const videoUrl = toVideoUrl(project.video_url);
  const videoPlayer = useVideoPlayer(videoUrl || '', p => { p.loop = false; });

  useEffect(() => {
    if (videoModal && videoUrl) videoPlayer.play();
    else videoPlayer.pause();
  }, [videoModal, videoUrl]);

  useEffect(() => {
    getPartners(project.id)
      .then(r => setPartners(r.data || []))
      .catch(() => {})
      .finally(() => setPartnersLoading(false));
  }, [project.id]);

  const openDeck = () => {
    const token = useAuthStore.getState().token;
    Linking.openURL(`${BACKEND_BASE_URL}/api/projects/${project.id}/deck?token=${token}`);
  };

  const displayOwner = ownerName || project.owner_name;
  const stageLabel = STAGE_LABELS[project.stage] || project.stage;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Project Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* Title block */}
        <View style={styles.titleBlock}>
          <View style={styles.projectIconCircle}>
            <Text style={styles.projectIconText}>📁</Text>
          </View>
          <Text style={styles.projectTitle}>{project.title}</Text>
          {displayOwner ? (
            <Text style={styles.ownerLabel}>by {displayOwner}</Text>
          ) : null}
          <View style={styles.pillRow}>
            {stageLabel ? (
              <View style={styles.stagePill}>
                <Text style={styles.stagePillText}>{stageLabel}</Text>
              </View>
            ) : null}
            {project.industry ? (
              <View style={styles.industryPill}>
                <Text style={styles.industryPillText}>{project.industry}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Description */}
        {project.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ABOUT</Text>
            <Text style={styles.descText}>{project.description}</Text>
          </View>
        ) : null}

        {/* Funding */}
        {project.funding_needed ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>FUNDING SOUGHT</Text>
            <Text style={styles.fundingText}>
              ${Number(project.funding_needed).toLocaleString()}
            </Text>
          </View>
        ) : null}

        {/* Team */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TEAM</Text>
          {partnersLoading ? (
            <ActivityIndicator size="small" color={C.primary} style={{ marginTop: 8 }} />
          ) : partners.length === 0 ? (
            <Text style={styles.emptyHint}>No team members listed yet.</Text>
          ) : (
            <View style={styles.partnerList}>
              {partners.map(p => (
                <View key={p.userId} style={styles.partnerRow}>
                  <PartnerAvatar name={p.name} photoUrl={p.photoUrl} size={40} C={C} />
                  <View style={styles.partnerInfo}>
                    <Text style={styles.partnerName}>{p.name}</Text>
                    <Text style={styles.partnerRole}>{p.isOwner ? 'CEO / Founder' : (p.role || 'Member')}</Text>
                  </View>
                  {p.isOwner && (
                    <View style={styles.ceoBadge}>
                      <Text style={styles.ceoBadgeText}>CEO</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Assets */}
        {(project.deck_url || project.video_url) ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ASSETS</Text>
            <View style={styles.assetRow}>
              {project.deck_url ? (
                <TouchableOpacity style={styles.assetBtn} onPress={openDeck} activeOpacity={0.85}>
                  <Text style={styles.assetBtnIcon}>📄</Text>
                  <Text style={styles.assetBtnText}>View Pitch Deck</Text>
                </TouchableOpacity>
              ) : null}
              {project.video_url ? (
                <TouchableOpacity style={styles.assetBtn} onPress={() => setVideoModal(true)} activeOpacity={0.85}>
                  <Text style={styles.assetBtnIcon}>🎬</Text>
                  <Text style={styles.assetBtnText}>Watch Demo</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}

      </ScrollView>

      {/* Video modal */}
      <Modal visible={videoModal} animationType="slide" onRequestClose={() => setVideoModal(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <VideoView
            player={videoPlayer}
            style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}
            contentFit="contain"
            allowsFullscreen
            nativeControls
          />
          <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
            <TouchableOpacity onPress={() => setVideoModal(false)} style={{ padding: 16 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>✕  Close</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(C) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.backgroundSoft },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: C.surface,
      borderBottomWidth: 1,
      borderBottomColor: C.surfaceBorder,
    },
    backBtn: {
      width: 40, height: 40,
      justifyContent: 'center', alignItems: 'center',
    },
    backIcon: { fontSize: 22, color: C.textPrimary },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: 17,
      fontWeight: '700',
      color: C.textPrimary,
    },

    content: { paddingBottom: 40 },

    titleBlock: {
      backgroundColor: C.surface,
      alignItems: 'center',
      paddingTop: 32,
      paddingBottom: 24,
      paddingHorizontal: 24,
      marginBottom: 12,
      ...cardShadow,
    },
    projectIconCircle: {
      width: 72, height: 72, borderRadius: 36,
      backgroundColor: C.backgroundSoft,
      justifyContent: 'center', alignItems: 'center',
      marginBottom: 14,
      borderWidth: 1.5,
      borderColor: C.surfaceBorder,
    },
    projectIconText: { fontSize: 32 },
    projectTitle: {
      fontSize: 24,
      fontWeight: '800',
      color: C.textPrimary,
      textAlign: 'center',
      marginBottom: 4,
    },
    ownerLabel: {
      fontSize: 14,
      color: C.textHint,
      marginBottom: 14,
    },
    pillRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      justifyContent: 'center',
    },
    stagePill: {
      backgroundColor: C.primary + '18',
      borderRadius: radius.pill,
      paddingHorizontal: 12,
      paddingVertical: 4,
    },
    stagePillText: { fontSize: 12, fontWeight: '700', color: C.primary },
    industryPill: {
      backgroundColor: C.backgroundSoft,
      borderRadius: radius.pill,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderWidth: 1,
      borderColor: C.surfaceBorder,
    },
    industryPillText: { fontSize: 12, fontWeight: '600', color: C.textSecondary },

    section: {
      backgroundColor: C.surface,
      marginHorizontal: 16,
      marginBottom: 12,
      borderRadius: radius.lg,
      padding: 18,
      ...cardShadow,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.2,
      color: C.textHint,
      marginBottom: 10,
    },
    descText: {
      fontSize: 15,
      color: C.textSecondary,
      lineHeight: 22,
    },
    fundingText: {
      fontSize: 22,
      fontWeight: '800',
      color: C.primary,
    },
    emptyHint: {
      fontSize: 14,
      color: C.textHint,
      fontStyle: 'italic',
    },

    partnerList: { gap: 12 },
    partnerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    partnerInfo: { flex: 1 },
    partnerName: { fontSize: 15, fontWeight: '700', color: C.textPrimary },
    partnerRole: { fontSize: 13, color: C.textHint, marginTop: 1 },
    ceoBadge: {
      backgroundColor: C.primary,
      borderRadius: radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    ceoBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },

    assetRow: { flexDirection: 'row', gap: 10 },
    assetBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: C.primary,
      borderRadius: radius.md,
      paddingVertical: 12,
    },
    assetBtnIcon: { fontSize: 16 },
    assetBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  });
}
