import { useEffect, useRef } from "react";
import { useDispatchSetGlobalSetting } from "../../shared-store";

type SplitterSizeGuardProps = {
  settingId: string;
  value?: string;
  minPrimarySize?: string;
  maxPrimarySize?: string;
  fallbackSize?: string;
};

export function SplitterSizeGuardReact({
  settingId,
  value,
  minPrimarySize = "0px",
  maxPrimarySize,
  fallbackSize = "50%"
}: SplitterSizeGuardProps) {
  const markerRef = useRef<HTMLSpanElement | null>(null);
  const dispatchSetGlobalSetting = useDispatchSetGlobalSetting();

  useEffect(() => {
    const marker = markerRef.current;
    const container = marker?.parentElement;
    if (!container || !value) {
      return;
    }

    const validate = () => {
      const containerSize = container.getBoundingClientRect().height;
      if (containerSize <= 0) {
        return;
      }

      const primarySize = resolveCssSize(value, containerSize);
      const minSize = resolveCssSize(minPrimarySize, containerSize) ?? 0;
      const maxSize = maxPrimarySize
        ? resolveCssSize(maxPrimarySize, containerSize)
        : containerSize;
      if (primarySize === undefined || maxSize === undefined) {
        return;
      }

      if ((primarySize < minSize || primarySize > maxSize) && value !== fallbackSize) {
        dispatchSetGlobalSetting(settingId, fallbackSize);
      }
    };

    validate();
    const observer = new ResizeObserver(validate);
    observer.observe(container);
    return () => observer.disconnect();
  }, [dispatchSetGlobalSetting, fallbackSize, maxPrimarySize, minPrimarySize, settingId, value]);

  return (
    <span
      ref={markerRef}
      aria-hidden="true"
      style={{
        display: "none"
      }}
    />
  );
}

function resolveCssSize(value: string | undefined, containerSize: number): number | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed.endsWith("px")) {
    const pixels = Number.parseFloat(trimmed);
    return Number.isFinite(pixels) ? normalizeSignedSize(pixels, containerSize) : undefined;
  }

  if (trimmed.endsWith("%")) {
    const percent = Number.parseFloat(trimmed);
    return Number.isFinite(percent) ? (containerSize * percent) / 100 : undefined;
  }

  const pixels = Number.parseFloat(trimmed);
  return Number.isFinite(pixels) ? normalizeSignedSize(pixels, containerSize) : undefined;
}

function normalizeSignedSize(size: number, containerSize: number): number {
  return size < 0 ? containerSize + size : size;
}
