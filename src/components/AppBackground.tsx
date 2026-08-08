/**
 * Global app background.
 *
 * Most Collectee screens are dense lists and cards, so the background has to do
 * one quiet job: make the flat canvas feel collectible without pulling
 * attention away from item art. The card silhouettes have separate phone,
 * laptop and wide-monitor compositions rather than one stretched asset.
 */

import type { ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { useThemeMode } from '@/theme/ThemeMode';
import { appBackground } from '@/theme/theme';

type LayoutName = 'phone' | 'laptop' | 'monitor';
type CardTone = 'base' | 'cool' | 'warm';
type BackgroundPalette = (typeof appBackground)[keyof typeof appBackground];

interface CardPlacement {
  x: number;
  y: number;
  scale: number;
  rotate: number;
  opacity: number;
  tone?: CardTone;
}

/**
 * Three authored compositions, not a scaled wallpaper:
 * phone keeps more cards cropped at the edges, laptop spreads two loose piles,
 * and monitor adds enough extra silhouettes that ultrawide screens do not look
 * empty at the sides.
 */
const CARD_STACK_LAYOUTS = {
  phone: [
    { x: -0.04, y: 0.06, scale: 0.92, rotate: -17, opacity: 0.72, tone: 'cool' },
    { x: 0.32, y: 0.08, scale: 0.7, rotate: 8, opacity: 0.48 },
    { x: 0.78, y: 0.12, scale: 0.86, rotate: 15, opacity: 0.58, tone: 'warm' },
    { x: 1.03, y: 0.28, scale: 0.8, rotate: -11, opacity: 0.56 },
    { x: 0.08, y: 0.39, scale: 0.72, rotate: 13, opacity: 0.46 },
    { x: 0.74, y: 0.48, scale: 0.66, rotate: -8, opacity: 0.42, tone: 'cool' },
    { x: -0.05, y: 0.66, scale: 0.82, rotate: 18, opacity: 0.5, tone: 'warm' },
    { x: 0.38, y: 0.73, scale: 0.72, rotate: -12, opacity: 0.42 },
    { x: 0.88, y: 0.82, scale: 0.96, rotate: 10, opacity: 0.58, tone: 'cool' },
    { x: 0.18, y: 0.96, scale: 0.78, rotate: -6, opacity: 0.38 },
  ],
  laptop: [
    { x: 0.04, y: 0.06, scale: 0.9, rotate: -14, opacity: 0.62, tone: 'cool' },
    { x: 0.2, y: 0.12, scale: 0.7, rotate: 9, opacity: 0.42 },
    { x: 0.39, y: 0.03, scale: 0.82, rotate: -5, opacity: 0.38, tone: 'warm' },
    { x: 0.66, y: 0.09, scale: 0.68, rotate: 12, opacity: 0.36 },
    { x: 0.88, y: 0.05, scale: 0.88, rotate: -10, opacity: 0.5, tone: 'cool' },
    { x: 1.03, y: 0.2, scale: 0.78, rotate: 16, opacity: 0.48 },
    { x: -0.03, y: 0.36, scale: 0.74, rotate: 13, opacity: 0.42, tone: 'warm' },
    { x: 0.18, y: 0.48, scale: 0.64, rotate: -9, opacity: 0.34 },
    { x: 0.8, y: 0.44, scale: 0.76, rotate: 8, opacity: 0.36 },
    { x: 0.97, y: 0.56, scale: 0.9, rotate: -13, opacity: 0.48, tone: 'cool' },
    { x: 0.08, y: 0.73, scale: 0.88, rotate: -8, opacity: 0.52 },
    { x: 0.3, y: 0.83, scale: 0.68, rotate: 14, opacity: 0.34, tone: 'cool' },
    { x: 0.58, y: 0.76, scale: 0.72, rotate: -15, opacity: 0.32, tone: 'warm' },
    { x: 0.78, y: 0.88, scale: 0.84, rotate: 7, opacity: 0.42 },
    { x: 1.02, y: 0.86, scale: 0.94, rotate: 15, opacity: 0.5, tone: 'warm' },
  ],
  monitor: [
    { x: -0.02, y: 0.08, scale: 0.94, rotate: -14, opacity: 0.58, tone: 'cool' },
    { x: 0.1, y: 0.2, scale: 0.72, rotate: 10, opacity: 0.38 },
    { x: 0.21, y: 0.06, scale: 0.76, rotate: -7, opacity: 0.38, tone: 'warm' },
    { x: 0.35, y: 0.14, scale: 0.62, rotate: 15, opacity: 0.28 },
    { x: 0.49, y: 0.04, scale: 0.76, rotate: -10, opacity: 0.3, tone: 'cool' },
    { x: 0.63, y: 0.16, scale: 0.66, rotate: 9, opacity: 0.28 },
    { x: 0.78, y: 0.07, scale: 0.82, rotate: -12, opacity: 0.38, tone: 'warm' },
    { x: 0.94, y: 0.16, scale: 0.9, rotate: 13, opacity: 0.48, tone: 'cool' },
    { x: 1.05, y: 0.32, scale: 0.78, rotate: -9, opacity: 0.42 },
    { x: -0.05, y: 0.5, scale: 0.86, rotate: 16, opacity: 0.4 },
    { x: 0.14, y: 0.58, scale: 0.66, rotate: -11, opacity: 0.28, tone: 'cool' },
    { x: 0.33, y: 0.47, scale: 0.7, rotate: 8, opacity: 0.24 },
    { x: 0.7, y: 0.5, scale: 0.64, rotate: -13, opacity: 0.24, tone: 'warm' },
    { x: 0.87, y: 0.6, scale: 0.74, rotate: 11, opacity: 0.32 },
    { x: 0.02, y: 0.86, scale: 0.92, rotate: -8, opacity: 0.48, tone: 'warm' },
    { x: 0.2, y: 0.78, scale: 0.68, rotate: 14, opacity: 0.3 },
    { x: 0.41, y: 0.9, scale: 0.8, rotate: -12, opacity: 0.32, tone: 'cool' },
    { x: 0.61, y: 0.8, scale: 0.7, rotate: 7, opacity: 0.28 },
    { x: 0.81, y: 0.9, scale: 0.86, rotate: 12, opacity: 0.42, tone: 'warm' },
    { x: 1.04, y: 0.82, scale: 0.96, rotate: -16, opacity: 0.5, tone: 'cool' },
  ],
} as const satisfies Record<LayoutName, readonly CardPlacement[]>;

export function AppBackgroundFrame({ children }: { children: ReactNode }) {
  return (
    <View style={styles.frame}>
      <AppBackground />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

export function AppBackground() {
  const { mode } = useThemeMode();
  const { width, height } = useWindowDimensions();
  const palette = appBackground[mode];
  const layout = layoutFor(width);
  const compact = layout === 'phone';
  const sideWashWidth = Math.min(width * (compact ? 0.7 : 0.45), compact ? 340 : 760);
  const cardBaseWidth = baseCardWidth(width, layout);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.background, { backgroundColor: palette.base }]}
    >
      <LinearGradient
        colors={[palette.topGlow, palette.clear]}
        locations={[0, 1]}
        style={[styles.topWash, { height: compact ? 240 : 340 }]}
      />

      <LinearGradient
        colors={[palette.sideGlow, palette.clear]}
        locations={[0, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.sideWash, { width: sideWashWidth }]}
      />

      {CARD_STACK_LAYOUTS[layout].map((placement, index) => (
        <TextureCard
          key={`${layout}-${index}`}
          placement={placement}
          palette={palette}
          baseWidth={cardBaseWidth}
          viewport={{ width, height }}
        />
      ))}

      <LinearGradient
        colors={[palette.clear, palette.lowerGlow]}
        locations={[0, 1]}
        style={[styles.lowerWash, { height: compact ? 260 : 380 }]}
      />
    </View>
  );
}

function layoutFor(width: number): LayoutName {
  if (width < 700) return 'phone';
  if (width < 1500) return 'laptop';
  return 'monitor';
}

function baseCardWidth(width: number, layout: LayoutName): number {
  if (layout === 'phone') return Math.min(148, Math.max(112, width * 0.35));
  if (layout === 'laptop') return Math.min(172, Math.max(132, width * 0.12));
  return Math.min(218, Math.max(174, width * 0.1));
}

function fillFor(tone: CardTone | undefined, palette: BackgroundPalette): string {
  if (tone === 'cool') return palette.cardFillCool;
  if (tone === 'warm') return palette.cardFillWarm;
  return palette.cardFill;
}

function TextureCard({
  placement,
  palette,
  baseWidth,
  viewport,
}: {
  placement: CardPlacement;
  palette: BackgroundPalette;
  baseWidth: number;
  viewport: { width: number; height: number };
}) {
  const cardWidth = baseWidth * placement.scale;
  const cardHeight = cardWidth * 1.34;
  const left = viewport.width * placement.x - cardWidth / 2;
  const top = viewport.height * placement.y - cardHeight / 2;
  const lineInset = cardWidth * 0.16;

  return (
    <View
      style={[
        styles.card,
        {
          left,
          top,
          width: cardWidth,
          height: cardHeight,
          opacity: placement.opacity,
          borderColor: palette.cardBorder,
          backgroundColor: fillFor(placement.tone, palette),
          transform: [{ rotate: `${placement.rotate}deg` }],
        },
      ]}
    >
      <LinearGradient
        colors={[palette.cardSheen, palette.clear]}
        locations={[0, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.cardShade, { backgroundColor: palette.cardShade }]} />
      <View
        style={[
          styles.cardArt,
          {
            left: lineInset,
            right: lineInset,
            top: cardHeight * 0.14,
            height: cardHeight * 0.46,
            borderColor: palette.cardLine,
          },
        ]}
      />
      <View
        style={[
          styles.cardLine,
          {
            left: lineInset,
            right: lineInset * 1.4,
            top: cardHeight * 0.69,
            backgroundColor: palette.cardLineAccent,
          },
        ]}
      />
      <View
        style={[
          styles.cardLine,
          {
            left: lineInset,
            right: lineInset * 1.9,
            top: cardHeight * 0.78,
            backgroundColor: palette.cardLine,
          },
        ]}
      />
      <View
        style={[
          styles.cardDot,
          {
            right: lineInset,
            bottom: lineInset,
            backgroundColor: palette.cardLineAccent,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
  },
  background: {
    pointerEvents: 'none',
  },
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
  card: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  cardShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '46%',
  },
  cardArt: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 7,
  },
  cardLine: {
    position: 'absolute',
    height: 2,
    borderRadius: 999,
  },
  cardDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 999,
  },
});
