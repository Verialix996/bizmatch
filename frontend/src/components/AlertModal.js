import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import useAppStore from '../store/appStore';
import { colors, investorColors, investorThemeColors, radius } from '../theme';

// Renders alerts pushed via services/alert.js as an in-app modal instead of
// window.alert/confirm on web, which blocks the whole tab (including
// automated testing) until manually dismissed and looks out of place next
// to the rest of the UI.
export default function AlertModal() {
  const pendingAlert = useAppStore(s => s.pendingAlert);
  const dismissAlertModal = useAppStore(s => s.dismissAlertModal);
  const darkMode = useAppStore(s => s.darkMode);
  const isInvestorTheme = useAppStore(s => s.isInvestorTheme);
  const C = darkMode ? investorColors : (isInvestorTheme ? investorThemeColors : colors);
  const styles = makeStyles(C);

  if (!pendingAlert) return null;

  const { title, message, buttons } = pendingAlert;
  const items = buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }];

  const handlePress = (btn) => {
    dismissAlertModal();
    btn.onPress?.();
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={dismissAlertModal}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {!!title && <Text style={styles.title}>{title}</Text>}
          {!!message && <Text style={styles.message}>{message}</Text>}
          <View style={styles.buttonRow}>
            {items.map((btn, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.button, btn.style === 'cancel' && styles.buttonCancel]}
                onPress={() => handlePress(btn)}
                activeOpacity={0.85}
              >
                <Text style={[
                  styles.buttonText,
                  btn.style === 'cancel' && styles.buttonCancelText,
                  btn.style === 'destructive' && styles.buttonDestructiveText,
                ]}>
                  {btn.text || 'OK'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (C) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: C.surface,
    borderRadius: radius.lg,
    padding: 20,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: C.textPrimary,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: C.textSecondary,
    lineHeight: 20,
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: C.buttonPrimary,
  },
  buttonCancel: {
    backgroundColor: 'transparent',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.buttonPrimaryText,
  },
  buttonCancelText: {
    color: C.textSecondary,
  },
  buttonDestructiveText: {
    color: C.error,
  },
});
