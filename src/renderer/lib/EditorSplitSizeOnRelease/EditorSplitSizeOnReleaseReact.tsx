import { useCallback, useEffect, useRef } from "react";
import { useDispatch } from "../../shared-store";

type EditorSplitSizeOnReleaseProps = {
  path?: string;
  value?: number;
};

export function EditorSplitSizeOnReleaseReact({
  path = "",
  value
}: EditorSplitSizeOnReleaseProps) {
  const dispatch = useDispatch();
  const lastSavedValueRef = useRef<number | undefined>(value);
  const pendingValueRef = useRef<number | undefined>(value);

  useEffect(() => {
    pendingValueRef.current = value;
  }, [value]);

  const flushNow = useCallback(() => {
    const pendingValue = pendingValueRef.current;
    if (
      pendingValue === undefined ||
      !Number.isFinite(pendingValue) ||
      pendingValue === lastSavedValueRef.current
    ) {
      return;
    }

    const roundedValue = Math.round(pendingValue);
    lastSavedValueRef.current = roundedValue;
    dispatch({
      type: "SET_EDITOR_SPLIT_SIZE",
      payload: { value: { path, size: roundedValue } }
    });
  }, [dispatch, path]);

  const flush = useCallback(() => {
    window.setTimeout(flushNow, 0);
  }, [flushNow]);

  useEffect(() => {
    window.addEventListener("pointerup", flush);
    window.addEventListener("mouseup", flush);
    window.addEventListener("touchend", flush);
    window.addEventListener("blur", flush);

    return () => {
      flushNow();
      window.removeEventListener("pointerup", flush);
      window.removeEventListener("mouseup", flush);
      window.removeEventListener("touchend", flush);
      window.removeEventListener("blur", flush);
    };
  }, [flush, flushNow]);

  return null;
}
