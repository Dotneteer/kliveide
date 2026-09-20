import { MutableRefObject, useCallback, useEffect, useRef, useState } from "react";

import {
  SETTING_EMU_MOUSE_CAPTURE,
  SETTING_EMU_MOUSE_SENSITIVITY,
  SETTING_EMU_MOUSE_SHOW_POINTER
} from "@common/settings/setting-const";
import {
  normalizeMousePointerDisplay,
  normalizeMouseSensitivity
} from "@common/settings/mouse-capture";
import { setMouseCapturedAction } from "@common/state/actions";
import { useDispatch, useGlobalSetting } from "@renderer/core/RendererProvider";
import type { IMachineController } from "@renderer/abstractions/IMachineController";
import type { IZxNextHostInputMachine } from "@emu/machines/zxNext/IZxNextHostInputMachine";
import { registerMouseCaptureRequest } from "./mouseCaptureBridge";

/**
 * Hands the host mouse to the emulator screen through the Pointer Lock API.
 *
 * Relative motion is the only model a Kempston mouse can use: its hardware counters are relative
 * 8-bit accumulators that wrap, and the *guest* draws the pointer, so there is no host coordinate
 * to map onto anything. Pointer lock gives exactly that - it hides the cursor, confines it to the
 * window and reports `movementX` / `movementY` while freezing `clientX` / `clientY`.
 *
 * This step wires capture and release only: movement is accumulated and thrown away. The flush that
 * turns it into PS/2 packets, the toolbar button and the on-screen indicator arrive in later steps,
 * on purpose - every awkward corner below belongs to pointer lock rather than to the machine, and
 * they are much easier to recognise while nothing else can be blamed for them.
 */

/** How long a refused capture is reported for, so the UI can explain itself and then stop. */
const REFUSAL_NOTICE_MS = 2000;

/**
 * The most movement one PS/2 packet may carry.
 *
 * The core scales a packet by NextReg `$0A`'s DPI *before* adding it to its 8-bit counter, and at
 * DPI `00` that doubles the byte - so 64 would land as -128 and the guest's pointer would jump
 * backwards. 63 is the largest value that survives every DPI setting. A real mouse reporting at
 * 100-200 Hz never exceeds it either, so splitting a fast flick across packets is what the hardware
 * does, not a workaround.
 */
const MAX_DELTA_PER_PACKET = 63;

/** The wheel field is 4 bits, signed. */
const MAX_WHEEL_PER_PACKET = 7;

/**
 * A ceiling on the packets one frame may emit.
 *
 * After a stall the accumulated movement could otherwise be flushed as a hundred packets at once.
 * The excess is dropped rather than carried: a real mouse's reports are lost the same way, and
 * carrying them would make the pointer keep gliding after the user's hand had stopped.
 */
const MAX_PACKETS_PER_FRAME = 8;

/**
 * How long after the machine last read a mouse port the indicator stays hidden.
 *
 * Software polls the mouse in its own loop, not every frame, so "has read it recently" needs a
 * window rather than a single-frame test. A second is long enough for a lazy poller and short
 * enough that the indicator comes back promptly when a program exits.
 */
const CONSUMED_IDLE_MS = 1000;

export type EmulatorMouseApi = {
  /** True while the screen holds the pointer lock. */
  captured: boolean;
  /**
   * True for a moment after the browser refused a capture. Practically always the Esc lockout -
   * see `requestCapture` - and the cue for the UI to say "click to capture" rather than look dead.
   */
  captureRefused: boolean;
  /** Capture the mouse. Returns false when nothing was attempted, so the caller can fall back. */
  requestCapture: () => boolean;
  /** Release the mouse if we hold it. Esc and focus loss do this on their own. */
  releaseCapture: () => void;
};

/** `requestPointerLock` is typed as returning `void` in older DOM libs and a promise in newer. */
type PointerLockRequest = (options?: { unadjustedMovement?: boolean }) => Promise<void> | void;

export type EmulatorMouseOptions = {
  /** The node the indicator is drawn on; absent while the indicator is switched off. */
  indicatorRef?: MutableRefObject<HTMLElement | undefined | null>;
  /** How the packets reach the machine. Absent in tests that only exercise capture. */
  controllerRef?: MutableRefObject<IMachineController>;
};

export function useEmulatorMouse(
  targetRef: MutableRefObject<HTMLElement | undefined | null>,
  { indicatorRef, controllerRef }: EmulatorMouseOptions = {}
): EmulatorMouseApi {
  const dispatch = useDispatch();
  const captureEnabled = !!useGlobalSetting(SETTING_EMU_MOUSE_CAPTURE);
  const sensitivity = normalizeMouseSensitivity(useGlobalSetting(SETTING_EMU_MOUSE_SENSITIVITY));
  const pointerDisplay = normalizeMousePointerDisplay(useGlobalSetting(SETTING_EMU_MOUSE_SHOW_POINTER));

  const [captured, setCaptured] = useState(false);
  const [captureRefused, setCaptureRefused] = useState(false);
  const capturedRef = useRef(false);
  const refusalTimer = useRef<ReturnType<typeof setTimeout>>();

  /*
   * Movement since the last flush, in *host* screen space: x grows right, y grows down. It is kept
   * raw here rather than pre-converted because the two consumers want opposite things - the
   * on-screen indicator moves in screen space, while the machine's packets count Y upwards. Storing
   * one convention and negating at the point of use keeps the sign flip in one readable place.
   */
  const pending = useRef({ x: 0, y: 0 });

  /*
   * Klive's own pointer, in pixels inside the screen element, and the buttons currently held.
   *
   * This is *not* the machine's pointer. While captured there is no host cursor position at all -
   * only deltas - so anything that wants to show where the mouse "is" has to keep its own. When a
   * program is reading the mouse it draws its own pointer from its own counters, and the two drift
   * apart by design (the machine scales by its DPI setting and its counters wrap where this one
   * clamps). Step 7 hides this indicator whenever software is actually consuming the coordinates.
   */
  const pointer = useRef({ x: 0, y: 0 });
  const buttons = useRef(0);

  /*
   * What still owes the machine, in *machine* space: x right, y **up**, z wheel notches.
   *
   * Kept as fractions rather than whole counts because a sensitivity below 1 would otherwise
   * truncate every small movement to nothing and the pointer would simply refuse to creep.
   */
  const owed = useRef({ x: 0, y: 0, z: 0 });

  /** The machine's mouse-port read count as of the previous frame, and when it last changed. */
  const portReads = useRef({ count: -1, changedAt: 0 });

  const noteRefusal = useCallback(() => {
    setCaptureRefused(true);
    clearTimeout(refusalTimer.current);
    refusalTimer.current = setTimeout(() => setCaptureRefused(false), REFUSAL_NOTICE_MS);
  }, []);

  const requestCapture = useCallback((): boolean => {
    if (!captureEnabled || capturedRef.current) return false;
    const target = targetRef.current;
    const request = (target as unknown as { requestPointerLock?: PointerLockRequest })
      ?.requestPointerLock;
    if (!target || typeof request !== "function") return false;

    /*
     * `unadjustedMovement` asks for raw counts with the operating system's pointer acceleration
     * turned off. That matters more here than it does in a game: the emulated core already scales
     * every packet by the machine's own DPI setting, and letting the OS curve compound with it
     * would make the guest's pointer behave in a way no real machine does.
     */
    let result: Promise<void> | void;
    try {
      result = request.call(target, { unadjustedMovement: true });
    } catch {
      // --- Thrown rather than rejected by browsers on the older, void-returning signature.
      noteRefusal();
      return true;
    }
    /*
     * A refusal is normal, not exceptional. Pointer lock needs transient activation, and the spec
     * additionally rejects a request made right after the user released the lock with Esc - "even
     * if a transient activation is available" - for roughly a second. So pressing Esc and clicking
     * straight back in *always* fails the first time. Swallowing that silently is what makes it
     * look like a bug; `captureRefused` is how the UI gets to say "click to capture" instead.
     */
    if (result && typeof (result as Promise<void>).catch === "function") {
      (result as Promise<void>).catch(noteRefusal);
    }
    return true;
  }, [captureEnabled, noteRefusal, targetRef]);

  const releaseCapture = useCallback(() => {
    if (capturedRef.current) document.exitPointerLock?.();
  }, []);

  // --- The toolbar button is a sibling of the panel, so it reaches us through this registration.
  useEffect(() => registerMouseCaptureRequest(requestCapture), [requestCapture]);

  /*
   * One listener for all four ways the lock can end - Esc, our own `exitPointerLock`, the window
   * losing focus, and a renderer reload. The browser reports every one of them the same way, so
   * there is a single release path to get right.
   */
  useEffect(() => {
    const onChange = (): void => {
      const isCaptured = !!targetRef.current && document.pointerLockElement === targetRef.current;
      if (isCaptured === capturedRef.current) return;
      capturedRef.current = isCaptured;
      setCaptured(isCaptured);
      if (!isCaptured) {
        // --- Movement collected before a release must not survive into the next capture.
        pending.current = { x: 0, y: 0 };
        owed.current = { x: 0, y: 0, z: 0 };
        /*
         * A button held when the lock ends would stay held in the machine for ever: the core latches
         * the buttons of the last packet and nothing else ever clears them. One final packet with
         * everything released is the only way to let go.
         */
        if (buttons.current !== 0) {
          buttons.current = 0;
          hostInputMachine(controllerRef)?.mousePacket(0, 0, 0, 0);
          indicatorRef?.current?.setAttribute("data-buttons", "0");
        }
      }
      dispatch(setMouseCapturedAction(isCaptured));
    };
    const onError = (): void => noteRefusal();

    document.addEventListener("pointerlockchange", onChange);
    document.addEventListener("pointerlockerror", onError);
    return () => {
      document.removeEventListener("pointerlockchange", onChange);
      document.removeEventListener("pointerlockerror", onError);
    };
  }, [controllerRef, dispatch, indicatorRef, noteRefusal, targetRef]);

  /*
   * Movement, buttons, and the one frame loop that consumes them.
   *
   * `mousemove` fires far above the machine's frame rate - a gaming mouse reports around 1000 times
   * a second - so the handler only accumulates, and everything that acts on the movement happens
   * once per animation frame. There is deliberately a *single* drain point: step 5 adds the PS/2
   * packet flush right beside the indicator update, reading the same `dx` / `dy`, so the two can
   * never disagree about how far the mouse moved.
   */
  useEffect(() => {
    if (!captured) return undefined;

    const onMove = (e: MouseEvent): void => {
      pending.current.x += e.movementX ?? 0;
      pending.current.y += e.movementY ?? 0;
    };

    /*
     * Buttons are applied straight away rather than on the next frame: a click on a still mouse
     * would otherwise be held back by up to a frame for no reason. `e.buttons` is already the
     * bitmask we want - bit 0 left, bit 1 right, bit 2 middle - in the same order the Kempston
     * mouse uses, so step 6 can hand it to the core untouched.
     */
    const onButtons = (e: MouseEvent): void => {
      const held = e.buttons & 0x07;
      if (held === buttons.current) return;
      buttons.current = held;
      indicatorRef?.current?.setAttribute("data-buttons", String(held));
      // --- A zero-motion packet, so a click on a still mouse is not held back by up to a frame.
      hostInputMachine(controllerRef)?.mousePacket(held, 0, 0, 0);
    };

    /*
     * One notch per event, from the sign: `deltaY` is 100, 3 or 53 depending on the platform and
     * the user's settings, and the wheel counter counts notches.
     *
     * The sign here still needs checking against real software - the core simply adds the delta
     * (`zxnext-input.c:182-186`) and the VHDL does not say which way a NextZXOS list should scroll.
     */
    const onWheel = (e: WheelEvent): void => {
      if (e.deltaY) owed.current.z -= Math.sign(e.deltaY);
    };
    // --- Without this the right button opens a context menu instead of reaching the machine.
    const onContextMenu = (e: Event): void => e.preventDefault();

    // --- Start in the middle: with no host cursor there is no more meaningful place to begin.
    const host = targetRef.current;
    pointer.current = { x: (host?.offsetWidth ?? 0) / 2, y: (host?.offsetHeight ?? 0) / 2 };
    portReads.current = { count: -1, changedAt: 0 };

    let frame = 0;
    const tick = (): void => {
      frame = requestAnimationFrame(tick);
      const element = indicatorRef?.current;
      const bounds = targetRef.current;
      if (!bounds) return;

      const dx = pending.current.x * sensitivity;
      const dy = pending.current.y * sensitivity;
      pending.current = { x: 0, y: 0 };

      if (dx || dy) {
        /*
         * Moved by what the *machine* receives, not by the raw host movement: the core multiplies
         * every packet by NextReg `$0A`'s DPI, so at DPI `00` a program's pointer travels exactly
         * twice as far as the hand did. An indicator that ignored that would sit at half speed
         * beside the machine's own pointer and look like a delivery bug. Software changes `$0A`
         * whenever it likes, so the factor is read per frame.
         *
         * Clamped to the screen box, where the machine's counters wrap instead - so the two still
         * part company at the edges, which no amount of scaling can fix.
         *
         * The bounds are re-read each frame rather than cached because the screen is resized by
         * the panel, the zoom-step setting and the window; one offset read per frame is cheaper
         * than being wrong after a resize.
         */
        const scale = hostInputMachine(controllerRef)?.mouseDeltaScale?.() ?? 1;
        pointer.current.x = clamp(pointer.current.x + dx * scale, 0, bounds.offsetWidth);
        pointer.current.y = clamp(pointer.current.y + dy * scale, 0, bounds.offsetHeight);
      }

      // --- Written straight to the DOM: this runs at display rate and must not re-render React.
      if (element) {
        element.style.transform = `translate3d(${pointer.current.x}px, ${pointer.current.y}px, 0)`;
      }

      /*
       * The same `dx` / `dy` the indicator just used, turned into PS/2 packets. Y is negated
       * because the machine's counter goes **up** where screen coordinates go down.
       */
      const machine = hostInputMachine(controllerRef);
      owed.current.x += dx;
      owed.current.y -= dy;
      flushPackets(machine, owed.current, buttons.current);

      /*
       * Hide the indicator while software is reading the mouse.
       *
       * A program that polls the counters draws its own pointer, and ours would be a second one
       * drifting away from it - different origin, the machine's own DPI scaling, and counters that
       * wrap where ours clamps. Two pointers that disagree are worse than none, so the moment the
       * machine shows interest in the mouse we get out of the way.
       */
      if (element) {
        const count = machine?.mousePortReadCount?.() ?? 0;
        const now = performance.now();
        if (count !== portReads.current.count) {
          // --- The first frame only establishes a baseline; it is not evidence of a reader.
          if (portReads.current.count >= 0) portReads.current.changedAt = now;
          portReads.current.count = count;
        }
        const consumed =
          pointerDisplay === "unused" &&
          portReads.current.changedAt > 0 &&
          now - portReads.current.changedAt < CONSUMED_IDLE_MS;
        element.dataset.consumed = consumed ? "true" : "false";
      }
    };
    frame = requestAnimationFrame(tick);

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mousedown", onButtons);
    document.addEventListener("mouseup", onButtons);
    document.addEventListener("wheel", onWheel);
    document.addEventListener("contextmenu", onContextMenu);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mousedown", onButtons);
      document.removeEventListener("mouseup", onButtons);
      document.removeEventListener("wheel", onWheel);
      document.removeEventListener("contextmenu", onContextMenu);
      buttons.current = 0;
    };
  }, [captured, controllerRef, indicatorRef, pointerDisplay, sensitivity, targetRef]);

  /*
   * Ctrl/Cmd+M, handled here rather than as an Electron menu accelerator. A menu click runs in the
   * main process and reaches the renderer over IPC with no transient activation, so it could never
   * perform the lock; a real key event can.
   *
   * `stopImmediatePropagation` keeps the chord away from `useEmulatorKeyboard`, which maps `KeyM`
   * to the machine's M key and would otherwise type one every time the mouse is captured. It works
   * because this hook is mounted *before* the keyboard hook in `EmulatorPanel`, so its listener on
   * `window` runs first - keep that order.
   */
  useEffect(() => {
    const isHotkey = (e: KeyboardEvent): boolean =>
      e.code === "KeyM" && (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey;

    const onKeyDown = (e: KeyboardEvent): void => {
      if (!isHotkey(e)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (capturedRef.current) releaseCapture();
      else requestCapture();
    };
    // --- The key-up is swallowed too, so the machine never sees half of a chord it should not see.
    const onKeyUp = (e: KeyboardEvent): void => {
      if (!isHotkey(e)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [releaseCapture, requestCapture]);

  // --- Turning the setting off while captured must hand the mouse straight back.
  useEffect(() => {
    if (!captureEnabled) releaseCapture();
  }, [captureEnabled, releaseCapture]);

  // --- Never leave a lock behind when the panel goes away.
  useEffect(
    () => () => {
      clearTimeout(refusalTimer.current);
      if (capturedRef.current) document.exitPointerLock?.();
    },
    []
  );

  return { captured, captureRefused, requestCapture, releaseCapture };
}

/** Keeps the indicator inside the screen box. */
function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** The running machine, when it is a Next that can take host input at all. */
function hostInputMachine(
  controllerRef?: MutableRefObject<IMachineController>
): IZxNextHostInputMachine | undefined {
  const machine = controllerRef?.current?.machine as Partial<IZxNextHostInputMachine> | undefined;
  return typeof machine?.mousePacket === "function" ? (machine as IZxNextHostInputMachine) : undefined;
}

/**
 * Drains a frame's worth of owed movement into PS/2 packets.
 *
 * Whole counts only: the fractional remainder stays owed so a slow drag at low sensitivity still
 * gets there. Exported for the tests, which is also the only place the arithmetic can be read
 * without a machine attached.
 */
export function flushPackets(
  machine: IZxNextHostInputMachine | undefined,
  owed: { x: number; y: number; z: number },
  buttons: number
): number {
  if (!machine) return 0;
  let sent = 0;
  for (;;) {
    const dx = clampChunk(Math.trunc(owed.x), MAX_DELTA_PER_PACKET);
    const dy = clampChunk(Math.trunc(owed.y), MAX_DELTA_PER_PACKET);
    const dz = clampChunk(Math.trunc(owed.z), MAX_WHEEL_PER_PACKET);
    // --- Sub-count remainders simply wait for the next frame; this is what ends the loop.
    if (!dx && !dy && !dz) return sent;

    owed.x -= dx;
    owed.y -= dy;
    owed.z -= dz;
    machine.mousePacket(buttons, dx, dy, dz);

    if (++sent === MAX_PACKETS_PER_FRAME) {
      owed.x = owed.y = owed.z = 0;
      return sent;
    }
  }
}

function clampChunk(value: number, limit: number): number {
  return value < -limit ? -limit : value > limit ? limit : value;
}
