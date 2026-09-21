import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { supabase, getOrCreateUserId } from './SupabaseClient';
import { STORAGE_BUCKET } from '../config/supabase';
import { NativeBridge } from './NativeBridge';
import { CallRecord } from '../types';

const SYNCED_RECORDS_KEY = '@callvault_synced_record_ids';
const TOTAL_SAVED_BYTES_KEY = '@callvault_total_saved_bytes';

export class CloudSyncService {
  private static isSyncing = false;

  /**
   * Scans for newly finished call recordings, uploads them to Supabase,
   * and immediately purges local files to maintain a zero-storage footprint.
   */
  static async syncPendingRecordings(onRecordSynced?: (record: CallRecord) => void): Promise<number> {
    if (this.isSyncing) return 0;
    this.isSyncing = true;

    let syncedCount = 0;

    try {
      // 1. Get local records from native Room database
      const localRecords = await NativeBridge.getCallRecords();
      if (!localRecords || localRecords.length === 0) {
        this.isSyncing = false;
        return 0;
      }

      // 2. Load the list of already uploaded record IDs
      const rawSynced = await AsyncStorage.getItem(SYNCED_RECORDS_KEY);
      const syncedIds: number[] = rawSynced ? JSON.parse(rawSynced) : [];

      const userId = await getOrCreateUserId();

      for (const record of localRecords) {
        // Check if already synced or if physical file exists
        if (syncedIds.includes(record.id)) continue;

        if (!record.filePath || record.filePath.length === 0) continue;

        const exists = await RNFS.exists(record.filePath);
        if (!exists) {
          // File was already deleted or doesn't exist; mark as synced to prevent re-checking
          syncedIds.push(record.id);
          continue;
        }

        console.log(`CloudSyncService: Starting zero-storage upload for call ID ${record.id}`);
        const success = await this.uploadAndPurgeLocalFile(record, userId);
        if (success) {
          syncedIds.push(record.id);
          syncedCount++;
          if (onRecordSynced) {
            onRecordSynced({
              ...record,
              filePath: '',
              syncStatus: 'synced',
            });
          }
        }
      }

      await AsyncStorage.setItem(SYNCED_RECORDS_KEY, JSON.stringify(syncedIds));
    } catch (err) {
      console.error('CloudSyncService: Error during sync queue execution', err);
    } finally {
      this.isSyncing = false;
    }

    return syncedCount;
  }

  /**
   * Uploads the audio file, writes metadata to Supabase PostgreSQL,
   * then permanently unlinks the local file from disk.
   */
  private static async uploadAndPurgeLocalFile(record: CallRecord, userId: string): Promise<boolean> {
    try {
      const fileName = record.filePath.split('/').pop() || `call_${record.id}_${Date.now()}.mp3`;
      const fileUri = Platform.OS === 'android' ? 'file://' + record.filePath : record.filePath;
      const storagePath = `${userId}/${fileName}`;

      const isEncrypted = fileName.endsWith('.enc');
      const mimeType = isEncrypted ? 'application/octet-stream' : 'audio/mpeg';

      // 1. Prepare form data binary
      const formData = new FormData();
      formData.append('file', {
        uri: fileUri,
        name: fileName,
        type: mimeType,
      } as any);

      // 2. Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, formData, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadError) {
        console.error(`CloudSyncService: Storage upload failed for call ID ${record.id}:`, uploadError.message);
        return false;
      }

      console.log(`CloudSyncService: Audio uploaded successfully to: ${storagePath}`);

      // 3. Insert metadata into public.callvault_records table
      const { data: insertData, error: dbError } = await supabase
        .from('callvault_records')
        .insert({
          user_id: userId,
          local_id: record.id,
          phone_number: record.phoneNumber,
          call_type: record.callType,
          audio_path: storagePath,
          audio_format: 'mp3',
          duration_seconds: record.duration,
          file_size_bytes: record.fileSize,
          start_time: record.startTime,
          end_time: record.endTime,
        })
        .select('id')
        .single();

      if (dbError) {
        console.warn(`CloudSyncService: DB insert warning (may require user profile):`, dbError.message);
      }

      // 4. Update local Room DB row with cloud storage reference & clear local file path
      await NativeBridge.updateRecordSync(record.id, storagePath, 'synced');

      // 5. 💥 ZERO-STORAGE AUTO-PURGE: Delete the local physical file immediately!
      try {
        await RNFS.unlink(record.filePath);
        console.log(`CloudSyncService: 0-Storage Purge complete. Deleted: ${record.filePath}`);

        // Update persistent counter of storage space saved on this phone
        const rawSaved = await AsyncStorage.getItem(TOTAL_SAVED_BYTES_KEY);
        const currentSaved = rawSaved ? parseInt(rawSaved, 10) : 0;
        await AsyncStorage.setItem(TOTAL_SAVED_BYTES_KEY, (currentSaved + record.fileSize).toString());
      } catch (delError) {
        console.warn('CloudSyncService: Local file purge warning', delError);
      }

      return true;
    } catch (e: any) {
      console.error(`CloudSyncService: Exception uploading call ID ${record.id}:`, e.message || e);
      return false;
    }
  }

  /**
   * Generates a secure, temporary signed URL (valid for 60 minutes)
   * so the native MediaPlayer can stream audio directly from Supabase.
   */
  static async getSignedStreamingUrl(storagePath: string): Promise<string | null> {
    try {
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(storagePath, 3600); // 1 hour validity

      if (error || !data?.signedUrl) {
        console.error('CloudSyncService: Failed to generate signed URL', error?.message);
        return null;
      }

      return data.signedUrl;
    } catch (e) {
      console.error('CloudSyncService: Error obtaining streaming URL', e);
      return null;
    }
  }

  /**
   * Returns total bytes of phone storage saved by cloud auto-purge.
   */
  static async getStorageSpaceSaved(): Promise<number> {
    try {
      const raw = await AsyncStorage.getItem(TOTAL_SAVED_BYTES_KEY);
      return raw ? parseInt(raw, 10) : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Deletes a recording from Supabase storage and database.
   */
  static async deleteFromCloud(storagePath: string, localId: number): Promise<boolean> {
    try {
      // 1. Remove from Supabase Storage
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);

      // 2. Remove from Supabase Table
      await supabase.from('callvault_records').delete().eq('audio_path', storagePath);

      // 3. Remove local reference
      await NativeBridge.deleteCallRecord(localId);

      return true;
    } catch (e) {
      console.error('CloudSyncService: Error deleting cloud record', e);
      return false;
    }
  }
}
