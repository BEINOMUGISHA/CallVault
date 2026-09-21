export type CallType = 'INCOMING' | 'OUTGOING' | 'MISSED';
export type SyncStatus = 'local_only' | 'pending' | 'uploading' | 'synced' | 'failed';
export type Sentiment = 'calm' | 'urgent' | 'agitated' | 'suspicious' | 'neutral';

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
  filePath: string;           // Local path if pending, or empty string if purged
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
}

export interface AppSettings {
  autoRecord: boolean;
  recordIncoming: boolean;
  recordOutgoing: boolean;
  audioQuality: 'high' | 'medium' | 'low';
  storageLocation: string;
  darkMode: boolean;
  appVisible: boolean;
  
  // Sophisticated Enhancements
  zeroStorageEnabled: boolean;     // Automatically purges local audio once uploaded
  autoSpeakerphone: boolean;       // Automatically triggers speakerphone for 2-way clarity
  dspNoiseSuppression: boolean;    // Hardware/Software DSP noise filter
  dspGainBoost: boolean;           // Automatic gain control boost
  
  // Security & Disguise
  calculatorDisguise: boolean;     // Boots into a working calculator
  passcode: string;                // Default '9999'
  duressPasscode: string;          // Fake vault passcode (e.g. '1111')
  flagSecureEnabled: boolean;      // Blocks screenshots & app switcher previews
  biometricsEnabled: boolean;      // Require fingerprint/face
}
