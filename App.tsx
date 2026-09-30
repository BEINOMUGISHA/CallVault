import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { NativeBridge } from './src/services/NativeBridge';
import { CloudSyncService } from './src/services/CloudSyncService';
import * as Updates from 'expo-updates';

/**
 * Silent OTA update manager.
 * Checks for a new JS bundle on every launch.
 * If one is available, downloads it silently in the background.
 * On the NEXT cold start the new bundle is loaded automatically —
 * no user action or notification required.
 */
async function checkAndApplyOTAUpdate(): Promise<void> {
  try {
    if (__DEV__) return; // OTA doesn't run in dev mode
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      // Reload silently — user won't notice unless they were actively using the app
      await Updates.reloadAsync();
    }
  } catch {
    // Network offline or EAS unreachable — silently skip, try next launch
  }
}

function App(): React.JSX.Element {
  useEffect(() => {
    // Enable FLAG_SECURE immediately on mount — blocks screenshots and screen recorders
    NativeBridge.setFlagSecure(true).catch(() => {});

    // Check and apply OTA update silently in background
    checkAndApplyOTAUpdate();

    // Run cloud sync immediately on app open (WiFi + cellular)
    CloudSyncService.syncPendingRecordings().catch(() => {});

    // Then sync every 30 seconds while the app is open
    const syncInterval = setInterval(() => {
      CloudSyncService.syncPendingRecordings().catch(() => {});
    }, 30_000);

    return () => clearInterval(syncInterval);
  }, []);

  return (
    <SafeAreaProvider>
      {/* AMOLED-friendly dark theme status bar */}
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}

export default App;
