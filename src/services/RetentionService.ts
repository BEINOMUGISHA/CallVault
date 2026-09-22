/**
 * RetentionService.ts
 * Manages automatic recording retention policies:
 *  - Auto-delete recordings older than N days
 *  - Protect favorited and locked recordings
 *  - Enforce max local storage quota
 *  - Log space reclaimed per purge cycle
 */

import { NativeBridge } from './NativeBridge';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CallRecord, RetentionPolicy, DEFAULT_RETENTION } from '../types';

const RETENTION_KEY = '@callvault_retention_policy';
const LAST_PURGE_KEY = '@callvault_last_purge_ts';

export class RetentionService {
  // ─────────────────────────────────────────────
  // Policy Persistence
  // ─────────────────────────────────────────────

  static async getPolicy(): Promise<RetentionPolicy> {
    try {
      const raw = await AsyncStorage.getItem(RETENTION_KEY);
      if (raw) {
        return { ...DEFAULT_RETENTION, ...JSON.parse(raw) };
      }
    } catch (e) {
      console.warn('RetentionService: Failed to read policy', e);
    }
    return DEFAULT_RETENTION;
  }

  static async savePolicy(policy: RetentionPolicy): Promise<void> {
    try {
      await AsyncStorage.setItem(RETENTION_KEY, JSON.stringify(policy));
    } catch (e) {
      console.warn('RetentionService: Failed to save policy', e);
    }
  }

  // ─────────────────────────────────────────────
  // Purge Runner
  // ─────────────────────────────────────────────

  /**
   * Runs the retention sweep.
   * Skips if last purge was less than 1 hour ago.
   * Returns { deletedCount, reclaimedBytes }
   */
  static async runPurge(): Promise<{ deletedCount: number; reclaimedBytes: number }> {
    const policy = await RetentionService.getPolicy();
    if (!policy.enabled) {
      return { deletedCount: 0, reclaimedBytes: 0 };
    }

    // Throttle: don't run more than once per hour
    const lastPurge = await AsyncStorage.getItem(LAST_PURGE_KEY);
    if (lastPurge) {
      const elapsed = Date.now() - parseInt(lastPurge, 10);
      if (elapsed < 60 * 60 * 1000) {
        console.log('RetentionService: Skipping purge (ran < 1h ago)');
        return { deletedCount: 0, reclaimedBytes: 0 };
      }
    }

    const records = await NativeBridge.getCallRecords();
    let deletedCount = 0;
    let reclaimedBytes = 0;

    const cutoffMs = policy.keepDays > 0
      ? Date.now() - policy.keepDays * 24 * 60 * 60 * 1000
      : 0;

    for (const record of records) {
      if (RetentionService.shouldDelete(record, policy, cutoffMs)) {
        try {
          const deleted = await NativeBridge.deleteCallRecord(record.id);
          if (deleted) {
            deletedCount++;
            reclaimedBytes += record.fileSize ?? 0;
          }
        } catch (e) {
          console.warn(`RetentionService: Failed to delete record ${record.id}`, e);
        }
      }
    }

    await AsyncStorage.setItem(LAST_PURGE_KEY, Date.now().toString());

    if (deletedCount > 0) {
      console.log(
        `RetentionService: Purged ${deletedCount} recordings, reclaimed ${(reclaimedBytes / 1024 / 1024).toFixed(2)} MB`
      );
    }

    return { deletedCount, reclaimedBytes };
  }

  // ─────────────────────────────────────────────
  // Storage Quota Check
  // ─────────────────────────────────────────────

  /**
   * Returns true if local storage usage is below the configured quota.
   * If quota is 0, always returns true (unlimited).
   */
  static async isWithinStorageQuota(): Promise<boolean> {
    const policy = await RetentionService.getPolicy();
    if (!policy.enabled || policy.maxLocalStorageMb === 0) {
      return true;
    }

    const usage = await NativeBridge.getStorageUsage();
    const usedMb = (usage.totalBytes ?? 0) / 1024 / 1024;
    const withinQuota = usedMb < policy.maxLocalStorageMb;

    if (!withinQuota) {
      console.warn(
        `RetentionService: Storage quota exceeded! Used: ${usedMb.toFixed(1)} MB / Limit: ${policy.maxLocalStorageMb} MB`
      );
    }

    return withinQuota;
  }

  // ─────────────────────────────────────────────
  // Decision Logic
  // ─────────────────────────────────────────────

  private static shouldDelete(
    record: CallRecord,
    policy: RetentionPolicy,
    cutoffMs: number
  ): boolean {
    // Never delete if locked and policy protects locked recordings
    if (record.isLocked && policy.keepLockedForever) {
      return false;
    }

    // Never delete if favorited and policy protects favorites
    if (record.isFavorite && policy.keepFavoritesForever) {
      return false;
    }

    // Never delete synced files that have been purged locally already
    if (!record.filePath || record.filePath === '') {
      return false;
    }

    // Delete if older than retention window
    if (cutoffMs > 0 && record.startTime < cutoffMs) {
      return true;
    }

    return false;
  }
}
