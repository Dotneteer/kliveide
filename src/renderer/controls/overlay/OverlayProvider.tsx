import { createContext, ReactNode, useContext, useMemo, useState } from "react";

type OverlayContextValue = {
  root: HTMLElement | null;
};

const OverlayContext = createContext<OverlayContextValue | undefined>(undefined);

type OverlayProviderProps = {
  children?: ReactNode;
};

export function OverlayProvider({ children }: OverlayProviderProps) {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const value = useMemo<OverlayContextValue>(() => ({ root }), [root]);

  return (
    <OverlayContext.Provider value={value}>
      {children}
      <div id="overlayRoot" ref={setRoot} />
    </OverlayContext.Provider>
  );
}

export function useOverlayContext(): OverlayContextValue | undefined {
  return useContext(OverlayContext);
}
