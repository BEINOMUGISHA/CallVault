import React, { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CallRecord } from '../types';
import { SecurityService } from '../services/SecurityService';
import { NativeBridge } from '../services/NativeBridge';

// Screens
import DashboardScreen from '../screens/DashboardScreen';
import RecordingsScreen from '../screens/RecordingsScreen';
import AudioPlayerScreen from '../screens/AudioPlayerScreen';
import SettingsScreen from '../screens/SettingsScreen';
import CalculatorDisguiseScreen from '../screens/CalculatorDisguiseScreen';

export type RootStackParamList = {
  CalculatorDisguise: undefined;
  Dashboard: undefined;
  DecoyDashboard: undefined;
  Recordings: undefined;
  DecoyRecordings: undefined;
  AudioPlayer: { record: CallRecord };
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export default function AppNavigator() {
  const [initialRoute, setInitialRoute] = useState<'CalculatorDisguise' | 'Dashboard' | null>(null);

  useEffect(() => {
    // 1. Initial route & security integrity verification
    (async () => {
      const disguiseEnabled = await SecurityService.isDisguiseEnabled();
      setInitialRoute(disguiseEnabled ? 'CalculatorDisguise' : 'Dashboard');

      // Check anti-forensics / emulator sandbox
      try {
        const integrity = await NativeBridge.checkDeviceIntegrity();
        if (integrity.isEmulator) {
          // If inspected inside emulator, lock down into calculator mode
          await SecurityService.setDisguiseEnabled(true);
          setInitialRoute('CalculatorDisguise');
        }
      } catch {}

      // Start hardware shake detector if enabled
      try {
        const shakeEnabled = await SecurityService.isShakeToLockEnabled();
        if (shakeEnabled) {
          await NativeBridge.startShakeDetector();
        }
      } catch {}
    })();

    // 2. Hardware Shake to instant lock
    const unsubShake = NativeBridge.onDeviceShaken(async () => {
      const isDisguised = await SecurityService.isDisguiseEnabled();
      if (isDisguised && navigationRef.isReady()) {
        NativeBridge.stopAudio();
        navigationRef.reset({
          index: 0,
          routes: [{ name: 'CalculatorDisguise' }],
        });
      }
    });

    // 3. Auto-Lock on App Background / Minimization
    const appStateSubscription = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        const autoLock = await SecurityService.isAutoLockEnabled();
        const isDisguised = await SecurityService.isDisguiseEnabled();
        if (autoLock && isDisguised && navigationRef.isReady()) {
          NativeBridge.stopAudio();
          navigationRef.reset({
            index: 0,
            routes: [{ name: 'CalculatorDisguise' }],
          });
        }
      }
    });

    return () => {
      unsubShake();
      appStateSubscription.remove();
    };
  }, []);

  // Show nothing while determining initial route (prevents screen flicker)
  if (!initialRoute) return null;

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        {/* Disguise entry point — the calculator display */}
        <Stack.Screen
          name="CalculatorDisguise"
          children={(props) => (
            <CalculatorDisguiseScreen
              {...props}
              onUnlock={(isDuress: boolean) => {
                if (isDuress) {
                  // Duress PIN — navigate to realistic decoy vault
                  props.navigation.replace('DecoyDashboard');
                } else {
                  // Real PIN — open the actual vault
                  props.navigation.replace('Dashboard');
                }
              }}
            />
          )}
        />

        {/* Real vault */}
        <Stack.Screen name="Dashboard" component={DashboardScreen} />

        {/* Decoy vault — harmless simulated metrics and calls */}
        <Stack.Screen
          name="DecoyDashboard"
          children={(props) => <DashboardScreen {...props} decoyMode={true} />}
        />

        {/* Real recordings */}
        <Stack.Screen name="Recordings" component={RecordingsScreen} />

        {/* Decoy recordings */}
        <Stack.Screen
          name="DecoyRecordings"
          children={(props) => <RecordingsScreen {...props} decoyMode={true} />}
        />

        <Stack.Screen name="AudioPlayer" component={AudioPlayerScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
