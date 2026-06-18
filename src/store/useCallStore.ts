import { create } from 'zustand';
import { CallRecord, AppSettings, StorageUsage } from '../types';
import { NativeBridge } from '../services/NativeBridge';

interface CallStoreState {
  records: CallRecord[];
  filteredRecords: CallRecord[];
  storageUsage: StorageUsage;
  todayCallsCount: number;
  settings: AppSettings;
  isServiceRunning: boolean;
  searchQuery: string;
  isLoading: boolean;

  // Actions
  loadAll: () => Promise<void>;
  checkServiceStatus: () => Promise<boolean>;
  loadRecords: () => Promise<void>;
  loadStats: () => Promise<void>;
  loadSettings: () => Promise<void>;
  updateSearchQuery: (query: string) => void;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  deleteRecord: (id: number) => Promise<boolean>;
  renameRecord: (id: number, newName: string) => Promise<boolean>;
  toggleService: () => Promise<void>;
}

const DEFAULT_SETTINGS: AppSettings = {
  autoRecord: true,
  recordIncoming: true,
  recordOutgoing: true,
  audioQuality: 'high',
  storageLocation: 'CallVault/',
  darkMode: true,
  appVisible: true,
};

export const useCallStore = create<CallStoreState>((set, get) => ({
  records: [],
  filteredRecords: [],
  storageUsage: { totalBytes: 0, totalCount: 0 },
  todayCallsCount: 0,
  settings: DEFAULT_SETTINGS,
  isServiceRunning: false,
  searchQuery: '',
  isLoading: false,

  loadAll: async () => {
    set({ isLoading: true });
    try {
      await get().checkServiceStatus();
      await get().loadSettings();
      await get().loadRecords();
      await get().loadStats();
    } catch (e) {
      console.error('useCallStore: loadAll failed', e);
    } finally {
      set({ isLoading: false });
    }
  },

  checkServiceStatus: async () => {
    const isRunning = await NativeBridge.isServiceRunning();
    set({ isServiceRunning: isRunning });
    return isRunning;
  },

  loadRecords: async () => {
    const list = await NativeBridge.getCallRecords();
    set({ records: list });
    get().updateSearchQuery(get().searchQuery);
  },

  loadStats: async () => {
    const stats = await NativeBridge.getStorageUsage();
    const count = await NativeBridge.getTodayCallsCount();
    set({ storageUsage: stats, todayCallsCount: count });
  },

  loadSettings: async () => {
    const nativeSettings = await NativeBridge.getSettings();
    if (nativeSettings) {
      set((state) => ({
        settings: {
          ...state.settings,
          autoRecord: nativeSettings.autoRecord,
          recordIncoming: nativeSettings.recordIncoming,
          recordOutgoing: nativeSettings.recordOutgoing,
          appVisible: nativeSettings.appVisible ?? true,
        },
      }));
    }
  },

  updateSearchQuery: (query: string) => {
    const { records } = get();
    if (!query.trim()) {
      set({ searchQuery: query, filteredRecords: records });
      return;
    }

    const lowerQuery = query.toLowerCase();
    const filtered = records.filter(
      (r) =>
        r.phoneNumber.toLowerCase().includes(lowerQuery) ||
        r.filePath.toLowerCase().includes(lowerQuery)
    );
    set({ searchQuery: query, filteredRecords: filtered });
  },

  updateSettings: async (newSettings: Partial<AppSettings>) => {
    set((state) => {
      const merged = { ...state.settings, ...newSettings };
      
      // Sync settings to native layer
      NativeBridge.updateSettings(
        merged.autoRecord,
        merged.recordIncoming,
        merged.recordOutgoing
      );

      // Sync app icon visibility to native layer if changed
      if (newSettings.appVisible !== undefined) {
        NativeBridge.setAppVisible(newSettings.appVisible);
      }

      // If autoRecord is disabled, we stop the foreground service
      if (newSettings.autoRecord === false) {
        NativeBridge.stopService().then(() => {
          set({ isServiceRunning: false });
        });
      } else if (newSettings.autoRecord === true && !state.isServiceRunning) {
        NativeBridge.startService(
          merged.autoRecord,
          merged.recordIncoming,
          merged.recordOutgoing
        ).then((started) => {
          set({ isServiceRunning: started });
        });
      }

      return { settings: merged };
    });
  },

  deleteRecord: async (id: number) => {
    const success = await NativeBridge.deleteCallRecord(id);
    if (success) {
      await get().loadRecords();
      await get().loadStats();
    }
    return success;
  },

  renameRecord: async (id: number, newName: string) => {
    const success = await NativeBridge.renameCallRecord(id, newName);
    if (success) {
      await get().loadRecords();
    }
    return success;
  },

  toggleService: async () => {
    const { isServiceRunning, settings } = get();
    if (isServiceRunning) {
      const success = await NativeBridge.stopService();
      if (success) set({ isServiceRunning: false });
    } else {
      const success = await NativeBridge.startService(
        settings.autoRecord,
        settings.recordIncoming,
        settings.recordOutgoing
      );
      if (success) set({ isServiceRunning: true });
    }
  },
}));
