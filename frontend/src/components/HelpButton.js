import {
  View, Text, TouchableOpacity, Modal, ScrollView,
  StyleSheet, TouchableWithoutFeedback,
} from 'react-native';
import { useState } from 'react';
import { useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getHelpContent } from '../config/helpContent';
import { radius, typography } from '../theme';

// "?" button that opens an on-demand guide for whichever screen is
// currently focused — resolved via useRoute() rather than a prop, so this
// works for every screen without touching each one individually (AppShell
// is rendered as that screen's own child, so useRoute() here always
// resolves to it).
export default function HelpButton({ role, tintColor }) {
  const route = useRoute();
  const [open, setOpen] = useState(false);
  const content = getHelpContent(route?.name, role);
  const iconColor = tintColor || '#022466';

  if (!content) return null;

  return (
    <>
      <TouchableOpacity
        style={styles.btn}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="help-circle-outline" size={22} color={iconColor} />
      </TouchableOpacity>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.card}>
                <View style={styles.header}>
                  <Ionicons name="help-circle" size={20} color="#022466" />
                  <Text style={styles.title}>{content.title}</Text>
                </View>
                <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
                  <Text style={styles.intro}>{content.intro}</Text>
                  {content.steps.map((step, i) => (
                    <View key={i} style={styles.stepRow}>
                      <Text style={styles.bullet}>•</Text>
                      <Text style={styles.stepText}>{step}</Text>
                    </View>
                  ))}
                </ScrollView>
                <TouchableOpacity style={styles.closeBtn} onPress={() => setOpen(false)} activeOpacity={0.85}>
                  <Text style={styles.closeBtnText}>Got it</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btn: { padding: 4 },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2,36,102,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.lg,
    width: 360,
    maxWidth: '100%',
    maxHeight: 460,
    padding: 20,
    shadowColor: '#022466',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  title: { ...typography.titleMedium, color: '#022466', fontWeight: '800' },
  body: { marginBottom: 16 },
  intro: { ...typography.bodyMedium, color: '#3A4A6B', marginBottom: 14, lineHeight: 20 },
  stepRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  bullet: { color: '#022466', fontWeight: '800' },
  stepText: { flex: 1, ...typography.bodySmall, color: '#3A4A6B', lineHeight: 19 },
  closeBtn: {
    backgroundColor: '#022466', borderRadius: radius.pill, paddingVertical: 12, alignItems: 'center',
  },
  closeBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
