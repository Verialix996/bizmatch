import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../config/constants';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Only the web build needs to pick a session up out of a redirect URL
    // (OAuth / password-recovery links); native uses WebBrowser + deep links instead.
    detectSessionInUrl: Platform.OS === 'web',
  },
});
