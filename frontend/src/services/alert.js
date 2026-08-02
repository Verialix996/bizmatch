import { Alert, Platform } from 'react-native';
import useAppStore from '../store/appStore';

/**
 * Cross-platform alert. On web Alert.alert() is silent, so this renders
 * an in-app AlertModal (see components/AlertModal.js) instead of falling
 * back to window.alert/confirm — those block the entire tab until
 * manually dismissed, which is jarring for real users and freezes
 * automated browser testing.
 *
 * Usage matches Alert.alert(title, message?, buttons?).
 */
export function showAlert(title, message, buttons) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }

  useAppStore.getState().showAlertModal({ title, message, buttons });
}
