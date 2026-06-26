import { NativeModules, Platform } from 'react-native';
import { CallRecord, StorageUsage } from '../types';

const { CallVaultModule } = NativeModules;

const isAndroid = Platform.OS === 'android';

if (!CallVaultModule && isAndroid) {
  console.error('CallVaultModule is not linked. Make sure to rebuild the native application.');
}

export const NativeBridge = {
  async startService(
    autoRecord: boolean,
    recordIncoming: boolean,
    recordOutgoing: boolean
  ): Promise<boolean> {
    if (!isAndroid) return false;
    try {
      return await CallVaultModule.startService(autoRecord, recordIncoming, recordOutgoing);
    } catch (e) {
      console.error('NativeBridge: startService failed', e);
      return false;
    }
  },

  async stopService(): Promise<boolean> {
    if (!isAndroid) return false;
    try {
      return await CallVaultModule.stopService();
    } catch (e) {
      console.error('NativeBridge: stopService failed', e);
      return false;
    }
  },

  async updateSettings(
    autoRecord: boolean,
    recordIncoming: boolean,
    recordOutgoing: boolean
  ): Promise<boolean> {
    if (!isAndroid) return false;
    try {
      return await CallVaultModule.updateSettings(autoRecord, recordIncoming, recordOutgoing);
    } catch (e) {
      console.error('NativeBridge: updateSettings failed', e);
      return false;
    }
  },

  async isServiceRunning(): Promise<boolean> {
    if (!isAndroid) return false;
    try {
      return await CallVaultModule.isServiceRunning();
    } catch (e) {
      console.error('NativeBridge: isServiceRunning failed', e);
      return false;
    }
  },

  async getSettings(): Promise<{ autoRecord: boolean; recordIncoming: boolean; recordOutgoing: boolean; appVisible?: boolean } | null> {
    if (!isAndroid) return null;
    try {
      return await CallVaultModule.getSettings();
    } catch (e) {
      console.error('NativeBridge: getSettings failed', e);
      return null;
    }
  },

  async setAppVisible(visible: boolean): Promise<boolean> {
    if (!isAndroid) return false;
    try {
      return await CallVaultModule.setAppVisible(visible);
    } catch (e) {
      console.error('NativeBridge: setAppVisible failed', e);
      return false;
    }
  },

  async isAppVisible(): Promise<boolean> {
    if (!isAndroid) return true;
    try {
      return await CallVaultModule.isAppVisible();
    } catch (e) {
      console.error('NativeBridge: isAppVisible failed', e);
      return true;
    }
  },

  async getCallRecords(): Promise<CallRecord[]> {
    if (!isAndroid) return [];
    try {
      return await CallVaultModule.getCallRecords();
    } catch (e) {
      console.error('NativeBridge: getCallRecords failed', e);
      return [];
    }
  },

  async searchCallRecords(query: string): Promise<CallRecord[]> {
    if (!isAndroid) return [];
    try {
      return await CallVaultModule.searchCallRecords(query);
    } catch (e) {
      console.error('NativeBridge: searchCallRecords failed', e);
      return [];
    }
  },

  async deleteCallRecord(id: number): Promise<boolean> {
    if (!isAndroid) return false;
    try {
      return await CallVaultModule.deleteCallRecord(id);
    } catch (e) {
      console.error(`NativeBridge: deleteCallRecord(${id}) failed`, e);
      return false;
    }
  },

  async renameCallRecord(id: number, newName: string): Promise<boolean> {
    if (!isAndroid) return false;
    try {
      return await CallVaultModule.renameCallRecord(id, newName);
    } catch (e) {
      console.error(`NativeBridge: renameCallRecord(${id}) failed`, e);
      return false;
    }
  },

  async getStorageUsage(): Promise<StorageUsage> {
    if (!isAndroid) return { totalBytes: 0, totalCount: 0 };
    try {
      return await CallVaultModule.getStorageUsage();
    } catch (e) {
      console.error('NativeBridge: getStorageUsage failed', e);
      return { totalBytes: 0, totalCount: 0 };
    }
  },

  async getTodayCallsCount(): Promise<number> {
    if (!isAndroid) return 0;
    try {
      return await CallVaultModule.getTodayCallsCount();
    } catch (e) {
      console.error('NativeBridge: getTodayCallsCount failed', e);
      return 0;
    }
  },

  async playAudio(filePath: string): Promise<boolean> {
    if (!isAndroid) return false;
    try {
      return await CallVaultModule.playAudio(filePath);
    } catch (e) {
      console.error('NativeBridge: playAudio failed', e);
      return false;
    }
  },

  async pauseAudio(): Promise<boolean> {
    if (!isAndroid) return false;
    try {
      return await CallVaultModule.pauseAudio();
    } catch (e) {
      console.error('NativeBridge: pauseAudio failed', e);
      return false;
    }
  },

  async resumeAudio(): Promise<boolean> {
    if (!isAndroid) return false;
    try {
      return await CallVaultModule.resumeAudio();
    } catch (e) {
      console.error('NativeBridge: resumeAudio failed', e);
      return false;
    }
  },

  async stopAudio(): Promise<boolean> {
    if (!isAndroid) return false;
    try {
      return await CallVaultModule.stopAudio();
    } catch (e) {
      console.error('NativeBridge: stopAudio failed', e);
      return false;
    }
  },

  async seekAudio(positionMs: number): Promise<boolean> {
    if (!isAndroid) return false;
    try {
      return await CallVaultModule.seekAudio(positionMs);
    } catch (e) {
      console.error('NativeBridge: seekAudio failed', e);
      return false;
    }
  },

  async getAudioPlaybackState(): Promise<{ isPlaying: boolean; currentPosition: number; duration: number }> {
    if (!isAndroid) return { isPlaying: false, currentPosition: 0, duration: 0 };
    try {
      return await CallVaultModule.getAudioPlaybackState();
    } catch (e) {
      console.error('NativeBridge: getAudioPlaybackState failed', e);
      return { isPlaying: false, currentPosition: 0, duration: 0 };
    }
  },

  async shareCallRecord(id: number): Promise<boolean> {
    if (!isAndroid) return false;
    try {
      return await CallVaultModule.shareCallRecord(id);
    } catch (e) {
      console.error(`NativeBridge: shareCallRecord(${id}) failed`, e);
      return false;
    }
  },

  async isIgnoringBatteryOptimizations(): Promise<boolean> {
    if (!isAndroid) return true;
    try {
      return await CallVaultModule.isIgnoringBatteryOptimizations();
    } catch (e) {
      console.error('NativeBridge: isIgnoringBatteryOptimizations failed', e);
      return true;
    }
  },

  async requestIgnoreBatteryOptimizations(): Promise<boolean> {
    if (!isAndroid) return false;
    try {
      return await CallVaultModule.requestIgnoreBatteryOptimizations();
    } catch (e) {
      console.error('NativeBridge: requestIgnoreBatteryOptimizations failed', e);
      return false;
    }
  },

  async openAutoStartSettings(): Promise<boolean> {
    if (!isAndroid) return false;
    try {
      return await CallVaultModule.openAutoStartSettings();
    } catch (e) {
      console.error('NativeBridge: openAutoStartSettings failed', e);
      return false;
    }
  },
};
