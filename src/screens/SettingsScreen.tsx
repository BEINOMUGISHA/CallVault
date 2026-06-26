import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { useCallStore } from '../store/useCallStore';
import TabBar from '../components/TabBar';
import { NativeBridge } from '../services/NativeBridge';

export default function SettingsScreen({ navigation }: any) {
  const { settings, updateSettings, isServiceRunning, toggleService } = useCallStore();

  const [isBatteryIgnored, setIsBatteryIgnored] = React.useState(true);

  React.useEffect(() => {
    checkBatteryOptimization();
  }, []);

  const checkBatteryOptimization = async () => {
    const ignored = await NativeBridge.isIgnoringBatteryOptimizations();
    setIsBatteryIgnored(ignored);
  };

  const handleRequestBatteryIgnore = async () => {
    if (isBatteryIgnored) {
      Alert.alert('Settings', 'Battery optimizations are already disabled for CallVault.');
      return;
    }
    const success = await NativeBridge.requestIgnoreBatteryOptimizations();
    if (success) {
      // Re-check after a brief delay
      setTimeout(checkBatteryOptimization, 2000);
    }
  };

  const handleOpenAutoStart = async () => {
    Alert.alert(
      'Allow Auto-Start',
      'Please ensure "Auto-Start" or "Background Activity" is allowed for CallVault in the settings page that opens.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => NativeBridge.openAutoStartSettings() }
      ]
    );
  };

  const handleToggleAutoRecord = (value: boolean) => {
    updateSettings({ autoRecord: value });
  };

  const handleToggleIncoming = (value: boolean) => {
    updateSettings({ recordIncoming: value });
  };

  const handleToggleOutgoing = (value: boolean) => {
    updateSettings({ recordOutgoing: value });
  };

  const handleQualityChange = (quality: 'high' | 'medium' | 'low') => {
    updateSettings({ audioQuality: quality });
    Alert.alert('Quality Updated', `Audio compression adjusted to ${quality.toUpperCase()} mode.`);
  };

  const handleToggleStealthMode = (hide: boolean) => {
    if (hide) {
      Alert.alert(
        'Enable Stealth Mode?',
        'This will hide CallVault\'s icon from your home screen and app drawer.\n\nTo open the app again, you must dial *#*#9999#*#* (or dial *#9999#) in your phone\'s keypad, or click the background service notification.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Hide App',
            style: 'destructive',
            onPress: () => {
              updateSettings({ appVisible: false });
              Alert.alert('App Hidden', 'The app icon has been hidden. Remember to dial *#*#9999#*#* to open CallVault.');
            },
          },
        ]
      );
    } else {
      updateSettings({ appVisible: true });
      Alert.alert('App Restored', 'The app icon is now visible in the app drawer again.');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>

        {/* Section: Recording Preferences */}
        <Text style={styles.sectionTitle}>Recording Preferences</Text>
        <View style={styles.groupCard}>
          <View style={styles.settingItem}>
            <View style={styles.settingTextGroup}>
              <Text style={styles.settingLabel}>Enable Auto Recording</Text>
              <Text style={styles.settingDesc}>Record calls automatically when they connect</Text>
            </View>
            <Switch
              value={settings.autoRecord}
              onValueChange={handleToggleAutoRecord}
              trackColor={{ false: '#334155', true: '#2563EB' }}
              thumbColor={settings.autoRecord ? '#38BDF8' : '#94A3B8'}
            />
          </View>

          <View style={[styles.settingItem, !settings.autoRecord && styles.disabledSetting]}>
            <View style={styles.settingTextGroup}>
              <Text style={styles.settingLabel}>Record Incoming Calls</Text>
              <Text style={styles.settingDesc}>Capture incoming phone call audio</Text>
            </View>
            <Switch
              value={settings.recordIncoming}
              onValueChange={handleToggleIncoming}
              disabled={!settings.autoRecord}
              trackColor={{ false: '#334155', true: '#2563EB' }}
              thumbColor={settings.recordIncoming && settings.autoRecord ? '#38BDF8' : '#94A3B8'}
            />
          </View>

          <View style={[styles.settingItem, styles.lastItem, !settings.autoRecord && styles.disabledSetting]}>
            <View style={styles.settingTextGroup}>
              <Text style={styles.settingLabel}>Record Outgoing Calls</Text>
              <Text style={styles.settingDesc}>Capture dialed phone call audio</Text>
            </View>
            <Switch
              value={settings.recordOutgoing}
              onValueChange={handleToggleOutgoing}
              disabled={!settings.autoRecord}
              trackColor={{ false: '#334155', true: '#2563EB' }}
              thumbColor={settings.recordOutgoing && settings.autoRecord ? '#38BDF8' : '#94A3B8'}
            />
          </View>
        </View>

        {/* Section: Audio Quality */}
        <Text style={styles.sectionTitle}>Audio Quality</Text>
        <View style={styles.groupCard}>
          <View style={styles.qualitySelectorRow}>
            {(['low', 'medium', 'high'] as const).map((q) => {
              const isActive = settings.audioQuality === q;
              const bitrateText = q === 'high' ? '128 kbps' : q === 'medium' ? '64 kbps' : '32 kbps';
              return (
                <TouchableOpacity
                  key={q}
                  style={[styles.qualityPill, isActive && styles.qualityPillActive]}
                  onPress={() => handleQualityChange(q)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.qualityLabel, isActive && styles.qualityLabelActive]}>
                    {q.toUpperCase()}
                  </Text>
                  <Text style={[styles.qualitySub, isActive && styles.qualitySubActive]}>
                    {bitrateText}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Section: Storage Location */}
        <Text style={styles.sectionTitle}>Custom Secure Storage</Text>
        <View style={styles.groupCard}>
          <View style={styles.storageItem}>
            <Text style={styles.storageLabel}>Vault Folder Path:</Text>
            <Text style={styles.storagePath}>
              Android/data/com.callvault/files/CallVault/
            </Text>
            <Text style={styles.storageAlert}>
              ⚠️ Recordings are stored in private isolated app files to prevent other apps from reading them. They will be deleted if you uninstall the app.
            </Text>
          </View>
        </View>

        {/* Section: Background Stability */}
        <Text style={styles.sectionTitle}>Background Stability</Text>
        <View style={styles.groupCard}>
          <View style={styles.settingItem}>
            <View style={styles.settingTextGroup}>
              <Text style={styles.settingLabel}>Ignore Battery Optimizations</Text>
              <Text style={styles.settingDesc}>
                {isBatteryIgnored 
                  ? 'Optimizations Disabled (Service is stable)' 
                  : 'Highly recommended to prevent OS from killing recording'}
              </Text>
            </View>
            <Switch
              value={isBatteryIgnored}
              onValueChange={handleRequestBatteryIgnore}
              trackColor={{ false: '#334155', true: '#2563EB' }}
              thumbColor={isBatteryIgnored ? '#38BDF8' : '#94A3B8'}
              disabled={isBatteryIgnored}
            />
          </View>

          <View style={[styles.settingItem, styles.lastItem]}>
            <View style={styles.settingTextGroup}>
              <Text style={styles.settingLabel}>Auto-Start & Background Settings</Text>
              <Text style={styles.settingDesc}>Open manufacturer settings for background startup</Text>
            </View>
            <TouchableOpacity 
              style={{ backgroundColor: '#2563EB', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}
              onPress={handleOpenAutoStart}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>Manage</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Section: Stealth Mode */}
        <Text style={styles.sectionTitle}>App Stealth Mode</Text>
        <View style={styles.groupCard}>
          <View style={[styles.settingItem, styles.lastItem]}>
            <View style={styles.settingTextGroup}>
              <Text style={styles.settingLabel}>Hide Launcher Icon</Text>
              <Text style={styles.settingDesc}>Remove the app icon from the system home screen</Text>
            </View>
            <Switch
              value={!settings.appVisible}
              onValueChange={(hide) => handleToggleStealthMode(hide)}
              trackColor={{ false: '#334155', true: '#2563EB' }}
              thumbColor={!settings.appVisible ? '#38BDF8' : '#94A3B8'}
            />
          </View>
        </View>

        {/* Section: Appearance */}
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.groupCard}>
          <View style={[styles.settingItem, styles.lastItem]}>
            <View style={styles.settingTextGroup}>
              <Text style={styles.settingLabel}>Dark Mode (AMOLED)</Text>
              <Text style={styles.settingDesc}>Use low-power dark interface theme</Text>
            </View>
            <Switch
              value={settings.darkMode}
              onValueChange={(val) => {
                updateSettings({ darkMode: val });
                if (!val) {
                  Alert.alert('Theme Notice', 'CallVault uses Dark Mode by default to optimize battery consumption and save OLED screen power.');
                }
              }}
              trackColor={{ false: '#334155', true: '#2563EB' }}
              thumbColor={settings.darkMode ? '#38BDF8' : '#94A3B8'}
            />
          </View>
        </View>
      </ScrollView>

      {/* Floating Bottom Navigation Tab */}
      <TabBar currentRoute="Settings" navigation={navigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 110, // space for tab bar
  },
  header: {
    paddingTop: 20,
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 24,
    color: '#F8FAFC',
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 14,
    color: '#38BDF8',
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 10,
  },
  groupCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  lastItem: {
    borderBottomWidth: 0,
  },
  disabledSetting: {
    opacity: 0.4,
  },
  settingTextGroup: {
    flex: 1,
    marginRight: 10,
  },
  settingLabel: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDesc: {
    color: '#64748B',
    fontSize: 12,
  },
  qualitySelectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  qualityPill: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingVertical: 10,
    marginHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  qualityPillActive: {
    backgroundColor: '#2563EB',
    borderColor: '#38BDF8',
  },
  qualityLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  qualityLabelActive: {
    color: '#FFFFFF',
  },
  qualitySub: {
    color: '#64748B',
    fontSize: 10,
  },
  qualitySubActive: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  storageItem: {
    paddingVertical: 16,
  },
  storageLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  storagePath: {
    color: '#F8FAFC',
    fontSize: 13,
    backgroundColor: '#0F172A',
    padding: 10,
    borderRadius: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  storageAlert: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 16,
  },
});
