export interface CallRecord {
  id: number;
  phoneNumber: string;
  filePath: string;
  startTime: number;
  endTime: number;
  duration: number; // in seconds
  callType: 'INCOMING' | 'OUTGOING' | 'MISSED';
  fileSize: number; // in bytes
  createdAt: number;
}

export interface StorageUsage {
  totalBytes: number;
  totalCount: number;
}

export interface AppSettings {
  autoRecord: boolean;
  recordIncoming: boolean;
  recordOutgoing: boolean;
  audioQuality: 'high' | 'medium' | 'low';
  storageLocation: string;
  darkMode: boolean;
  appVisible: boolean;
}
