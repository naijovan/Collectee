/**
 * Keeps a bottom-anchored composer above the keyboard.
 *
 * Jovan owns every component in src/components/. Changes go via PR announced in
 * chat — this is where merge conflicts will otherwise happen.
 *
 * Four screens put a `TextInput` at the bottom of a long `ScrollView` —
 * `collection/[id]`, `room/[id]`, `thread/[id]`, `community/[id]`. On iOS the
 * keyboard is an overlay, not a layout change, so it covers the field the user
 * just tapped and they type blind. Android resizes the window itself
 * (`softwareKeyboardLayoutMode: resize` is the Expo default), which is why
 * `behavior` is iOS-only here — setting it on Android double-counts and leaves
 * a keyboard-sized gap.
 *
 * `headerOffset` is the height the native stack header already occupies, which
 * `KeyboardAvoidingView` cannot see from inside the screen. Without it the view
 * lifts by that much too far and the composer floats above the keyboard with a
 * visible band of background under it.
 */

import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Default iOS stack header height. Screens without one pass `hasHeader={false}`. */
const HEADER_HEIGHT = 44;

export function KeyboardSafe({
  children,
  hasHeader = true,
}: {
  children: React.ReactNode;
  hasHeader?: boolean;
}) {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={hasHeader ? insets.top + HEADER_HEIGHT : 0}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
