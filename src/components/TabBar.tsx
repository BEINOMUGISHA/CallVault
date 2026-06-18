import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface TabBarProps {
  currentRoute: 'Dashboard' | 'Recordings' | 'Settings';
  navigation: any;
}

export default function TabBar({ currentRoute, navigation }: TabBarProps) {
  const tabs = [
    { route: 'Dashboard', label: 'Overview', icon: '📊' },
    { route: 'Recordings', label: 'Vault', icon: '🎙️' },
    { route: 'Settings', label: 'Settings', icon: '⚙️' },
  ] as const;

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const isActive = currentRoute === tab.route;
          return (
            <TouchableOpacity
              key={tab.route}
              style={styles.tabItem}
              onPress={() => {
                if (!isActive) {
                  // Replace screen in the navigation stack to keep stack size low
                  navigation.replace(tab.route);
                }
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.iconContainer, isActive && styles.activeIconContainer]}>
                <Text style={styles.icon}>{tab.icon}</Text>
              </View>
              <Text style={[styles.label, isActive && styles.activeLabel]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(30, 41, 59, 0.85)', // Secondary color #1E293B with transparency
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    width: '100%',
    justifyContent: 'space-around',
  },
  tabItem: {
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    paddingVertical: 6,
    paddingHorizontal: 18,
    borderRadius: 16,
    marginBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIconContainer: {
    backgroundColor: '#2563EB', // Primary Blue accent
  },
  icon: {
    fontSize: 18,
  },
  label: {
    fontSize: 11,
    color: '#94A3B8', // Slate grey
    fontWeight: '500',
  },
  activeLabel: {
    color: '#38BDF8', // Accent light blue
    fontWeight: '700',
  },
});
