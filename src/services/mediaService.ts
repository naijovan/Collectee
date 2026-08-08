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

/**
 * Longest edge we send to the scanner, in pixels.
 *
 * 2576 is the high-resolution vision tier's ceiling on the model the scan runs
 * on — above it the image is downscaled server-side anyway, so sending more is
 * paying to transmit detail that gets thrown away. Below it, tile labels in a
 * phone screenshot stay legible, which is the entire job.
 */
const SCAN_MAX_EDGE = 2576;

/**
 * JPEG quality for the re-encode. High enough that small condensed type stays
 * sharp, low enough that a 2MB PNG screenshot lands around 300KB.
 */
const SCAN_JPEG_QUALITY = 0.85;

/** An image ready to POST: base64 with no data-URL prefix, plus its type. */
export interface ScanImage {
  data: string;
  mediaType: 'image/jpeg';
  bytes: number;
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

  /**
   * Downscale and re-encode a picked image for the scanner. Null when the
   * platform cannot do it, which is every non-web target today.
   *
   * This exists because of a hard limit rather than a preference: the proxy is
   * a Vercel function and those cap a request body at 4.5MB, while the picker
   * accepts files up to 8MB — base64 inflates by a third on top of that. An
   * unmodified 8MB PNG is a guaranteed 413 with a confusing error, so the
   * client shrinks it first and the server keeps its own cap as a backstop.
   *
   * The re-encode does most of the work even when no downscaling is needed: a
   * lossless phone screenshot is mostly flat UI, which JPEG eats.
   *
   * Takes a URI rather than a `PickedImage` so the scanner can hand it whatever
   * it was given — including the `demo://` placeholder used when no file was
   * picked, which fails to decode and returns null, which is exactly the
   * "no live scan, use the prepared result" path the caller already handles.
   */
  async prepareForScan(uri: string): Promise<ScanImage | null> {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return null;

    try {
      const bitmap = await loadImage(uri);
      const scale = Math.min(1, SCAN_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));

      const context = canvas.getContext('2d');
      if (context === null) return null;
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      // toDataURL rather than toBlob: the base64 is what we are actually
      // sending, so going via a Blob would mean decoding it straight back.
      const dataUrl = canvas.toDataURL('image/jpeg', SCAN_JPEG_QUALITY);
      const data = dataUrl.slice(dataUrl.indexOf(',') + 1);
      if (data.length === 0) return null;

      // Base64 is 4 characters per 3 bytes, minus whatever padding is present.
      const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
      return { data, mediaType: 'image/jpeg', bytes: (data.length * 3) / 4 - padding };
    } catch {
      // A canvas that refuses to export is not worth distinguishing from an
      // image that refuses to decode: both mean "no live scan", and the caller
      // falls back to the prepared result either way.
      return null;
    }
  },
};

export type MediaService = typeof mediaService;

/**
 * How long to wait after the window regains focus before deciding the dialog
 * closed with nothing selected. `change` fires just after `focus` on several
 * browsers, so settling immediately would discard a real selection.
 */
const DIALOG_SETTLE_MS = 500;

/**
 * Longest we will wait for the blur that means "the dialog is open" before
 * arming the focus fallback anyway. Some browsers present the picker as a
 * sheet and never blur the window at all; without this backstop a dismissed
 * dialog would leave the promise pending forever.
 */
const DIALOG_OPEN_MS = 1000;

/**
 * A dialog per call, removed on settle.
 *
 * `change` is the primary signal. `cancel` is now widely supported and handles
 * an explicit dismissal, but a dialog closed by other means can still fire
 * nothing at all — so a window `focus` is used as the last-resort fallback.
 *
 * ── Why the fallback is armed late, and not at click time ──────────────────
 * This is the bug that made picking a valid PNG do nothing. Arming `focus`
 * before `input.click()` means any focus event that lands while the dialog is
 * still open settles the promise as cancelled — and `settle` removes the input
 * from the DOM, so the user's real selection then has no live listener to fire
 * `change` at. The pick vanished silently and the only way back was a reload.
 *
 * So the fallback is armed only once the dialog is definitely open: on the
 * blur that opening it causes, or after `DIALOG_OPEN_MS` if this browser never
 * blurs. After that point a focus event genuinely does mean the dialog closed.
 */
function openFileDialog(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    document.body.appendChild(input);

    let settled = false;
    let armTimer: ReturnType<typeof setTimeout> | undefined;

    const settle = (file: File | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(armTimer);
      window.removeEventListener('blur', arm);
      window.removeEventListener('focus', onFocus);
      input.remove();
      resolve(file);
    };

    const onFocus = () => {
      setTimeout(() => settle(input.files?.[0] ?? null), DIALOG_SETTLE_MS);
    };

    /** Idempotent: whichever of blur or the timer happens first wins. */
    const arm = () => {
      if (settled) return;
      clearTimeout(armTimer);
      window.removeEventListener('blur', arm);
      window.addEventListener('focus', onFocus, { once: true });
    };

    input.addEventListener('change', () => settle(input.files?.[0] ?? null), { once: true });
    input.addEventListener('cancel', () => settle(null), { once: true });
    window.addEventListener('blur', arm, { once: true });
    armTimer = setTimeout(arm, DIALOG_OPEN_MS);

    input.click();
  });
}

/**
 * Decode a data URL into something canvas can draw.
 *
 * A plain `Image` rather than `createImageBitmap`, which Safari only grew
 * recently enough to be worth avoiding three days before a demo. The source is
 * always a data URL from `pickImage`, so there is no cross-origin taint to
 * worry about and `toDataURL` stays callable afterwards.
 */
function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not decode the selected image'));
    image.src = uri;
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
