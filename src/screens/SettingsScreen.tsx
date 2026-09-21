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
  TextInput,
  Modal,
} from 'react-native';
import { useCallStore } from '../store/useCallStore';
import TabBar from '../components/TabBar';
import { NativeBridge } from '../services/NativeBridge';
import { SecurityService } from '../services/SecurityService';

export default function SettingsScreen({ navigation }: any) {
  const { settings, updateSettings, isServiceRunning, toggleService } = useCallStore();

  const [isBatteryIgnored, setIsBatteryIgnored] = React.useState(true);
  // Security state
  const [disguiseEnabled, setDisguiseEnabled] = React.useState(false);
  const [flagSecureEnabled, setFlagSecureEnabled] = React.useState(true);
  const [shakeToLockEnabled, setShakeToLockEnabled] = React.useState(true);
  const [autoLockEnabled, setAutoLockEnabled] = React.useState(true);
  const [duressModalVisible, setDuressModalVisible] = React.useState(false);
  const [duressPin, setDuressPin] = React.useState('');
  const [panicModalVisible, setPanicModalVisible] = React.useState(false);
  const [panicPin, setPanicPin] = React.useState('');

  React.useEffect(() => {
    checkBatteryOptimization();
    // Load security settings
    SecurityService.isDisguiseEnabled().then(setDisguiseEnabled);
    SecurityService.isFlagSecureEnabled().then(setFlagSecureEnabled);
    SecurityService.isShakeToLockEnabled().then(setShakeToLockEnabled);
    SecurityService.isAutoLockEnabled().then(setAutoLockEnabled);
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

  const handleToggleDisguise = async (enabled: boolean) => {
    if (enabled) {
      Alert.alert(
        'Enable Calculator Disguise?',
        'The app will show as a calculator. Enter PIN "9999" via the = key to open the vault.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Enable',
            onPress: async () => {
              await SecurityService.setDisguiseEnabled(true);
              setDisguiseEnabled(true);
              Alert.alert('Disguise Enabled', 'The app will now open as a calculator. Use PIN 9999 to unlock.');
            },
          },
        ]
      );
    } else {
      await SecurityService.setDisguiseEnabled(false);
      setDisguiseEnabled(false);
    }
  };

  const handleToggleFlagSecure = async (enabled: boolean) => {
    await SecurityService.setFlagSecure(enabled);
    setFlagSecureEnabled(enabled);
    Alert.alert(
      enabled ? 'Screen Protection On' : 'Screen Protection Off',
      enabled
        ? 'Screenshots and screen recordings are now blocked.'
        : 'Screenshots and screen recordings are now allowed.'
    );
  };

  const handleSaveDuressPin = async () => {
    const pin = duressPin.trim();
    if (pin.length < 4) {
      Alert.alert('Invalid PIN', 'Duress PIN must be at least 4 digits.');
      return;
    }
    const master = await SecurityService.getPasscode();
    if (pin === master) {
      Alert.alert('Invalid PIN', 'Duress PIN cannot be the same as your master PIN.');
      return;
    }
    await SecurityService.setDuressPasscode(pin);
    setDuressModalVisible(false);
    setDuressPin('');
    Alert.alert('Duress PIN Set', 'Entering this PIN will show a decoy empty vault to unauthorized persons.');
  };

  const handleToggleShakeToLock = async (enabled: boolean) => {
    await SecurityService.setShakeToLockEnabled(enabled);
    setShakeToLockEnabled(enabled);
  };

  const handleToggleAutoLock = async (enabled: boolean) => {
    await SecurityService.setAutoLockEnabled(enabled);
    setAutoLockEnabled(enabled);
  };

  const handleSavePanicPin = async () => {
    const pin = panicPin.trim();
    if (pin.length < 4) {
      Alert.alert('Invalid PIN', 'Panic passcode must be at least 4 digits.');
      return;
    }
    const master = await SecurityService.getPasscode();
    if (pin === master) {
      Alert.alert('Invalid PIN', 'Panic passcode cannot be the same as your master PIN.');
      return;
    }
    await SecurityService.setPanicPasscode(pin);
    setPanicModalVisible(false);
    setPanicPin('');
    Alert.alert('Panic PIN Set', 'Entering this code in the calculator will instantly trigger a silent, total data wipe.');
  };

  const handleExecutePanicWipe = () => {
    Alert.alert(
      '⚠️ EMERGENCY PANIC WIPE',
      'This will IMMEDIATELY and PERMANENTLY delete ALL call recordings, database records, cloud backups, and app settings. This cannot be undone.\n\nAre you sure you want to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'DESTROY ALL DATA',
          style: 'destructive',
          onPress: async () => {
            await SecurityService.executePanicWipe();
            Alert.alert('Vault Destroyed', 'All records and files have been permanently erased from device and cloud.', [
              {
                text: 'OK',
                onPress: () => {
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'CalculatorDisguise' }],
                  });
                },
              },
            ]);
          },
        },
      ]
    );
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
        {/* Section: Security & Privacy */}
        <Text style={styles.sectionTitle}>Security & Privacy</Text>
        <View style={styles.groupCard}>
          <View style={styles.settingItem}>
            <View style={styles.settingTextGroup}>
              <Text style={styles.settingLabel}>Calculator Disguise</Text>
              <Text style={styles.settingDesc}>Open app as a calculator. Enter PIN via = key to unlock vault.</Text>
            </View>
            <Switch
              value={disguiseEnabled}
              onValueChange={handleToggleDisguise}
              trackColor={{ false: '#334155', true: '#2563EB' }}
              thumbColor={disguiseEnabled ? '#38BDF8' : '#94A3B8'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingTextGroup}>
              <Text style={styles.settingLabel}>Block Screenshots</Text>
              <Text style={styles.settingDesc}>Prevent screenshots and screen recording of CallVault</Text>
            </View>
            <Switch
              value={flagSecureEnabled}
              onValueChange={handleToggleFlagSecure}
              trackColor={{ false: '#334155', true: '#2563EB' }}
              thumbColor={flagSecureEnabled ? '#38BDF8' : '#94A3B8'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingTextGroup}>
              <Text style={styles.settingLabel}>Shake to Lock</Text>
              <Text style={styles.settingDesc}>Shake device vigorously to instantly lock app & stop audio</Text>
            </View>
            <Switch
              value={shakeToLockEnabled}
              onValueChange={handleToggleShakeToLock}
              trackColor={{ false: '#334155', true: '#2563EB' }}
              thumbColor={shakeToLockEnabled ? '#38BDF8' : '#94A3B8'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingTextGroup}>
              <Text style={styles.settingLabel}>Auto-Lock on Minimize</Text>
              <Text style={styles.settingDesc}>Immediately lock app when switched to background</Text>
            </View>
            <Switch
              value={autoLockEnabled}
              onValueChange={handleToggleAutoLock}
              trackColor={{ false: '#334155', true: '#2563EB' }}
              thumbColor={autoLockEnabled ? '#38BDF8' : '#94A3B8'}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingTextGroup}>
              <Text style={styles.settingLabel}>Duress PIN</Text>
              <Text style={styles.settingDesc}>Decoy PIN that shows a harmless vault when coerced</Text>
            </View>
            <TouchableOpacity
              style={{ backgroundColor: '#334155', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 }}
              onPress={() => setDuressModalVisible(true)}
            >
              <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '700' }}>Set PIN</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingTextGroup}>
              <Text style={styles.settingLabel}>Panic Wipe Code</Text>
              <Text style={styles.settingDesc}>Entering this code in calculator instantly destroys all records</Text>
            </View>
            <TouchableOpacity
              style={{ backgroundColor: '#334155', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 }}
              onPress={() => setPanicModalVisible(true)}
            >
              <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '700' }}>Set Code</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.settingItem, styles.lastItem]}>
            <View style={styles.settingTextGroup}>
              <Text style={[styles.settingLabel, { color: '#EF4444' }]}>Scorched Earth Panic Wipe</Text>
              <Text style={styles.settingDesc}>Permanently erase all phone database records and cloud backups</Text>
            </View>
            <TouchableOpacity
              style={{ backgroundColor: '#EF4444', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 }}
              onPress={handleExecutePanicWipe}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>Wipe All</Text>
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>

      {/* Duress PIN Modal */}
      <Modal visible={duressModalVisible} transparent animationType="fade" onRequestClose={() => setDuressModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set Duress PIN</Text>
            <Text style={styles.modalDesc}>
              When entered, this PIN will open a decoy vault with no recordings. Use it if forced to unlock the app.
            </Text>
            <TextInput
              style={styles.modalInput}
              value={duressPin}
              onChangeText={setDuressPin}
              placeholder="Enter duress PIN (min 4 digits)"
              placeholderTextColor="#64748B"
              keyboardType="numeric"
              secureTextEntry
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonCancel]} onPress={() => { setDuressModalVisible(false); setDuressPin(''); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonSave]} onPress={handleSaveDuressPin}>
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Panic Passcode Modal */}
      <Modal visible={panicModalVisible} transparent animationType="fade" onRequestClose={() => setPanicModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={[styles.modalTitle, { color: '#EF4444' }]}>Set Panic Self-Destruct PIN</Text>
            <Text style={styles.modalDesc}>
              Entering this code into the calculator disguise and pressing = will immediately and irreversibly wipe all local and cloud data.
            </Text>
            <TextInput
              style={styles.modalInput}
              value={panicPin}
              onChangeText={setPanicPin}
              placeholder="Enter panic code (e.g. 0000)"
              placeholderTextColor="#64748B"
              keyboardType="numeric"
              secureTextEntry
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonCancel]} onPress={() => { setPanicModalVisible(false); setPanicPin(''); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: '#EF4444' }]} onPress={handleSavePanicPin}>
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  // Modal styles for Duress PIN
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '82%',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    elevation: 12,
  },
  modalTitle: {
    fontSize: 17,
    color: '#F8FAFC',
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalDesc: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
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
    borderColor: 'rgba(255,255,255,0.05)',
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
    marginHorizontal: 4,
  },
  modalButtonCancel: { backgroundColor: '#334155' },
  modalButtonSave: { backgroundColor: '#2563EB' },
  modalCancelText: { color: '#94A3B8', fontWeight: '600', fontSize: 13 },
  modalSaveText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
});

