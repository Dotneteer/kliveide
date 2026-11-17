import type { KeyMapping } from "@abstractions/KeyMapping";
import type { KeyCodeSet } from "@emu/abstractions/IGenericKeyboardDevice";

import { MutableRefObject, useCallback, useEffect, useRef } from "react";
import { IMachineController } from "../../abstractions/IMachineController";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { useSelector } from "@renderer/core/RendererProvider";

/**
 * Whether a key event is the Command (Meta) key itself.
 *
 * macOS sends no `keyup` for a key released while Command is held: Cmd+P, then letting go of
 * both, delivers `keydown P` and never `keyup P`. A key pressed into the matrix that way stays
 * down until reset, and the ROM keeps repeating it (the "stuck key" report). So a key that comes
 * with Command never reaches the matrix (it is a host shortcut), and letting go of Command lets
 * go of everything still held, because those key-ups are the ones that went missing.
 */
function isMetaKey(code: string): boolean {
  return code === "MetaLeft" || code === "MetaRight" || code === "OSLeft" || code === "OSRight";
}

export function useEmulatorKeyboard(
  controllerRef: MutableRefObject<IMachineController>,
  keyStatusSet?: (code: number, down: boolean) => void,
  /**
   * Whether a joystick connector has taken a host key, from `useEmulatorJoystick`.
   *
   * Without this, one `ArrowUp` would press the joystick's UP pin *and* the machine's cursor key -
   * and in a Sinclair or Cursor joystick mode the core would press a third key on top, because
   * those modes make the pins press membrane keys themselves. It answers `false` on a machine
   * without connectors, so there the key reaches the matrix. Expected to be stable across renders,
   * so a change of bindings does not re-bind the listeners below.
   */
  claimsKey?: (code: string) => boolean
) {
  const keyMappings = useSelector((s) => s.keyMappings);

  const keyMappingsRef = useRef(keyMappings);
  const pressedKeys = useRef<Record<string, boolean>>({});
  const defaultKeyMappings = useRef<KeyMapping>();
  const currentKeyMappings = useRef<KeyMapping>();
  const keyCodeSet = useRef<KeyCodeSet>();
  const modalOpen = useRef(false);
  const machineState = useSelector((s) => s.emulatorState?.machineState);

  // Keep keyMappings ref in sync
  useEffect(() => {
    keyMappingsRef.current = keyMappings;
    applyKeyMappings();
  }, [keyMappings]);

  // Keep modal-open state in sync so emulator key events do not leak behind dialogs.
  const dimMenu = useSelector((s) => s.dimMenu ?? false);
  useEffect(() => {
    modalOpen.current = dimMenu;
  }, [dimMenu]);

  function applyKeyMappings(): void {
    const km = keyMappingsRef.current;
    if (!km) {
      currentKeyMappings.current = defaultKeyMappings.current;
    } else {
      currentKeyMappings.current = km.merge
        ? { ...defaultKeyMappings.current, ...km.mapping }
        : km.mapping;
    }
  }

  // Called when the machine controller changes to initialize key data
  const setKeyData = useCallback((codeSet: KeyCodeSet, defaultMappings: KeyMapping) => {
    keyCodeSet.current = codeSet;
    defaultKeyMappings.current = defaultMappings;
    applyKeyMappings();
  }, []);

  const handleMappedKey = useCallback((code: string, keyMapping: KeyMapping, isDown: boolean): void => {
    // --- A key bound to a joystick pin belongs to the joystick and never to the keyboard matrix.
    if (claimsKey?.(code)) return;
    const mapping = keyMapping?.[code];
    if (!mapping) return;
    const machine = controllerRef.current?.machine;
    // --- A mapping is one key or a modifier plus a key. Iterating rather than unrolling a branch
    // --- per position keeps this from drifting out of step with `KeySet` again: the arity lives in
    // --- the type and in the mapping-file parser, not here.
    const keys = typeof mapping === "string" ? [mapping] : mapping;
    for (const key of keys) {
      const keyCode = keyCodeSet.current[key];
      machine?.setKeyStatus(keyCode, isDown);
      keyStatusSet?.(keyCode, isDown);
    }
  }, [claimsKey, controllerRef, keyStatusSet]);

  /**
   * Lets go of every key this hook pressed into the matrix.
   *
   * Called on every edge where key-ups stop arriving: Command released (see `isMetaKey`), the
   * window losing focus, a dialog opening and the machine leaving `Running` - in each of those a
   * key-up is never seen here, and the key would stay down in the matrix.
   */
  const releaseAll = useCallback((): void => {
    const codes = Object.keys(pressedKeys.current);
    if (codes.length === 0) return;
    pressedKeys.current = {};
    const mapping = currentKeyMappings.current;
    if (!keyCodeSet.current) return;
    for (const code of codes) {
      handleMappedKey(code, mapping, false);
    }
  }, [handleMappedKey]);

  const handleKey = useCallback((
    e: KeyboardEvent,
    mapping: KeyMapping,
    isDown: boolean
  ): void => {
    if (
      !e ||
      controllerRef.current?.state !== MachineControllerState.Running ||
      modalOpen.current
    )
      return;
    if (isMetaKey(e.code)) {
      if (!isDown) releaseAll();
      return;
    }
    // --- Cmd+<key> is a host shortcut, and its key-up never arrives on macOS (see `isMetaKey`).
    if (isDown && e.metaKey) return;
    if ((e.code === "ShiftLeft" || e.code === "ShiftRight") && e.shiftKey === false && !isDown) {
      handleMappedKey("ShiftLeft", mapping, false);
      handleMappedKey("ShiftRight", mapping, false);
    } else {
      handleMappedKey(e.code, mapping, isDown);
    }
    if (isDown) {
      pressedKeys.current[e.code.toString()] = true;
    } else {
      delete pressedKeys.current[e.code.toString()];
    }
  }, [controllerRef, handleMappedKey, releaseAll]);

  const _handleKeyDown = useCallback((e: KeyboardEvent) => {
    handleKey(e, currentKeyMappings.current, true);
  }, [handleKey]);

  const _handleKeyUp = useCallback((e: KeyboardEvent) => {
    handleKey(e, currentKeyMappings.current, false);
  }, [handleKey]);

  useEffect(() => {
    window.addEventListener("keydown", _handleKeyDown);
    window.addEventListener("keyup", _handleKeyUp);
    window.addEventListener("blur", releaseAll);
    return () => {
      window.removeEventListener("keydown", _handleKeyDown);
      window.removeEventListener("keyup", _handleKeyUp);
      window.removeEventListener("blur", releaseAll);
      releaseAll();
    };
  }, [_handleKeyDown, _handleKeyUp, releaseAll]);

  // --- Key-ups are ignored behind a dialog and while the machine is not running, so let go first.
  useEffect(() => {
    if (dimMenu || machineState !== MachineControllerState.Running) releaseAll();
  }, [dimMenu, machineState, releaseAll]);

  return { setKeyData };
}
