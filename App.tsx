import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      {/* AMOELD-friendly dark theme status bar */}
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}

export default App;
