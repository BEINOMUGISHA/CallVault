import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';

interface WaveformVisualizerProps {
  duration: number; // in ms
  position: number; // in ms
  isPlaying: boolean;
  onSeek: (positionMs: number) => void;
  barCount?: number;
}

export default function WaveformVisualizer({
  duration,
  position,
  isPlaying,
  onSeek,
  barCount = 36,
}: WaveformVisualizerProps) {
  // Generate deterministic pseudo-random amplitude heights based on duration
  const waveformHeights = useMemo(() => {
    const heights: number[] = [];
    let seed = duration || 45000;
    for (let i = 0; i < barCount; i++) {
      seed = (seed * 9301 + 49297) % 233280;
      const rnd = seed / 233280;
      // Between 15% and 100% height
      const h = Math.round(15 + rnd * 85);
      heights.push(h);
    }
    return heights;
  }, [duration, barCount]);

  const progressRatio = duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;
  const activeBarIndex = Math.floor(progressRatio * barCount);

  const handleBarPress = (index: number) => {
    if (duration <= 0) return;
    const targetMs = (index / barCount) * duration;
    onSeek(targetMs);
  };

  return (
    <View style={styles.container}>
      {waveformHeights.map((heightPercent, index) => {
        const isPast = index <= activeBarIndex;
        const isCurrent = index === activeBarIndex && isPlaying;

        return (
          <TouchableOpacity
            key={index}
            activeOpacity={0.7}
            onPress={() => handleBarPress(index)}
            style={styles.barTouch}
          >
            <View
              style={[
                styles.bar,
                {
                  height: `${heightPercent}%`,
                  backgroundColor: isCurrent ? '#38BDF8' : isPast ? '#8B5CF6' : '#334155',
                },
              ]}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginVertical: 12,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  barTouch: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 1,
  },
  bar: {
    width: 3,
    borderRadius: 2,
    minHeight: 6,
  },
});
