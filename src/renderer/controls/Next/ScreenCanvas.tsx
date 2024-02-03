import { useEffect, useRef } from "react";
import { Row } from "../generic/Row";

type Props = {
  data: Uint8Array;
  palette: number[];
  screenWidth: number;
  screenHeight: number;
  zoomFactor?: number;
  calculateDataLength?: () => number;
  createPixelData?: (
    data: Uint8Array,
    palette: number[],
    target: Uint32Array
  ) => void;
};

// --- Represents a canvas and a drawing method to display a ZX Spectrum screen
export const ScreenCanvas = ({
  data,
  palette,
  screenWidth,
  screenHeight,
  zoomFactor = 2,
  calculateDataLength,
  createPixelData
}: Props) => {
  const screenElement = useRef<HTMLCanvasElement>();
  const shadowScreenElement = useRef<HTMLCanvasElement>();
  const shadowScreenWidth = screenWidth;
  const shadowScreenHeight = screenHeight;
  const canvasWidth = shadowScreenWidth * zoomFactor;
  const canvasHeight = shadowScreenHeight * zoomFactor;

  useEffect(() => {
    // --- Calculate the data length
    const dataLength =
      calculateDataLength?.() ?? shadowScreenWidth * shadowScreenHeight * 4;

    // --- Prepare buffers
    const imageBuffer = new ArrayBuffer(dataLength);
    const imageBuffer8 = new Uint8Array(imageBuffer);
    const pixelData = new Uint32Array(imageBuffer);

    const screenEl = screenElement.current;
    const shadowScreenEl = shadowScreenElement.current;
    if (!screenEl || !shadowScreenEl) {
      return;
    }

    // --- Prepare canvases
    const shadowCtx = shadowScreenEl.getContext("2d", {
      willReadFrequently: true
    });
    if (!shadowCtx) return;

    shadowCtx.imageSmoothingEnabled = false;
    const shadowImageData = shadowCtx.getImageData(
      0,
      0,
      shadowScreenEl.width,
      shadowScreenEl.height
    );

    const screenCtx = screenEl.getContext("2d", {
      willReadFrequently: true
    });

    // --- Calculate pixelData
    createPixelData?.(data, palette, pixelData);

    // --- Display the screen
    shadowImageData.data.set(imageBuffer8);
    shadowCtx.putImageData(shadowImageData, 0, 0);
    if (screenCtx) {
      screenCtx.imageSmoothingEnabled = false;
      screenCtx.drawImage(
        shadowScreenEl,
        0,
        0,
        screenEl.width,
        screenEl.height
      );
    }
  }, [data]);

  return (
    <Row>
      <canvas ref={screenElement} width={canvasWidth} height={canvasHeight} />
      <canvas
        ref={shadowScreenElement}
        style={{ display: "none" }}
        width={shadowScreenWidth}
        height={shadowScreenHeight}
      />
    </Row>
  );
};
