import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { MutableRefObject } from "react";

import { useEmulatorMouse } from "@renderer/features/emulator/useEmulatorMouse";
import { requestMouseCapture } from "@renderer/features/emulator/mouseCaptureBridge";
import { flushPackets } from "@renderer/features/emulator/useEmulatorMouse";

/*
 * `useEmulatorMouse` - capture and release only (Milestone A, step 1).
 *
 * jsdom implements no part of the Pointer Lock API, so the browser side is stubbed here: the
 * element's `requestPointerLock`, `document.exitPointerLock` and the `pointerLockElement` getter.
 * That is fine for what these tests are about - the hook's job is to *ask* correctly and to react
 * to whatever the browser then reports, and both halves of that are observable through the stub.
 */

const mocks = vi.hoisted(() => ({
  captureEnabled: true,
  /** "always" by default, as the shipped setting is; "unused" turns the auto-hide on. */
  pointerDisplay: "always" as string,
  dispatched: [] as { type: string; payload?: { flag?: boolean } }[]
}));

vi.mock("@renderer/core/RendererProvider", () => ({
  useGlobalSetting: (id: string) =>
    id === "emuOptions.mouseShowPointer" ? mocks.pointerDisplay : mocks.captureEnabled,
  useDispatch: () => (action: { type: string; payload?: { flag?: boolean } }) => {
    mocks.dispatched.push(action);
  }
}));

let target: HTMLDivElement;
let targetRef: MutableRefObject<HTMLElement | undefined>;
let indicator: HTMLDivElement;
let indicatorRef: MutableRefObject<HTMLElement | undefined>;
let frameCallbacks: FrameRequestCallback[];
let packets: { buttons: number; dx: number; dy: number; dz: number }[];
let portReadCount: number;
let deltaScale: number;
let now: number;
let controllerRef: {
  current: {
    machine: {
      mousePacket: (b: number, x: number, y: number, z: number) => void;
      mousePortReadCount: () => number;
      mouseDeltaScale: () => number;
    };
  };
};
let lockElement: Element | null;
let requestPointerLock: ReturnType<typeof vi.fn>;

/** The browser telling us the lock state changed - the only way the hook learns anything. */
function reportLockChange(): void {
  act(() => {
    document.dispatchEvent(new Event("pointerlockchange"));
  });
}

/** The browser granting the lock, as it would after a successful request. */
function grantLock(): void {
  lockElement = target;
  reportLockChange();
}

beforeEach(() => {
  mocks.captureEnabled = true;
  mocks.pointerDisplay = "always";
  mocks.dispatched = [];
  lockElement = null;

  target = document.createElement("div");
  // --- jsdom lays nothing out, so the screen box has to be stated for the clamping to mean anything.
  Object.defineProperty(target, "offsetWidth", { configurable: true, value: 320 });
  Object.defineProperty(target, "offsetHeight", { configurable: true, value: 240 });
  document.body.appendChild(target);
  targetRef = { current: target };

  indicator = document.createElement("div");
  document.body.appendChild(indicator);
  indicatorRef = { current: indicator };

  // --- Frames are driven by hand: a timer-based rAF would make every assertion below a race.
  frameCallbacks = [];
  packets = [];
  portReadCount = 0;
  deltaScale = 1;
  now = 1000;
  vi.stubGlobal("performance", { now: () => now });
  controllerRef = {
    current: {
      machine: {
        mousePacket: (buttons: number, dx: number, dy: number, dz: number) =>
          packets.push({ buttons, dx, dy, dz }),
        mousePortReadCount: () => portReadCount,
        mouseDeltaScale: () => deltaScale
      }
    }
  };
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => frameCallbacks.push(cb));
  vi.stubGlobal("cancelAnimationFrame", () => undefined);

  requestPointerLock = vi.fn(() => Promise.resolve());
  (target as unknown as { requestPointerLock: unknown }).requestPointerLock = requestPointerLock;

  Object.defineProperty(document, "pointerLockElement", {
    configurable: true,
    get: () => lockElement
  });
  (document as unknown as { exitPointerLock: unknown }).exitPointerLock = vi.fn(() => {
    lockElement = null;
    reportLockChange();
  });
});

afterEach(() => {
  /*
   * Vitest runs without `globals`, so `@testing-library/react` never registers its own
   * `afterEach(cleanup)` - the repo's other hook tests call it by hand for the same reason. It
   * matters more than usual here: an un-unmounted hook keeps its `keydown` listener on `window`,
   * and that listener calls `stopImmediatePropagation`, so a leftover instance from an earlier test
   * silently swallows the hotkey the current one is testing.
   */
  cleanup();
  target.remove();
  indicator.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Runs the frames queued so far; the loop re-arms itself, so each call advances exactly one. */
function flushFrame(): void {
  const due = frameCallbacks;
  frameCallbacks = [];
  act(() => {
    due.forEach((cb) => cb(0));
  });
}

/**
 * Host movement, as the browser reports it while the pointer is locked.
 *
 * `movementX` / `movementY` are getter-only in jsdom and its `MouseEvent` constructor ignores them,
 * so they have to be defined onto the instance.
 */
function moveMouse(movementX: number, movementY: number): void {
  const event = new MouseEvent("mousemove");
  Object.defineProperty(event, "movementX", { value: movementX });
  Object.defineProperty(event, "movementY", { value: movementY });
  act(() => {
    document.dispatchEvent(event);
  });
}

describe("useEmulatorMouse", () => {
  it("asks for the lock on the screen element, with OS pointer acceleration turned off", () => {
    const { result } = renderHook(() => useEmulatorMouse(targetRef));

    let attempted = false;
    act(() => {
      attempted = result.current.requestCapture();
    });

    expect(attempted).toBe(true);
    expect(requestPointerLock).toHaveBeenCalledTimes(1);
    // --- Raw counts: the machine applies its own DPI scaling, so the OS curve must not compound.
    expect(requestPointerLock).toHaveBeenCalledWith({ unadjustedMovement: true });
  });

  it("does not become captured until the browser says so", () => {
    const { result } = renderHook(() => useEmulatorMouse(targetRef));

    act(() => {
      result.current.requestCapture();
    });
    // --- The request is not the grant; `pointerlockchange` is.
    expect(result.current.captured).toBe(false);

    grantLock();
    expect(result.current.captured).toBe(true);
    expect(mocks.dispatched.at(-1)).toEqual({
      type: "SET_MOUSE_CAPTURED",
      payload: { flag: true }
    });
  });

  it("clears the flag when the lock ends, whoever ended it", () => {
    const { result } = renderHook(() => useEmulatorMouse(targetRef));
    grantLock();
    expect(result.current.captured).toBe(true);

    // --- Exactly what Esc, a focus loss and our own exitPointerLock all look like from here.
    lockElement = null;
    reportLockChange();

    expect(result.current.captured).toBe(false);
    expect(mocks.dispatched.at(-1)).toEqual({
      type: "SET_MOUSE_CAPTURED",
      payload: { flag: false }
    });
  });

  it("survives a refused request and reports it instead of looking dead", async () => {
    // --- The Esc lockout: the spec rejects a re-capture for about a second after the unlock
    // --- gesture, even with a fresh user activation. It is routine, not exceptional.
    requestPointerLock.mockReturnValue(Promise.reject(new Error("locked out")));
    const { result } = renderHook(() => useEmulatorMouse(targetRef));

    await act(async () => {
      result.current.requestCapture();
      await Promise.resolve();
    });

    expect(result.current.captured).toBe(false);
    expect(result.current.captureRefused).toBe(true);
  });

  it("reports a refusal signalled as a pointerlockerror event", () => {
    const { result } = renderHook(() => useEmulatorMouse(targetRef));

    act(() => {
      result.current.requestCapture();
      document.dispatchEvent(new Event("pointerlockerror"));
    });

    expect(result.current.captured).toBe(false);
    expect(result.current.captureRefused).toBe(true);
  });

  it("attempts nothing while capture is switched off, and says so", () => {
    mocks.captureEnabled = false;
    const { result } = renderHook(() => useEmulatorMouse(targetRef));

    let attempted = true;
    act(() => {
      attempted = result.current.requestCapture();
    });

    // --- False tells the toolbar's bridge that nothing was attempted, rather than pretending.
    expect(attempted).toBe(false);
    expect(requestPointerLock).not.toHaveBeenCalled();
  });

  it("hands the mouse back when capture is switched off mid-capture", () => {
    const { rerender } = renderHook(() => useEmulatorMouse(targetRef));
    grantLock();

    mocks.captureEnabled = false;
    act(() => {
      rerender();
    });

    expect(document.exitPointerLock).toHaveBeenCalled();
  });

  it("captures and releases on Ctrl+M, and keeps the chord away from the machine", () => {
    const { result } = renderHook(() => useEmulatorMouse(targetRef));

    const down = new KeyboardEvent("keydown", { code: "KeyM", ctrlKey: true, cancelable: true });
    const stopped = vi.spyOn(down, "stopImmediatePropagation");
    act(() => {
      window.dispatchEvent(down);
    });

    expect(requestPointerLock).toHaveBeenCalledTimes(1);
    // --- Otherwise `useEmulatorKeyboard` would type an M into the machine on every capture.
    expect(stopped).toHaveBeenCalled();
    expect(down.defaultPrevented).toBe(true);

    grantLock();
    expect(result.current.captured).toBe(true);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyM", ctrlKey: true }));
    });
    expect(document.exitPointerLock).toHaveBeenCalled();
  });

  it("leaves a plain M alone", () => {
    renderHook(() => useEmulatorMouse(targetRef));

    const down = new KeyboardEvent("keydown", { code: "KeyM", cancelable: true });
    act(() => {
      window.dispatchEvent(down);
    });

    expect(requestPointerLock).not.toHaveBeenCalled();
    expect(down.defaultPrevented).toBe(false);
  });

  it("lets the toolbar reach it through the capture bridge", () => {
    // --- The toolbar button is a sibling of the panel and calls this, not the hook.
    renderHook(() => useEmulatorMouse(targetRef));

    let attempted = false;
    act(() => {
      attempted = requestMouseCapture();
    });

    expect(attempted).toBe(true);
    expect(requestPointerLock).toHaveBeenCalledTimes(1);
  });

  it("reports nothing to capture once the panel is gone", () => {
    const { unmount } = renderHook(() => useEmulatorMouse(targetRef));
    unmount();

    // --- The toolbar can be on screen while the emulator panel is not; that is not an error.
    expect(requestMouseCapture()).toBe(false);
  });

  describe("the captured-pointer indicator", () => {
    it("starts in the middle of the screen box", () => {
      renderHook(() => useEmulatorMouse(targetRef, { indicatorRef }));
      grantLock();
      flushFrame();

      expect(indicator.style.transform).toBe("translate3d(160px, 120px, 0)");
    });

    it("follows the host movement", () => {
      renderHook(() => useEmulatorMouse(targetRef, { indicatorRef }));
      grantLock();
      moveMouse(10, -20);
      flushFrame();

      expect(indicator.style.transform).toBe("translate3d(170px, 100px, 0)");
    });

    it("coalesces a frame's worth of movement into one update", () => {
      renderHook(() => useEmulatorMouse(targetRef, { indicatorRef }));
      grantLock();
      // --- A real mouse reports far faster than the display refreshes.
      moveMouse(3, 0);
      moveMouse(4, 0);
      moveMouse(5, 0);
      flushFrame();

      expect(indicator.style.transform).toBe("translate3d(172px, 120px, 0)");
    });

    it("clamps at the edges instead of leaving the screen", () => {
      renderHook(() => useEmulatorMouse(targetRef, { indicatorRef }));
      grantLock();
      moveMouse(10_000, 10_000);
      flushFrame();
      expect(indicator.style.transform).toBe("translate3d(320px, 240px, 0)");

      moveMouse(-10_000, -10_000);
      flushFrame();
      expect(indicator.style.transform).toBe("translate3d(0px, 0px, 0)");
    });

    it("comes back from an edge by the distance actually moved, not the distance pushed", () => {
      // --- The bug this guards: keeping the overshoot would make the pointer lag on the way back.
      renderHook(() => useEmulatorMouse(targetRef, { indicatorRef }));
      grantLock();
      moveMouse(10_000, 0);
      flushFrame();

      moveMouse(-5, 0);
      flushFrame();

      expect(indicator.style.transform).toBe("translate3d(315px, 120px, 0)");
    });

    it("shows which buttons are held", () => {
      renderHook(() => useEmulatorMouse(targetRef, { indicatorRef }));
      grantLock();

      act(() => {
        document.dispatchEvent(new MouseEvent("mousedown", { buttons: 0x01 }));
      });
      expect(indicator.dataset.buttons).toBe("1");

      act(() => {
        document.dispatchEvent(new MouseEvent("mouseup", { buttons: 0 }));
      });
      expect(indicator.dataset.buttons).toBe("0");
    });

    it("swallows the context menu so the right button can reach the machine", () => {
      renderHook(() => useEmulatorMouse(targetRef, { indicatorRef }));
      grantLock();

      const menu = new MouseEvent("contextmenu", { cancelable: true });
      act(() => {
        document.dispatchEvent(menu);
      });

      expect(menu.defaultPrevented).toBe(true);
    });

    it("stops tracking once the lock ends", () => {
      renderHook(() => useEmulatorMouse(targetRef, { indicatorRef }));
      grantLock();
      flushFrame();

      lockElement = null;
      reportLockChange();
      const frozen = indicator.style.transform;

      moveMouse(50, 50);
      flushFrame();

      // --- The panel stops rendering the indicator at all, but it must not move either way.
      expect(indicator.style.transform).toBe(frozen);
      const menu = new MouseEvent("contextmenu", { cancelable: true });
      document.dispatchEvent(menu);
      expect(menu.defaultPrevented).toBe(false);
    });
  });

  describe("feeding the machine", () => {
    const renderWithMachine = () =>
      renderHook(() => useEmulatorMouse(targetRef, { indicatorRef, controllerRef: controllerRef as never }));

    it("turns a frame's movement into one packet, with Y flipped for the machine", () => {
      renderWithMachine();
      grantLock();
      moveMouse(7, 5);
      flushFrame();

      // --- Screen Y grows downwards; the Kempston counter grows upwards.
      expect(packets).toEqual([{ buttons: 0, dx: 7, dy: -5, dz: 0 }]);
    });

    it("splits a fast flick into packets no larger than the hardware can carry", () => {
      renderWithMachine();
      grantLock();
      moveMouse(200, 0);
      flushFrame();

      // --- 64 or more would be doubled past a signed byte at DPI 00 and arrive as movement the
      // --- other way, so the flick becomes several packets rather than one wrong one.
      expect(packets.every((p) => Math.abs(p.dx) <= 63)).toBe(true);
      expect(packets.reduce((sum, p) => sum + p.dx, 0)).toBe(200);
    });

    it("keeps the fraction a slow drag leaves behind", () => {
      // --- At 0.25x a 2px movement is half a count; truncating it away every frame would mean a
      // --- slow drag never moved the machine's pointer at all.
      const owed = { x: 0, y: 0, z: 0 };
      const machine = { mousePacket: (b: number, x: number, y: number, z: number) => packets.push({ buttons: b, dx: x, dy: y, dz: z }) };

      owed.x += 0.5;
      expect(flushPackets(machine, owed, 0)).toBe(0);
      owed.x += 0.5;
      expect(flushPackets(machine, owed, 0)).toBe(1);
      expect(packets).toEqual([{ buttons: 0, dx: 1, dy: 0, dz: 0 }]);
    });

    it("drops the backlog rather than gliding on after a stall", () => {
      const owed = { x: 10_000, y: 0, z: 0 };
      const machine = { mousePacket: () => undefined };

      expect(flushPackets(machine, owed, 0)).toBe(8);
      expect(owed.x, "the rest is discarded, not carried").toBe(0);
    });

    it("sends a button change at once instead of waiting for the frame", () => {
      renderWithMachine();
      grantLock();

      act(() => {
        document.dispatchEvent(new MouseEvent("mousedown", { buttons: 0x01 }));
      });

      // --- A click on a still mouse would otherwise be held back by up to a frame.
      expect(packets).toEqual([{ buttons: 0x01, dx: 0, dy: 0, dz: 0 }]);
    });

    it("carries the held buttons on the movement packets too", () => {
      renderWithMachine();
      grantLock();
      act(() => {
        document.dispatchEvent(new MouseEvent("mousedown", { buttons: 0x02 }));
      });
      packets.length = 0;

      moveMouse(4, 0);
      flushFrame();
      expect(packets).toEqual([{ buttons: 0x02, dx: 4, dy: 0, dz: 0 }]);
    });

    it("counts wheel notches, not the platform's delta", () => {
      renderWithMachine();
      grantLock();

      act(() => {
        document.dispatchEvent(new WheelEvent("wheel", { deltaY: -120 }));
        document.dispatchEvent(new WheelEvent("wheel", { deltaY: -3 }));
      });
      flushFrame();

      // --- deltaY is 120 on one platform and 3 on another for the very same notch.
      expect(packets).toEqual([{ buttons: 0, dx: 0, dy: 0, dz: 2 }]);
    });

    it("releases the buttons when the lock ends, so nothing stays held for ever", () => {
      renderWithMachine();
      grantLock();
      act(() => {
        document.dispatchEvent(new MouseEvent("mousedown", { buttons: 0x01 }));
      });
      packets.length = 0;

      lockElement = null;
      reportLockChange();

      // --- The core latches the last packet's buttons and nothing else ever clears them.
      expect(packets).toEqual([{ buttons: 0, dx: 0, dy: 0, dz: 0 }]);
    });

    it("sends nothing to a machine that has no mouse", () => {
      // --- A ZX Spectrum 48 exposes no `mousePacket`; capture must not throw over it.
      const notANext = { current: { machine: {} } };
      renderHook(() => useEmulatorMouse(targetRef, { indicatorRef, controllerRef: notANext as never }));
      grantLock();
      moveMouse(10, 10);

      expect(() => flushFrame()).not.toThrow();
      expect(packets).toHaveLength(0);
    });
  });

  describe("matching the machine's own scaling", () => {
    const renderWithMachine = () =>
      renderHook(() => useEmulatorMouse(targetRef, { indicatorRef, controllerRef: controllerRef as never }));

    it("moves the indicator by what the machine receives, not by the raw hand movement", () => {
      // --- NextReg $0A DPI 00 doubles every packet inside the core, so a program's pointer travels
      // --- twice as far as the hand. An indicator at half that speed looks like a delivery bug.
      deltaScale = 2;
      renderWithMachine();
      grantLock();
      moveMouse(10, 0);
      flushFrame();

      expect(indicator.style.transform).toBe("translate3d(180px, 120px, 0)");
    });

    it("still sends the machine the unscaled movement", () => {
      deltaScale = 2;
      renderWithMachine();
      grantLock();
      moveMouse(10, 0);
      flushFrame();

      // --- The core applies the DPI itself; scaling here too would double it twice.
      expect(packets).toEqual([{ buttons: 0, dx: 10, dy: 0, dz: 0 }]);
    });

    it("follows a DPI that halves as readily as one that doubles", () => {
      deltaScale = 0.5;
      renderWithMachine();
      grantLock();
      moveMouse(10, 0);
      flushFrame();

      expect(indicator.style.transform).toBe("translate3d(165px, 120px, 0)");
    });
  });

  describe("getting out of the way of software that uses the mouse", () => {
    const renderWithMachine = () =>
      renderHook(() => useEmulatorMouse(targetRef, { indicatorRef, controllerRef: controllerRef as never }));

    it("stays visible by default even while a program reads the mouse", () => {
      /*
       * The default is "always" precisely so the two pointers can be compared: when Klive's
       * indicator and the program's own pointer drift apart, seeing both is the whole diagnosis.
       * Hiding was the original default and made the indicator look broken.
       */
      renderWithMachine();
      grantLock();
      flushFrame();
      portReadCount = 12;
      flushFrame();

      expect(indicator.dataset.consumed).toBe("false");
    });

    it("keeps the indicator while nothing is reading the mouse ports", () => {
      renderWithMachine();
      grantLock();
      flushFrame();
      flushFrame();

      expect(indicator.dataset.consumed).toBe("false");
    });

    it("hides it once the machine starts reading them, when asked to", () => {
      mocks.pointerDisplay = "unused";
      renderWithMachine();
      grantLock();
      flushFrame();

      // --- A program polling the counters is drawing its own pointer; ours would be a second one.
      portReadCount = 12;
      flushFrame();

      expect(indicator.dataset.consumed).toBe("true");
    });

    it("brings it back once the reading stops", () => {
      mocks.pointerDisplay = "unused";
      renderWithMachine();
      grantLock();
      flushFrame();
      portReadCount = 12;
      flushFrame();
      expect(indicator.dataset.consumed).toBe("true");

      // --- Software polls in its own loop, not every frame, so the verdict needs a window.
      now += 500;
      flushFrame();
      expect(indicator.dataset.consumed, "still within the window").toBe("true");

      now += 600;
      flushFrame();
      expect(indicator.dataset.consumed).toBe("false");
    });

    it("does not treat the first frame's reading as evidence", () => {
      mocks.pointerDisplay = "unused";
      // --- Whatever the count happens to be when a capture starts is a baseline, not a reader:
      // --- otherwise every capture would begin with the indicator hidden.
      portReadCount = 5000;
      renderWithMachine();
      grantLock();
      flushFrame();

      expect(indicator.dataset.consumed).toBe("false");
    });
  });

  it("never leaves the lock behind when the panel goes away", () => {
    const { unmount } = renderHook(() => useEmulatorMouse(targetRef));
    grantLock();

    unmount();

    expect(document.exitPointerLock).toHaveBeenCalled();
  });
});
