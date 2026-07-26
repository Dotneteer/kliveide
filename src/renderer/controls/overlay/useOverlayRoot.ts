import { useEffect, useState } from "react";
import { useOverlayContext } from "./OverlayProvider";

export function getOverlayRoot(): HTMLElement {
  return (
    document.getElementById("overlayRoot") ??
    document.getElementById("themeRoot") ??
    document.body
  );
}

export function useOverlayRoot(): HTMLElement | null {
  const context = useOverlayContext();
  const [fallbackRoot, setFallbackRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!context?.root) {
      setFallbackRoot(getOverlayRoot());
    }
  }, [context?.root]);

  return context?.root ?? fallbackRoot;
}
