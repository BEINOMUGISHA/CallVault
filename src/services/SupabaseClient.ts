import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase';

// Initialize the Supabase Client with persistent AsyncStorage
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

const DEVICE_USER_ID_KEY = '@callvault_device_user_id';

/**
 * Ensures each device has a unique, deterministic anonymous UUID identifier
 * for isolated cloud folders: callvault_recordings/{userId}/
 */
export async function getOrCreateUserId(): Promise<string> {
  try {
    // 1. Check if user is signed in via Supabase Auth
    let { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      return session.user.id;
    }

    // Try signing in anonymously if enabled in project
    try {
      const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();
      if (!anonError && anonData?.user?.id) {
        return anonData.user.id;
      }
    } catch {
      // Anonymous sign-ins not enabled in dashboard, proceed to persistent device ID
    }

    // 2. Check local persistent storage for previously generated device UUID
    const storedId = await AsyncStorage.getItem(DEVICE_USER_ID_KEY);
    if (storedId) {
      return storedId;
    }

    // 3. Generate a robust random UUIDv4 for this device installation
    const newId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });

    await AsyncStorage.setItem(DEVICE_USER_ID_KEY, newId);
    return newId;
  } catch (e) {
    console.warn('SupabaseClient: getOrCreateUserId fallback to default id', e);
    return 'default_vault_user';
  }
}
