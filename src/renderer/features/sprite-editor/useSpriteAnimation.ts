import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Plays the sheet as an animation.
 *
 * Deliberately small and deliberately *local*: the hook is used inside `SpritePreview`, so a
 * running animation re-renders a 16x16 thumbnail and nothing else. Hoisting the frame counter into
 * `SpriteEditor` would have put a `setState` at 12 Hz above the grid, the palette and the sheet -
 * undoing Phase 3 the moment anyone pressed play.
 */

/** Frame rates worth offering. A cycle button beats a spinner for four values. */
export const FPS_STEPS = [4, 8, 12, 24] as const;

export type SpriteAnimation = {
  playing: boolean;
  /** The frame to draw while playing; `undefined` means "show the selected sprite". */
  frame: number | undefined;
  fps: number;
  toggle: () => void;
  cycleFps: () => void;
};

export function useSpriteAnimation(
  frameCount: number,
  initialFps: number,
  onFpsChange?: (fps: number) => void
): SpriteAnimation {
  const [playing, setPlaying] = useState(false);
  const [frame, setFrame] = useState(0);
  const [fps, setFps] = useState(
    FPS_STEPS.includes(initialFps as (typeof FPS_STEPS)[number]) ? initialFps : 12
  );

  // A single sprite is not an animation; stop rather than flashing one frame at itself.
  const canPlay = frameCount > 1;
  const active = playing && canPlay;

  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setFrame((f) => (f + 1) % frameCount), 1000 / fps);
    return () => clearInterval(id);
  }, [active, fps, frameCount]);

  /*
   * Stop when the window is hidden.
   *
   * A timer left running behind another tab is invisible work, and in Electron the document panel
   * can sit hidden for a long time. Pausing rather than merely throttling also means the frame the
   * user comes back to is the one they left.
   */
  useEffect(() => {
    if (!active) return undefined;
    const onVisibility = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onVisibility);
    };
  }, [active]);

  // Deleting sprites can leave the frame index past the end of the sheet.
  const frameRef = useRef(frame);
  frameRef.current = frame;
  useEffect(() => {
    if (frameRef.current >= frameCount) setFrame(0);
  }, [frameCount]);

  const toggle = useCallback(() => {
    setPlaying((p) => {
      if (p) return false;
      setFrame(0);
      return true;
    });
  }, []);

  const cycleFps = useCallback(() => {
    setFps((current) => {
      const next = FPS_STEPS[(FPS_STEPS.indexOf(current as (typeof FPS_STEPS)[number]) + 1) % FPS_STEPS.length];
      onFpsChange?.(next);
      return next;
    });
  }, [onFpsChange]);

  return { playing: active, frame: active ? frame % frameCount : undefined, fps, toggle, cycleFps };
}
