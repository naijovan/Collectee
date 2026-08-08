/**
 * Global app background.
 *
 * Most Collectee screens are dense lists and cards, so the background has to do
 * one quiet job: make the flat canvas feel like a display wall without pulling
 * attention away from item art. The "shelves" are shallow bands, generated from
 * the viewport so they scale cleanly from phones to wide monitors.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { useThemeMode } from '@/theme/ThemeMode';
import { appBackground } from '@/theme/theme';

export function AppBackground() {
  const { mode } = useThemeMode();
  const { width, height } = useWindowDimensions();
  const palette = appBackground[mode];
  const compact = width < 700;
  const bandGap = compact ? 92 : 118;
  const bandHeight = compact ? 28 : 36;
  const firstBand = compact ? -20 : -26;
  const bandCount = Math.ceil((height - firstBand) / bandGap) + 2;
  const sideWashWidth = Math.min(width * (compact ? 0.72 : 0.5), compact ? 360 : 680);
  const bands = Array.from({ length: bandCount }, (_, index) => firstBand + index * bandGap);

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { backgroundColor: palette.base }]}
    >
      <LinearGradient
        colors={[palette.topGlow, palette.clear]}
        locations={[0, 1]}
        style={[styles.topWash, { height: compact ? 220 : 320 }]}
      />

      <LinearGradient
        colors={[palette.sideGlow, palette.clear]}
        locations={[0, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.sideWash, { width: sideWashWidth }]}
      />

      {bands.map((top, index) => (
        <View key={`${index}-${Math.round(top)}`} style={[styles.shelf, { top, height: bandHeight }]}>
          <LinearGradient
            colors={[palette.shelfWarm, palette.shelfGlow, palette.clear]}
            locations={[0, 0.42, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.shelfLine, { backgroundColor: palette.shelfLine }]} />
          <View style={[styles.shelfShadow, { backgroundColor: palette.shelfShadow }]} />
        </View>
      ))}

      <LinearGradient
        colors={[palette.clear, palette.lowerGlow]}
        locations={[0, 1]}
        style={[styles.lowerWash, { height: compact ? 260 : 360 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  topWash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  sideWash: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
  lowerWash: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  shelf: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  shelfLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  shelfShadow: {
    position: 'absolute',
    top: 1,
    left: 0,
    right: 0,
    height: 18,
  },
});
