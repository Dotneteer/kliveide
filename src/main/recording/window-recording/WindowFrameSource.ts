import type { Size } from "./layout";
import { fitSize } from "./layout";
import type { SourcePicture } from "./FrameComposer";

/**
 * The part of Electron's `NativeImage` the frame source uses.
 */
export interface FrameImage {
  getSize(): Size;
  isEmpty(): boolean;
  resize(options: { width: number; height: number; quality?: "good" | "better" | "best" }): FrameImage;
  /** BGRA bytes */
  toBitmap(): Uint8Array;
}

/**
 * The part of Electron's `WebContents` the frame source uses.
 */
export interface CaptureTarget {
  beginFrameSubscription(callback: (image: FrameImage) => void): void;
  endFrameSubscription(): void;
  /** Asks the page to repaint, so the first frame arrives without waiting for a change */
  invalidate(): void;
}

/**
 * Captures one window's page content (plan §4.1).
 *
 * `beginFrameSubscription` delivers a frame only when the page repaints, so the source keeps the
 * latest one. The conversion to a bitmap - and the resize to the window's slot - is done lazily, only
 * when a video frame is composed and the picture has changed since the last conversion.
 */
export class WindowFrameSource {
  private _image: FrameImage | null = null;
  private _version = 0;
  private _cached: { version: number; slot: string; picture: SourcePicture } | null = null;
  private _subscribed = false;

  constructor(private readonly target: CaptureTarget) {}

  /** True once the window has delivered at least one frame */
  get hasFrame(): boolean {
    return this._image !== null;
  }

  start(): void {
    if (this._subscribed) return;
    this._subscribed = true;
    this.target.beginFrameSubscription((image) => {
      if (image.isEmpty()) return;
      this._image = image;
      this._version++;
    });
    this.target.invalidate();
  }

  stop(): void {
    if (!this._subscribed) return;
    this._subscribed = false;
    try {
      this.target.endFrameSubscription();
    } catch {
      // --- The window may already be gone
    }
  }

  /**
   * The latest picture, fitted to the slot (aspect ratio kept), or undefined before the first frame.
   */
  picture(slot: Size): SourcePicture | undefined {
    const image = this._image;
    if (!image) return undefined;
    const slotKey = `${slot.width}x${slot.height}`;
    const cached = this._cached;
    if (cached && cached.version === this._version && cached.slot === slotKey) {
      return cached.picture;
    }
    const size = image.getSize();
    const fitted = fitSize(size, slot);
    if (fitted.width === 0 || fitted.height === 0) return undefined;
    const scaled =
      fitted.width === size.width && fitted.height === size.height
        ? image
        : image.resize({ width: fitted.width, height: fitted.height, quality: "good" });
    const actual = scaled.getSize();
    const pixels = scaled.toBitmap();
    if (pixels.length < actual.width * actual.height * 4) return cached?.picture;
    const picture: SourcePicture = { pixels, width: actual.width, height: actual.height };
    this._cached = { version: this._version, slot: slotKey, picture };
    return picture;
  }
}
