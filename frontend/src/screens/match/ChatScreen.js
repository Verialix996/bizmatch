import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  SafeAreaView, ActivityIndicator, Image, StatusBar, Alert,
} from 'react-native';
import { getMessages, sendMessage, respondToInvite, signNda, sendPartnerInvite, requestNda } from '../../services/match.service';
import { getMyProjects, getProjectsByOwner } from '../../services/project.service';
import useAuthStore from '../../store/authStore';
import { colors, cardShadow, radius } from '../../theme';

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

function Avatar({ photoUrl, name, size = 36 }) {
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

export default function ChatScreen({ route, navigation }) {
  const { match } = route.params;
  const user = useAuthStore(s => s.user);
  const markMatchRead = useAuthStore(s => s.markMatchRead);

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const lastIdRef = useRef(null);

  // "+" action sheet state
  const [actionSheet, setActionSheet] = useState(null); // null | 'menu' | 'pick-project'
  const [actionType, setActionType] = useState(null);   // 'invite' | 'share' | 'nda'
  const [actionProjects, setActionProjects] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getMessages(match.matchId);
      setMessages(res.data);
      if (res.data.length > 0) {
        lastIdRef.current = res.data[res.data.length - 1].id;
      }
    } catch (e) {
      console.error('Failed to load messages', e);
    } finally {
      setLoading(false);
    }
  }, [match.matchId]);

  const poll = useCallback(async () => {
    try {
      const res = await getMessages(match.matchId, lastIdRef.current);
      if (res.data.length > 0) {
        lastIdRef.current = res.data[res.data.length - 1].id;
        setMessages(prev => {
          const ids = new Set(prev.map(m => m.id));
          return [...prev, ...res.data.filter(m => !ids.has(m.id))];
        });
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      }
    } catch (e) {
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
      console.error('Send failed', e);
    } finally {
      setSending(false);
    }
  };

  const handleSignNdaAndAccept = async (item) => {
    const meta = tryParseJson(item.metadata);
    if (!meta) return;
    try {
      // Sign the NDA first, then accept the partner invite
      await signNda(match.matchId, meta.projectId);
      const res = await respondToInvite(match.matchId, meta.invitationId, true);
      lastIdRef.current = res.data.message?.id ?? lastIdRef.current;
      setMessages(prev => {
        // Replace invite card with the response + add new message
        const updated = prev.map(m =>
          m.id === item.id ? { ...m, _responded: true } : m
        );
        const newMsg = res.data.message;
        if (newMsg) {
          const ids = new Set(updated.map(m => m.id));
          return ids.has(newMsg.id) ? updated : [...updated, newMsg];
        }
        return updated;
      });
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Could not accept invite.');
    }
  };

  const handleDeclineInvite = async (item) => {
    const meta = tryParseJson(item.metadata);
    if (!meta) return;
    try {
      const res = await respondToInvite(match.matchId, meta.invitationId, false);
      setMessages(prev => {
        const updated = prev.map(m =>
          m.id === item.id ? { ...m, _responded: true } : m
        );
        const newMsg = res.data.message;
        if (newMsg) {
          const ids = new Set(updated.map(m => m.id));
          return ids.has(newMsg.id) ? updated : [...updated, newMsg];
        }
        return updated;
      });
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Could not decline invite.');
    }
  };

  const handleSignNda = async (item) => {
    const meta = tryParseJson(item.metadata);
    if (!meta) return;
    try {
      const res = await signNda(match.matchId, meta.projectId);
      lastIdRef.current = res.data.id ?? lastIdRef.current;
      setMessages(prev => {
        const updated = prev.map(m =>
          m.id === item.id ? { ...m, _signed: true } : m
        );
        const ids = new Set(updated.map(m => m.id));
        return ids.has(res.data.id) ? updated : [...updated, res.data];
      });
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Could not sign NDA.');
    }
  };

  const openActionMenu = () => setActionSheet('menu');
  const closeActionSheet = () => { setActionSheet(null); setActionType(null); setActionProjects([]); };

  const pickProjectFor = async (type) => {
    setActionType(type);
    setActionLoading(true);
    setActionSheet('pick-project');
    try {
      let projects;
      if (type === 'nda') {
        // Investor requests NDA → pick from match's (entrepreneur's) projects
        const res = await getProjectsByOwner(match.userId);
        projects = res.data;
      } else {
        // Entrepreneur: invite or share → pick from own projects
        const res = await getMyProjects();
        projects = res.data;
      }
      setActionProjects(projects);
    } catch {
      Alert.alert('Error', 'Could not load projects.');
      closeActionSheet();
    } finally {
      setActionLoading(false);
    }
  };

  const handleActionPickProject = async (project) => {
    closeActionSheet();
    try {
      if (actionType === 'invite') {
        await sendPartnerInvite(match.matchId, project.id);
        Alert.alert('Invite Sent', `Partner invite sent for "${project.title}". They must sign the NDA and accept to join.`);
        await load(); // refresh messages
      } else if (actionType === 'share') {
        const parts = [`📁 *${project.title}*`];
        if (project.description) parts.push(project.description);
        if (project.industry)    parts.push(`Industry: ${project.industry}`);
        if (project.deck_url)    parts.push(`📄 Deck: ${project.deck_url}`);
        if (project.video_url)   parts.push(`🎬 Video: ${project.video_url}`);
        const text = parts.join('\n');
        const res = await sendMessage(match.matchId, text);
        lastIdRef.current = res.data.id;
        setMessages(prev => {
          const ids = new Set(prev.map(m => m.id));
          return ids.has(res.data.id) ? prev : [...prev, res.data];
        });
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      } else if (actionType === 'nda') {
        await requestNda(match.matchId, project.id);
        Alert.alert('NDA Requested', `NDA request sent for "${project.title}".`);
        await load();
      }
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Action failed.');
    }
  };

  const renderSpecialMessage = (item, isOwn) => {
    const meta = tryParseJson(item.metadata) || {};
    const type = item.message_type;

    if (type === 'partner_invite') {
      const alreadyResponded = item._responded;
      return (
        <View style={styles.actionCard}>
          <Text style={styles.actionCardTitle}>Partner Invite</Text>
          <Text style={styles.actionCardBody}>
            Invited to join{'\n'}
            <Text style={styles.actionCardProject}>{meta.projectTitle || 'a project'}</Text>
          </Text>
          <Text style={styles.actionCardNote}>
            Signing the NDA is required before accepting.
          </Text>
          {!isOwn && !alreadyResponded && (
            <View style={styles.actionCardBtns}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnAccept]}
                onPress={() => handleSignNdaAndAccept(item)}
                activeOpacity={0.85}
              >
                <Text style={styles.actionBtnAcceptText}>Sign NDA & Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnDecline]}
                onPress={() => handleDeclineInvite(item)}
                activeOpacity={0.85}
              >
                <Text style={styles.actionBtnDeclineText}>Decline</Text>
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

    if (type === 'nda_request') {
      const alreadySigned = item._signed;
      return (
        <View style={styles.actionCard}>
          <Text style={styles.actionCardTitle}>NDA Requested</Text>
          <Text style={styles.actionCardBody}>
            Access requested for{'\n'}
            <Text style={styles.actionCardProject}>{meta.projectTitle || 'a project'}</Text>
          </Text>
          {!isOwn && !alreadySigned && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnAccept, { marginTop: 10 }]}
              onPress={() => handleSignNda(item)}
              activeOpacity={0.85}
            >
              <Text style={styles.actionBtnAcceptText}>Sign NDA</Text>
            </TouchableOpacity>
          )}
          {(isOwn || alreadySigned) && (
            <Text style={styles.actionCardStatus}>
              {alreadySigned ? 'NDA signed' : 'Awaiting signature'}
            </Text>
          )}
          <Text style={styles.actionCardTime}>{formatTime(item.created_at)}</Text>
        </View>
      );
    }

    if (type === 'nda_signed') {
      return (
        <View style={[styles.actionCard, styles.actionCardResponse]}>
          <Text style={styles.actionCardTitle}>NDA Signed</Text>
          <Text style={styles.actionCardBody}>Full project details are now accessible.</Text>
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
              <Text style={[
                styles.bubbleTime,
                isOwn ? styles.bubbleTimeOwn : styles.bubbleTimeTheir,
              ]}>
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
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Avatar photoUrl={match.photoUrl} name={match.name} size={38} />
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{match.name}</Text>
            <Text style={styles.headerStatus}>ACTIVE NOW</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.headerActionBtn}>
          <Text style={styles.headerActionIcon}>📹</Text>
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
            placeholderTextColor={colors.textHint}
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
                        <Text style={styles.sheetItemSub}>Send your project details, deck or video link</Text>
                      </View>
                    </TouchableOpacity>
                  </>
                )}
                {match.role === 'entrepreneur' && (
                  <TouchableOpacity style={styles.sheetItem} onPress={() => pickProjectFor('nda')} activeOpacity={0.8}>
                    <Text style={styles.sheetItemIcon}>📄</Text>
                    <View>
                      <Text style={styles.sheetItemLabel}>Request NDA</Text>
                      <Text style={styles.sheetItemSub}>Request access to their project details</Text>
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
                  <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSoft,
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
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
    gap: 10,
    ...cardShadow,
    shadowOpacity: 0.03,
  },
  backBtn: { padding: 4 },
  backIcon: {
    fontSize: 24,
    color: colors.primaryDark,
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
    color: colors.primaryDark,
  },
  headerStatus: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.success,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 1,
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActionIcon: { fontSize: 16 },

  avatarPlaceholder: {
    backgroundColor: colors.primary,
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
    backgroundColor: colors.surfaceBorder,
  },
  dateDividerText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textHint,
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
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleTheir: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    ...cardShadow,
    shadowOpacity: 0.03,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleTextOwn: { color: '#fff' },
  bubbleTextTheir: { color: colors.primaryDark },
  bubbleTime: {
    fontSize: 10,
    marginTop: 4,
  },
  bubbleTimeOwn: {
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'right',
  },
  bubbleTimeTheir: { color: colors.textHint },

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
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  emptyChatTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.primaryDark,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyChatSub: {
    fontSize: 13,
    color: colors.textHint,
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
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
  },
  input: {
    flex: 1,
    backgroundColor: colors.backgroundSoft,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.primaryDark,
    maxHeight: 120,
    lineHeight: 20,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: colors.surfaceBorder,
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
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusBtnText: {
    fontSize: 22,
    color: colors.primary,
    lineHeight: 26,
    fontWeight: '400',
  },

  // Action sheet
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,36,102,0.4)',
  },
  sheetBox: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primaryDark,
    marginBottom: 16,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundSoft,
  },
  sheetItemIcon: { fontSize: 22 },
  sheetItemLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  sheetItemSub: {
    fontSize: 12,
    color: colors.textHint,
    marginTop: 2,
  },
  sheetCancel: {
    marginTop: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.backgroundSoft,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  sheetCancelText: { color: colors.textSecondary, fontWeight: '600', fontSize: 14 },
  sheetEmpty: {
    fontSize: 13,
    color: colors.textHint,
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 24,
  },

  // Action cards (partner invite, NDA)
  actionCardWrapper: {
    alignItems: 'center',
    marginVertical: 6,
  },
  actionCard: {
    width: '85%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    padding: 16,
    ...cardShadow,
  },
  actionCardResponse: {
    borderColor: colors.success || '#38a169',
  },
  actionCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  actionCardBody: {
    fontSize: 14,
    color: colors.primaryDark,
    lineHeight: 20,
    marginBottom: 4,
  },
  actionCardProject: {
    fontWeight: '700',
    color: colors.primaryDark,
  },
  actionCardNote: {
    fontSize: 12,
    color: colors.textHint,
    marginTop: 4,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  actionCardStatus: {
    fontSize: 12,
    color: colors.textHint,
    marginTop: 10,
    fontStyle: 'italic',
  },
  actionCardTime: {
    fontSize: 10,
    color: colors.textHint,
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
    backgroundColor: colors.primary,
  },
  actionBtnAcceptText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  actionBtnDecline: {
    backgroundColor: colors.backgroundSoft,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  actionBtnDeclineText: {
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: 13,
  },
});