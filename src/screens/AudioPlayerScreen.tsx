import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useCallStore } from '../store/useCallStore';
import { NativeBridge } from '../services/NativeBridge';
import { CloudSyncService } from '../services/CloudSyncService';
import { AIService } from '../services/AIService';
import { formatBytes, formatDate, formatDuration } from '../utils/format';
import { CallRecord, AISummary } from '../types';
import WaveformVisualizer from '../components/WaveformVisualizer';
import TranscriptViewer from '../components/TranscriptViewer';

type Tab = 'audio' | 'transcript' | 'summary';

export default function AudioPlayerScreen({ route, navigation }: any) {
  const recordParam: CallRecord = route.params.record;
  const { deleteRecord, renameRecord } = useCallStore();

  const [record, setRecord] = useState<CallRecord>(recordParam);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);      // ms
  const [duration, setDuration] = useState(recordParam.duration * 1000); // ms
  const [isLoading, setIsLoading] = useState(false);
  const [streamingUrl, setStreamingUrl] = useState<string>('');
  const [activeTab, setActiveTab] = useState<Tab>('audio');

  // AI state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<AISummary | null>(null);
  const [transcript, setTranscript] = useState<string>('');

  // Rename modal
  const [renameVisible, setRenameVisible] = useState(false);
  const [newName, setNewName] = useState('');

  const timerRef = useRef<any>(null);

  const filename = record.cloudStorageId
    ? record.cloudStorageId.split('/').pop() || 'Cloud Recording'
    : record.filePath.split('/').pop() || 'Recording.mp3';

  const isCloudRecord = !!(record.cloudStorageId && record.syncStatus === 'synced');

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  useEffect(() => {
    // Stop any previous playback
    NativeBridge.stopAudio();
    // Kick off AI analysis in background
    triggerAIAnalysis();
    return () => {
      stopProgressPolling();
      NativeBridge.stopAudio();
    };
  }, []);

  // ── AI Analysis ───────────────────────────────────────────────────────────

  const triggerAIAnalysis = async () => {
    setAiLoading(true);
    try {
      const result = await AIService.analyzeCall(
        record.id,
        record.phoneNumber,
        record.duration,
        record.callType
      );
      if (result) {
        setTranscript(result.transcript || '');
        setAiSummary(result.summary || null);
      }
    } catch (e) {
      // Non-fatal — AI is best-effort
    } finally {
      setAiLoading(false);
    }
  };

  // ── Streaming URL ─────────────────────────────────────────────────────────

  const getPlaybackUrl = async (): Promise<string | null> => {
    if (isCloudRecord) {
      try {
        const url = await CloudSyncService.getSignedStreamingUrl(record.cloudStorageId!);
        if (!url) {
          Alert.alert('Stream Error', 'Could not get cloud streaming URL. Check your connection.');
          return null;
        }
        setStreamingUrl(url);
        return url;
      } catch {
        Alert.alert('Stream Error', 'Could not get cloud streaming URL. Check your connection.');
        return null;
      }
    } else if (record.filePath) {
      return record.filePath;
    }
    Alert.alert('No Audio Source', 'This recording has no local file and no cloud backup.');
    return null;
  };

  // ── Playback Controls ─────────────────────────────────────────────────────

  const startProgressPolling = () => {
    stopProgressPolling();
    timerRef.current = setInterval(async () => {
      const state = await NativeBridge.getAudioPlaybackState();
      setPosition(state.currentPosition);
      if (state.duration > 0) setDuration(state.duration);
      setIsPlaying(state.isPlaying);
      if (!state.isPlaying && state.currentPosition >= duration - 500 && state.currentPosition > 0) {
        setIsPlaying(false);
        setPosition(0);
        stopProgressPolling();
      }
    }, 250);
  };

  const stopProgressPolling = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handlePlayPause = async () => {
    if (isPlaying) {
      const ok = await NativeBridge.pauseAudio();
      if (ok) { setIsPlaying(false); stopProgressPolling(); }
      return;
    }

    setIsLoading(true);
    let success = false;

    if (position === 0) {
      // Fresh start — resolve URL first
      const url = await getPlaybackUrl();
      if (!url) { setIsLoading(false); return; }
      success = await NativeBridge.playAudio(url);
    } else {
      success = await NativeBridge.resumeAudio();
    }

    setIsLoading(false);
    if (success) {
      setIsPlaying(true);
      startProgressPolling();
    } else {
      Alert.alert('Playback Error', 'Failed to play the recording. The file may be missing or the stream unavailable.');
    }
  };

  const handleSeek = async (positionMs: number) => {
    setPosition(positionMs);
    await NativeBridge.seekAudio(positionMs);
    if (isPlaying) startProgressPolling();
  };

  const handleRewind = () => handleSeek(Math.max(0, position - 10000));
  const handleForward = () => handleSeek(Math.min(duration, position + 10000));

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleShare = async () => {
    if (isCloudRecord) {
      // Share the signed streaming URL
      try {
        const url = await CloudSyncService.getSignedStreamingUrl(record.cloudStorageId!);
        if (url) {
          Alert.alert('Cloud Link', url, [{ text: 'Close' }]);
        } else {
          Alert.alert('Error', 'Could not generate share link.');
        }
      } catch {
        Alert.alert('Error', 'Could not generate share link.');
      }
      return;
    }
    const ok = await NativeBridge.shareCallRecord(record.id);
    if (!ok) Alert.alert('Share Failed', 'Could not open sharing for this recording.');
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Recording',
      'Permanently delete this recording from both device and cloud? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Delete from cloud if synced
            if (isCloudRecord && record.cloudStorageId) {
              await CloudSyncService.deleteFromCloud(record.cloudStorageId, record.id);
            }
            const ok = await deleteRecord(record.id);
            if (ok) navigation.goBack();
            else Alert.alert('Error', 'Failed to delete call record.');
          },
        },
      ]
    );
  };

  const handleRename = async () => {
    if (!newName.trim()) { Alert.alert('Error', 'Filename cannot be empty.'); return; }
    const ok = await renameRecord(record.id, newName.trim());
    if (ok) {
      const updatedList = useCallStore.getState().records;
      const updated = updatedList.find((r) => r.id === record.id);
      if (updated) setRecord(updated);
      setRenameVisible(false);
      setNewName('');
      Alert.alert('Success', 'Recording renamed successfully.');
    } else {
      Alert.alert('Error', 'Failed to rename recording.');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const progressPercent = duration > 0 ? position / duration : 0;
  const syncBadgeColor = isCloudRecord ? '#10B981' : record.syncStatus === 'pending' ? '#F59E0B' : '#64748B';
  const syncBadgeText = isCloudRecord ? '☁️ Cloud' : record.syncStatus === 'pending' ? '⏳ Pending' : '📱 Local';

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Audio Player</Text>
        <TouchableOpacity onPress={handleShare}>
          <Text style={styles.shareIcon}>🔗</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {(['audio', 'transcript', 'summary'] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'audio' ? '🎵 Audio' : tab === 'transcript' ? '📝 Transcript' : '🧠 AI Summary'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Audio Tab ─────────────────────────────────────────────────── */}
        {activeTab === 'audio' && (
          <>
            {/* Metadata */}
            <View style={styles.metaCard}>
              <View style={styles.metaRow}>
                <Text style={styles.callTypeBadge}>
                  {record.callType === 'INCOMING' ? '📥 INCOMING' : record.callType === 'OUTGOING' ? '📤 OUTGOING' : '❌ MISSED'}
                </Text>
                <Text style={[styles.syncBadge, { backgroundColor: syncBadgeColor + '22', color: syncBadgeColor }]}>
                  {syncBadgeText}
                </Text>
              </View>
              <Text style={styles.phoneText}>{record.phoneNumber}</Text>
              <Text style={styles.fileNameText} numberOfLines={1}>{filename}</Text>
              <Text style={styles.dateText}>{formatDate(record.startTime)}</Text>
              <Text style={styles.fileSizeText}>{formatBytes(record.fileSize)}</Text>
            </View>

            {/* Waveform Visualizer */}
            <View style={styles.waveformContainer}>
              <WaveformVisualizer
                duration={duration}
                position={position}
                onSeek={handleSeek}
                isPlaying={isPlaying}
              />
              <View style={styles.timeRow}>
                <Text style={styles.timeText}>{formatDuration(position / 1000)}</Text>
                <Text style={styles.timeText}>{formatDuration(duration / 1000)}</Text>
              </View>
            </View>

            {/* Transport Controls */}
            <View style={styles.transportRow}>
              <TouchableOpacity style={styles.skipBtn} onPress={handleRewind}>
                <Text style={styles.skipBtnText}>⏪ 10s</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.playButton}
                onPress={handlePlayPause}
                disabled={isLoading || record.callType === 'MISSED'}
                activeOpacity={0.8}
              >
                {isLoading
                  ? <ActivityIndicator color="#FFFFFF" size="small" />
                  : <Text style={styles.playButtonText}>{isPlaying ? '⏸' : '▶'}</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity style={styles.skipBtn} onPress={handleForward}>
                <Text style={styles.skipBtnText}>10s ⏩</Text>
              </TouchableOpacity>
            </View>

            {/* Action buttons */}
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => {
                setNewName(filename.replace(/\.[^/.]+$/, ''));
                setRenameVisible(true);
              }}>
                <Text style={styles.actionBtnIcon}>✏️</Text>
                <Text style={styles.actionBtnText}>Rename</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={handleDelete}>
                <Text style={styles.actionBtnIcon}>🗑️</Text>
                <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── Transcript Tab ─────────────────────────────────────────────── */}
        {activeTab === 'transcript' && (
          <View style={styles.aiTabContent}>
            {aiLoading ? (
              <View style={styles.aiLoadingBox}>
                <ActivityIndicator color="#38BDF8" size="large" />
                <Text style={styles.aiLoadingText}>Analyzing call audio…</Text>
              </View>
            ) : (
              <TranscriptViewer
                transcript={transcript}
              />
            )}
          </View>
        )}

        {/* ── AI Summary Tab ─────────────────────────────────────────────── */}
        {activeTab === 'summary' && (
          <View style={styles.aiTabContent}>
            {aiLoading ? (
              <View style={styles.aiLoadingBox}>
                <ActivityIndicator color="#38BDF8" size="large" />
                <Text style={styles.aiLoadingText}>Generating AI summary…</Text>
              </View>
            ) : aiSummary ? (
              <TranscriptViewer
                summary={aiSummary}
              />
            ) : (
              <View style={styles.aiEmptyBox}>
                <Text style={styles.aiEmptyIcon}>🧠</Text>
                <Text style={styles.aiEmptyText}>No AI analysis available</Text>
                <Text style={styles.aiEmptySubText}>
                  AI analysis runs automatically for all recordings with audio content.
                </Text>
                <TouchableOpacity style={styles.retryBtn} onPress={triggerAIAnalysis}>
                  <Text style={styles.retryBtnText}>Retry Analysis</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

      </ScrollView>

      {/* Rename Modal */}
      <Modal visible={renameVisible} transparent animationType="fade" onRequestClose={() => setRenameVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Rename File</Text>
            <TextInput
              style={styles.modalInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="Enter new filename"
              placeholderTextColor="#64748B"
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonCancel]} onPress={() => setRenameVisible(false)}>
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonConfirm]} onPress={handleRename}>
                <Text style={styles.modalButtonConfirmText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 44,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  backButton: { paddingVertical: 6, paddingHorizontal: 4 },
  backButtonText: { color: '#38BDF8', fontSize: 14, fontWeight: '600' },
  headerTitle: { fontSize: 17, color: '#F8FAFC', fontWeight: '700' },
  shareIcon: { fontSize: 20, paddingHorizontal: 4 },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabItemActive: {
    borderBottomWidth: 2,
    borderColor: '#2563EB',
  },
  tabText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  tabTextActive: { color: '#38BDF8' },

  scrollContent: { padding: 16, paddingBottom: 40 },

  // Meta card
  metaCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  callTypeBadge: {
    fontSize: 10, color: '#38BDF8', backgroundColor: 'rgba(56,189,248,0.12)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, fontWeight: '700',
  },
  syncBadge: {
    fontSize: 10, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, fontWeight: '700',
  },
  phoneText: { fontSize: 22, color: '#F8FAFC', fontWeight: '800', marginBottom: 4 },
  fileNameText: { fontSize: 12, color: '#94A3B8', marginBottom: 3, maxWidth: 260 },
  dateText: { fontSize: 11, color: '#64748B', marginBottom: 3 },
  fileSizeText: { fontSize: 11, color: '#64748B' },

  // Waveform
  waveformContainer: { marginBottom: 16 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  timeText: { fontSize: 12, color: '#64748B', fontWeight: '500' },

  // Transport
  transportRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24, gap: 24 },
  skipBtn: {
    backgroundColor: '#1E293B', borderRadius: 10, paddingVertical: 10,
    paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  skipBtnText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  playButton: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowColor: '#2563EB', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8,
  },
  playButtonText: { fontSize: 26, color: '#FFFFFF' },

  // Actions
  actionsRow: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  actionBtn: {
    flex: 1, alignItems: 'center', backgroundColor: '#1E293B',
    borderRadius: 12, paddingVertical: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  deleteBtn: { borderColor: 'rgba(239,68,68,0.2)' },
  actionBtnIcon: { fontSize: 20, marginBottom: 4 },
  actionBtnText: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },

  // AI tabs
  aiTabContent: { paddingTop: 4 },
  aiLoadingBox: { alignItems: 'center', paddingVertical: 60 },
  aiLoadingText: { color: '#94A3B8', fontSize: 14, marginTop: 12 },
  aiEmptyBox: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 20 },
  aiEmptyIcon: { fontSize: 48, marginBottom: 12 },
  aiEmptyText: { color: '#F8FAFC', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  aiEmptySubText: { color: '#64748B', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  retryBtn: { backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 24 },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalContent: {
    width: '80%', backgroundColor: '#1E293B', borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', elevation: 10,
  },
  modalTitle: { fontSize: 16, color: '#F8FAFC', fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  modalInput: {
    backgroundColor: '#0F172A', borderRadius: 8, height: 48, color: '#F8FAFC',
    paddingHorizontal: 12, fontSize: 14, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between' },
  modalButton: { flex: 1, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginHorizontal: 6 },
  modalButtonCancel: { backgroundColor: '#334155' },
  modalButtonCancelText: { color: '#94A3B8', fontWeight: '600' },
  modalButtonConfirm: { backgroundColor: '#2563EB' },
  modalButtonConfirmText: { color: '#FFFFFF', fontWeight: '600' },
});
