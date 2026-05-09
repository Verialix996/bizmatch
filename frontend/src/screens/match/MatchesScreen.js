import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  ActivityIndicator, TouchableOpacity, Image,
  ScrollView, SafeAreaView, StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getConversations } from '../../services/match.service';
import { colors, cardShadow, radius } from '../../theme';
import useAuthStore from '../../store/authStore';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const normalized = dateStr.endsWith('Z') ? dateStr : dateStr + 'Z';
  const diff = Date.now() - new Date(normalized).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function Avatar({ photoUrl, name, size = 52 }) {
  const initials = name ? name[0].toUpperCase() : '?';
  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={{
          width: size, height: size,
          borderRadius: size / 2,
          resizeMode: 'cover',
        }}
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

function NewMatchBubble({ item, onPress }) {
  return (
    <TouchableOpacity
      style={styles.newMatchItem}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.newMatchAvatarWrap}>
        <Avatar photoUrl={item.photoUrl} name={item.name} size={56} />
        <View style={styles.onlineDot} />
      </View>
      <Text style={styles.newMatchName} numberOfLines={1}>
        {item.name.split(' ')[0]}
      </Text>
    </TouchableOpacity>
  );
}

function ConversationRow({ item, onPress, currentUserId, readTimestamps }) {
  const roleLabel = item.roleType === 'investor' ? 'INVESTOR' : 'ENTREPRENEUR';
  const domain = item.investmentDomain || item.ventureStage || '';
  const lastMsgTime = item.lastMessageAt
    ? new Date(item.lastMessageAt.endsWith('Z') ? item.lastMessageAt : item.lastMessageAt + 'Z').getTime()
    : 0;
  const readAt = readTimestamps?.[item.matchId] || 0;
  const hasUnread = item.lastMessage && item.lastMessageSenderId !== currentUserId && lastMsgTime > readAt;

  return (
    <TouchableOpacity
      style={styles.convRow}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Avatar photoUrl={item.photoUrl} name={item.name} size={50} />

      <View style={styles.convBody}>
        <View style={styles.convHeader}>
          <Text style={styles.convName}>{item.name}</Text>
          <Text style={styles.convTime}>
            {timeAgo(item.lastMessageAt || item.matchedAt)}
          </Text>
        </View>

        <View style={styles.convChipRow}>
          <View style={styles.convChip}>
            <Text style={styles.convChipText}>
              {roleLabel}{domain ? ` · ${domain}` : ''}
            </Text>
          </View>
        </View>

        {item.lastMessage ? (
          <Text style={styles.convPreview} numberOfLines={1}>
            {item.lastMessage}
          </Text>
        ) : item.aiSummary ? (
          <Text style={styles.convPreviewAi} numberOfLines={2}>
            {item.aiSummary}
          </Text>
        ) : (
          <Text style={styles.convPreviewNew}>New match — say hello!</Text>
        )}
      </View>

      {hasUnread && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
}

export default function MatchesScreen({ navigation }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const setNewMatchCount = useAuthStore(s => s.setNewMatchCount);
  const currentUser = useAuthStore(s => s.user);
  const readTimestamps = useAuthStore(s => s.readTimestamps);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getConversations();
      setConversations(res.data);
      const items = res.data || [];
      const readTs = useAuthStore.getState().readTimestamps;
      // Badge = new matches (no messages) + conversations with unread last message
      const newMatchCount = items.filter(c => !c.lastMessage).length;
      const unreadCount = items.filter(c => {
        if (!c.lastMessage || c.lastMessageSenderId === currentUser?.id) return false;
        const lastMsgTime = c.lastMessageAt ? new Date(c.lastMessageAt.endsWith('Z') ? c.lastMessageAt : c.lastMessageAt + 'Z').getTime() : 0;
        const readAt = readTs[c.matchId] || 0;
        return lastMsgTime > readAt;
      }).length;
      setNewMatchCount(newMatchCount + unreadCount);
    } catch (e) {
      console.error('Failed to load conversations', e);
    } finally {
      setLoading(false);
    }
  }, [setNewMatchCount, currentUser]);

  useFocusEffect(useCallback(() => {
    load();
    const interval = setInterval(async () => {
      try {
        const res = await getConversations();
        setConversations(res.data);
        const items = res.data || [];
        const readTs = useAuthStore.getState().readTimestamps;
        const newMatchCount = items.filter(c => !c.lastMessage).length;
        const unreadCount = items.filter(c => {
          if (!c.lastMessage || c.lastMessageSenderId === currentUser?.id) return false;
          const t = c.lastMessageAt ? new Date(c.lastMessageAt.endsWith('Z') ? c.lastMessageAt : c.lastMessageAt + 'Z').getTime() : 0;
          return t > (readTs[c.matchId] || 0);
        }).length;
        setNewMatchCount(newMatchCount + unreadCount);
      } catch { /* silent */ }
    }, 10000);
    return () => clearInterval(interval);
  }, [load, setNewMatchCount, currentUser]));

  const newMatches = conversations.filter(c => !c.lastMessage);
  const withMessages = conversations.filter(c => c.lastMessage);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>BizMatch</Text>
        </View>

        {/* Title */}
        <View style={styles.titleBlock}>
          <Text style={styles.pageTitle}>Matches</Text>
          <Text style={styles.pageSub}>Nurture your professional nexus.</Text>
        </View>

        {conversations.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Text style={styles.emptyIcon}>💬</Text>
            </View>
            <Text style={styles.emptyTitle}>No matches yet</Text>
            <Text style={styles.emptySub}>
              Start swiping to find your first connection
            </Text>
          </View>
        ) : (
          <>
            {/* New matches row */}
            {newMatches.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionLabel}>NEW MATCHES</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{newMatches.length} NEW</Text>
                  </View>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.newMatchesRow}
                >
                  {newMatches.map(item => (
                    <NewMatchBubble
                      key={String(item.matchId)}
                      item={item}
                      onPress={() => navigation.navigate('Chat', { match: item })}
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Conversations */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { paddingHorizontal: 24, marginBottom: 4 }]}>
                ALL CONVERSATIONS
              </Text>
              <View style={styles.convList}>
                {conversations.map((item) => (
                  <ConversationRow
                    key={String(item.matchId)}
                    item={item}
                    currentUserId={currentUser?.id}
                    readTimestamps={readTimestamps}
                    onPress={() => navigation.navigate('Chat', { match: item })}
                  />
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSoft,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  titleBlock: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 4,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: -0.5,
  },
  pageSub: {
    fontSize: 13,
    color: colors.textHint,
    marginTop: 2,
  },

  section: { marginBottom: 8 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 14,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textHint,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },

  newMatchesRow: {
    paddingHorizontal: 24,
    gap: 16,
    paddingBottom: 8,
  },
  newMatchItem: {
    alignItems: 'center',
    width: 64,
  },
  newMatchAvatarWrap: { position: 'relative' },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.backgroundSoft,
  },
  newMatchName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryDark,
    marginTop: 6,
    textAlign: 'center',
  },

  avatarPlaceholder: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontWeight: '800',
    color: '#fff',
  },

  convList: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    overflow: 'hidden',
    ...cardShadow,
    shadowOpacity: 0.04,
  },
  convRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.backgroundSoft,
  },
  convBody: { flex: 1 },
  convHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  convName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  convTime: {
    fontSize: 11,
    color: colors.textHint,
  },
  convChipRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  convChip: {
    backgroundColor: colors.backgroundSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  convChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
  convPreview: {
    fontSize: 13,
    color: colors.textHint,
    lineHeight: 18,
  },
  convPreviewNew: {
    fontSize: 13,
    color: colors.primary,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  convPreviewAi: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 17,
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.primary,
    flexShrink: 0,
  },

  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  emptyIcon: { fontSize: 30 },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primaryDark,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    color: colors.textHint,
    textAlign: 'center',
    lineHeight: 20,
  },
});