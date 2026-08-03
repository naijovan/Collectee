/**
 * Local file picking — the one service that reads from the device, not fixtures.
 * Flow owner: Bernard (J2 cover upload, J1 screenshot upload).
 *
 * Why this exists as a service: §13.1 rules out new dependencies, so there is no
 * `expo-image-picker` to call. The web implementation below is a hidden
 * `<input type="file">`, which is genuinely all the browser needs. Keeping it
 * behind an async service means the native path is one file to fill in later,
 * and screens keep their "never touch the platform directly" shape (§12.1).
 *
 * The returned `uri` is a data URL, not a blob URL. A blob URL dies with the
 * document and cannot survive a reload or be persisted into a fixture; a data
 * URL can be dropped straight into `Collection.coverUrl` and still render.
 */

import { Platform } from 'react-native';

/** Exactly what the cover flow accepts. Anything else is rejected by the dialog. */
export const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg'] as const;

/** ~8 MB. A phone screenshot is well under this; a 40 MP export is not. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export interface PickedImage {
  /** Data URL, usable directly as an RN `Image` source. */
  uri: string;
  name: string;
  bytes: number;
  mimeType: string;
}

export type PickImageResult =
  | { status: 'picked'; image: PickedImage }
  | { status: 'cancelled' }
  | { status: 'unsupported-type'; name: string }
  | { status: 'too-large'; name: string; bytes: number }
  | { status: 'unavailable' };

export const mediaService = {
  /**
   * Open the platform file dialog and return the chosen image.
   *
   * Resolves with a discriminated result rather than throwing, because "the user
   * pressed Escape" is the most likely outcome and is not an error — the caller
   * has to render something different for cancel, wrong type and too big.
   */
  async pickImage(): Promise<PickImageResult> {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      // [ROADMAP] Native needs expo-image-picker, which §13.1 defers. The demo
      // runs on web; callers fall back to picking an item as the cover.
      return { status: 'unavailable' };
    }

    const file = await openFileDialog(IMAGE_MIME_TYPES.join(','));
    if (file === null) return { status: 'cancelled' };

    if (!IMAGE_MIME_TYPES.includes(file.type as (typeof IMAGE_MIME_TYPES)[number])) {
      return { status: 'unsupported-type', name: file.name };
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return { status: 'too-large', name: file.name, bytes: file.size };
    }

    return {
      status: 'picked',
      image: {
        uri: await readAsDataUrl(file),
        name: file.name,
        bytes: file.size,
        mimeType: file.type,
      },
    };
  },
};

export type MediaService = typeof mediaService;

/**
 * A dialog per call, removed on settle.
 *
 * `change` is the only reliable signal: `cancel` is not in every browser yet,
 * and a dialog that was dismissed fires nothing at all. So the input is also
 * dropped on the next window focus, which is what actually happens when the
 * dialog closes either way — otherwise a cancelled pick would leave the promise
 * pending forever and the button dead until reload.
 */
function openFileDialog(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    document.body.appendChild(input);

    let settled = false;
    const settle = (file: File | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onFocus);
      input.remove();
      resolve(file);
    };

    // A frame of slack: focus returns before `change` fires on some browsers,
    // so settling immediately here would discard a real selection.
    const onFocus = () => setTimeout(() => settle(input.files?.[0] ?? null), 250);

    input.addEventListener('change', () => settle(input.files?.[0] ?? null), { once: true });
    input.addEventListener('cancel', () => settle(null), { once: true });
    window.addEventListener('focus', onFocus);

    input.click();
  });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

/** "1.4 MB". For the caller's "too large" message. */
export function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}
