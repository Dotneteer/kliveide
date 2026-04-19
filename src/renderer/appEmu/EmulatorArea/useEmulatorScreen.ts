import { MutableRefObject, useEffect, useRef, useState } from "react";
import { IMachineController } from "../../abstractions/IMachineController";
import { useResizeObserver } from "@renderer/core/useResizeObserver";
import { useGlobalSetting } from "@renderer/core/RendererProvider";
import { SETTING_EMU_SCANLINE_EFFECT } from "@common/settings/setting-const";
import {
  applyScanlineEffectToCanvas,
  getScanlineDarkening,
  type ScanlineIntensity
} from "./scanlineEffect";

export function useEmulatorScreen(
  hostElement: MutableRefObject<HTMLDivElement>,
  controllerRef: MutableRefObject<IMachineController>
) {
  const scanlineEffect = useGlobalSetting(SETTING_EMU_SCANLINE_EFFECT);

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
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    currentScanlineEffect.current = (scanlineEffect || "off") as ScanlineIntensity;
  }, [scanlineEffect]);

  useResizeObserver(hostElement, () => {
    calculateDimensions();
    displayScreenData();
  });

  function configureScreen(): void {
    const dataLen = (shadowCanvasWidth.current ?? 0) * (shadowCanvasHeight.current ?? 0) * 4;
    imageBuffer.current = new ArrayBuffer(dataLen);
    imageBuffer8.current = new Uint8Array(imageBuffer.current);
    pixelData.current = new Uint32Array(imageBuffer.current);
    screenCtxRef.current = null;
    screenImageDataRef.current = null;
    tempCanvasRef.current = null;
  }

  function calculateDimensions(): void {
    if (!hostElement?.current || !screenElement?.current) return;
    hostRectangle.current = hostElement.current.getBoundingClientRect();
    screenRectangle.current = screenElement.current.getBoundingClientRect();
    const clientWidth = hostElement.current.offsetWidth;
    const clientHeight = hostElement.current.offsetHeight;
    const width = shadowCanvasWidth.current ?? 1;
    const height = shadowCanvasHeight.current ?? 1;
    let widthRatio = Math.floor((1 * (clientWidth - 8)) / width) / 1 / xRatio.current;
    if (widthRatio < 1) widthRatio = 1;
    let heightRatio = Math.floor((1 * (clientHeight - 8)) / height) / 1 / yRatio.current;
    if (heightRatio < 1) heightRatio = 1;
    const ratio = Math.min(widthRatio, heightRatio);
    setCanvasWidth(width * ratio * xRatio.current);
    setCanvasHeight(height * ratio * yRatio.current);
  }

  function updateScreenDimensions(): void {
    const ctrl = controllerRef.current;
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
  }

  function displayScreenData(): void {
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
    const screenData = ctrl?.machine?.getPixelBuffer();
    if (!screenData) return;
    const startIndex = ctrl?.machine?.getBufferStartOffset() ?? 0;
    const endIndex = shadowCanvasWidth.current * shadowCanvasHeight.current + startIndex;

    pixelData.current.set(screenData.subarray(startIndex, endIndex));
    screenImageData.data.set(imageBuffer8.current);

    const tempCanvas = getTempCanvas();
    if (!tempCanvas) return;

    const scanlineIntensity = currentScanlineEffect.current;
    const darkening = getScanlineDarkening(scanlineIntensity);
    if (darkening === 0.0) {
      renderWithoutScanlines(screenCtx, screenEl, screenImageData, tempCanvas);
    } else {
      renderWithScanlines(screenCtx, screenEl, screenImageData, tempCanvas, scanlineIntensity);
    }
  }

  function renderWithoutScanlines(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    imageData: ImageData,
    tempCanvas: HTMLCanvasElement
  ): void {
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) return;
    tempCtx.putImageData(imageData, 0, 0);
    ctx.globalCompositeOperation = "copy";
    ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "source-over";
  }

  function renderWithScanlines(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    imageData: ImageData,
    tempCanvas: HTMLCanvasElement,
    scanlineIntensity: ScanlineIntensity
  ): void {
    applyScanlineEffectToCanvas(
      ctx,
      canvas,
      imageData,
      shadowCanvasWidth.current,
      shadowCanvasHeight.current,
      scanlineIntensity,
      tempCanvas
    );
  }

  function getTempCanvas(): HTMLCanvasElement | null {
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
  }

  return {
    screenElement,
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
