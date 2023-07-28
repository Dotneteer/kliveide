import { useEffect, useRef } from "react";

export function useInitializeAsync (initializer: () => Promise<void>) {
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    (async () => {
      await initializer();
    })();
  });
}
