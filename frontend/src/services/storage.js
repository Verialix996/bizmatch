// Platform-aware key/value storage: SecureStore is a no-op on web, so fall back
// to localStorage there — otherwise web sessions are lost on every reload.
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const isWeb = Platform.OS === 'web';

export async function setItem(key, value) {
  if (isWeb) {
    window.localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function getItem(key) {
  if (isWeb) return window.localStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

export async function deleteItem(key) {
  if (isWeb) {
    window.localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
