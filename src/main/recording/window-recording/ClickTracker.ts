/**
 * Turns mouse button events into what to draw for a recorded frame (D11, plan §4.4.1).
 *
 * - While a button is held, the frame shows the *held* ring.
 * - A release starts a ripple that expands and fades over `rippleMs`.
 * - **Latch:** a press is drawn in at least one recorded frame. At 15 fps a frame is taken only
 *   every 66 ms, so a quick click could otherwise fall between two frames and never appear. A press
 *   released before any frame showed it stays *held* until one frame has, and its ripple starts then.
 */
export type MouseButton = "left" | "middle" | "right";

export type ClickVisual = {
  /** The button currently drawn as held */
  held?: MouseButton;
  /** The release ripple in progress */
  ripple?: { button: MouseButton; progress: number };
};

export const DEFAULT_RIPPLE_MS = 300;

export class ClickTracker {
  private _down: { button: MouseButton; shown: boolean; released: boolean } | null = null;
  private _ripple: { button: MouseButton; start: number } | null = null;

  constructor(private readonly rippleMs = DEFAULT_RIPPLE_MS) {}

  /** True while a press is held (or latched, waiting to be shown) */
  get isHeld(): boolean {
    return this._down !== null;
  }

  mouseDown(button: MouseButton): void {
    this._down = { button, shown: false, released: false };
  }

  mouseUp(_button: MouseButton, now: number): void {
    const down = this._down;
    if (!down) return;
    if (down.shown) {
      this._down = null;
      this._ripple = { button: down.button, start: now };
    } else {
      // --- Latch: show the press in the next frame first
      down.released = true;
    }
  }

  /** Clears a press without a ripple (focus lost, pointer gone, recording stopped) */
  reset(): void {
    this._down = null;
  }

  /** The visual for a frame composed at `now`; marks a pending press as shown */
  frame(now: number): ClickVisual {
    const visual: ClickVisual = {};
    const down = this._down;
    if (down) {
      visual.held = down.button;
      down.shown = true;
      if (down.released) {
        this._down = null;
        this._ripple = { button: down.button, start: now };
        // --- The ripple starts from the next frame on; this one shows the press
        return visual;
      }
    }
    const ripple = this._ripple;
    if (ripple) {
      const progress = (now - ripple.start) / this.rippleMs;
      if (progress >= 1) {
        this._ripple = null;
      } else if (progress >= 0) {
        visual.ripple = { button: ripple.button, progress };
      }
    }
    return visual;
  }
}
