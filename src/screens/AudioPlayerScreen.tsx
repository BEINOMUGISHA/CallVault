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
  Dimensions,
} from 'react-native';
import { useCallStore } from '../store/useCallStore';
import { NativeBridge } from '../services/NativeBridge';
import { formatBytes, formatDate, formatDuration } from '../utils/format';
import { CallRecord } from '../types';

export default function AudioPlayerScreen({ route, navigation }: any) {
  const recordParam: CallRecord = route.params.record;
  const { deleteRecord, renameRecord } = useCallStore();

  const [record, setRecord] = useState<CallRecord>(recordParam);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0); // in ms
  const [duration, setDuration] = useState(recordParam.duration * 1000); // in ms
  const [isLoading, setIsLoading] = useState(false);

  // Rename modal state
  const [renameVisible, setRenameVisible] = useState(false);
  const [newName, setNewName] = useState('');

  const timerRef = useRef<any>(null);

  const filename = record.filePath.split('/').pop() || 'Recording.m4a';

  // Stop playback when leaving screen
  useEffect(() => {
    NativeBridge.stopAudio();
    return () => {
      stopProgressPolling();
      NativeBridge.stopAudio();
    };
  }, []);

  const startProgressPolling = () => {
    stopProgressPolling();
    timerRef.current = setInterval(async () => {
      const state = await NativeBridge.getAudioPlaybackState();
      setPosition(state.currentPosition);
      if (state.duration > 0) {
        setDuration(state.duration);
      }
      setIsPlaying(state.isPlaying);
      if (!state.isPlaying && state.currentPosition >= duration - 500 && state.currentPosition > 0) {
        // Audio finished playing
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
      const success = await NativeBridge.pauseAudio();
      if (success) {
        setIsPlaying(false);
        stopProgressPolling();
      }
    } else {
      setIsLoading(true);
      // If position is at 0, start from beginning, else resume
      let success = false;
      if (position === 0) {
        success = await NativeBridge.playAudio(record.filePath);
      } else {
        success = await NativeBridge.resumeAudio();
      }
      setIsLoading(false);

      if (success) {
        setIsPlaying(true);
        startProgressPolling();
      } else {
        Alert.alert('Playback Error', 'Failed to play the selected recording. The file may be corrupt or missing.');
      }
    }
  };

  const handleSeek = async (event: any) => {
    const { locationX } = event.nativeEvent;
    const progressWidth = Dimensions.get('window').width - 80; // horizontal padding space
    const percentage = Math.max(0, Math.min(1, locationX / progressWidth));
    const seekPositionMs = percentage * duration;

    setPosition(seekPositionMs);
    await NativeBridge.seekAudio(seekPositionMs);
    if (isPlaying) {
      startProgressPolling();
    }
  };

  const handleShare = async () => {
    const success = await NativeBridge.shareCallRecord(record.id);
    if (!success) {
      Alert.alert('Share Failed', 'Could not open sharing for this recording.');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Recording',
      'Are you sure you want to permanently delete this recording? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteRecord(record.id);
            if (success) {
              navigation.goBack();
            } else {
              Alert.alert('Error', 'Failed to delete call record.');
            }
          },
        },
      ]
    );
  };

  const handleRename = async () => {
    if (!newName.trim()) {
      Alert.alert('Error', 'Filename cannot be empty.');
      return;
    }

    const success = await renameRecord(record.id, newName.trim());
    if (success) {
      // Find the updated record from store to show the updated filePath
      const updatedList = useCallStore.getState().records;
      const updatedRecord = updatedList.find((r) => r.id === record.id);
      if (updatedRecord) {
        setRecord(updatedRecord);
      } else {
        // Fallback: update filePath string structure locally
        const parentPath = record.filePath.substring(0, record.filePath.lastIndexOf('/') + 1);
        const extension = record.filePath.split('.').pop();
        setRecord({
          ...record,
          filePath: `${parentPath}${newName.trim()}.${extension}`,
        });
      }
      setRenameVisible(false);
      setNewName('');
      Alert.alert('Success', 'Recording renamed successfully.');
    } else {
      Alert.alert('Error', 'Failed to rename recording. Ensure symbols are not used.');
    }
  };

  const progressPercent = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Audio Player</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.content}>
        {/* Disc/Record visualization */}
        <View style={[styles.discContainer, isPlaying && styles.discContainerPlaying]}>
          <View style={styles.discOuter}>
            <View style={styles.discInner}>
              <Text style={styles.discIcon}>🎙️</Text>
            </View>
          </View>
        </View>

        {/* Metadata Details */}
        <View style={styles.metaContainer}>
          <Text style={styles.callTypeBadge}>
            {record.callType === 'INCOMING' ? '📥 INCOMING CALL' : record.callType === 'OUTGOING' ? '📤 OUTGOING CALL' : '❌ MISSED CALL'}
          </Text>
          <Text style={styles.phoneText}>{record.phoneNumber}</Text>
          <Text style={styles.fileNameText} numberOfLines={1}>{filename}</Text>
          <Text style={styles.dateText}>{formatDate(record.startTime)}</Text>
          <Text style={styles.fileSizeText}>File size: {formatBytes(record.fileSize)}</Text>
        </View>

        {/* Playback Progress Scrubber */}
        <View style={styles.progressContainer}>
          <TouchableOpacity
            style={styles.progressBarWrapper}
            onPress={handleSeek}
            activeOpacity={1}
          >
            <View style={styles.progressBarBackground}>
              <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
            </View>
          </TouchableOpacity>
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatDuration(position / 1000)}</Text>
            <Text style={styles.timeText}>{formatDuration(duration / 1000)}</Text>
          </View>
        </View>

        {/* Main Controls */}
        <View style={styles.controlsContainer}>
          <TouchableOpacity
            style={styles.playButton}
            onPress={handlePlayPause}
            disabled={isLoading || record.callType === 'MISSED'}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.playButtonText}>{isPlaying ? '⏸️' : '▶️'}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Actions bar (Rename, Share, Delete) */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.actionItem} onPress={() => {
            setNewName(filename.substring(0, filename.lastIndexOf('.')) || filename);
            setRenameVisible(true);
          }}>
            <Text style={styles.actionIcon}>✏️</Text>
            <Text style={styles.actionText}>Rename</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem} onPress={handleShare}>
            <Text style={styles.actionIcon}>🔗</Text>
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem} onPress={handleDelete}>
            <Text style={[styles.actionIcon, { color: '#EF4444' }]}>🗑️</Text>
            <Text style={[styles.actionText, { color: '#EF4444' }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Rename Dialog Modal */}
      <Modal
        visible={renameVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameVisible(false)}
      >
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
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setRenameVisible(false)}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleRename}
              >
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
    paddingTop: 40,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  backButtonText: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    color: '#F8FAFC',
    fontWeight: '700',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 40,
    paddingVertical: 20,
  },
  discContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  discContainerPlaying: {
    // We could add rotational styling or animations here
  },
  discOuter: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 8,
    borderColor: '#334155',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  discInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#2563EB',
  },
  discIcon: {
    fontSize: 24,
  },
  metaContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },
  callTypeBadge: {
    fontSize: 10,
    color: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  phoneText: {
    fontSize: 24,
    color: '#F8FAFC',
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  fileNameText: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 4,
    textAlign: 'center',
    maxWidth: 250,
  },
  dateText: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 4,
  },
  fileSizeText: {
    fontSize: 11,
    color: '#64748B',
  },
  progressContainer: {
    width: '100%',
    marginVertical: 10,
  },
  progressBarWrapper: {
    paddingVertical: 10, // extra tap target space
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: '#334155',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2563EB',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  timeText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  controlsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  playButtonText: {
    fontSize: 28,
    color: '#FFFFFF',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 10,
    marginTop: 10,
  },
  actionItem: {
    alignItems: 'center',
    flex: 1,
  },
  actionIcon: {
    fontSize: 22,
    marginBottom: 4,
    color: '#38BDF8',
  },
  actionText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    elevation: 10,
  },
  modalTitle: {
    fontSize: 16,
    color: '#F8FAFC',
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    height: 48,
    color: '#F8FAFC',
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
  },
  modalButtonCancel: {
    backgroundColor: '#334155',
  },
  modalButtonCancelText: {
    color: '#94A3B8',
    fontWeight: '600',
  },
  modalButtonConfirm: {
    backgroundColor: '#2563EB',
  },
  modalButtonConfirmText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
