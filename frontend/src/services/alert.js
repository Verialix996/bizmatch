import { Alert, Platform } from 'react-native';

/**
 * Cross-platform alert. On web Alert.alert() is silent; this falls back to
 * window.alert / window.confirm so limit/gate messages are always visible.
 *
 * Usage matches Alert.alert(title, message?, buttons?).
 */
export function showAlert(title, message, buttons) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }

  const text = message ? `${title}\n\n${message}` : title;

  if (!buttons || buttons.length <= 1) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }

  // Identify cancel vs action buttons
  const cancelBtn = buttons.find(b => b.style === 'cancel') ?? null;
  const actionBtn = buttons.find(b => b.style !== 'cancel') ?? buttons[buttons.length - 1];

  const confirmed = window.confirm(text);
  if (confirmed) {
    actionBtn?.onPress?.();
  } else {
    cancelBtn?.onPress?.();
  }
}
