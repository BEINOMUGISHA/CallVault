/**
 * UploadQueue.ts
 * Network-aware cloud sync upload queue with:
 *  - Connectivity verification before uploading
 *  - Exponential backoff retry on failure (max 5 attempts)
 *  - Per-record upload state tracking
 *  - Concurrency control (1 upload at a time)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CloudSyncService } from './CloudSyncService';
import { NativeBridge } from './NativeBridge';

const QUEUE_KEY = '@callvault_upload_queue';
const MAX_ATTEMPTS = 5;
const BACKOFF_BASE_MS = 5000; // 5s, 10s, 20s, 40s, 80s

interface QueueItem {
  recordId: number;
  attempts: number;
  nextRetryAt: number;
  addedAt: number;
}

export class UploadQueue {
  private static isProcessing = false;

  // ─────────────────────────────────────────────
  // Queue Management
  // ─────────────────────────────────────────────

  static async enqueue(recordId: number): Promise<void> {
    const queue = await UploadQueue.readQueue();
    const exists = queue.find(item => item.recordId === recordId);
    if (exists) return;

    queue.push({
      recordId,
      attempts: 0,
      nextRetryAt: Date.now(),
      addedAt: Date.now(),
    });

    await UploadQueue.saveQueue(queue);
    console.log(`UploadQueue: Enqueued record ${recordId}`);
    UploadQueue.flush();
  }

  static async remove(recordId: number): Promise<void> {
    const queue = await UploadQueue.readQueue();
    const filtered = queue.filter(item => item.recordId !== recordId);
    await UploadQueue.saveQueue(filtered);
  }

  static async size(): Promise<number> {
    const queue = await UploadQueue.readQueue();
    return queue.length;
  }

  // ─────────────────────────────────────────────
  // Network Check
  // ─────────────────────────────────────────────

  private static async isUploadAllowed(_wifiOnly: boolean): Promise<boolean> {
    try {
      // Lightweight connectivity probe with 3s timeout
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch('https://clients3.google.com/generate_204', {
        method: 'HEAD',
        signal: controller.signal,
      });
      clearTimeout(timer);
      return res.status === 204 || res.ok;
    } catch {
      // Offline or network unreachable
      return false;
    }
  }

  // ─────────────────────────────────────────────
  // Flush (Process Queue)
  // ─────────────────────────────────────────────

  static async flush(wifiOnly: boolean = false): Promise<void> {
    if (UploadQueue.isProcessing) return;
    UploadQueue.isProcessing = true;

    try {
      const allowed = await UploadQueue.isUploadAllowed(wifiOnly);
      if (!allowed) return;

      const queue = await UploadQueue.readQueue();
      const now = Date.now();
      const due = queue.filter(item => item.nextRetryAt <= now);

      for (const item of due) {
        try {
          // Fetch fresh record from native DB
          const records = await NativeBridge.getCallRecords();
          const record = records.find(r => r.id === item.recordId);

          if (!record) {
            // Record was deleted — remove from queue
            await UploadQueue.remove(item.recordId);
            continue;
          }

          if (record.syncStatus === 'synced') {
            // Already synced by another path
            await UploadQueue.remove(item.recordId);
            continue;
          }

          // Attempt upload
          const success = await CloudSyncService.syncSingleRecord(record);

          if (success) {
            await UploadQueue.remove(item.recordId);
            console.log(`UploadQueue: Record ${item.recordId} uploaded successfully.`);
          } else {
            item.attempts += 1;
            if (item.attempts >= MAX_ATTEMPTS) {
              console.error(`UploadQueue: Record ${item.recordId} failed after ${MAX_ATTEMPTS} attempts. Dropping.`);
              await UploadQueue.remove(item.recordId);
            } else {
              // Exponential backoff
              item.nextRetryAt = Date.now() + BACKOFF_BASE_MS * Math.pow(2, item.attempts - 1);
              const updated = (await UploadQueue.readQueue()).map(q =>
                q.recordId === item.recordId ? item : q
              );
              await UploadQueue.saveQueue(updated);
              console.warn(`UploadQueue: Record ${item.recordId} failed (attempt ${item.attempts}). Retry at ${new Date(item.nextRetryAt).toISOString()}`);
            }
          }
        } catch (e) {
          console.error(`UploadQueue: Error processing record ${item.recordId}`, e);
        }
      }
    } finally {
      UploadQueue.isProcessing = false;
    }
  }

  // ─────────────────────────────────────────────
  // Persistence
  // ─────────────────────────────────────────────

  private static async readQueue(): Promise<QueueItem[]> {
    try {
      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private static async saveQueue(queue: QueueItem[]): Promise<void> {
    try {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.warn('UploadQueue: Failed to persist queue', e);
    }
  }
}
