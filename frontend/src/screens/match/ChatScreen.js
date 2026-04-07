import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  SafeAreaView, ActivityIndicator, Image,
} from 'react-native';
import { getMessages, sendMessage } from '../../services/match.service';
import useAuthStore from '../../store/authStore';
import { colors } from '../../theme';

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
  const listRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await getMessages(match.matchId);
      setMessages(res.data);
    } catch (e) {
      console.error('Failed to load messages', e);
    } finally {
      setLoading(false);
    }
  }, [match.matchId]);

  useEffect(() => { load(); }, [load]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);
    try {
      const res = await sendMessage(match.matchId, text);
      setMessages(prev => [...prev, res.data]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      console.error('Send failed', e);
    } finally {
      setSending(false);
    }
  };

  // Group messages by date for dividers
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
        <TouchableOpacity style={styles.headerAction}>
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
  bubbleOwn: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
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
});
