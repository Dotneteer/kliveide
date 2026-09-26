import type { KeyMapping } from "@abstractions/KeyMapping";
import type { KeyCodeSet } from "@emu/abstractions/IGenericKeyboardDevice";

import { MutableRefObject, useCallback, useEffect, useRef } from "react";
import { IMachineController } from "../../abstractions/IMachineController";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { useSelector } from "@renderer/core/RendererProvider";

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
  }, [controllerRef, handleMappedKey]);

  const _handleKeyDown = useCallback((e: KeyboardEvent) => {
    handleKey(e, currentKeyMappings.current, true);
  }, [handleKey]);

  const _handleKeyUp = useCallback((e: KeyboardEvent) => {
    handleKey(e, currentKeyMappings.current, false);
  }, [handleKey]);

  useEffect(() => {
    window.addEventListener("keydown", _handleKeyDown);
    window.addEventListener("keyup", _handleKeyUp);
    return () => {
      window.removeEventListener("keydown", _handleKeyDown);
      window.removeEventListener("keyup", _handleKeyUp);
    };
  }, [_handleKeyDown, _handleKeyUp]);

  return { setKeyData };
}
