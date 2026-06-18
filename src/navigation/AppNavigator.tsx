import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CallRecord } from '../types';

// Import Screens (which we will create next)
import DashboardScreen from '../screens/DashboardScreen';
import RecordingsScreen from '../screens/RecordingsScreen';
import AudioPlayerScreen from '../screens/AudioPlayerScreen';
import SettingsScreen from '../screens/SettingsScreen';

export type RootStackParamList = {
  Dashboard: undefined;
  Recordings: undefined;
  AudioPlayer: { record: CallRecord };
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Dashboard"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="Recordings" component={RecordingsScreen} />
        <Stack.Screen name="AudioPlayer" component={AudioPlayerScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
