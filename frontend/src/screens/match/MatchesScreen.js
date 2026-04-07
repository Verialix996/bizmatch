import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  ActivityIndicator, TouchableOpacity, Image,
  ScrollView, SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getConversations } from '../../services/match.service';
import { colors, cardShadow } from '../../theme';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  // SQLite datetime('now') is UTC without 'Z' — append it so JS parses correctly.
  const normalized = dateStr.endsWith('Z') ? dateStr : dateStr + 'Z';
  const diff = Date.now() - new Date(normalized).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function Avatar({ photoUrl, name, size = 52 }) {
  const initials = name ? name[0].toUpperCase() : '?';
  if (photoUrl) {
    return (
      <Image source={{ uri: photoUrl }} style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]} />
    );
  }
  return (
    <View style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarInitial, { fontSize: size * 0.4 }]}>{initials}</Text>
    </View>
  );
}

function NewMatchBubble({ item, onPress }) {
  return (
    <TouchableOpacity style={styles.newMatchItem} onPress={onPress}>
      <View style={styles.newMatchAvatarWrap}>
        <Avatar photoUrl={item.photoUrl} name={item.name} size={56} />
        <View style={styles.newMatchDot} />
      </View>
      <Text style={styles.newMatchName} numberOfLines={1}>{item.name.split(' ')[0]}</Text>
    </TouchableOpacity>
  );
}

function ConversationRow({ item, onPress }) {
  const roleLabel = item.roleType === 'investor' ? 'INVESTOR' : 'ENTREPRENEUR';
  const domain = item.investmentDomain || item.ventureStage || '';

  return (
    <TouchableOpacity style={styles.convRow} onPress={onPress} activeOpacity={0.7}>
      <Avatar photoUrl={item.photoUrl} name={item.name} size={52} />
      <View style={styles.convBody}>
        <View style={styles.convHeader}>
          <Text style={styles.convName}>{item.name}</Text>
          <Text style={styles.convTime}>{timeAgo(item.lastMessageAt || item.matchedAt)}</Text>
        </View>
        <View style={styles.convMeta}>
          <View style={styles.convChip}>
            <Text style={styles.convChipText}>{roleLabel}{domain ? ` · ${domain}` : ''}</Text>
          </View>
        </View>
        {item.lastMessage ? (
          <Text style={styles.convPreview} numberOfLines={1}>{item.lastMessage}</Text>
        ) : (
          <Text style={styles.convPreviewNew}>New match — say hello!</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function MatchesScreen({ navigation }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getConversations();
      setConversations(res.data);
    } catch (e) {
      console.error('Failed to load conversations', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

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
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>BizMatch</Text>
          <TouchableOpacity style={styles.notifBtn}>
            <Text style={styles.notifIcon}>🔔</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.pageTitle}>Matches</Text>
          <Text style={styles.pageSub}>Nurture your professional nexus.</Text>
        </View>

        {conversations.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No matches yet</Text>
            <Text style={styles.emptySub}>Start swiping to find your match</Text>
          </View>
        ) : (
          <>
            {/* New Matches row */}
            {newMatches.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionLabel}>NEW MATCHES</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{newMatches.length} NEW</Text>
                  </View>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.newMatchesRow}>
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

            {/* All conversations */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>ALL CONVERSATIONS</Text>
              {conversations.map(item => (
                <ConversationRow
                  key={String(item.matchId)}
                  item={item}
                  onPress={() => navigation.navigate('Chat', { match: item })}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4,
  },
  logo: { fontSize: 20, fontWeight: '800', color: colors.onSurface, letterSpacing: -0.4 },
  notifBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  notifIcon: { fontSize: 20 },

  titleBlock: { paddingHorizontal: 24, paddingBottom: 16, paddingTop: 4 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: colors.onSurface, letterSpacing: -0.5 },
  pageSub: { fontSize: 14, color: colors.onSurfaceVariant, marginTop: 2 },

  section: { marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, marginBottom: 12, gap: 8 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: colors.onSurfaceVariant,
    letterSpacing: 1.2, textTransform: 'uppercase',
  },
  badge: {
    backgroundColor: colors.primary, borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },

  newMatchesRow: { paddingHorizontal: 24, gap: 16 },
  newMatchItem: { alignItems: 'center', width: 68 },
  newMatchAvatarWrap: { position: 'relative' },
  newMatchDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#2ea071', borderWidth: 2, borderColor: colors.surface,
  },
  newMatchName: {
    fontSize: 12, fontWeight: '600', color: colors.onSurface,
    marginTop: 6, textAlign: 'center',
  },

  avatar: { resizeMode: 'cover' },
  avatarPlaceholder: {
    backgroundColor: colors.primaryContainer,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarInitial: { fontWeight: '700', color: '#fff' },

  convRow: {
    flexDirection: 'row', paddingHorizontal: 24, paddingVertical: 14,
    gap: 14, alignItems: 'flex-start',
    borderBottomWidth: 1, borderBottomColor: colors.surfaceContainerLow,
  },
  convBody: { flex: 1 },
  convHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  convName: { fontSize: 15, fontWeight: '700', color: colors.onSurface },
  convTime: { fontSize: 11, color: colors.onSurfaceVariant },
  convMeta: { flexDirection: 'row', marginBottom: 4 },
  convChip: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2,
  },
  convChipText: { fontSize: 10, fontWeight: '600', color: colors.onSurfaceVariant, letterSpacing: 0.4 },
  convPreview: { fontSize: 13, color: colors.onSurfaceVariant, lineHeight: 18 },
  convPreviewNew: { fontSize: 13, color: colors.secondary, fontStyle: 'italic', lineHeight: 18 },

  emptyState: { padding: 48, alignItems: 'center' },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.onSurface, marginBottom: 8 },
  emptySub: { color: colors.onSurfaceVariant },
});
