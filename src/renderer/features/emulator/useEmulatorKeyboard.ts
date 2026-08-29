import type { KeyMapping } from "@abstractions/KeyMapping";
import type { KeyCodeSet } from "@emu/abstractions/IGenericKeyboardDevice";

import { MutableRefObject, useCallback, useEffect, useRef } from "react";
import { IMachineController } from "../../abstractions/IMachineController";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { useSelector } from "@renderer/core/RendererProvider";

export function useEmulatorKeyboard(
  controllerRef: MutableRefObject<IMachineController>,
  keyStatusSet?: (code: number, down: boolean) => void
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
    const mapping = keyMapping?.[code];
    if (!mapping) return;
    const machine = controllerRef.current?.machine;
    if (typeof mapping === "string") {
      machine?.setKeyStatus(keyCodeSet.current[mapping], isDown);
      keyStatusSet?.(keyCodeSet.current[mapping], isDown);
    } else {
      if (mapping.length > 0) {
        machine?.setKeyStatus(keyCodeSet.current[mapping[0]], isDown);
        keyStatusSet?.(keyCodeSet.current[mapping[0]], isDown);
      }
      if (mapping.length > 1) {
        machine?.setKeyStatus(keyCodeSet.current[mapping[1]], isDown);
        keyStatusSet?.(keyCodeSet.current[mapping[1]], isDown);
      }
      if (mapping.length > 2) {
        machine?.setKeyStatus(keyCodeSet.current[mapping[2]], isDown);
        keyStatusSet?.(keyCodeSet.current[mapping[2]], isDown);
      }
    }
  }, [controllerRef, keyStatusSet]);

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
