import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  PermissionsAndroid,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useCallStore } from '../store/useCallStore';
import { formatBytes } from '../utils/format';
import TabBar from '../components/TabBar';

export default function DashboardScreen({ navigation }: any) {
  const {
    isLoading,
    isServiceRunning,
    storageUsage,
    todayCallsCount,
    records,
    settings,
    loadAll,
    toggleService,
  } = useCallStore();

  useEffect(() => {
    // Initial data loading and status check
    loadAll();
    requestPermissions();

    // Poll service status every 3 seconds to keep UI synced
    const interval = setInterval(() => {
      useCallStore.getState().checkServiceStatus();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS !== 'android') return;

    try {
      const permissions = [
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
      ];

      const results = await PermissionsAndroid.requestMultiple(permissions);
      
      const audioGranted = results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
      const phoneGranted = results[PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE] === PermissionsAndroid.RESULTS.GRANTED;

      if (!audioGranted || !phoneGranted) {
        Alert.alert(
          'Permissions Required',
          'CallVault needs Record Audio and Phone State permissions to automatically record calls in the background.',
          [{ text: 'OK' }]
        );
      }
    } catch (err) {
      console.warn(err);
    }
  };

  const handleToggleService = async () => {
    await toggleService();
  };

  const recentRecords = records.slice(0, 3);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerSubtitle}>SECURE PHONE ARCHIVE</Text>
          <Text style={styles.headerTitle}>CallVault</Text>
        </View>

        {/* Service Running Status Card */}
        <View style={[styles.card, styles.statusCard]}>
          <View style={styles.statusInfo}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isServiceRunning ? '#10B981' : '#EF4444' },
              ]}
            />
            <Text style={styles.statusLabel}>
              Recording Engine: {isServiceRunning ? 'ACTIVE' : 'STOPPED'}
            </Text>
          </View>
          <Text style={styles.statusDesc}>
            {isServiceRunning
              ? 'Background service is running and monitoring telephony actions.'
              : 'Auto-recording is inactive. Tap below to launch background services.'}
          </Text>
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: isServiceRunning ? '#EF4444' : '#2563EB' },
            ]}
            onPress={handleToggleService}
            activeOpacity={0.8}
          >
            <Text style={styles.actionButtonText}>
              {isServiceRunning ? 'Stop Engine' : 'Activate Engine'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Loading Indicator */}
        {isLoading && (
          <ActivityIndicator size="small" color="#38BDF8" style={{ marginVertical: 10 }} />
        )}

        {/* Stats Section */}
        <Text style={styles.sectionTitle}>Vault Statistics</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>🎙️</Text>
            <Text style={styles.statValue}>{storageUsage.totalCount}</Text>
            <Text style={styles.statLabel}>Total Files</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statIcon}>💾</Text>
            <Text style={styles.statValue}>{formatBytes(storageUsage.totalBytes)}</Text>
            <Text style={styles.statLabel}>Storage Used</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statIcon}>📞</Text>
            <Text style={styles.statValue}>{todayCallsCount}</Text>
            <Text style={styles.statLabel}>Calls Today</Text>
          </View>
        </View>

        {/* Recent Recordings */}
        <View style={styles.recentHeader}>
          <Text style={styles.sectionTitle}>Recent Audio Files</Text>
          <TouchableOpacity onPress={() => navigation.replace('Recordings')}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {recentRecords.length === 0 ? (
          <View style={[styles.card, styles.emptyCard]}>
            <Text style={styles.emptyText}>No call recordings captured yet.</Text>
            <Text style={styles.emptySubText}>
              Once you place or receive calls, recordings will show up here.
            </Text>
          </View>
        ) : (
          recentRecords.map((item) => {
            const dateStr = new Date(item.startTime).toLocaleDateString();
            const timeStr = new Date(item.startTime).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });
            const filename = item.filePath.split('/').pop() || 'Recording';

            return (
              <TouchableOpacity
                key={item.id}
                style={styles.recordItem}
                onPress={() => navigation.navigate('AudioPlayer', { record: item })}
              >
                <View style={styles.recordMain}>
                  <Text style={styles.recordIcon}>
                    {item.callType === 'INCOMING'
                      ? '📥'
                      : item.callType === 'OUTGOING'
                      ? '📤'
                      : '❌'}
                  </Text>
                  <View style={styles.recordDetails}>
                    <Text style={styles.recordPhone}>{item.phoneNumber}</Text>
                    <Text style={styles.recordMeta}>
                      {dateStr} • {timeStr}
                    </Text>
                  </View>
                </View>
                <View style={styles.recordRight}>
                  <Text style={styles.recordDuration}>
                    {Math.floor(item.duration / 60)}m {item.duration % 60}s
                  </Text>
                  <Text style={styles.recordSize}>{formatBytes(item.fileSize)}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
      {/* Bottom Navigation */}
      <TabBar currentRoute="Dashboard" navigation={navigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A', // Deep background
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 110, // space for tab bar
  },
  header: {
    marginTop: 20,
    marginBottom: 24,
  },
  headerSubtitle: {
    fontSize: 10,
    color: '#38BDF8', // Accent light blue
    letterSpacing: 2,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 28,
    color: '#F8FAFC',
    fontWeight: '800',
  },
  card: {
    backgroundColor: '#1E293B', // Surface secondary
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  statusCard: {
    marginBottom: 24,
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  statusLabel: {
    fontSize: 14,
    color: '#F8FAFC',
    fontWeight: '700',
  },
  statusDesc: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
    marginBottom: 16,
  },
  actionButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 16,
    color: '#F8FAFC',
    fontWeight: '700',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  statIcon: {
    fontSize: 20,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 16,
    color: '#F8FAFC',
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
    textAlign: 'center',
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewAllText: {
    fontSize: 13,
    color: '#38BDF8',
    fontWeight: '600',
  },
  emptyCard: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  emptyText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptySubText: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  recordItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  recordMain: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  recordIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  recordDetails: {
    flex: 1,
  },
  recordPhone: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  recordMeta: {
    color: '#94A3B8',
    fontSize: 11,
  },
  recordRight: {
    alignItems: 'flex-end',
  },
  recordDuration: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  recordSize: {
    color: '#94A3B8',
    fontSize: 11,
  },
});
