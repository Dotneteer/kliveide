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
    // A real element: the hook reads computed padding to size the screen, which a plain object
    // cannot answer. It is what the component passes in any case.
    const hostDiv = document.createElement("div");
    Object.defineProperty(hostDiv, "offsetWidth", { value: 20 });
    Object.defineProperty(hostDiv, "offsetHeight", { value: 20 });
    document.body.appendChild(hostDiv);
    const hostElement = { current: hostDiv };

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

  /*
   * The zoom step is a step of the ratio the *user sees*, not of the machine's raw buffer.
   *
   * The Next draws a 640-pixel-wide buffer whose pixels are half as wide as they are tall
   * (`getAspectRatio` -> [0.5, 1]), so its picture occupies 320 screen pixels at 1x. A fit that
   * snapped the raw 640 multiple and divided the aspect out afterwards put the rungs back on whole
   * numbers - half steps behaved exactly like whole ones on every Next machine.
   */
  describe("zoom steps on a machine whose pixels are not square", () => {
    const renderWithZoomStep = async (zoomStep: unknown, hostWidth: number) => {
      vi.doMock("@renderer/core/RendererProvider", () => ({
        useGlobalSetting: (id: string) => (id === "emuOptions.zoomStep" ? zoomStep : "off")
      }));
      vi.doMock("@renderer/core/useResizeObserver", () => ({
        useResizeObserver: vi.fn()
      }));

      const controllerRef = {
        current: {
          machine: {
            getAspectRatio: () => [0.5, 1] as [number, number],
            getBufferStartOffset: () => 0,
            getPixelBuffer: () => new Uint32Array(640 * 256),
            screenHeightInPixels: 256,
            screenWidthInPixels: 640
          }
        }
      };

      const hostDiv = document.createElement("div");
      Object.defineProperty(hostDiv, "offsetWidth", { value: hostWidth });
      // --- Generous, so the width is always the axis that binds
      Object.defineProperty(hostDiv, "offsetHeight", { value: 4000 });
      document.body.appendChild(hostDiv);

      const { useEmulatorScreen } = await import("@renderer/features/emulator/useEmulatorScreen");
      const { result } = renderHook(() =>
        useEmulatorScreen(
          { current: hostDiv } as unknown as MutableRefObject<HTMLDivElement>,
          controllerRef as any
        )
      );

      const screenCanvas = document.createElement("canvas");
      result.current.screenElement.current = screenCanvas;
      act(() => {
        result.current.updateScreenDimensions();
      });
      // --- Width in screen pixels / 320 is the ratio the user perceives
      return { canvasWidth: result.current.canvasWidth, canvasHeight: result.current.canvasHeight };
    };

    it("reaches the half rungs a 640-wide buffer used to skip", async () => {
      // --- 500px of panel fits 1.5x of the 320px-wide picture (480px), not 2x (640px)
      const { canvasWidth, canvasHeight } = await renderWithZoomStep(0.5, 500);
      expect(canvasWidth).toBe(480);
      expect(canvasHeight).toBe(384);
    });

    it("reaches the quarter rungs too", async () => {
      // --- 420px fits 1.25x (400px) but not 1.5x
      const { canvasWidth } = await renderWithZoomStep(0.25, 420);
      expect(canvasWidth).toBe(400);
    });

    it("still snaps to whole multiples of the picture at the coarsest step", async () => {
      const { canvasWidth } = await renderWithZoomStep(1, 500);
      expect(canvasWidth).toBe(320);
    });

    it("falls back to half steps when the setting is missing", async () => {
      const { canvasWidth } = await renderWithZoomStep(undefined, 500);
      expect(canvasWidth).toBe(480);
    });
  });

  /*
   * A picture with no border of its own (issue #1374).
   *
   * The display's rounded corners clipped the Cambridge Z88 LCD's corner pixels: its 640x64 buffer
   * is picture to the edge. A machine that reports `getScreenSurroundColor` gets the display's
   * corner radius as padding, in that colour, and the fit leaves room for it.
   */
  describe("a machine that reports a surround colour", () => {
    const LCD_UNLIT = 0xffb9e0d2; // --- the Z88 core's unlit pixel, ABGR
    const LCD_OFF = 0xffa0a0a0;

    const renderLcd = async (hostWidth: number, surround: boolean) => {
      vi.doMock("@renderer/core/RendererProvider", () => ({
        useGlobalSetting: (id: string) => (id === "emuOptions.zoomStep" ? 1 : "off")
      }));
      vi.doMock("@renderer/core/useResizeObserver", () => ({
        useResizeObserver: vi.fn()
      }));
      let color = LCD_UNLIT;
      const machine: Record<string, unknown> = {
        getBufferStartOffset: () => 0,
        getPixelBuffer: () => new Uint32Array(640 * 64),
        screenHeightInPixels: 64,
        screenWidthInPixels: 640
      };
      if (surround) machine.getScreenSurroundColor = () => color;
      const controller: { machine: Record<string, unknown> } = { machine };

      const hostDiv = document.createElement("div");
      hostDiv.style.setProperty("--radius-md", "6px");
      Object.defineProperty(hostDiv, "offsetWidth", { value: hostWidth });
      Object.defineProperty(hostDiv, "offsetHeight", { value: 4000 });
      document.body.appendChild(hostDiv);

      const { useEmulatorScreen } = await import("@renderer/features/emulator/useEmulatorScreen");
      const { result } = renderHook(() =>
        useEmulatorScreen(
          { current: hostDiv } as unknown as MutableRefObject<HTMLDivElement>,
          { current: controller } as any
        )
      );
      const display = document.createElement("div");
      result.current.displayElement.current = display;
      result.current.screenElement.current = document.createElement("canvas");
      act(() => {
        result.current.updateScreenDimensions();
      });
      return { result, display, controller, setColor: (c: number) => (color = c) };
    };

    it("keeps the padding out of the fit", async () => {
      // --- 1284px holds 2x (1280) of a bare picture, but not 2x plus 6px on each side
      const bare = await renderLcd(1284, false);
      expect(bare.result.current.canvasWidth).toBe(1280);
      expect(bare.result.current.hasSurround).toBe(false);

      vi.resetModules();
      const padded = await renderLcd(1284, true);
      expect(padded.result.current.canvasWidth).toBe(640);
      expect(padded.result.current.hasSurround).toBe(true);

      vi.resetModules();
      expect((await renderLcd(1292, true)).result.current.canvasWidth).toBe(1280);
    });

    it("paints the surround in the machine's colour and follows it", async () => {
      const { result, display, setColor } = await renderLcd(1400, true);
      expect(display.style.backgroundColor).toBe("rgb(210, 224, 185)");

      // --- The LCD switched off: the next picture shown brings the surround along
      setColor(LCD_OFF);
      act(() => result.current.displayScreenData());
      expect(display.style.backgroundColor).toBe("rgb(160, 160, 160)");
    });

    it("clears the surround when the next machine has its own border", async () => {
      // --- Found in the running app: switching from the Z88 to a Spectrum left the LCD green behind
      // --- the Spectrum's picture, showing in its rounded corners
      const { result, display, controller } = await renderLcd(1400, true);
      expect(display.style.backgroundColor).toBe("rgb(210, 224, 185)");

      controller.machine = {
        getBufferStartOffset: () => 0,
        getPixelBuffer: () => new Uint32Array(352 * 288),
        screenHeightInPixels: 288,
        screenWidthInPixels: 352
      };
      act(() => result.current.updateScreenDimensions());
      expect(display.style.backgroundColor).toBe("");
      expect(result.current.hasSurround).toBe(false);
    });

    it("leaves a machine with its own border alone", async () => {
      const { display } = await renderLcd(1400, false);
      expect(display.style.backgroundColor).toBe("");
    });
  });

  /*
   * The window's size hints (issue #1377).
   *
   * The window was held at 640x480 for every machine, so a Z88 (a 640x64 LCD) could not be made
   * compact. The hook reports what the window needs: whatever of the viewport is not the picture's
   * room, plus the picture at 1x (the minimum) and at the current ratio (the fit).
   */
  describe("the window size hints it reports", () => {
    const Z88 = {
      machineId: "z88",
      getBufferStartOffset: () => 0,
      getPixelBuffer: () => new Uint32Array(640 * 64),
      screenHeightInPixels: 64,
      screenWidthInPixels: 640
    };
    const SP48 = {
      machineId: "sp48",
      getBufferStartOffset: () => 0,
      getPixelBuffer: () => new Uint32Array(352 * 296),
      screenHeightInPixels: 296,
      screenWidthInPixels: 352
    };

    const render = async (
      opts: {
        machine?: Record<string, unknown>;
        host?: { width: number; height: number };
        strip?: { width: number; height: number };
      } = {}
    ) => {
      vi.useFakeTimers();
      vi.doMock("@renderer/core/RendererProvider", () => ({
        useGlobalSetting: (id: string) => (id === "emuOptions.zoomStep" ? 1 : "off")
      }));
      vi.doMock("@renderer/core/useResizeObserver", () => ({
        useResizeObserver: vi.fn()
      }));
      const controller = { machine: (opts.machine ?? Z88) as Record<string, unknown> };
      const hostDiv = document.createElement("div");
      Object.defineProperty(hostDiv, "offsetWidth", { value: opts.host?.width ?? 700 });
      Object.defineProperty(hostDiv, "offsetHeight", { value: opts.host?.height ?? 300 });
      document.body.appendChild(hostDiv);
      let stripRef: MutableRefObject<HTMLElement> | undefined;
      if (opts.strip) {
        const strip = document.createElement("div");
        Object.defineProperty(strip, "offsetWidth", { value: opts.strip.width });
        Object.defineProperty(strip, "offsetHeight", { value: opts.strip.height });
        stripRef = { current: strip };
      }
      // --- jsdom's viewport
      vi.spyOn(window, "innerWidth", "get").mockReturnValue(1024);
      vi.spyOn(window, "innerHeight", "get").mockReturnValue(768);

      const onHints = vi.fn();
      const { useEmulatorScreen, HINTS_SETTLE_DELAY } = await import(
        "@renderer/features/emulator/useEmulatorScreen"
      );
      const { result } = renderHook(() =>
        useEmulatorScreen(
          { current: hostDiv } as unknown as MutableRefObject<HTMLDivElement>,
          { current: controller } as any,
          stripRef,
          onHints
        )
      );
      result.current.screenElement.current = document.createElement("canvas");
      const settle = () => act(() => vi.advanceTimersByTime(HINTS_SETTLE_DELAY + 1));
      act(() => result.current.updateScreenDimensions());
      settle();
      return { result, onHints, controller, settle };
    };

    afterEach(() => {
      vi.useRealTimers();
    });

    it("is the chrome plus the picture at 1x, for the minimum and the fit alike at 1x", async () => {
      // --- 1024x768 viewport, 700x300 for the picture: 324x468 of chrome, plus 640x64
      const { onHints } = await render();
      expect(onHints).toHaveBeenCalledTimes(1);
      expect(onHints).toHaveBeenCalledWith({
        machineId: "z88",
        minimum: { width: 964, height: 532 },
        fit: { width: 964, height: 532 }
      });
    });

    it("fits the current zoom step, not 1x, when the window holds more", async () => {
      // --- 800x700 holds a 352x296 Spectrum picture at 2x (704x592)
      const { onHints } = await render({ machine: SP48, host: { width: 800, height: 700 } });
      expect(onHints).toHaveBeenCalledWith({
        machineId: "sp48",
        minimum: { width: 640, height: 364 },
        fit: { width: 928, height: 660 }
      });
    });

    it("keeps room for the slot-card strip, and its width when that is wider", async () => {
      const { onHints } = await render({ strip: { width: 800, height: 40 } });
      expect(onHints.mock.calls[0][0].minimum).toEqual({ width: 1124, height: 572 });
    });

    it("reports only when the hints change, and only once the layout settles", async () => {
      const { result, onHints, settle } = await render();
      act(() => result.current.calculateDimensions());
      settle();
      expect(onHints).toHaveBeenCalledTimes(1);

      // --- Several fits in a row send only the last
      act(() => {
        result.current.calculateDimensions();
        result.current.calculateDimensions();
      });
      expect(onHints).toHaveBeenCalledTimes(1);
    });

    it("reports again for a new machine, even when its sizes are the same", async () => {
      const { result, onHints, controller, settle } = await render({ machine: SP48 });
      controller.machine = { ...SP48, machineId: "sp128" };
      act(() => result.current.updateScreenDimensions());
      settle();
      expect(onHints).toHaveBeenCalledTimes(2);
      expect(onHints.mock.calls[1][0].machineId).toBe("sp128");
      expect(onHints.mock.calls[1][0].minimum).toEqual(onHints.mock.calls[0][0].minimum);
    });
  });
});
