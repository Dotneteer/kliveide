import { useRef, useEffect } from "react";

/**
 * Display renderer state management hook.
 * Encapsulates canvas rendering, pixel buffering, and frame synchronization.
 * Single-canvas implementation with CSS scaling.
 */
export function useDisplayRenderer() {
  // --- Canvas element reference (single canvas for both native and display)
  const screenElement = useRef<HTMLCanvasElement>();

  // --- Canvas dimensions (native emulator resolution)
  const canvasWidth = useRef(0);
  const canvasHeight = useRef(0);
  const displayScaleX = useRef(1);
  const displayScaleY = useRef(1);

  // --- Canvas context (cached for performance)
  const screenContext = useRef<CanvasRenderingContext2D | null>(null);

  // --- Pixel buffers
  const imageBuffer = useRef<ArrayBuffer>();
  const imageBuffer8 = useRef<Uint8Array>();
  const pixelData = useRef<Uint32Array>();

  // --- Cached display objects
  const screenImageData = useRef<ImageData | null>(null);
  const previousPixelData = useRef<Uint32Array | null>(null);

  // --- Frame synchronization (RequestAnimationFrame)
  const rafId = useRef<number | null>(null);
  const pendingDisplayUpdate = useRef(false);

  // --- Machine change detection
  const lastMachineHash = useRef<number>(0);

  // --- Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      screenContext.current = null;
      screenImageData.current = null;
      previousPixelData.current = null;
    };
  }, []);

  return {
    // --- Element reference
    screenElement,

    // --- Dimensions (native emulator resolution)
    canvasWidth,
    canvasHeight,
    displayScaleX,
    displayScaleY,

    // --- Context
    screenContext,

    // --- Buffers
    imageBuffer,
    imageBuffer8,
    pixelData,

    // --- Cached display objects
    screenImageData,
    previousPixelData,

    // --- Frame synchronization
    rafId,
    pendingDisplayUpdate,

    // --- Machine state tracking
    lastMachineHash,
  };
}
