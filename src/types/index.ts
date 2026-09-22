export type CallType = 'INCOMING' | 'OUTGOING' | 'MISSED';
export type SyncStatus = 'local_only' | 'pending' | 'uploading' | 'synced' | 'failed';
export type Sentiment = 'calm' | 'urgent' | 'agitated' | 'suspicious' | 'neutral';
export type AudioQuality = 'high' | 'medium' | 'low';

export interface AISummary {
  overview: string;
  keyPoints: string[];
  actionItems: string[];
  sentiment: Sentiment;
  isScamFlagged?: boolean;
}

export interface CallRecord {
  id: number;
  phoneNumber: string;
  contactName?: string;
  filePath: string;           // Local path (.mp3.enc if encrypted) or empty if purged
  isEncrypted?: boolean;      // True when filePath points to AES-256-GCM .enc file
  cloudStorageId?: string;    // Supabase storage path: {userId}/{fileName}
  cloudRecordId?: string;     // Supabase database UUID
  syncStatus: SyncStatus;
  startTime: number;          // Epoch ms
  endTime: number;            // Epoch ms
  duration: number;           // Seconds
  callType: CallType;
  fileSize: number;           // Bytes
  createdAt: number;

  // AI & Analytics Fields
  transcript?: string;
  aiSummary?: AISummary;

  // Protection & Security
  isFavorite?: boolean;
  isLocked?: boolean;
  isDecoy?: boolean;          // Displayed in duress mode
  note?: string;
  tags?: string[];
}

export interface StorageUsage {
  totalBytes: number;
  totalCount: number;
  cloudBytesSaved?: number;
  encryptedCount?: number;    // Number of locally-stored encrypted files
}

export interface RetentionPolicy {
  enabled: boolean;
  keepDays: number;           // Auto-delete recordings older than N days (0 = keep forever)
  keepFavoritesForever: boolean;
  keepLockedForever: boolean;
  maxLocalStorageMb: number;  // Pause recording when local vault exceeds this (0 = unlimited)
}

export interface AppSettings {
  autoRecord: boolean;
  recordIncoming: boolean;
  recordOutgoing: boolean;
  audioQuality: AudioQuality;
  storageLocation: string;
  darkMode: boolean;
  appVisible: boolean;

  // Encryption
  e2eEncryptionEnabled: boolean;   // AES-256-GCM encrypt before saving (default: true)

  // Retention & Storage
  retention: RetentionPolicy;
  wifiOnlySync: boolean;           // Only upload to Supabase on Wi-Fi

  // Audio Enhancement
  zeroStorageEnabled: boolean;     // Purge local audio once successfully uploaded
  autoSpeakerphone: boolean;       // Trigger speakerphone for 2-way clarity
  dspNoiseSuppression: boolean;    // Hardware/Software DSP noise filter
  dspGainBoost: boolean;           // Automatic gain control boost

  // Security & Disguise
  calculatorDisguise: boolean;     // Boots into a working calculator
  passcode: string;                // Default '9999'
  duressPasscode: string;          // Fake vault passcode (e.g. '1111')
  flagSecureEnabled: boolean;      // Blocks screenshots & app switcher previews
  biometricsEnabled: boolean;      // Require fingerprint/face
}

// Default values for easy initialization
export const DEFAULT_RETENTION: RetentionPolicy = {
  enabled: false,
  keepDays: 30,
  keepFavoritesForever: true,
  keepLockedForever: true,
  maxLocalStorageMb: 500,
};

export const DEFAULT_SETTINGS: Partial<AppSettings> = {
  autoRecord: true,
  recordIncoming: true,
  recordOutgoing: true,
  audioQuality: 'high',
  darkMode: true,
  appVisible: true,
  e2eEncryptionEnabled: true,
  wifiOnlySync: true,
  zeroStorageEnabled: false,
  autoSpeakerphone: false,
  dspNoiseSuppression: false,
  dspGainBoost: false,
  calculatorDisguise: false,
  passcode: '9999',
  duressPasscode: '',
  flagSecureEnabled: false,
  biometricsEnabled: false,
  retention: DEFAULT_RETENTION,
};


