import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { NativeBridge } from './src/services/NativeBridge';
import { CloudSyncService } from './src/services/CloudSyncService';

function App(): React.JSX.Element {
  useEffect(() => {
    // Enable FLAG_SECURE immediately on mount — blocks screenshots and screen recorders
    NativeBridge.setFlagSecure(true).catch(() => {});

    // Run cloud sync immediately on app open
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
