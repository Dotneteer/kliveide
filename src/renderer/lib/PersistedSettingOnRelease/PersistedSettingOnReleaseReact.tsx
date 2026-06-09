import { useCallback, useEffect, useRef } from "react";
import { useDispatchSetGlobalSetting } from "../../shared-store";

type PersistedSettingOnReleaseProps = {
  settingId: string;
  value?: string;
};

export function PersistedSettingOnReleaseReact({
  settingId,
  value
}: PersistedSettingOnReleaseProps) {
  const dispatchSetGlobalSetting = useDispatchSetGlobalSetting();
  const lastSavedValueRef = useRef<string | undefined>(value);
  const pendingValueRef = useRef<string | undefined>(value);

  useEffect(() => {
    pendingValueRef.current = value;
  }, [value]);

  const flushNow = useCallback(() => {
    const pendingValue = pendingValueRef.current;
    if (pendingValue === undefined || pendingValue === lastSavedValueRef.current) {
      return;
    }

    lastSavedValueRef.current = pendingValue;
    dispatchSetGlobalSetting(settingId, pendingValue);
  }, [dispatchSetGlobalSetting, settingId]);

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
