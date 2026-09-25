import { MutableRefObject, useCallback, useEffect, useRef, useState } from "react";
import { IMachineController } from "../../abstractions/IMachineController";
import { useResizeObserver } from "@renderer/core/useResizeObserver";
import { useGlobalSetting } from "@renderer/core/RendererProvider";
import {
  SETTING_EMU_SCANLINE_EFFECT,
  SETTING_EMU_ZOOM_STEP
} from "@common/settings/setting-const";
import { normalizeZoomStep, snapToZoomStep } from "@common/settings/zoom-steps";
import {
  applyScanlineEffectToCanvas,
  getScanlineDarkening,
  type ScanlineIntensity
} from "./scanlineEffect";

export function useEmulatorScreen(
  /*
   * The element whose content box bounds the screen.
   *
   * This is the panel's screen area, not the panel root: the root also carries the
   * machine-specific tool strip (the Z88 slot cards), and sizing the canvas against the root would
   * claim the height that strip is already using.
   */
  screenArea: MutableRefObject<HTMLDivElement>,
  controllerRef: MutableRefObject<IMachineController>,
  /*
   * An element inside the screen area whose height the screen may not use.
   *
   * The machine-specific tool strip (the Z88 slot cards) shares the screen's stack so the two stay
   * adjacent and left-aligned, which puts it inside the box being measured. Its outer height is
   * held back here rather than guessed at: the strip's size follows its own type and spacing, and
   * a constant would go stale the first time either changes.
   */
  reservedElement?: MutableRefObject<HTMLElement | undefined | null>
) {
  const scanlineEffect = useGlobalSetting(SETTING_EMU_SCANLINE_EFFECT);
  /*
   * How fine the fit below is allowed to be: whole, half or quarter multiples of the machine's
   * screen. Normalized here rather than trusted, because the value comes from a settings file
   * older versions never wrote.
   */
  const zoomStep = normalizeZoomStep(useGlobalSetting(SETTING_EMU_ZOOM_STEP));

  const screenElement = useRef<HTMLCanvasElement>();
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [canvasHeight, setCanvasHeight] = useState(0);
  const shadowCanvasWidth = useRef(0);
  const shadowCanvasHeight = useRef(0);
  const xRatio = useRef(1);
  const yRatio = useRef(1);
  const hostRectangle = useRef<DOMRect>();
  const screenRectangle = useRef<DOMRect>();

  const imageBuffer = useRef<ArrayBuffer>();
  const imageBuffer8 = useRef<Uint8Array>();
  const pixelData = useRef<Uint32Array>();
  const currentScanlineEffect = useRef<ScanlineIntensity>("off");
  const screenCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const screenImageDataRef = useRef<ImageData | null>(null);
  const directScreenImageDataRef = useRef<ImageData | null>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);

  /*
   * The display box around the canvas, and the surround a borderless picture gets inside it.
   *
   * The display has rounded corners and clips to them. A Spectrum's picture carries its own
   * emulated border, so the clip only ever takes border pixels; a Cambridge Z88's LCD is picture to
   * the edge, and lost its corner pixels (issue #1374). A machine that reports
   * `getScreenSurroundColor` is padded by the display's own corner radius - the one amount that
   * keeps the curve off the picture at any radius - in the colour it reports.
   */
  const displayElement = useRef<HTMLDivElement>(null);
  const [hasSurround, setHasSurround] = useState(false);
  const hasSurroundRef = useRef(false);
  /** The colour last painted; `null` means "not painted for this machine yet", forcing the next paint */
  const surroundColor = useRef<number | undefined | null>(null);

  useEffect(() => {
    currentScanlineEffect.current = (scanlineEffect || "off") as ScanlineIntensity;
  }, [scanlineEffect]);

  const configureScreen = useCallback((): void => {
    const dataLen = (shadowCanvasWidth.current ?? 0) * (shadowCanvasHeight.current ?? 0) * 4;
    imageBuffer.current = new ArrayBuffer(dataLen);
    imageBuffer8.current = new Uint8Array(imageBuffer.current);
    pixelData.current = new Uint32Array(imageBuffer.current);
    screenCtxRef.current = null;
    screenImageDataRef.current = null;
    directScreenImageDataRef.current = null;
    tempCanvasRef.current = null;
  }, []);

  const calculateDimensions = useCallback((): void => {
    if (!screenArea?.current || !screenElement?.current) return;
    hostRectangle.current = screenArea.current.getBoundingClientRect();
    screenRectangle.current = screenElement.current.getBoundingClientRect();
    /*
     * Measure the screen area's *content* box.
     *
     * This used to read `offsetWidth` and subtract a bare `- 8`: a gutter that existed only in this
     * arithmetic, invisible to every stylesheet, and wrong the moment anyone changed the panel's
     * spacing. The gutter is now real padding on `.emulatorPanel`, and this reads what the CSS
     * actually left available — the panel's padding and the tool strip's height are both already
     * subtracted by the time the layout hands this element its size.
     */
    const host = screenArea.current;
    const hostStyle = host instanceof Element ? getComputedStyle(host) : undefined;
    const pad = (value: string | undefined) => {
      const n = parseFloat(value ?? "");
      return Number.isFinite(n) ? n : 0;
    };
    // `clientWidth` excludes borders but includes padding, so the padding comes back off.
    const clientWidth =
      (host.clientWidth || host.offsetWidth) -
      pad(hostStyle?.paddingLeft) -
      pad(hostStyle?.paddingRight);
    // --- Whatever shares the stack with the screen is not space the screen can have
    const reserved = reservedElement?.current;
    const reservedStyle = reserved instanceof Element ? getComputedStyle(reserved) : undefined;
    const reservedHeight = reserved
      ? reserved.offsetHeight + pad(reservedStyle?.marginTop) + pad(reservedStyle?.marginBottom)
      : 0;
    const clientHeight =
      (host.clientHeight || host.offsetHeight) -
      pad(hostStyle?.paddingTop) -
      pad(hostStyle?.paddingBottom) -
      reservedHeight;
    /*
     * The surround sits inside the display box, around the canvas, so it is space the picture
     * cannot have. It is the display's `--radius-md` padding (`.surround` in the stylesheet), read
     * from the token rather than repeated here, and read from the screen area because the class
     * may not be on the display yet: this runs as the machine changes, before React re-renders.
     */
    const surround = hasSurroundRef.current
      ? pad(getComputedStyle(host).getPropertyValue("--radius-md"))
      : 0;
    // --- The display is `content-box`: its bezel border lies outside the canvas too
    const display = displayElement.current;
    const displayStyle = display instanceof Element ? getComputedStyle(display) : undefined;
    const frameWidth =
      2 * surround + pad(displayStyle?.borderLeftWidth) + pad(displayStyle?.borderRightWidth);
    const frameHeight =
      2 * surround + pad(displayStyle?.borderTopWidth) + pad(displayStyle?.borderBottomWidth);
    const width = shadowCanvasWidth.current ?? 1;
    const height = shadowCanvasHeight.current ?? 1;
    /*
     * The fit is snapped *down* to a multiple of the chosen zoom step, so the screen always lands
     * on a rung the user asked for rather than on whatever fraction the panel happens to allow.
     * At the coarsest step and a 1:1 aspect ratio this is the whole-pixel `Math.floor` that stood
     * here before the setting existed.
     *
     * The snap must happen on the size the machine's picture actually *occupies*, which is why the
     * aspect ratio is folded in before it rather than divided out after. The Next's pixels are
     * half as wide as they are tall (a 640-wide buffer, `xRatio` 0.5): snapping the raw buffer
     * multiple and then dividing by 0.5 doubles the grid back, so half steps came out as whole
     * ones and quarter steps as halves. What the user sees stepping is this ratio, so this is what
     * has to sit on the ladder.
     */
    let widthRatio = snapToZoomStep(clientWidth - frameWidth, width * xRatio.current, zoomStep);
    if (widthRatio < 1) widthRatio = 1;
    let heightRatio = snapToZoomStep(clientHeight - frameHeight, height * yRatio.current, zoomStep);
    if (heightRatio < 1) heightRatio = 1;
    const ratio = Math.min(widthRatio, heightRatio);
    /*
     * Rounded, because these become the canvas element's `width`/`height` attributes, which are
     * integers: a fractional step on an axis with an odd size or a non-unit aspect ratio would
     * otherwise be parsed rather than scaled. The correction is under half a device pixel.
     */
    setCanvasWidth(Math.round(width * ratio * xRatio.current));
    setCanvasHeight(Math.round(height * ratio * yRatio.current));
  }, [reservedElement, screenArea, zoomStep]);

  /**
   * Paints the surround in the machine's current colour, touching the DOM only when it changes.
   * Called for every picture shown, because the colour is the machine's and can change with it
   * (the Z88's LCD turns grey when it is off).
   */
  const syncSurroundColor = useCallback((): void => {
    const color = controllerRef.current?.machine?.getScreenSurroundColor?.();
    const element = displayElement.current;
    if (color === surroundColor.current || !element) return;
    surroundColor.current = color;
    element.style.backgroundColor = color === undefined ? "" : abgrToCssColor(color);
  }, [controllerRef]);

  const updateScreenDimensions = useCallback((): void => {
    const ctrl = controllerRef.current;
    const surround = typeof ctrl?.machine?.getScreenSurroundColor === "function";
    hasSurroundRef.current = surround;
    setHasSurround(surround);
    // --- A new machine: paint (or clear) whatever the last one left, even if the value is "none"
    surroundColor.current = null;
    syncSurroundColor();
    shadowCanvasWidth.current = ctrl?.machine?.screenWidthInPixels;
    shadowCanvasHeight.current = ctrl?.machine?.screenHeightInPixels;
    if (ctrl?.machine?.getAspectRatio) {
      const [ratX, ratY] = ctrl.machine.getAspectRatio();
      xRatio.current = ratX ?? 1;
      yRatio.current = ratY ?? 1;
    } else {
      xRatio.current = 1;
      yRatio.current = 1;
    }
    configureScreen();
    calculateDimensions();
  }, [calculateDimensions, configureScreen, controllerRef, syncSurroundColor]);

  const renderWithoutScanlines = useCallback((
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    imageData: ImageData,
    tempCanvas: HTMLCanvasElement
  ): void => {
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;
    tempCtx.putImageData(imageData, 0, 0);
    ctx.globalCompositeOperation = "copy";
    ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "source-over";
  }, []);

  const renderWithScanlines = useCallback((
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    imageData: ImageData,
    tempCanvas: HTMLCanvasElement,
    scanlineIntensity: ScanlineIntensity
  ): void => {
    applyScanlineEffectToCanvas(
      ctx,
      canvas,
      imageData,
      shadowCanvasWidth.current,
      shadowCanvasHeight.current,
      scanlineIntensity,
      tempCanvas
    );
  }, []);

  const getTempCanvas = useCallback((): HTMLCanvasElement | null => {
    if (
      !tempCanvasRef.current ||
      tempCanvasRef.current.width !== shadowCanvasWidth.current ||
      tempCanvasRef.current.height !== shadowCanvasHeight.current
    ) {
      const canvas = document.createElement("canvas");
      canvas.width = shadowCanvasWidth.current;
      canvas.height = shadowCanvasHeight.current;
      tempCanvasRef.current = canvas;
    }
    return tempCanvasRef.current;
  }, []);

  const displayScreenData = useCallback((): void => {
    syncSurroundColor();
    if (!pixelData.current) return;
    const screenEl = screenElement.current;
    if (!screenEl) return;

    let screenCtx = screenCtxRef.current;
    if (!screenCtx) {
      screenCtx = screenEl.getContext("2d", { willReadFrequently: true });
      if (!screenCtx) return;
      screenCtxRef.current = screenCtx;
    }

    screenCtx.imageSmoothingEnabled = false;

    let screenImageData = screenImageDataRef.current;
    if (
      !screenImageData ||
      screenImageData.width !== shadowCanvasWidth.current ||
      screenImageData.height !== shadowCanvasHeight.current
    ) {
      const width = Math.floor(shadowCanvasWidth.current ?? 1);
      const height = Math.floor(shadowCanvasHeight.current ?? 1);
      screenImageData = screenCtx.createImageData(width, height);
      screenImageDataRef.current = screenImageData;
    }

    const ctrl = controllerRef.current;
    const startIndex = ctrl?.machine?.getBufferStartOffset() ?? 0;
    const visiblePixels = shadowCanvasWidth.current * shadowCanvasHeight.current;
    const scanlineIntensity = currentScanlineEffect.current;
    const darkening = getScanlineDarkening(scanlineIntensity);
    const directScreenBytes = ctrl?.machine?.getPixelBufferBytes?.();
    if (darkening === 0.0 && directScreenBytes) {
      const byteStart = startIndex * 4;
      const byteEnd = byteStart + visiblePixels * 4;
      imageBuffer8.current = directScreenBytes.subarray(byteStart, byteEnd);
      let directScreenImageData = directScreenImageDataRef.current;
      if (
        !directScreenImageData ||
        directScreenImageData.data.buffer !== imageBuffer8.current.buffer ||
        directScreenImageData.data.byteOffset !== imageBuffer8.current.byteOffset ||
        directScreenImageData.width !== shadowCanvasWidth.current ||
        directScreenImageData.height !== shadowCanvasHeight.current
      ) {
        directScreenImageData = new ImageData(
          imageBuffer8.current as Uint8ClampedArray,
          shadowCanvasWidth.current,
          shadowCanvasHeight.current
        );
        directScreenImageDataRef.current = directScreenImageData;
      }
      const tempCanvas = getTempCanvas();
      if (!tempCanvas) return;
      renderWithoutScanlines(screenCtx, screenEl, directScreenImageData, tempCanvas);
      return;
    }

    const screenData = ctrl?.machine?.getPixelBuffer();
    if (!screenData) return;
    const endIndex = visiblePixels + startIndex;

    pixelData.current.set(screenData.subarray(startIndex, endIndex));
    screenImageData.data.set(imageBuffer8.current);

    const tempCanvas = getTempCanvas();
    if (!tempCanvas) return;

    if (darkening === 0.0) {
      renderWithoutScanlines(screenCtx, screenEl, screenImageData, tempCanvas);
    } else {
      renderWithScanlines(screenCtx, screenEl, screenImageData, tempCanvas, scanlineIntensity);
    }
  }, [controllerRef, getTempCanvas, renderWithScanlines, renderWithoutScanlines, syncSurroundColor]);

  const onAvailableSpaceChanged = useCallback(() => {
    calculateDimensions();
    displayScreenData();
  }, [calculateDimensions, displayScreenData]);

  useResizeObserver(screenArea, onAvailableSpaceChanged);
  // --- The reserved strip is content-sized, so its height can move independently of the area's
  useResizeObserver(reservedElement, onAvailableSpaceChanged);

  // --- Choosing a different zoom step changes the fit exactly as a resize does, and a paused
  // --- machine draws no further frames on its own, so the screen is re-rendered here too.
  useEffect(() => {
    onAvailableSpaceChanged();
  }, [onAvailableSpaceChanged, zoomStep]);

  return {
    screenElement,
    displayElement,
    hasSurround,
    canvasWidth,
    canvasHeight,
    imageBuffer8,
    xRatio,
    yRatio,
    displayScreenData,
    configureScreen,
    calculateDimensions,
    updateScreenDimensions
  };
}

/**
 * A pixel-buffer colour as CSS: the words are ABGR, so their bytes read R, G, B, A in memory order.
 */
export function abgrToCssColor(color: number): string {
  return `rgb(${color & 0xff}, ${(color >>> 8) & 0xff}, ${(color >>> 16) & 0xff})`;
}
