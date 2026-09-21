import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeBridge } from './NativeBridge';
import { supabase, getOrCreateUserId } from './SupabaseClient';
import { STORAGE_BUCKET } from '../config/supabase';

const PASSCODE_KEY = '@callvault_master_passcode';
const DURESS_PASSCODE_KEY = '@callvault_duress_passcode';
const PANIC_PASSCODE_KEY = '@callvault_panic_passcode';
const DISGUISE_MODE_KEY = '@callvault_calculator_disguise';
const FLAG_SECURE_KEY = '@callvault_flag_secure';
const SHAKE_TO_LOCK_KEY = '@callvault_shake_to_lock';
const AUTO_LOCK_KEY = '@callvault_auto_lock_background';
const FAILED_ATTEMPTS_KEY = '@callvault_failed_attempts';
const INTRUSION_LOGS_KEY = '@callvault_intrusion_logs';

export interface AuthResult {
  authenticated: boolean;
  isDuress: boolean;
  isPanic: boolean;
  failedAttempts: number;
}

export interface IntrusionLog {
  timestamp: number;
  attemptedCode: string;
  isFlagged: boolean;
}

export class SecurityService {
  /**
   * Validates entered code against master PIN, duress PIN, and panic PIN.
   */
  static async verifyCode(inputCode: string): Promise<AuthResult> {
    const master = (await AsyncStorage.getItem(PASSCODE_KEY)) || '9999';
    const duress = (await AsyncStorage.getItem(DURESS_PASSCODE_KEY)) || '1111';
    const panic = (await AsyncStorage.getItem(PANIC_PASSCODE_KEY)) || '0000';

    const cleanInput = inputCode.trim();

    // 1. Panic code: Immediate silent self-destruct
    if (cleanInput === panic) {
      await this.executePanicWipe();
      return { authenticated: false, isDuress: false, isPanic: true, failedAttempts: 0 };
    }

    // 2. Real Vault PIN
    if (cleanInput === master) {
      await this.resetFailedAttempts();
      return { authenticated: true, isDuress: false, isPanic: false, failedAttempts: 0 };
    }

    // 3. Duress PIN: Decoy vault
    if (cleanInput === duress) {
      await this.resetFailedAttempts();
      return { authenticated: true, isDuress: true, isPanic: false, failedAttempts: 0 };
    }

    // 4. Failed attempt: Record & evaluate intrusion
    const fails = await this.recordFailedAttempt(cleanInput);
    return { authenticated: false, isDuress: false, isPanic: false, failedAttempts: fails };
  }

  // --- Disguise & Flag Secure ---
  static async isDisguiseEnabled(): Promise<boolean> {
    const val = await AsyncStorage.getItem(DISGUISE_MODE_KEY);
    return val === 'true';
  }

  static async setDisguiseEnabled(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(DISGUISE_MODE_KEY, enabled ? 'true' : 'false');
  }

  static async isFlagSecureEnabled(): Promise<boolean> {
    const val = await AsyncStorage.getItem(FLAG_SECURE_KEY);
    return val !== 'false'; // Default enabled
  }

  static async setFlagSecure(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(FLAG_SECURE_KEY, enabled ? 'true' : 'false');
    await NativeBridge.setFlagSecure(enabled);
  }

  // --- Shake to Lock ---
  static async isShakeToLockEnabled(): Promise<boolean> {
    const val = await AsyncStorage.getItem(SHAKE_TO_LOCK_KEY);
    return val !== 'false'; // Default enabled
  }

  static async setShakeToLockEnabled(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(SHAKE_TO_LOCK_KEY, enabled ? 'true' : 'false');
    if (enabled) {
      await NativeBridge.startShakeDetector();
    } else {
      await NativeBridge.stopShakeDetector();
    }
  }

  // --- Auto Lock on App Background ---
  static async isAutoLockEnabled(): Promise<boolean> {
    const val = await AsyncStorage.getItem(AUTO_LOCK_KEY);
    return val !== 'false'; // Default enabled
  }

  static async setAutoLockEnabled(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(AUTO_LOCK_KEY, enabled ? 'true' : 'false');
  }

  // --- Passcode Management ---
  static async setPasscode(newCode: string): Promise<void> {
    await AsyncStorage.setItem(PASSCODE_KEY, newCode.trim());
  }

  static async getPasscode(): Promise<string> {
    return (await AsyncStorage.getItem(PASSCODE_KEY)) || '9999';
  }

  static async setDuressPasscode(newDuress: string): Promise<void> {
    await AsyncStorage.setItem(DURESS_PASSCODE_KEY, newDuress.trim());
  }

  static async getDuressPasscode(): Promise<string> {
    return (await AsyncStorage.getItem(DURESS_PASSCODE_KEY)) || '1111';
  }

  static async setPanicPasscode(newPanic: string): Promise<void> {
    await AsyncStorage.setItem(PANIC_PASSCODE_KEY, newPanic.trim());
  }

  static async getPanicPasscode(): Promise<string> {
    return (await AsyncStorage.getItem(PANIC_PASSCODE_KEY)) || '0000';
  }

  // --- Intrusion Tracking ---
  static async recordFailedAttempt(attemptedCode: string): Promise<number> {
    try {
      const current = parseInt((await AsyncStorage.getItem(FAILED_ATTEMPTS_KEY)) || '0', 10) + 1;
      await AsyncStorage.setItem(FAILED_ATTEMPTS_KEY, current.toString());

      // Save to intrusion history
      const rawLogs = await AsyncStorage.getItem(INTRUSION_LOGS_KEY);
      const logs: IntrusionLog[] = rawLogs ? JSON.parse(rawLogs) : [];
      logs.unshift({
        timestamp: Date.now(),
        attemptedCode: attemptedCode ? `${attemptedCode.slice(0, 1)}***` : 'UNKNOWN',
        isFlagged: current >= 3,
      });

      // Keep last 20 logs
      await AsyncStorage.setItem(INTRUSION_LOGS_KEY, JSON.stringify(logs.slice(0, 20)));
      return current;
    } catch {
      return 1;
    }
  }

  static async resetFailedAttempts(): Promise<void> {
    try {
      await AsyncStorage.setItem(FAILED_ATTEMPTS_KEY, '0');
    } catch {}
  }

  static async getIntrusionLogs(): Promise<IntrusionLog[]> {
    try {
      const rawLogs = await AsyncStorage.getItem(INTRUSION_LOGS_KEY);
      return rawLogs ? JSON.parse(rawLogs) : [];
    } catch {
      return [];
    }
  }

  // --- Scorched-Earth Emergency Panic Wipe ---
  static async executePanicWipe(): Promise<boolean> {
    console.warn('SECURITY ALERT: Executing total panic wipe.');
    try {
      // 1. Wipe Cloud Supabase Records for this anonymous device ID
      try {
        const userId = await getOrCreateUserId();
        await supabase.from('callvault_records').delete().eq('user_id', userId);
        // List and delete bucket files
        const { data: files } = await supabase.storage.from(STORAGE_BUCKET).list(userId);
        if (files && files.length > 0) {
          const filePaths = files.map((f) => `${userId}/${f.name}`);
          await supabase.storage.from(STORAGE_BUCKET).remove(filePaths);
        }
      } catch (cloudErr) {
        console.warn('Cloud panic wipe warning:', cloudErr);
      }

      // 2. Native Wipe (Room DB + local audio files + app preferences)
      await NativeBridge.panicWipe();

      // 3. Clear all AsyncStorage data
      await AsyncStorage.clear();

      return true;
    } catch (e) {
      console.error('Failed to complete panic wipe:', e);
      return false;
    }
  }
}
