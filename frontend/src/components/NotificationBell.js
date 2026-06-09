import {
  View, Text, TouchableOpacity, Modal, FlatList,
  StyleSheet, TouchableWithoutFeedback,
} from 'react-native';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import api from '../services/api';
import useAppStore from '../store/appStore';

const TYPE_ICON = {
  match:          '🤝',
  message:        '💬',
  meeting:        '📅',
  super_like:     '⭐',
  partner_invite: '📋',
};

const TYPE_LABEL = {
  match:          'New Match',
  message:        'New Message',
  meeting:        'Meeting Invitation',
  super_like:     'Super Like',
  partner_invite: 'Partner Invitation',
};

function formatTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const TYPE_BODY = {
  match:          (p) => p?.name ? `You matched with ${p.name}!` : 'You have a new match!',
  message:        (p) => p?.fromName ? `New message from ${p.fromName}` : 'You have a new message.',
  meeting:        (p) => p?.title || 'A meeting has been proposed.',
  super_like:     (p) => p?.name ? `${p.name} super liked you!` : 'Someone super liked you!',
  partner_invite: (p) => p?.title || 'New partner invitation.',
};

export default function NotificationBell({ tintColor }) {
  const navigation = useNavigation();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const intervalRef = useRef(null);
  const notificationTick = useAppStore(s => s.notificationTick);
  const seenIdsRef = useRef(null); // null = first load, Set after first load

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data);

      if (seenIdsRef.current === null) {
        // First load — record existing IDs without showing banners
        seenIdsRef.current = new Set(data.map(n => n.id));
        return;
      }

      // Detect notifications that are new since last fetch
      const newUnread = data.filter(n => !n.readAt && !seenIdsRef.current.has(n.id));
      if (newUnread.length > 0) {
        const newest = newUnread[0];
        useAppStore.getState().showBanner({
          title: TYPE_LABEL[newest.type] || 'New Notification',
          body: (TYPE_BODY[newest.type] || (() => ''))(newest.payload),
          data: { type: newest.type, refId: newest.refId },
        });
      }
      seenIdsRef.current = new Set(data.map(n => n.id));
    } catch { /* silent — bell is non-critical */ }
  }, []);

  useEffect(() => {
    fetchNotifications();
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(fetchNotifications, 5000);
    return () => clearInterval(intervalRef.current);
  }, [fetchNotifications, notificationTick]);

  const unreadCount = notifications.filter(n => !n.readAt).length;

  const markIds = useCallback(async (ids) => {
    if (!ids.length) return;
    try {
      await api.post('/notifications/read', { ids });
      setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, readAt: new Date().toISOString() } : n));
    } catch { /* silent */ }
  }, []);

  const handleOpen = () => {
    setOpen(true);
  };

  const handleTap = (item) => {
    setOpen(false);
    if (!item.readAt) markIds([item.id]);
    switch (item.type) {
      case 'match':
      case 'super_like':
        navigation.navigate('Matches');
        break;
      case 'message':
        navigation.navigate('Matches');
        break;
      case 'meeting':
        navigation.navigate('Meetings');
        break;
      case 'partner_invite':
        navigation.navigate('Projects');
        break;
    }
  };

  const iconColor = tintColor || '#022466';

  return (
    <>
      <TouchableOpacity style={styles.bellBtn} onPress={handleOpen} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={[styles.bellIcon, { color: iconColor }]}>🔔</Text>
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.bubble}>
                <Text style={styles.bubbleTitle}>Notifications</Text>
                {notifications.length === 0 ? (
                  <Text style={styles.emptyText}>No notifications yet</Text>
                ) : (
                  <FlatList
                    data={notifications}
                    keyExtractor={item => String(item.id)}
                    style={styles.list}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={[styles.row, !item.readAt && styles.rowUnread]}
                        onPress={() => handleTap(item)}
                        activeOpacity={0.75}
                      >
                        <Text style={styles.rowIcon}>{TYPE_ICON[item.type] || '🔔'}</Text>
                        <View style={styles.rowBody}>
                          <Text style={styles.rowLabel}>{TYPE_LABEL[item.type] || item.type}</Text>
                          {(item.payload?.name || item.payload?.fromName || item.payload?.title) ? (
                            <Text style={styles.rowSub} numberOfLines={1}>
                              {item.payload.name || item.payload.fromName || item.payload.title}
                            </Text>
                          ) : null}
                        </View>
                        <Text style={styles.rowTime}>{formatTime(item.createdAt)}</Text>
                      </TouchableOpacity>
                    )}
                    ItemSeparatorComponent={() => <View style={styles.sep} />}
                  />
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bellBtn: { position: 'relative', padding: 4, overflow: 'visible' },
  bellIcon: { fontSize: 22 },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E53E3E',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2,36,102,0.35)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 80,
    paddingRight: 16,
  },
  bubble: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: 300,
    maxHeight: 420,
    shadowColor: '#022466',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
    overflow: 'hidden',
  },
  bubbleTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#022466',
    letterSpacing: 0.3,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#DDE3F0',
  },
  list: { maxHeight: 360 },
  emptyText: {
    fontSize: 13,
    color: '#8A96AE',
    textAlign: 'center',
    paddingVertical: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  rowUnread: { backgroundColor: '#F0F4FF' },
  rowIcon: { fontSize: 22, width: 30 },
  rowBody: { flex: 1 },
  rowLabel: { fontSize: 13, fontWeight: '700', color: '#022466' },
  rowSub: { fontSize: 12, color: '#4A5A7A', marginTop: 2 },
  rowTime: { fontSize: 11, color: '#8A96AE' },
  sep: { height: 1, backgroundColor: '#F4F6F9', marginHorizontal: 14 },
});
