import { useCallback, useEffect, useRef } from "react";
import { useDispatchSetGlobalSetting } from "../../shared-store";

type PersistedSettingOnReleaseProps = {
  settingId: string;
  value?: string;
  selector?: string;
};

export function PersistedSettingOnReleaseReact({
  settingId,
  value,
  selector = "div[class*='_splitter_']"
}: PersistedSettingOnReleaseProps) {
  const dispatchSetGlobalSetting = useDispatchSetGlobalSetting();
  const lastSavedValueRef = useRef<string | undefined>(value);
  const pendingValueRef = useRef<string | undefined>(value);

  useEffect(() => {
    pendingValueRef.current = value;
    console.log("[splitter-persist] value", { settingId, value });
  }, [value]);

  const readMeasuredValue = useCallback(() => {
    const splitter = document.querySelector<HTMLElement>(selector);
    const primaryPanel = splitter?.firstElementChild as HTMLElement | null;
    if (!splitter || !primaryPanel) {
      console.log("[splitter-persist] measure-miss", { settingId, selector });
      return undefined;
    }

    const splitterRect = splitter.getBoundingClientRect();
    const primaryRect = primaryPanel.getBoundingClientRect();
    const measuredValue = `${Math.round(primaryRect.height)}px`;
    console.log("[splitter-persist] measure", {
      settingId,
      selector,
      splitterHeight: Math.round(splitterRect.height),
      primaryHeight: Math.round(primaryRect.height),
      measuredValue
    });
    return measuredValue;
  }, [selector, settingId]);

  const flushNow = useCallback(() => {
    const pendingValue = readMeasuredValue() ?? pendingValueRef.current;
    if (pendingValue === undefined || pendingValue === lastSavedValueRef.current) {
      console.log("[splitter-persist] skip", {
        settingId,
        pendingValue,
        lastSavedValue: lastSavedValueRef.current
      });
      return;
    }

    lastSavedValueRef.current = pendingValue;
    console.log("[splitter-persist] dispatch", { settingId, pendingValue });
    dispatchSetGlobalSetting(settingId, pendingValue);
  }, [dispatchSetGlobalSetting, readMeasuredValue, settingId]);

  const flush = useCallback(() => {
    console.log("[splitter-persist] release");
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
  }, [flush]);

  return null;
}
