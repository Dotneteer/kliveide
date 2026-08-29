import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { MutableRefObject } from "react";

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("useEmulatorScreen", () => {
  it("uses direct RGBA pixel bytes when the machine exposes them and scanlines are off", async () => {
    if (typeof ImageData === "undefined") {
      (globalThis as any).ImageData = class TestImageData {
        data: Uint8ClampedArray;
        width: number;
        height: number;

        constructor(dataOrWidth: Uint8ClampedArray | number, widthOrHeight: number, height?: number) {
          if (typeof dataOrWidth === "number") {
            this.width = dataOrWidth;
            this.height = widthOrHeight;
            this.data = new Uint8ClampedArray(this.width * this.height * 4);
          } else {
            this.data = dataOrWidth;
            this.width = widthOrHeight;
            this.height = height ?? 0;
          }
        }
      };
    }

    vi.doMock("@renderer/core/RendererProvider", () => ({
      useGlobalSetting: () => "off"
    }));
    vi.doMock("@renderer/core/useResizeObserver", () => ({
      useResizeObserver: vi.fn()
    }));

    const tempPutImageData = vi.fn();
    const screenDrawImage = vi.fn();
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockImplementation(function getMockContext(this: HTMLCanvasElement) {
        return {
          createImageData: vi.fn((width: number, height: number) => new ImageData(width, height)),
          drawImage: this.dataset.kind === "screen" ? screenDrawImage : vi.fn(),
          globalCompositeOperation: "source-over",
          imageSmoothingEnabled: false,
          putImageData: this.dataset.kind === "screen" ? vi.fn() : tempPutImageData
        } as unknown as CanvasRenderingContext2D;
      });

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName);
      if (tagName.toLowerCase() === "canvas") {
        (element as HTMLCanvasElement).dataset.kind = "temp";
      }
      return element;
    });

    const visibleBytes = new Uint8ClampedArray([
      0, 0, 0, 0,
      1, 2, 3, 4,
      5, 6, 7, 8,
      9, 10, 11, 12,
      13, 14, 15, 16
    ]);
    const getPixelBuffer = vi.fn(() => new Uint32Array(4));
    const getPixelBufferBytes = vi.fn(() => visibleBytes);
    const controllerRef = {
      current: {
        machine: {
          getBufferStartOffset: () => 1,
          getPixelBuffer,
          getPixelBufferBytes,
          screenHeightInPixels: 2,
          screenWidthInPixels: 2
        }
      }
    };
    const hostElement = {
      current: { getBoundingClientRect: () => ({}), offsetHeight: 20, offsetWidth: 20 }
    };

    const { useEmulatorScreen } = await import("@renderer/features/emulator/useEmulatorScreen");
    const { result } = renderHook(() =>
      useEmulatorScreen(
        hostElement as unknown as MutableRefObject<HTMLDivElement>,
        controllerRef as any
      )
    );

    const screenCanvas = document.createElement("canvas");
    screenCanvas.dataset.kind = "screen";
    screenCanvas.width = 2;
    screenCanvas.height = 2;
    result.current.screenElement.current = screenCanvas;

    act(() => {
      result.current.updateScreenDimensions();
      result.current.displayScreenData();
    });

    expect(getPixelBufferBytes).toHaveBeenCalledTimes(1);
    expect(getPixelBuffer).not.toHaveBeenCalled();
    expect(result.current.imageBuffer8.current?.byteOffset).toBe(4);
    expect(result.current.imageBuffer8.current).toHaveLength(16);
    expect(tempPutImageData).toHaveBeenCalledTimes(1);
    expect(screenDrawImage).toHaveBeenCalledTimes(1);
    expect(getContext).toHaveBeenCalled();
  });
});
