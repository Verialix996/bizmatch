import { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, TouchableWithoutFeedback, KeyboardAvoidingView, Platform,
  ActivityIndicator, Image, StatusBar, Modal, Linking, Dimensions, Keyboard,
} from 'react-native';
import { showAlert } from '../../services/alert';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
import { VideoView, useVideoPlayer } from 'expo-video';
import { getMessages, sendMessage, markRead, respondToInvite, sendPartnerInvite, shareProject } from '../../services/match.service';
import api from '../../services/api';
import { getMyProjects } from '../../services/project.service';
import useAuthStore from '../../store/authStore';
import useAppStore from '../../store/appStore';
import { colors, investorColors, investorThemeColors, cardShadow, radius } from '../../theme';

// Project deck/video URLs come back as absolute Supabase Storage URLs already.
const toVideoUrl = url => url || null;

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

function Avatar({ photoUrl, name, size = 36, styles, C }) {
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
  try { return JSON.parse(str); } catch { return null; }
}

const ROLE_OPTIONS = ['Co-Founder', 'CEO', 'CTO', 'CFO', 'COO', 'CMO', 'VP', 'Director', 'Custom'];

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
  const [actionType, setActionType] = useState(null);   // 'invite' | 'share'
  const [actionProjects, setActionProjects] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);

  // Project detail popup
  const [detailProject, setDetailProject] = useState(null);

  // Role picker modal (for partner invite)
  const [rolePickerVisible, setRolePickerVisible] = useState(false);
  const [rolePendingProject, setRolePendingProject] = useState(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [customRole, setCustomRole] = useState('');
  const [roleEquity, setRoleEquity] = useState('');
  const [roleSalary, setRoleSalary] = useState('');
  const [roleSending, setRoleSending] = useState(false);

  // Counter-offer modal (partner invite negotiation)
  const [counterVisible, setCounterVisible] = useState(false);
  const [counterItem, setCounterItem] = useState(null);
  const [counterRole, setCounterRole] = useState('');
  const [counterEquity, setCounterEquity] = useState('');
  const [counterSalary, setCounterSalary] = useState('');
  const [counterSending, setCounterSending] = useState(false);

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

  const appendMessages = (...newMsgs) => {
    setMessages(prev => {
      const ids = new Set(prev.map(m => m.id));
      const toAdd = newMsgs.filter(m => m && !ids.has(m.id));
      return toAdd.length ? [...prev, ...toAdd] : prev;
    });
  };

  const handleAcceptInvite = async (item) => {
    const meta = tryParseJson(item.metadata);
    if (!meta) return;
    try {
      const res = await respondToInvite(match.matchId, meta.invitationId, true);
      const responseMsg = res.data.message;
      if (responseMsg) lastIdRef.current = responseMsg.id;
      appendMessages(responseMsg);
    } catch (e) {
      showAlert('Error', e.response?.data?.error || 'Could not accept invite.');
    }
  };

  const handleDeclineInvite = async (item) => {
    const meta = tryParseJson(item.metadata);
    if (!meta) return;
    try {
      const res = await respondToInvite(match.matchId, meta.invitationId, false);
      const responseMsg = res.data.message;
      if (responseMsg) lastIdRef.current = responseMsg.id;
      appendMessages(responseMsg);
    } catch (e) {
      showAlert('Error', e.response?.data?.error || 'Could not decline invite.');
    }
  };

  const openActionMenu = () => setActionSheet('menu');
  const closeActionSheet = () => { setActionSheet(null); setActionType(null); setActionProjects([]); };

  const pickProjectFor = async (type) => {
    setActionType(type);
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

  const handleActionPickProject = async (project) => {
    closeActionSheet();
    try {
      if (actionType === 'invite') {
        // Open role picker before sending
        setRolePendingProject(project);
        setSelectedRole('');
        setCustomRole('');
        setRoleEquity('');
        setRoleSalary('');
        setRolePickerVisible(true);
        return;
      } else if (actionType === 'share') {
        await shareProject(match.matchId, project.id);
        showAlert('Project Shared', `"${project.title}" details have been shared.`);
        await load();
      }
    } catch (e) {
      showAlert('Error', e.response?.data?.error || 'Action failed.');
    }
  };

  const handleSendInviteWithRole = async () => {
    Keyboard.dismiss();
    if (!rolePendingProject) return;
    const finalRole = selectedRole === 'Custom' ? customRole.trim() : selectedRole;
    setRoleSending(true);
    try {
      const roleData = {};
      if (finalRole) roleData.role_title = finalRole;
      if (roleEquity) roleData.equity_pct = Number(roleEquity);
      if (roleSalary) roleData.salary = Number(roleSalary);
      await sendPartnerInvite(match.matchId, rolePendingProject.id, roleData);
      setRolePickerVisible(false);
      showAlert('Invite Sent', `Partner invite sent for "${rolePendingProject.title}".`);
      await load();
    } catch (e) {
      showAlert('Error', e.response?.data?.error || 'Failed to send invite.');
    } finally {
      setRoleSending(false);
    }
  };

  const openCounterOffer = (item) => {
    const meta = tryParseJson(item.metadata) || {};
    setCounterItem(item);
    setCounterRole(meta.roleTitle || '');
    setCounterEquity(meta.equityPct != null ? String(meta.equityPct) : '');
    setCounterSalary(meta.salary != null ? String(meta.salary) : '');
    setCounterVisible(true);
  };

  const handleSendCounter = async () => {
    Keyboard.dismiss();
    if (!counterItem) return;
    const meta = tryParseJson(counterItem.metadata) || {};
    setCounterSending(true);
    try {
      const roleData = {};
      if (counterRole.trim()) roleData.role_title = counterRole.trim();
      if (counterEquity) roleData.equity_pct = Number(counterEquity);
      if (counterSalary) roleData.salary = Number(counterSalary);
      await sendPartnerInvite(match.matchId, meta.projectId, { ...roleData, counterOffer: true });
      setCounterVisible(false);
      await load();
    } catch (e) {
      showAlert('Error', e.response?.data?.error || 'Failed to send counter offer.');
    } finally {
      setCounterSending(false);
    }
  };

  const renderSpecialMessage = (item, isOwn) => {
    const meta = tryParseJson(item.metadata) || {};
    const type = item.message_type;

    if (type === 'partner_invite') {
      // Derive state from messages
      const alreadyResponded = messages.some(m => {
        if (m.message_type !== 'partner_invite_response') return false;
        const mm = tryParseJson(m.metadata) || {};
        if (mm.invitationId !== meta.invitationId) return false;
        // Only count responses that came after this invite message (ignores old rejections on re-invites)
        return new Date(m.created_at) >= new Date(item.created_at);
      });
      const isCounter = meta.counterOffer === true;
      return (
        <View style={styles.actionCard}>
          <Text style={styles.actionCardTitle}>{isCounter ? 'Counter Offer' : 'Partner Invite'}</Text>
          <Text style={styles.actionCardBody}>
            {isCounter ? 'Counter offer for' : 'Invited to join'}{'\n'}
            <Text style={styles.actionCardProject}>{meta.projectTitle || 'a project'}</Text>
          </Text>
          {(meta.roleTitle || meta.equityPct != null || meta.salary != null) && (
            <View style={styles.roleDetails}>
              {meta.roleTitle ? <Text style={styles.roleDetailText}>Role: {meta.roleTitle}</Text> : null}
              {meta.equityPct != null ? <Text style={styles.roleDetailText}>Equity: {meta.equityPct}%</Text> : null}
              {meta.salary != null ? <Text style={styles.roleDetailText}>Salary: ${meta.salary.toLocaleString()}/yr</Text> : null}
            </View>
          )}
          {!isOwn && !alreadyResponded && (
            <View style={styles.actionCardBtns}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnAccept]}
                onPress={() => handleAcceptInvite(item)}
                activeOpacity={0.85}
              >
                <Text style={styles.actionBtnAcceptText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnDecline]}
                onPress={() => handleDeclineInvite(item)}
                activeOpacity={0.85}
              >
                <Text style={styles.actionBtnDeclineText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnCounter]}
                onPress={() => openCounterOffer(item)}
                activeOpacity={0.85}
              >
                <Text style={styles.actionBtnCounterText}>Counter</Text>
              </TouchableOpacity>
            </View>
          )}
          {(isOwn || alreadyResponded) && (
            <Text style={styles.actionCardStatus}>
              {alreadyResponded ? 'Responded' : 'Awaiting response'}
            </Text>
          )}
          <Text style={styles.actionCardTime}>{formatTime(item.created_at)}</Text>
        </View>
      );
    }

    if (type === 'partner_invite_response') {
      const accepted = meta.accepted;
      return (
        <View style={[styles.actionCard, styles.actionCardResponse]}>
          <Text style={styles.actionCardTitle}>
            {accepted ? 'Invite Accepted' : 'Invite Declined'}
          </Text>
          <Text style={styles.actionCardBody}>
            {accepted
              ? 'Partner has joined the project.'
              : 'Partner declined the invitation.'}
          </Text>
          <Text style={styles.actionCardTime}>{formatTime(item.created_at)}</Text>
        </View>
      );
    }

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

    if (item.message_type === 'meeting_proposal') {
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

    if (item.message_type === 'meeting_response') {
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
                C={C}
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
          <Avatar photoUrl={match.photoUrl} name={match.name} size={38} styles={styles} C={C} />
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
                  <>
                    <TouchableOpacity style={styles.sheetItem} onPress={() => pickProjectFor('invite')} activeOpacity={0.8}>
                      <Text style={styles.sheetItemIcon}>🤝</Text>
                      <View>
                        <Text style={styles.sheetItemLabel}>Invite as Partner</Text>
                        <Text style={styles.sheetItemSub}>Send a partner invite for one of your projects</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.sheetItem} onPress={() => pickProjectFor('share')} activeOpacity={0.8}>
                      <Text style={styles.sheetItemIcon}>📁</Text>
                      <View>
                        <Text style={styles.sheetItemLabel}>Share Project Info</Text>
                        <Text style={styles.sheetItemSub}>Share one of your projects in this chat</Text>
                      </View>
                    </TouchableOpacity>
                  </>
                )}
                {user?.role === 'entrepreneur' && match.roleType === 'entrepreneur' && (
                  <TouchableOpacity
                    style={styles.sheetItem}
                    onPress={() => { closeActionSheet(); navigation.navigate('Projects', { screen: 'Projects', params: { startProject: true, coFounderMatchId: match.matchId, coFounderName: match.name } }); }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.sheetItemIcon}>💡</Text>
                    <View>
                      <Text style={styles.sheetItemLabel}>Start a Project Together</Text>
                      <Text style={styles.sheetItemSub}>Create a new project with {match.name} as co-founder</Text>
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
                <Text style={styles.sheetTitle}>
                  {actionType === 'invite' ? 'Pick a Project to Invite For' :
                   actionType === 'share'  ? 'Pick a Project to Share' :
                                             'Pick a Project'}
                </Text>
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
                      <TouchableOpacity style={styles.sheetItem} onPress={() => handleActionPickProject(item)} activeOpacity={0.8}>
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
                    onPress={() => Linking.openURL(detailProject.deckUrl)}
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

      {/* Role picker modal — shown after selecting a project for "invite" */}
      <Modal visible={rolePickerVisible} transparent animationType="fade" onRequestClose={() => setRolePickerVisible(false)}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.ndaOverlay}>
        <TouchableWithoutFeedback>
          <View style={styles.ndaModal}>
            <Text style={styles.ndaModalTitle}>Define the Role</Text>
            <Text style={styles.ndaModalSub}>Optionally set role details for your partner invite</Text>
            <Text style={[styles.ndaModalSub, { marginTop: 12, marginBottom: 6, fontWeight: '700', color: C.textPrimary }]}>Role</Text>
            <View style={styles.roleChipRow}>
              {ROLE_OPTIONS.map(r => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleChip, selectedRole === r && styles.roleChipSelected]}
                  onPress={() => setSelectedRole(selectedRole === r ? '' : r)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.roleChipText, selectedRole === r && styles.roleChipTextSelected]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {selectedRole === 'Custom' && (
              <TextInput
                style={styles.ndaInput}
                placeholder="Enter custom role title"
                placeholderTextColor={C.textHint}
                value={customRole}
                onChangeText={setCustomRole}
                maxLength={80}
              />
            )}
            <Text style={[styles.ndaModalSub, { marginTop: 12, marginBottom: 6, fontWeight: '700', color: C.textPrimary }]}>Equity %</Text>
            <TextInput
              style={styles.ndaInput}
              placeholder="e.g. 10"
              placeholderTextColor={C.textHint}
              value={roleEquity}
              onChangeText={setRoleEquity}
              keyboardType="decimal-pad"
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={Keyboard.dismiss}
              maxLength={6}
            />
            <Text style={[styles.ndaModalSub, { marginTop: 12, marginBottom: 6, fontWeight: '700', color: C.textPrimary }]}>Salary ($/yr, optional)</Text>
            <TextInput
              style={styles.ndaInput}
              placeholder="e.g. 80000"
              placeholderTextColor={C.textHint}
              value={roleSalary}
              onChangeText={setRoleSalary}
              keyboardType="number-pad"
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={Keyboard.dismiss}
              maxLength={10}
            />
            <View style={[styles.ndaModalActions, { marginTop: 20 }]}>
              <TouchableOpacity style={styles.ndaCancelBtn} onPress={() => setRolePickerVisible(false)} activeOpacity={0.8}>
                <Text style={styles.ndaCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.ndaSignBtn, roleSending && { opacity: 0.6 }]}
                onPress={handleSendInviteWithRole}
                disabled={roleSending}
                activeOpacity={0.85}
              >
                <Text style={styles.ndaSignBtnText}>{roleSending ? 'Sending…' : 'Send Invite'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Counter-offer modal */}
      <Modal visible={counterVisible} transparent animationType="fade" onRequestClose={() => setCounterVisible(false)}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.ndaOverlay}>
        <TouchableWithoutFeedback>
          <View style={styles.ndaModal}>
            <Text style={styles.ndaModalTitle}>Counter Offer</Text>
            <Text style={styles.ndaModalSub}>Edit the terms and send a counter proposal</Text>
            <Text style={[styles.ndaModalSub, { marginTop: 12, marginBottom: 6, fontWeight: '700', color: C.textPrimary }]}>Role Title</Text>
            <TextInput
              style={styles.ndaInput}
              placeholder="e.g. CTO"
              placeholderTextColor={C.textHint}
              value={counterRole}
              onChangeText={setCounterRole}
              maxLength={80}
            />
            <Text style={[styles.ndaModalSub, { marginTop: 12, marginBottom: 6, fontWeight: '700', color: C.textPrimary }]}>Equity %</Text>
            <TextInput
              style={styles.ndaInput}
              placeholder="e.g. 15"
              placeholderTextColor={C.textHint}
              value={counterEquity}
              onChangeText={setCounterEquity}
              keyboardType="decimal-pad"
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={Keyboard.dismiss}
              maxLength={6}
            />
            <Text style={[styles.ndaModalSub, { marginTop: 12, marginBottom: 6, fontWeight: '700', color: C.textPrimary }]}>Salary ($/yr, optional)</Text>
            <TextInput
              style={styles.ndaInput}
              placeholder="e.g. 90000"
              placeholderTextColor={C.textHint}
              value={counterSalary}
              onChangeText={setCounterSalary}
              keyboardType="number-pad"
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={Keyboard.dismiss}
              maxLength={10}
            />
            <View style={[styles.ndaModalActions, { marginTop: 20 }]}>
              <TouchableOpacity style={styles.ndaCancelBtn} onPress={() => setCounterVisible(false)} activeOpacity={0.8}>
                <Text style={styles.ndaCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.ndaSignBtn, counterSending && { opacity: 0.6 }]}
                onPress={handleSendCounter}
                disabled={counterSending}
                activeOpacity={0.85}
              >
                <Text style={styles.ndaSignBtnText}>{counterSending ? 'Sending…' : 'Send Counter'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
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

  // Action cards (partner invite, NDA)
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
  actionCardResponse: {
    borderColor: C.success || '#38a169',
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
  actionCardProject: {
    fontWeight: '700',
    color: C.primaryDark,
  },
  actionCardNote: {
    fontSize: 12,
    color: C.textHint,
    marginTop: 4,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  actionCardStatus: {
    fontSize: 12,
    color: C.textHint,
    marginTop: 10,
    fontStyle: 'italic',
  },
  ndaViewLink: {
    fontSize: 13,
    color: C.primary,
    marginTop: 6,
    textDecorationLine: 'underline',
  },
  ndaInlineTerms: {
    backgroundColor: C.surface,
    borderRadius: 8,
    padding: 10,
    gap: 6,
    marginTop: 6,
  },
  ndaInlineTerm: {
    fontSize: 12,
    color: C.textSecondary,
    lineHeight: 18,
  },
  actionCardTime: {
    fontSize: 10,
    color: C.textHint,
    marginTop: 8,
    textAlign: 'right',
  },
  actionCardBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  actionBtn: {
    flex: 1,
    borderRadius: radius.pill,
    paddingVertical: 10,
    alignItems: 'center',
  },
  actionBtnAccept: {
    backgroundColor: C.primary,
  },
  actionBtnAcceptText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  actionBtnDecline: {
    backgroundColor: C.backgroundSoft,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  actionBtnDeclineText: {
    color: C.textSecondary,
    fontWeight: '700',
    fontSize: 13,
  },
  actionBtnCounter: {
    backgroundColor: '#FFF8E7',
    borderWidth: 1,
    borderColor: '#E8D5A3',
  },
  actionBtnCounterText: {
    color: '#C4A84C',
    fontWeight: '700',
    fontSize: 13,
  },
  roleDetails: {
    backgroundColor: C.backgroundSoft,
    borderRadius: radius.sm,
    padding: 8,
    marginTop: 8,
    gap: 3,
  },
  roleDetailText: {
    fontSize: 12,
    color: C.textSecondary,
    fontWeight: '600',
  },
  roleChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  roleChip: {
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: C.backgroundSoft,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  roleChipSelected: {
    backgroundColor: C.primary,
    borderColor: C.primary,
  },
  roleChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textSecondary,
  },
  roleChipTextSelected: {
    color: '#fff',
  },
  ndaInput: {
    backgroundColor: C.backgroundSoft,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: C.textPrimary,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    marginBottom: 4,
  },

  // NDA preview modal
  ndaOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2,36,102,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  ndaModal: {
    backgroundColor: C.surface,
    borderRadius: radius.xl,
    padding: 24,
    width: '100%',
    maxWidth: 420,
  },
  ndaModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: C.primaryDark,
    textAlign: 'center',
    marginBottom: 4,
  },
  ndaModalSub: {
    fontSize: 13,
    color: C.textHint,
    textAlign: 'center',
    marginBottom: 20,
  },
  ndaClauseList: { gap: 14, marginBottom: 24 },
  ndaClause: {
    backgroundColor: C.backgroundSoft,
    borderRadius: radius.md,
    padding: 12,
  },
  ndaClauseTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.primaryDark,
    marginBottom: 4,
  },
  ndaClauseBody: {
    fontSize: 12,
    color: C.textSecondary,
    lineHeight: 18,
  },
  ndaModalActions: { flexDirection: 'row', gap: 12 },
  ndaCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ndaCancelBtnText: { color: C.textSecondary, fontWeight: '600', fontSize: 14 },
  ndaSignBtn: {
    flex: 1,
    backgroundColor: C.primary,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ndaSignBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  jobInput: {
    backgroundColor: C.backgroundSoft,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: C.textPrimary,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
});
}