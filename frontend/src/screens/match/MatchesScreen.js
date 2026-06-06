import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  ActivityIndicator, TouchableOpacity, Image,
  ScrollView, SafeAreaView, StatusBar, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { getConversations, whoLikedMe } from '../../services/match.service';
import api from '../../services/api';
import { colors, investorColors, investorThemeColors, cardShadow, radius } from '../../theme';
import useAuthStore from '../../store/authStore';
import useAppStore from '../../store/appStore';

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

function Avatar({ photoUrl, name, size = 52, C }) {
  const initials = name ? name[0].toUpperCase() : '?';
  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={{ width: size, height: size, borderRadius: size / 2, resizeMode: 'cover' }}
      />
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2,
      backgroundColor: C?.primary || C.primary, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: size * 0.38, fontWeight: '800', color: '#fff' }}>{initials}</Text>
    </View>
  );
}

function NewMatchBubble({ item, onPress, C, styles }) {
  return (
    <TouchableOpacity style={styles.newMatchItem} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.newMatchAvatarWrap}>
        <Avatar photoUrl={item.photoUrl} name={item.name} size={56} C={C} />
        <View style={styles.onlineDot} />
      </View>
      <Text style={styles.newMatchName} numberOfLines={1}>{item.name.split(' ')[0]}</Text>
    </TouchableOpacity>
  );
}

function ConversationRow({ item, onPress, currentUserId, readTimestamps, C, styles, showPersonName }) {
  const roleLabel = item.roleType === 'investor' ? 'INVESTOR' : 'ENTREPRENEUR';
  const domain = item.investmentDomain || item.ventureStage || '';
  const lastMsgTime = item.lastMessageAt
    ? new Date(item.lastMessageAt.endsWith('Z') ? item.lastMessageAt : item.lastMessageAt + 'Z').getTime()
    : 0;
  const readAt = readTimestamps?.[item.matchId] || 0;
  const hasUnread = item.lastMessage && item.lastMessageSenderId !== currentUserId && lastMsgTime > readAt;

  return (
    <TouchableOpacity style={styles.convRow} onPress={onPress} activeOpacity={0.7}>
      <Avatar photoUrl={item.photoUrl} name={item.name} size={50} C={C} />
      <View style={styles.convBody}>
        <View style={styles.convHeader}>
          <Text style={styles.convName}>
            {(!showPersonName && item.projectName) ? item.projectName : item.name}
          </Text>
          <Text style={styles.convTime}>{timeAgo(item.lastMessageAt || item.matchedAt)}</Text>
        </View>
        <View style={styles.convChipRow}>
          {item.projectName ? (
            <View style={styles.convChip}>
              <Text style={styles.convChipText}>📁 {item.projectName}</Text>
            </View>
          ) : (
            <View style={styles.convChip}>
              <Text style={styles.convChipText}>{roleLabel}{domain ? ` · ${domain}` : ''}</Text>
            </View>
          )}
        </View>
        {item.lastMessage ? (
          <Text style={styles.convPreview} numberOfLines={1}>{item.lastMessage}</Text>
        ) : item.aiSummary ? (
          <Text style={styles.convPreviewAi} numberOfLines={2}>{item.aiSummary}</Text>
        ) : (
          <Text style={styles.convPreviewNew}>New match — say hello!</Text>
        )}
      </View>
      {hasUnread && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
}

function WhoLikedMeBubble({ item, C, styles }) {
  return (
    <View style={styles.newMatchItem}>
      <View style={styles.newMatchAvatarWrap}>
        <Avatar photoUrl={item.photoUrl} name={item.name} size={56} C={C} />
        {item.isSuperLike ? (
          <View style={[styles.onlineDot, styles.superLikeDot]}>
            <Text style={styles.superLikeDotText}>★</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.newMatchName} numberOfLines={1}>
        {item.name.split(' ')[0]}
      </Text>
    </View>
  );
}

export default function MatchesScreen({ navigation }) {
  const [conversations, setConversations] = useState([]);
  const [likedBy, setLikedBy] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('messages');
  const [meetings, setMeetings] = useState([]);
  const [meetingsLoading, setMeetingsLoading] = useState(false);
  const setNewMatchCount = useAuthStore(s => s.setNewMatchCount);
  const currentUser = useAuthStore(s => s.user);
  const readTimestamps = useAuthStore(s => s.readTimestamps);
  const darkMode = useAppStore(s => s.darkMode);
  const isInvestorTheme = useAppStore(s => s.isInvestorTheme);
  const C = darkMode ? investorColors : (isInvestorTheme ? investorThemeColors : colors);
  const styles = makeStyles(C);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getConversations();
      setConversations(res.data);
      if (currentUser?.is_premium) {
        whoLikedMe().then(r => setLikedBy(r.data || [])).catch(() => {});
      }
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
      console.error('Conversations error:', e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, [setNewMatchCount, currentUser]);

  useFocusEffect(useCallback(() => {
    // Clear match/super_like notifications when user visits this screen
    api.post('/notifications/read', { types: ['match', 'super_like'] }).catch(() => {});
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
  const isInvestor = currentUser?.role === 'investor';

  // Investor: project chats = matches where investor swiped on a project
  const projectConvs = withMessages.filter(c => c.projectName && c.projectInvestorId === currentUser?.id);
  // Investor: all other convs (regular profile swipes)
  const peopleConvs = withMessages.filter(c => !c.projectName || c.projectInvestorId !== currentUser?.id);

  // Entrepreneur: partner chats = non-project matches (looking for co-founders)
  const partnerConvs = withMessages.filter(c => !c.projectName);
  // Entrepreneur: group investor convs by project
  const investorConvsByProject = withMessages
    .filter(c => c.projectName && c.projectInvestorId !== currentUser?.id)
    .reduce((acc, conv) => {
      const key = String(conv.projectId);
      if (!acc[key]) acc[key] = { name: conv.projectName, convs: [] };
      acc[key].convs.push(conv);
      return acc;
    }, {});
  const projectGroups = Object.values(investorConvsByProject);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Title + toggle */}
        <View style={styles.titleBlock}>
          <Text style={styles.pageTitle}>{activeTab === 'messages' ? 'Messages' : 'Meetings'}</Text>
          <View style={styles.viewToggle}>
            <TouchableOpacity
              style={[styles.viewToggleBtn, activeTab === 'messages' && styles.viewToggleBtnActive]}
              onPress={() => setActiveTab('messages')}
              activeOpacity={0.85}
            >
              <Text style={[styles.viewToggleBtnText, activeTab === 'messages' && styles.viewToggleBtnTextActive]}>
                💬 Messages
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewToggleBtn, activeTab === 'meetings' && styles.viewToggleBtnActive]}
              onPress={async () => {
                setActiveTab('meetings');
                if (meetings.length === 0) {
                  setMeetingsLoading(true);
                  try { const r = await api.get('/meetings'); setMeetings(r.data || []); } catch {}
                  setMeetingsLoading(false);
                }
              }}
              activeOpacity={0.85}
            >
              <Text style={[styles.viewToggleBtnText, activeTab === 'meetings' && styles.viewToggleBtnTextActive]}>
                📅 Meetings
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {activeTab === 'meetings' ? (
          meetingsLoading ? (
            <View style={styles.centered}><ActivityIndicator size="large" color={C.primary} /></View>
          ) : meetings.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}><Text style={styles.emptyIcon}>📅</Text></View>
              <Text style={styles.emptyTitle}>No meetings yet</Text>
              <Text style={styles.emptySub}>Propose a meeting from any chat conversation.</Text>
            </View>
          ) : (
            <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
              {meetings.map(m => {
                const STATUS_COLOR = { proposed: C.warning, confirmed: C.success, declined: C.error, cancelled: C.textHint };
                const isProposer = m.proposer_id === currentUser?.id;
                const otherName = isProposer ? m.receiver_name : m.proposer_name;
                const date = new Date(m.scheduled_at).toLocaleString('en-IL', { dateStyle: 'medium', timeStyle: 'short' });
                return (
                  <TouchableOpacity
                    key={String(m.id)}
                    style={styles.meetingCard}
                    onPress={() => navigation.navigate('Meetings')}
                    activeOpacity={0.85}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.meetingCardTitle}>{m.title || 'Meeting'}</Text>
                      <Text style={styles.meetingCardWith}>with {otherName}</Text>
                      <Text style={styles.meetingCardDate}>{date}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <View style={[styles.meetingBadge, { backgroundColor: m.location_type === 'virtual' ? C.surfaceElevated : '#FFF3E0' }]}>
                        <Ionicons name={m.location_type === 'virtual' ? 'videocam' : 'location'} size={11} color={m.location_type === 'virtual' ? C.primary : C.warning} />
                        <Text style={[styles.meetingBadgeText, { color: m.location_type === 'virtual' ? C.primary : C.warning }]}>
                          {m.location_type === 'virtual' ? 'Virtual' : 'In Person'}
                        </Text>
                      </View>
                      <View style={[styles.meetingBadge, { backgroundColor: (STATUS_COLOR[m.status] || C.textHint) + '22' }]}>
                        <Text style={[styles.meetingBadgeText, { color: STATUS_COLOR[m.status] || C.textHint }]}>
                          {m.status.charAt(0).toUpperCase() + m.status.slice(1)}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )
        ) : conversations.length === 0 ? (
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
                      C={C} styles={styles}
                      onPress={() => navigation.navigate('Chat', { match: item })}
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Who Liked Me — premium only */}
            {!!currentUser?.is_premium && likedBy.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionLabel}>WHO LIKED YOU</Text>
                  <View style={[styles.badge, styles.badgePremium]}>
                    <Text style={styles.badgeText}>★ PREMIUM</Text>
                  </View>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.newMatchesRow}
                >
                  {likedBy.map(item => (
                    <WhoLikedMeBubble key={String(item.id)} item={item} C={C} styles={styles} />
                  ))}
                </ScrollView>
              </View>
            )}

            {isInvestor ? (
              <>
                {/* Investor: PROJECT CHATS — matches via project swipe */}
                {projectConvs.length > 0 && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionLabel}>PROJECT CHATS</Text>
                      <View style={[styles.badge, styles.badgeProject]}>
                        <Text style={styles.badgeText}>📁 {projectConvs.length}</Text>
                      </View>
                    </View>
                    <View style={styles.convList}>
                      {projectConvs.map((item, idx) => (
                        <ConversationRow
                          key={`pc-${idx}-${item.matchId}`}
                          item={item}
                          currentUserId={currentUser?.id}
                          readTimestamps={readTimestamps}
                          C={C} styles={styles}
                          showPersonName
                          onPress={() => navigation.navigate('Chat', { match: item })}
                        />
                      ))}
                    </View>
                  </View>
                )}
                {/* Investor: ALL CONVERSATIONS — regular profile swipes */}
                {(peopleConvs.length > 0 || projectConvs.length === 0) && (
                  <View style={styles.section}>
                    <Text style={[styles.sectionLabel, { paddingHorizontal: 24, marginBottom: 4 }]}>
                      {projectConvs.length > 0 ? 'ALL CONVERSATIONS' : 'ALL CONVERSATIONS'}
                    </Text>
                    <View style={styles.convList}>
                      {(peopleConvs.length > 0 ? peopleConvs : withMessages).map((item, idx) => (
                        <ConversationRow
                          key={`ac-${idx}-${item.matchId}`}
                          item={item}
                          currentUserId={currentUser?.id}
                          readTimestamps={readTimestamps}
                          C={C} styles={styles}
                          onPress={() => navigation.navigate('Chat', { match: item })}
                        />
                      ))}
                    </View>
                  </View>
                )}
              </>
            ) : (
              <>
                {/* Entrepreneur: one section per project with investor convs */}
                {projectGroups.map(group => (
                  <View key={group.name} style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionLabel}>📁 {group.name.toUpperCase()}</Text>
                      <View style={[styles.badge, styles.badgeProject]}>
                        <Text style={styles.badgeText}>{group.convs.length} INVESTOR{group.convs.length !== 1 ? 'S' : ''}</Text>
                      </View>
                    </View>
                    <View style={styles.convList}>
                      {group.convs.map((item, idx) => (
                        <ConversationRow
                          key={`gc-${idx}-${item.matchId}`}
                          item={item}
                          currentUserId={currentUser?.id}
                          readTimestamps={readTimestamps}
                          C={C} styles={styles}
                          showPersonName
                          onPress={() => navigation.navigate('Chat', { match: item })}
                        />
                      ))}
                    </View>
                  </View>
                ))}
                {/* Entrepreneur: PARTNER CHATS — non-project matches */}
                {(partnerConvs.length > 0 || projectGroups.length === 0) && (
                  <View style={styles.section}>
                    <Text style={[styles.sectionLabel, { paddingHorizontal: 24, marginBottom: 4 }]}>
                      {projectGroups.length > 0 ? 'PARTNER CHATS' : 'ALL CONVERSATIONS'}
                    </Text>
                    <View style={styles.convList}>
                      {(partnerConvs.length > 0 ? partnerConvs : withMessages).map((item, idx) => (
                        <ConversationRow
                          key={`ec-${idx}-${item.matchId}`}
                          item={item}
                          currentUserId={currentUser?.id}
                          readTimestamps={readTimestamps}
                          C={C} styles={styles}
                          onPress={() => navigation.navigate('Chat', { match: item })}
                        />
                      ))}
                    </View>
                  </View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}


function makeStyles(C) { return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.backgroundSoft,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  titleBlock: {
    paddingHorizontal: 24,
    paddingBottom: 12,
    paddingTop: 8,
    gap: 10,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: C.textPrimary,
    letterSpacing: -0.5,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: radius.lg,
    padding: 3,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  viewToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewToggleBtnActive: {
    backgroundColor: C.primary,
  },
  viewToggleBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textHint,
  },
  viewToggleBtnTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  meetingCard: {
    backgroundColor: C.surface,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    ...cardShadow,
  },
  meetingCardTitle: { fontSize: 15, fontWeight: '700', color: C.textPrimary, marginBottom: 2 },
  meetingCardWith:  { fontSize: 13, color: C.textSecondary, marginBottom: 4 },
  meetingCardDate:  { fontSize: 13, color: C.primary, fontWeight: '600' },
  meetingBadge: {
    flexDirection: 'row', alignItems: 'center', borderRadius: radius.pill,
    paddingHorizontal: 8, paddingVertical: 3, gap: 3,
  },
  meetingBadgeText: { fontSize: 11, fontWeight: '600' },

  section: { marginBottom: 8 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 14,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: C.textHint,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  badge: {
    backgroundColor: C.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgePremium: {
    backgroundColor: '#F5A623',
  },
  badgeProject: {
    backgroundColor: C.success || '#2E7D32',
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
    backgroundColor: C.success,
    borderWidth: 2,
    borderColor: C.backgroundSoft,
  },
  superLikeDot: {
    backgroundColor: '#F5A623',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  superLikeDotText: {
    fontSize: 9,
    color: '#fff',
  },
  newMatchName: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textPrimary,
    marginTop: 6,
    textAlign: 'center',
  },

  avatarPlaceholder: {
    backgroundColor: C.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontWeight: '800',
    color: '#fff',
  },

  convList: {
    backgroundColor: C.surface,
    borderRadius: radius.lg,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
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
    borderBottomColor: C.backgroundSoft,
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
    color: C.textPrimary,
  },
  convTime: {
    fontSize: 11,
    color: C.textHint,
  },
  convChipRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  convChip: {
    backgroundColor: C.backgroundSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  convChipProject: {
    backgroundColor: (C.success || '#2E7D32') + '22',
    borderWidth: 1,
    borderColor: C.success || '#2E7D32',
  },
  convChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: C.textSecondary,
    letterSpacing: 0.3,
  },
  convChipTextProject: {
    color: C.success || '#2E7D32',
  },
  convPreview: {
    fontSize: 13,
    color: C.textHint,
    lineHeight: 18,
  },
  convPreviewNew: {
    fontSize: 13,
    color: C.primary,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  convPreviewAi: {
    fontSize: 12,
    color: C.textSecondary,
    fontStyle: 'italic',
    lineHeight: 17,
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: C.primary,
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
    backgroundColor: C.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.surfaceBorder,
  },
  emptyIcon: { fontSize: 30 },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: C.textPrimary,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    color: C.textHint,
    textAlign: 'center',
    lineHeight: 20,
  },
}); }