import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  SafeAreaView, ActivityIndicator, Image, StatusBar,
} from 'react-native';
import { getMessages, sendMessage } from '../../services/match.service';
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

export default function ChatScreen({ route, navigation }) {
  const { match } = route.params;
  const user = useAuthStore(s => s.user);

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);
  const lastIdRef = useRef(null);

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

  const renderItem = ({ item, index }) => {
    const isOwn = item.sender_id === user?.id;
    const prevMsg = messages[index - 1];
    const showDivider = !prevMsg || (
      parseUTC(item.created_at).toDateString() !==
      parseUTC(prevMsg.created_at).toDateString()
    );

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
            style={[
              styles.sendBtn,
              (!input.trim() || sending) && styles.sendBtnDisabled,
            ]}
            onPress={handleSend}
            disabled={!input.trim() || sending}
            activeOpacity={0.85}
          >
            <Text style={styles.sendBtnText}>▶</Text>
          </TouchableOpacity>
        </View>
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
});