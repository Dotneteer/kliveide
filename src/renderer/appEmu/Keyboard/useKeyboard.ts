import { useEffect, useMemo, useRef, useState } from "react";
import { KeyboardApi } from "./KeyboardPanel";
import { KeyPressMapper } from "./KeyPressMapper";

/**
 * Shared boilerplate for all keyboard components:
 * - `mounted` guard so `apiLoaded` fires exactly once
 * - `keystatus` ref for tracking pressed keys
 * - `version` state to trigger re-renders on key events
 * - `api` object passed to the caller via `apiLoaded`
 * - `isPressed` helper delegating to `keystatus`
 */
export function useKeyboard(apiLoaded?: (api: KeyboardApi) => void) {
  const mounted = useRef(false);
  const keystatus = useRef(new KeyPressMapper());
  const [version, setVersion] = useState(1);

  const api = useMemo<KeyboardApi>(
    () => ({
      signKeyStatus: (code, down) => {
        keystatus.current.setKeyStatus(code, down);
        setVersion(v => v + 1);
      }
    }),
    []
  );

  const isPressed = (code: number, secondary?: number, ternary?: number) =>
    keystatus.current.isPressed(code, secondary, ternary);

  useEffect(() => {
    if (mounted.current) return null;
    mounted.current = true;
    apiLoaded?.(api);

    return () => {
      mounted.current = false;
    };
  });

  return { keystatus, version, api, isPressed };
}
