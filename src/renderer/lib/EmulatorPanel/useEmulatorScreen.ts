import { type MutableRefObject, useEffect, useRef, useState } from "react";
import type { Sp48MachineController } from "../../../emu/sp48/Sp48MachineController";

export function useEmulatorScreen(
  hostElement: MutableRefObject<HTMLDivElement | null>,
  controllerRef: MutableRefObject<Sp48MachineController | null>
) {
  const screenElement = useRef<HTMLCanvasElement | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [canvasHeight, setCanvasHeight] = useState(0);
  const [nativeCanvasWidth, setNativeCanvasWidth] = useState(0);
  const [nativeCanvasHeight, setNativeCanvasHeight] = useState(0);
  const shadowCanvasWidth = useRef(0);
  const shadowCanvasHeight = useRef(0);
  const xRatio = useRef(1);
  const yRatio = useRef(1);
  const imageBuffer = useRef<ArrayBuffer | undefined>(undefined);
  const imageBuffer8 = useRef<Uint8Array | undefined>(undefined);
  const pixelData = useRef<Uint32Array | undefined>(undefined);
  const screenCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const screenImageDataRef = useRef<ImageData | null>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const host = hostElement.current;
    if (!host) {
      return;
    }

    const observer = new ResizeObserver(() => {
      calculateDimensions();
      displayScreenData();
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  function configureScreen(): void {
    const dataLen = shadowCanvasWidth.current * shadowCanvasHeight.current * 4;
    imageBuffer.current = new ArrayBuffer(dataLen);
    imageBuffer8.current = new Uint8Array(imageBuffer.current);
    pixelData.current = new Uint32Array(imageBuffer.current);
    screenCtxRef.current = null;
    screenImageDataRef.current = null;
    tempCanvasRef.current = null;
  }

  function calculateDimensions(): void {
    const host = hostElement.current;
    if (!host) {
      return;
    }

    const clientWidth = host.offsetWidth;
    const clientHeight = host.offsetHeight;
    const width = shadowCanvasWidth.current || 1;
    const height = shadowCanvasHeight.current || 1;
    let widthRatio = Math.floor((clientWidth - 8) / width) / xRatio.current;
    if (widthRatio < 1) {
      widthRatio = 1;
    }
    let heightRatio = Math.floor((clientHeight - 8) / height) / yRatio.current;
    if (heightRatio < 1) {
      heightRatio = 1;
    }
    const ratio = Math.min(widthRatio, heightRatio);
    setCanvasWidth(width * ratio * xRatio.current);
    setCanvasHeight(height * ratio * yRatio.current);
  }

  function updateScreenDimensions(): void {
    const machine = controllerRef.current?.machine;
    shadowCanvasWidth.current = machine?.screenWidthInPixels ?? 256;
    shadowCanvasHeight.current = machine?.screenHeightInPixels ?? 192;
    if (machine && "getAspectRatio" in machine && typeof machine.getAspectRatio === "function") {
      const [ratX, ratY] = machine.getAspectRatio();
      xRatio.current = ratX ?? 1;
      yRatio.current = ratY ?? 1;
    } else {
      xRatio.current = 1;
      yRatio.current = 1;
    }
    setNativeCanvasWidth(shadowCanvasWidth.current);
    setNativeCanvasHeight(shadowCanvasHeight.current);
    configureScreen();
    calculateDimensions();
  }

  function displayScreenData(): void {
    const screenEl = screenElement.current;
    const imageBytes = imageBuffer8.current;
    const pixels = pixelData.current;
    if (!screenEl || !imageBytes || !pixels) {
      return;
    }

    let screenCtx = screenCtxRef.current;
    if (!screenCtx) {
      screenCtx = screenEl.getContext("2d", { willReadFrequently: true });
      if (!screenCtx) {
        return;
      }
      screenCtx.imageSmoothingEnabled = false;
      screenCtxRef.current = screenCtx;
    }

    let screenImageData = screenImageDataRef.current;
    if (
      !screenImageData ||
      screenImageData.width !== shadowCanvasWidth.current ||
      screenImageData.height !== shadowCanvasHeight.current
    ) {
      screenImageData = screenCtx.createImageData(shadowCanvasWidth.current, shadowCanvasHeight.current);
      screenImageDataRef.current = screenImageData;
    }

    const machine = controllerRef.current?.machine;
    const screenData = machine?.getPixelBuffer();
    if (!machine || !screenData) {
      return;
    }

    const startIndex = machine.getPixelBufferStartOffset();
    const endIndex = shadowCanvasWidth.current * shadowCanvasHeight.current + startIndex;
    pixels.set(screenData.subarray(startIndex, endIndex));
    screenImageData.data.set(imageBytes);

    const tempCanvas = getTempCanvas();
    if (!tempCanvas) {
      return;
    }
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) {
      return;
    }
    tempCtx.imageSmoothingEnabled = false;
    tempCtx.putImageData(screenImageData, 0, 0);
    screenCtx.imageSmoothingEnabled = false;
    screenCtx.globalCompositeOperation = "copy";
    screenCtx.drawImage(tempCanvas, 0, 0, screenEl.width, screenEl.height);
    screenCtx.globalCompositeOperation = "source-over";
  }

  function paintStoppedScreen(): void {
    const screenEl = screenElement.current;
    const screenCtx = screenEl?.getContext("2d");
    if (!screenEl || !screenCtx) {
      return;
    }
    screenCtx.fillStyle = "#303030";
    screenCtx.fillRect(0, 0, screenEl.width, screenEl.height);
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
    nativeCanvasWidth,
    nativeCanvasHeight,
    displayScreenData,
    paintStoppedScreen,
    updateScreenDimensions
  };
}
