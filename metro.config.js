// metro.config.js
// Uses expo/metro-config since expo-updates is integrated into this project.
// This ensures EAS Build's Metro bundler serializer is compatible.
const { getDefaultConfig } = require('expo/metro-config');
const { mergeConfig } = require('@react-native/metro-config');

const expoConfig = getDefaultConfig(__dirname);

const config = {
  resolver: {
    // Ensure .cjs files (used by Supabase and other packages) are resolved correctly
    sourceExts: [...expoConfig.resolver.sourceExts, 'cjs'],
  },
};

module.exports = mergeConfig(expoConfig, config);
