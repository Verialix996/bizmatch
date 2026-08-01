import { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  ActivityIndicator, Image, StatusBar, Modal, Linking, Dimensions,
} from 'react-native';
import { showAlert } from '../../services/alert';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
import { VideoView, useVideoPlayer } from 'expo-video';
import { getMessages, sendMessage, markRead, shareProject } from '../../services/match.service';
import api from '../../services/api';
import { getMyProjects } from '../../services/project.service';
import useAuthStore from '../../store/authStore';
import useAppStore from '../../store/appStore';
import { colors, investorColors, investorThemeColors, cardShadow, radius } from '../../theme';
import { API_BASE_URL } from '../../config/constants';

const toAbsoluteUrl = url => (!url ? null : url.startsWith('http') ? url : `${API_BASE_URL}${url}`);

const toVideoUrl = url => {
  if (!url) return null;
  const abs = toAbsoluteUrl(url);
  if (abs && abs.includes('cloudinary.com') && !/\.(mp4|mov|m3u8)(\?|$)/i.test(abs)) {
    return abs + '.mp4';
  }
  return abs;
};

function parseUTC(dateStr) {
  if (!dateStr) return new Date(NaN);
  return new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  return parseUTC(dateStr).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit',
  });
}

function formatLastSeen(dateStr) {
  if (!dateStr) return 'Last seen recently';
  const d = parseUTC(dateStr);
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 2 * 60 * 1000) return 'Active now';
  if (diffMs < 60 * 60 * 1000) return `Last seen ${Math.floor(diffMs / 60000)}m ago`;
  if (diffMs < 24 * 60 * 60 * 1000) return `Last seen ${Math.floor(diffMs / 3600000)}h ago`;
  return `Last seen ${Math.floor(diffMs / 86400000)}d ago`;
}

function formatDateDivider(dateStr) {
  if (!dateStr) return '';
  const d = parseUTC(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'TODAY';
  if (d.toDateString() === yesterday.toDateString()) return 'YESTERDAY';
  return d.toLocaleDateString([], {
    weekday: 'long', month: 'long', day: 'numeric',
  }).toUpperCase();
}

function Avatar({ photoUrl, name, size = 36, styles }) {
  const initials = name ? name[0].toUpperCase() : '?';
  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  return (
    <View style={[
      styles.avatarPlaceholder,
      { width: size, height: size, borderRadius: size / 2 },
    ]}>
      <Text style={[styles.avatarInitial, { fontSize: size * 0.38 }]}>
        {initials}
      </Text>
    </View>
  );
}

function tryParseJson(str) {
  if (!str) return null;
  if (typeof str === 'object') return str;
  try { return JSON.parse(str); } catch { return null; }
}

export default function ChatScreen({ route, navigation }) {
  const { match } = route.params;
  const user = useAuthStore(s => s.user);
  const markMatchRead = useAuthStore(s => s.markMatchRead);
  const darkMode = useAppStore(s => s.darkMode);
  const isInvestorTheme = useAppStore(s => s.isInvestorTheme);
  const setActiveChatMatchId = useAppStore(s => s.setActiveChatMatchId);

  useFocusEffect(useCallback(() => {
    setActiveChatMatchId(match.matchId);
    return () => setActiveChatMatchId(null);
  }, [match.matchId, setActiveChatMatchId]));
  const C = darkMode ? investorColors : (isInvestorTheme ? investorThemeColors : colors);
  const styles = makeStyles(C);

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const lastIdRef = useRef(null);

  // "+" action sheet state
  const [actionSheet, setActionSheet] = useState(null); // null | 'menu' | 'pick-project'
  const [actionProjects, setActionProjects] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);

  // Project detail popup
  const [detailProject, setDetailProject] = useState(null);

  // Inline video player
  const [videoModal, setVideoModal] = useState({ visible: false, url: null });
  const videoPlayer = useVideoPlayer(videoModal.url || '', p => { p.loop = false; });
  useEffect(() => {
    if (videoModal.visible && videoModal.url) videoPlayer.play();
    else videoPlayer.pause();
  }, [videoModal.visible, videoModal.url]);

  const load = useCallback(async () => {
    try {
      const res = await getMessages(match.matchId);
      setMessages(res.data);
      if (res.data.length > 0) {
        lastIdRef.current = res.data[res.data.length - 1].id;
      }
      markRead(match.matchId).catch(() => {});
    } catch (e) {
      console.error('Failed to load messages', e);
    } finally {
      setLoading(false);
    }
  }, [match.matchId]);

  // Single full-fetch poll: picks up new messages AND read_at changes, while
  // preserving local-only moderation_blocked bubbles the server never stored
  const poll = useCallback(async () => {
    try {
      const res = await getMessages(match.matchId);
      const newest = res.data.length > 0 ? res.data[res.data.length - 1].id : null;
      const hasNew = newest !== null && newest !== lastIdRef.current;
      if (newest !== null) lastIdRef.current = newest;
      setMessages(prev => {
        const localOnly = prev.filter(m => String(m.id).startsWith('blocked_'));
        return [...res.data, ...localOnly];
      });
      if (hasNew) {
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
        markRead(match.matchId).catch(() => {});
      }
    } catch {
      // silent — polling failure shouldn't surface to user
    }
  }, [match.matchId]);

  useEffect(() => { load(); }, [load]);

  // Mark this conversation as read when screen opens
  useEffect(() => { markMatchRead(match.matchId); }, [match.matchId, markMatchRead]);

  useEffect(() => {
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [poll]);

  // Poll other user's last_active_at every 30s
  const [lastActiveAt, setLastActiveAt] = useState(match.lastActiveAt);
  useEffect(() => {
    if (!match.userId) return;
    const fetch = () => api.get(`/users/${match.userId}`).then(r => {
      if (r.data?.last_active_at) setLastActiveAt(r.data.last_active_at);
    }).catch(() => {});
    fetch();
    const interval = setInterval(fetch, 30000);
    return () => clearInterval(interval);
  }, [match.userId]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);
    try {
      const res = await sendMessage(match.matchId, text);
      lastIdRef.current = res.data.id;
      setMessages(prev => {
        const ids = new Set(prev.map(m => m.id));
        return ids.has(res.data.id) ? prev : [...prev, res.data];
      });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      setInput(text);
      const reason = e?.response?.data?.error || 'Message could not be sent. Please try again.';
      const blockedMsg = {
        id: `blocked_${Date.now()}`,
        sender_id: user?.id,
        body: text,
        message_type: 'moderation_blocked',
        reason,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, blockedMsg]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } finally {
      setSending(false);
    }
  };

  const openActionMenu = () => setActionSheet('menu');
  const closeActionSheet = () => { setActionSheet(null); setActionProjects([]); };

  const pickProjectToShare = async () => {
    setActionLoading(true);
    setActionSheet('pick-project');
    try {
      const res = await getMyProjects();
      setActionProjects(res.data);
    } catch {
      showAlert('Error', 'Could not load projects.');
      closeActionSheet();
    } finally {
      setActionLoading(false);
    }
  };

  const handleShareProject = async (project) => {
    closeActionSheet();
    try {
      const res = await shareProject(match.matchId, project.id);
      const msg = res.data;
      if (msg?.id) lastIdRef.current = msg.id;
      setMessages(prev => {
        const ids = new Set(prev.map(m => m.id));
        return ids.has(msg.id) ? prev : [...prev, msg];
      });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      showAlert('Error', e.response?.data?.error || 'Could not share project.');
    }
  };

  const renderSpecialMessage = (item, isOwn) => {
    const meta = tryParseJson(item.metadata) || {};
    const type = item.message_type;

    if (type === 'project_shared') {
      return (
        <View style={[styles.actionCard, styles.projectSharedCard]}>
          <Text style={styles.actionCardTitle}>📁 Project Shared</Text>
          <TouchableOpacity onPress={() => setDetailProject(meta)} activeOpacity={0.7}>
            <Text style={[styles.projectSharedTitle, { textDecorationLine: 'underline' }]}>{meta.title || 'Untitled Project'}</Text>
          </TouchableOpacity>
          {meta.industry || meta.stage ? (
            <Text style={styles.projectSharedMeta}>
              {[meta.stage, meta.industry].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
          <TouchableOpacity
            style={styles.viewDetailsBtn}
            onPress={() => setDetailProject(meta)}
            activeOpacity={0.85}
          >
            <Text style={styles.viewDetailsBtnText}>View Full Details</Text>
          </TouchableOpacity>
          <Text style={styles.actionCardTime}>{formatTime(item.created_at)}</Text>
        </View>
      );
    }

    if (type === 'meeting_proposal') {
      const scheduledAt = meta.scheduledAt
        ? new Date(meta.scheduledAt).toLocaleString('en-IL', { dateStyle: 'medium', timeStyle: 'short' })
        : 'TBD';
      return (
        <View style={[styles.actionCard, { borderLeftColor: C.primary }]}>
          <Text style={styles.actionCardTitle}>📅 Meeting Proposed</Text>
          <Text style={styles.actionCardBody}>{meta.title || 'Untitled Meeting'}</Text>
          <Text style={[styles.actionCardBody, { color: C.primary }]}>{scheduledAt}</Text>
          <Text style={[styles.actionCardBody, { color: C.textHint, fontSize: 12 }]}>
            {meta.locationType === 'virtual' ? '🎥 Virtual' : '📍 In Person'}
          </Text>
          <TouchableOpacity
            style={styles.viewDetailsBtn}
            onPress={() => navigation.navigate('MeetingDetail', {
              meeting: {
                id: meta.meetingId, match_id: match.matchId, title: meta.title,
                scheduled_at: meta.scheduledAt, location_type: meta.locationType,
                address: meta.address || null, video_link: meta.videoLink || null,
                status: meta.status || 'proposed',
                proposer_id: isOwn ? user?.id : match.userId,
                receiver_id: isOwn ? match.userId : user?.id,
                proposer_name: isOwn ? user?.name : match.name,
                receiver_name: isOwn ? match.name : user?.name,
              },
            })}
          >
            <Text style={styles.viewDetailsBtnText}>View Meeting</Text>
          </TouchableOpacity>
          <Text style={styles.actionCardTime}>{formatTime(item.created_at)}</Text>
        </View>
      );
    }

    if (type === 'meeting_response') {
      const label = meta.status === 'confirmed' ? 'Meeting Confirmed' : meta.status === 'declined' ? 'Meeting Declined' : 'Meeting Cancelled';
      const accent = meta.status === 'confirmed' ? C.success : C.error;
      return (
        <View style={[styles.actionCard, { borderLeftColor: accent }]}>
          <Text style={[styles.actionCardTitle, { color: accent }]}>📅 {label}</Text>
          <Text style={styles.actionCardTime}>{formatTime(item.created_at)}</Text>
        </View>
      );
    }

    return null;
  };

  const renderItem = ({ item, index }) => {
    const isOwn = item.sender_id === user?.id;
    const prevMsg = messages[index - 1];
    const showDivider = !prevMsg || (
      parseUTC(item.created_at).toDateString() !==
      parseUTC(prevMsg.created_at).toDateString()
    );

    const isSpecial = item.message_type && item.message_type !== 'text';

    if (item.message_type === 'moderation_blocked') {
      return (
        <View style={[styles.msgRow, styles.msgRowOwn]}>
          <View style={[styles.bubble, styles.bubbleBlocked]}>
            <Text style={styles.bubbleBlockedHeader}>⚠ Message not sent</Text>
            <Text style={styles.bubbleBlockedBody}>{item.body}</Text>
            <Text style={styles.bubbleBlockedReason}>{item.reason}</Text>
            <Text style={[styles.bubbleTime, { color: 'rgba(153,27,27,0.55)', textAlign: 'right' }]}>
              {formatTime(item.created_at)}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <>
        {showDivider && (
          <View style={styles.dateDivider}>
            <View style={styles.dateDividerLine} />
            <Text style={styles.dateDividerText}>
              {formatDateDivider(item.created_at)}
            </Text>
            <View style={styles.dateDividerLine} />
          </View>
        )}
        {isSpecial ? (
          <View style={styles.actionCardWrapper}>
            {renderSpecialMessage(item, isOwn)}
          </View>
        ) : (
          <View style={[
            styles.msgRow,
            isOwn ? styles.msgRowOwn : styles.msgRowTheir,
          ]}>
            {!isOwn && (
              <Avatar
                photoUrl={match.photoUrl}
                name={match.name}
                size={28}
                styles={styles}
              />
            )}
            <View style={[
              styles.bubble,
              isOwn ? styles.bubbleOwn : styles.bubbleTheir,
            ]}>
              <Text style={[
                styles.bubbleText,
                isOwn ? styles.bubbleTextOwn : styles.bubbleTextTheir,
              ]}>
                {item.body}
              </Text>
              <View style={styles.bubbleFooter}>
                <Text style={[
                  styles.bubbleTime,
                  isOwn ? styles.bubbleTimeOwn : styles.bubbleTimeTheir,
                ]}>
                  {formatTime(item.created_at)}
                </Text>
                {isOwn && (
                  <Text style={styles.readReceipt}>
                    {item.read_at && user?.is_premium ? '✓✓' : '✓'}
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}
      </>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerCenter}
          activeOpacity={0.75}
          onPress={() => navigation.navigate('ProfileDetail', {
            profile: {
              userId: match.userId,
              name: match.name,
              photoUrl: match.photoUrl,
              role: match.roleType,
            },
            matchId: match.matchId,
          })}
        >
          <Avatar photoUrl={match.photoUrl} name={match.name} size={38} styles={styles} />
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{match.name}</Text>
            <Text style={styles.headerStatus}>{formatLastSeen(lastActiveAt).toUpperCase()}</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerActionBtn}
          onPress={() => {
            const isPremium = !!(user?.is_premium && user?.premium_expires_at && new Date(user.premium_expires_at) > new Date());
            if (!isPremium) {
              showAlert('Premium Required', 'Meeting proposals are a Premium feature.', [
                { text: 'Not now', style: 'cancel' },
                { text: 'Upgrade', onPress: () => navigation.navigate('Premium') },
              ]);
              return;
            }
            navigation.navigate('ProposeMeeting', { matchId: match.matchId });
          }}
        >
          <Text style={styles.headerActionIcon}>📅</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={C.primary} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            extraData={messages}
            keyExtractor={item => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.msgList}
            onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <View style={styles.emptyChatIcon}>
                  <Text style={{ fontSize: 28 }}>👋</Text>
                </View>
                <Text style={styles.emptyChatTitle}>
                  You matched with {match.name}!
                </Text>
                <Text style={styles.emptyChatSub}>
                  Say hello and start the conversation
                </Text>
              </View>
            }
          />
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TouchableOpacity style={styles.plusBtn} onPress={openActionMenu} activeOpacity={0.75}>
            <Text style={styles.plusBtnText}>+</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Type a message..."
            placeholderTextColor={C.textHint}
            multiline
            maxLength={1000}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || sending}
            activeOpacity={0.85}
          >
            <Text style={styles.sendBtnText}>▶</Text>
          </TouchableOpacity>
        </View>

        {/* Action sheet modal */}
        <Modal visible={!!actionSheet} transparent animationType="slide" onRequestClose={closeActionSheet}>
          <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={closeActionSheet} />
          <View style={styles.sheetBox}>
            {actionSheet === 'menu' && (
              <>
                <Text style={styles.sheetTitle}>Chat Actions</Text>
                {user?.role === 'entrepreneur' && (
                  <TouchableOpacity style={styles.sheetItem} onPress={pickProjectToShare} activeOpacity={0.8}>
                    <Text style={styles.sheetItemIcon}>📁</Text>
                    <View>
                      <Text style={styles.sheetItemLabel}>Share Project Info</Text>
                      <Text style={styles.sheetItemSub}>Share one of your projects in this chat</Text>
                    </View>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.sheetCancel} onPress={closeActionSheet} activeOpacity={0.8}>
                  <Text style={styles.sheetCancelText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
            {actionSheet === 'pick-project' && (
              <>
                <Text style={styles.sheetTitle}>Pick a Project to Share</Text>
                {actionLoading ? (
                  <ActivityIndicator color={C.primary} style={{ marginVertical: 24 }} />
                ) : actionProjects.length === 0 ? (
                  <Text style={styles.sheetEmpty}>No projects found.</Text>
                ) : (
                  <FlatList
                    data={actionProjects}
                    keyExtractor={item => String(item.id)}
                    style={{ maxHeight: 300 }}
                    renderItem={({ item }) => (
                      <TouchableOpacity style={styles.sheetItem} onPress={() => handleShareProject(item)} activeOpacity={0.8}>
                        <Text style={styles.sheetItemIcon}>📁</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.sheetItemLabel}>{item.title}</Text>
                          {item.industry ? <Text style={styles.sheetItemSub}>{item.industry}</Text> : null}
                        </View>
                      </TouchableOpacity>
                    )}
                  />
                )}
                <TouchableOpacity style={styles.sheetCancel} onPress={closeActionSheet} activeOpacity={0.8}>
                  <Text style={styles.sheetCancelText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Modal>
      </KeyboardAvoidingView>

      {/* Project detail popup */}
      <Modal visible={!!detailProject} transparent animationType="fade" onRequestClose={() => setDetailProject(null)}>
        <View style={styles.detailBackdrop}>
          <View style={styles.detailBox}>
            <Text style={styles.detailTitle}>{detailProject?.title}</Text>

            {(detailProject?.stage || detailProject?.industry) ? (
              <Text style={styles.detailMeta}>
                {[detailProject?.stage, detailProject?.industry].filter(Boolean).join(' · ')}
              </Text>
            ) : null}

            {detailProject?.description ? (
              <Text style={styles.detailDesc}>{detailProject.description}</Text>
            ) : null}

            {detailProject?.fundingNeeded ? (
              <Text style={styles.detailFunding}>
                💰 Seeking ${Number(detailProject.fundingNeeded).toLocaleString()}
              </Text>
            ) : null}

            {(detailProject?.deckUrl || detailProject?.videoUrl) ? (
              <View style={styles.detailLinks}>
                {detailProject?.deckUrl ? (
                  <TouchableOpacity
                    style={styles.detailLinkBtn}
                    onPress={() => {
                      const token = useAuthStore.getState().token;
                      Linking.openURL(`${API_BASE_URL}/projects/${detailProject.projectId}/deck?token=${token}`);
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.detailLinkBtnText}>📄 View Pitch Deck</Text>
                  </TouchableOpacity>
                ) : null}
                {detailProject?.videoUrl ? (
                  <TouchableOpacity
                    style={styles.detailLinkBtn}
                    onPress={() => setVideoModal({ visible: true, url: toVideoUrl(detailProject.videoUrl) })}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.detailLinkBtnText}>🎬 Watch Demo Video</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            <TouchableOpacity
              style={styles.detailCloseBtn}
              onPress={() => setDetailProject(null)}
              activeOpacity={0.85}
            >
              <Text style={styles.detailCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Inline video player */}
      <Modal
        visible={videoModal.visible}
        animationType="slide"
        onRequestClose={() => setVideoModal({ visible: false, url: null })}
      >
        <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, backgroundColor: '#000' }}>
          <VideoView
            player={videoPlayer}
            style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}
            contentFit="contain"
            allowsFullscreen
            allowsPictureInPicture
            nativeControls
          />
          <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
            <TouchableOpacity
              onPress={() => setVideoModal({ visible: false, url: null })}
              style={{ padding: 16 }}
            >
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
  container: {
    flex: 1,
    backgroundColor: C.backgroundSoft,
  },
  flex: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.surfaceBorder,
    gap: 10,
    ...cardShadow,
    shadowOpacity: 0.03,
  },
  backBtn: { padding: 4 },
  backIcon: {
    fontSize: 24,
    color: C.primaryDark,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerInfo: { flex: 1 },
  headerName: {
    fontSize: 15,
    fontWeight: '700',
    color: C.primaryDark,
  },
  headerStatus: {
    fontSize: 10,
    fontWeight: '700',
    color: C.success,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 1,
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.backgroundSoft,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActionIcon: { fontSize: 16 },

  avatarPlaceholder: {
    backgroundColor: C.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontWeight: '800',
    color: '#fff',
  },

  // Messages
  msgList: {
    padding: 16,
    gap: 4,
    paddingBottom: 8,
  },

  dateDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    gap: 10,
  },
  dateDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.surfaceBorder,
  },
  dateDividerText: {
    fontSize: 10,
    fontWeight: '700',
    color: C.textHint,
    letterSpacing: 1,
  },

  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 7,
    marginVertical: 2,
  },
  msgRowOwn: { justifyContent: 'flex-end' },
  msgRowTheir: { justifyContent: 'flex-start' },

  bubble: {
    maxWidth: '72%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleOwn: {
    backgroundColor: C.primary,
    borderBottomRightRadius: 4,
  },
  bubbleTheir: {
    backgroundColor: C.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    ...cardShadow,
    shadowOpacity: 0.03,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleTextOwn: { color: '#fff' },
  bubbleTextTheir: { color: C.primaryDark },
  bubbleTime: {
    fontSize: 10,
    marginTop: 4,
  },
  bubbleTimeOwn: {
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'right',
  },
  bubbleTimeTheir: { color: C.textHint },
  bubbleFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  readReceipt: { fontSize: 10, color: 'rgba(255,255,255,0.55)' },

  // Empty state
  emptyChat: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyChatIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  emptyChatTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: C.primaryDark,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyChatSub: {
    fontSize: 13,
    color: C.textHint,
    textAlign: 'center',
    lineHeight: 19,
  },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.surfaceBorder,
  },
  input: {
    flex: 1,
    backgroundColor: C.backgroundSoft,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: C.primaryDark,
    maxHeight: 120,
    lineHeight: 20,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: C.surfaceBorder,
  },
  sendBtnText: {
    fontSize: 15,
    color: '#fff',
  },

  // "+" button
  plusBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.backgroundSoft,
    borderWidth: 1.5,
    borderColor: C.surfaceBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusBtnText: {
    fontSize: 22,
    color: C.primary,
    lineHeight: 26,
    fontWeight: '400',
  },

  // Action sheet
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,36,102,0.4)',
  },
  sheetBox: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: C.primaryDark,
    marginBottom: 16,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.backgroundSoft,
  },
  sheetItemIcon: { fontSize: 22 },
  sheetItemLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: C.primaryDark,
  },
  sheetItemSub: {
    fontSize: 12,
    color: C.textHint,
    marginTop: 2,
  },
  sheetCancel: {
    marginTop: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: C.backgroundSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  sheetCancelText: { color: C.textSecondary, fontWeight: '600', fontSize: 14 },
  sheetEmpty: {
    fontSize: 13,
    color: C.textHint,
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 24,
  },

  // project_shared card
  projectSharedCard: {
    borderColor: C.primary,
    borderWidth: 1.5,
  },
  projectSharedTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: C.primaryDark,
    marginBottom: 2,
  },
  projectSharedMeta: {
    fontSize: 12,
    color: C.textSecondary,
    textTransform: 'capitalize',
    marginBottom: 10,
  },
  viewDetailsBtn: {
    backgroundColor: C.primary,
    borderRadius: radius.pill,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  viewDetailsBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },

  // Project detail popup
  detailBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,36,102,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  detailBox: {
    backgroundColor: C.surface,
    borderRadius: radius.xl,
    padding: 24,
    width: '100%',
    maxWidth: 420,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: C.primaryDark,
    marginBottom: 4,
  },
  detailMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textSecondary,
    textTransform: 'capitalize',
    marginBottom: 12,
  },
  detailDesc: {
    fontSize: 14,
    color: C.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  detailFunding: {
    fontSize: 14,
    fontWeight: '600',
    color: C.primaryDark,
    marginBottom: 16,
  },
  detailLinks: {
    gap: 10,
    marginBottom: 20,
  },
  detailLinkBtn: {
    backgroundColor: C.backgroundSoft,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.primary,
  },
  detailLinkBtnText: {
    color: C.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  detailCloseBtn: {
    backgroundColor: C.primary,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  detailCloseBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },

  // Action cards (project shared, meetings)
  bubbleBlocked: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1.5,
    borderColor: '#FECACA',
    borderBottomRightRadius: 4,
    maxWidth: '82%',
  },
  bubbleBlockedHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  bubbleBlockedBody: {
    fontSize: 14,
    color: '#7F1D1D',
    lineHeight: 20,
    marginBottom: 4,
  },
  bubbleBlockedReason: {
    fontSize: 11,
    color: '#991B1B',
    fontStyle: 'italic',
    lineHeight: 16,
    marginBottom: 2,
  },

  actionCardWrapper: {
    alignItems: 'center',
    marginVertical: 6,
  },
  actionCard: {
    width: '85%',
    backgroundColor: C.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    padding: 16,
    ...cardShadow,
  },
  actionCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: C.primary,
    letterSpacing: 0.5,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  actionCardBody: {
    fontSize: 14,
    color: C.primaryDark,
    lineHeight: 20,
    marginBottom: 4,
  },
  actionCardTime: {
    fontSize: 10,
    color: C.textHint,
    marginTop: 8,
    textAlign: 'right',
  },
});
}
