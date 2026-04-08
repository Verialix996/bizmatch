import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, ScrollView,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  SafeAreaView, ActivityIndicator, Image, Modal, Alert,
} from 'react-native';
import { getMessages, sendMessage } from '../../services/match.service';
import { getMyProjects, invitePartner, signNda, respondInvitation } from '../../services/project.service';
import useAuthStore from '../../store/authStore';
import { colors } from '../../theme';

const NDA_TEXT = `NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into between the Project Owner ("Disclosing Party") and the undersigned user ("Receiving Party") on the date of electronic acceptance.

1. CONFIDENTIAL INFORMATION
The Receiving Party agrees that all information shared regarding the project, including but not limited to business plans, financial data, technology, trade secrets, and any other non-public information ("Confidential Information"), shall be kept strictly confidential.

2. OBLIGATIONS
The Receiving Party agrees to:
(a) Keep all Confidential Information strictly confidential.
(b) Not disclose Confidential Information to any third party without prior written consent.
(c) Use Confidential Information solely for evaluating a potential partnership.
(d) Not reproduce or copy any Confidential Information except as required.

3. TERM
This Agreement remains in effect for two (2) years from the date of acceptance.

4. EXCEPTIONS
These obligations do not apply to information that is publicly known, independently developed, or required to be disclosed by law.

5. REMEDIES
The Receiving Party acknowledges that breach of this Agreement may cause irreparable harm, and the Disclosing Party shall be entitled to seek equitable relief in addition to all other remedies available.

By tapping "I Agree & Sign NDA", you acknowledge that you have read, understood, and agree to be bound by this Agreement.`;

// SQLite datetime('now') returns UTC without 'Z' — append it so JS parses correctly.
function parseUTC(dateStr) {
  if (!dateStr) return new Date(NaN);
  return new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  return parseUTC(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateDivider(dateStr) {
  if (!dateStr) return '';
  return parseUTC(dateStr).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();
}

function Avatar({ photoUrl, name, size = 36 }) {
  const initials = name ? name[0].toUpperCase() : '?';
  if (photoUrl) {
    return <Image source={{ uri: photoUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarInitial, { fontSize: size * 0.4 }]}>{initials}</Text>
    </View>
  );
}

export default function ChatScreen({ route, navigation }) {
  const { match } = route.params;
  const user = useAuthStore(s => s.user);

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  // Partner invite modal (entrepreneur picks a project to invite match to)
  const [inviteModal, setInviteModal] = useState(false);
  const [myProjects, setMyProjects] = useState([]);

  // NDA modal (shown before accepting a partner invitation)
  const [ndaModal, setNdaModal] = useState(null); // { projectId, invitationId }
  const [signingNda, setSigningNda] = useState(false);

  // Track local responses so invite cards update immediately
  const [respondedInvitations, setRespondedInvitations] = useState({});

  const listRef = useRef(null);
  const lastMsgIdRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await getMessages(match.matchId);
      const msgs = res.data;
      setMessages(msgs);
      if (msgs.length > 0) lastMsgIdRef.current = msgs[msgs.length - 1].id;
    } catch (e) {
      console.error('Failed to load messages', e);
    } finally {
      setLoading(false);
    }
  }, [match.matchId]);

  // Initial load + real-time polling every 3 seconds
  useEffect(() => {
    load();

    const interval = setInterval(async () => {
      try {
        const res = await getMessages(match.matchId);
        const msgs = res.data;
        if (msgs.length > 0) {
          const lastId = msgs[msgs.length - 1].id;
          if (lastId !== lastMsgIdRef.current) {
            lastMsgIdRef.current = lastId;
            setMessages(msgs);
            setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
          }
        }
      } catch {}
    }, 3000);

    return () => clearInterval(interval);
  }, [match.matchId, load]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);
    try {
      const res = await sendMessage(match.matchId, text);
      setMessages(prev => [...prev, res.data]);
      lastMsgIdRef.current = res.data.id;
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      console.error('Send failed', e);
    } finally {
      setSending(false);
    }
  };

  // ── Partner invite flow ───────────────────────────────────────────────────

  const handleOpenInvite = async () => {
    try {
      const res = await getMyProjects();
      setMyProjects(res.data || []);
      setInviteModal(true);
    } catch {
      Alert.alert('Error', 'Could not load your projects.');
    }
  };

  const handleSendInvite = async (projectId) => {
    try {
      await invitePartner(projectId, match.matchId, match.userId);
      setInviteModal(false);
      // Refresh so the invite message appears
      const res = await getMessages(match.matchId);
      setMessages(res.data);
      if (res.data.length > 0) lastMsgIdRef.current = res.data[res.data.length - 1].id;
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.error || 'Could not send invitation.');
    }
  };

  const handleAcceptPress = (projectId, invitationId) => {
    setNdaModal({ projectId, invitationId });
  };

  const handleDeclinePress = async (invitationId) => {
    try {
      await respondInvitation(invitationId, false);
      setRespondedInvitations(prev => ({ ...prev, [invitationId]: 'declined' }));
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.error || 'Could not decline invitation.');
    }
  };

  const handleSignAndAccept = async () => {
    const { projectId, invitationId } = ndaModal;
    setSigningNda(true);
    try {
      await signNda(projectId);
      await respondInvitation(invitationId, true);
      setRespondedInvitations(prev => ({ ...prev, [invitationId]: 'accepted' }));
      setNdaModal(null);
      Alert.alert('Welcome aboard!', 'You are now a partner on this project.');
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.error || 'Could not complete the process.');
    } finally {
      setSigningNda(false);
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderPartnerInvite = (item, isOwn) => {
    const meta = item.metadata || {};
    const localStatus = respondedInvitations[meta.invitationId];
    const showButtons = !isOwn && !localStatus;

    return (
      <View style={styles.inviteCard}>
        <Text style={styles.inviteCardHeader}>🤝 Partner Invitation</Text>
        <Text style={styles.inviteCardProject}>{meta.projectTitle}</Text>
        {isOwn && (
          <Text style={styles.inviteCardSent}>Invitation sent</Text>
        )}
        {!isOwn && localStatus === 'accepted' && (
          <Text style={styles.inviteCardAccepted}>Accepted ✓</Text>
        )}
        {!isOwn && localStatus === 'declined' && (
          <Text style={styles.inviteCardDeclined}>Declined</Text>
        )}
        {showButtons && (
          <View style={styles.inviteCardBtns}>
            <TouchableOpacity
              style={styles.inviteDeclineBtn}
              onPress={() => handleDeclinePress(meta.invitationId)}
            >
              <Text style={styles.inviteDeclineBtnText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.inviteAcceptBtn}
              onPress={() => handleAcceptPress(meta.projectId, meta.invitationId)}
            >
              <Text style={styles.inviteAcceptBtnText}>Accept & Sign NDA</Text>
            </TouchableOpacity>
          </View>
        )}
        <Text style={styles.inviteCardTime}>{formatTime(item.created_at)}</Text>
      </View>
    );
  };

  const renderItem = ({ item, index }) => {
    const isOwn = item.sender_id === user?.id;
    const prevMsg = messages[index - 1];
    const showDivider = !prevMsg || (
      parseUTC(item.created_at).toDateString() !== parseUTC(prevMsg.created_at).toDateString()
    );

    return (
      <>
        {showDivider && (
          <View style={styles.dateDivider}>
            <Text style={styles.dateDividerText}>{formatDateDivider(item.created_at)}</Text>
          </View>
        )}
        {item.message_type === 'partner_invite' ? (
          renderPartnerInvite(item, isOwn)
        ) : (
          <View style={[styles.msgRow, isOwn ? styles.msgRowOwn : styles.msgRowTheir]}>
            {!isOwn && (
              <Avatar photoUrl={match.photoUrl} name={match.name} size={32} />
            )}
            <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleTheir]}>
              <Text style={[styles.bubbleText, isOwn ? styles.bubbleTextOwn : styles.bubbleTextTheir]}>
                {item.body}
              </Text>
              <Text style={[styles.bubbleTime, isOwn ? styles.bubbleTimeOwn : styles.bubbleTimeTheir]}>
                {formatTime(item.created_at)}
              </Text>
            </View>
          </View>
        )}
      </>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Avatar photoUrl={match.photoUrl} name={match.name} size={38} />
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{match.name}</Text>
            <Text style={styles.headerStatus}>ACTIVE NOW</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          {user?.role === 'entrepreneur' && (
            <TouchableOpacity style={styles.headerAction} onPress={handleOpenInvite}>
              <Text style={styles.headerActionIcon}>🤝</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.headerAction}>
            <Text style={styles.headerActionIcon}>📹</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={item => String(item.id)}
            renderItem={renderItem}
            contentContainerStyle={styles.msgList}
            onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Text style={styles.emptyChatText}>You matched! Say hello 👋</Text>
              </View>
            }
          />
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Type a professional response..."
            placeholderTextColor={colors.onSurfaceVariant}
            multiline
            maxLength={1000}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || sending}
          >
            <Text style={styles.sendBtnText}>▶</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Partner invite project picker */}
      <Modal transparent visible={inviteModal} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Invite as Partner</Text>
            <Text style={styles.modalSub}>Select a project to invite {match.name} to join</Text>
            {myProjects.length === 0 ? (
              <Text style={styles.emptyText}>No active projects. Create one first!</Text>
            ) : (
              <FlatList
                data={myProjects}
                keyExtractor={item => String(item.id)}
                style={{ maxHeight: 300, width: '100%' }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.projectPickerItem}
                    onPress={() => handleSendInvite(item.id)}
                  >
                    <Text style={styles.projectPickerTitle}>{item.title}</Text>
                    {item.stage ? (
                      <Text style={styles.projectPickerStage}>{item.stage}</Text>
                    ) : null}
                  </TouchableOpacity>
                )}
              />
            )}
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setInviteModal(false)}>
              <Text style={styles.modalCancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* NDA modal */}
      <Modal transparent visible={!!ndaModal} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.ndaBox}>
            <Text style={styles.modalTitle}>Non-Disclosure Agreement</Text>
            <Text style={styles.modalSub}>Read and sign before accepting the partnership</Text>
            <ScrollView style={styles.ndaScroll} showsVerticalScrollIndicator>
              <Text style={styles.ndaText}>{NDA_TEXT}</Text>
            </ScrollView>
            <TouchableOpacity
              style={[styles.ndaAgreeBtn, signingNda && styles.ndaAgreeBtnDisabled]}
              onPress={handleSignAndAccept}
              disabled={signingNda}
            >
              <Text style={styles.ndaAgreeBtnText}>
                {signingNda ? 'Signing...' : 'I Agree & Sign NDA'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setNdaModal(null)}
              disabled={signingNda}
            >
              <Text style={styles.modalCancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: colors.surfaceContainerLowest,
    borderBottomWidth: 1, borderBottomColor: colors.surfaceContainerLow,
    gap: 12,
  },
  backBtn: { padding: 4 },
  backIcon: { fontSize: 22, color: colors.onSurface },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerInfo: {},
  headerName: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  headerStatus: {
    fontSize: 10, fontWeight: '700', color: '#2ea071',
    letterSpacing: 0.8, textTransform: 'uppercase',
  },
  headerActions: { flexDirection: 'row', gap: 4 },
  headerAction: { padding: 4 },
  headerActionIcon: { fontSize: 20 },

  avatarPlaceholder: {
    backgroundColor: colors.primaryContainer,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarInitial: { fontWeight: '700', color: '#fff' },

  msgList: { padding: 16, gap: 4 },

  dateDivider: { alignItems: 'center', marginVertical: 16 },
  dateDividerText: {
    fontSize: 10, fontWeight: '700', color: colors.onSurfaceVariant,
    letterSpacing: 1, textTransform: 'uppercase',
  },

  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginVertical: 2 },
  msgRowOwn: { justifyContent: 'flex-end' },
  msgRowTheir: { justifyContent: 'flex-start' },

  bubble: { maxWidth: '72%', borderRadius: 16, padding: 12 },
  bubbleOwn: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleTheir: {
    backgroundColor: colors.surfaceContainerLowest,
    borderBottomLeftRadius: 4,
    shadowColor: '#131b2e', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTextOwn: { color: '#fff' },
  bubbleTextTheir: { color: colors.onSurface },
  bubbleTime: { fontSize: 10, marginTop: 4 },
  bubbleTimeOwn: { color: 'rgba(255,255,255,0.6)', textAlign: 'right' },
  bubbleTimeTheir: { color: colors.onSurfaceVariant },

  // Partner invite card
  inviteCard: {
    alignSelf: 'center',
    width: '85%',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 16, padding: 16, marginVertical: 8,
    borderWidth: 1.5, borderColor: colors.primary + '33',
    shadowColor: '#131b2e', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  inviteCardHeader: {
    fontSize: 13, fontWeight: '700', color: colors.primary, marginBottom: 6,
  },
  inviteCardProject: {
    fontSize: 15, fontWeight: '800', color: colors.onSurface, marginBottom: 12,
  },
  inviteCardSent: { fontSize: 12, color: colors.onSurfaceVariant, fontStyle: 'italic', marginBottom: 8 },
  inviteCardAccepted: { fontSize: 13, fontWeight: '700', color: '#2ea071', marginBottom: 8 },
  inviteCardDeclined: { fontSize: 13, fontWeight: '700', color: colors.error, marginBottom: 8 },
  inviteCardBtns: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  inviteDeclineBtn: {
    flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.outlineVariant,
  },
  inviteDeclineBtnText: { fontSize: 13, fontWeight: '600', color: colors.onSurfaceVariant },
  inviteAcceptBtn: {
    flex: 2, backgroundColor: colors.primary, borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  inviteAcceptBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  inviteCardTime: { fontSize: 10, color: colors.onSurfaceVariant, textAlign: 'right' },

  emptyChat: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyChatText: { color: colors.onSurfaceVariant, fontSize: 14 },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: colors.surfaceContainerLowest,
    borderTopWidth: 1, borderTopColor: colors.surfaceContainerLow,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, color: colors.onSurface,
    maxHeight: 120, lineHeight: 20,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.outlineVariant },
  sendBtnText: { fontSize: 16, color: '#fff' },

  // Shared modal styles
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(7,0,73,0.5)', justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: colors.surfaceContainerLowest,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  ndaBox: {
    backgroundColor: colors.surfaceContainerLowest,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
    maxHeight: '85%',
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.onSurface, marginBottom: 4 },
  modalSub: { fontSize: 13, color: colors.onSurfaceVariant, marginBottom: 16 },
  emptyText: { fontSize: 13, color: colors.onSurfaceVariant, fontStyle: 'italic', marginBottom: 16 },

  projectPickerItem: {
    paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.outlineVariant,
  },
  projectPickerTitle: { fontSize: 15, fontWeight: '600', color: colors.onSurface },
  projectPickerStage: {
    fontSize: 12, color: colors.onSurfaceVariant,
    marginTop: 2, textTransform: 'capitalize',
  },

  ndaScroll: {
    maxHeight: 300,
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 12, padding: 14, marginBottom: 16,
  },
  ndaText: { fontSize: 12, color: colors.onSurfaceVariant, lineHeight: 18 },
  ndaAgreeBtn: {
    backgroundColor: colors.primary, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginBottom: 10,
  },
  ndaAgreeBtnDisabled: { backgroundColor: colors.outlineVariant },
  ndaAgreeBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  modalCancelBtn: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  modalCancelBtnText: { color: colors.onSurfaceVariant, fontWeight: '600', fontSize: 15 },
});
