import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./SideBarPanels.module.scss";
import {
  SideBarPanelStackContext,
  type SideBarPanelRegistration
} from "./SideBarPanelStackContext";

type Props = {
  minPanelSize?: number;
  children?: ReactNode;
};

type DragState = {
  panelId: string;
  nextPanelId: string;
  startY: number;
  panelHeight: number;
  nextPanelHeight: number;
};

const rememberedPanelSizes: Record<string, number> = {};

export function SideBarPanelStackReact({ minPanelSize = 120, children }: Props) {
  const registrations = useRef<SideBarPanelRegistration[]>([]);
  const dragState = useRef<DragState | null>(null);
  const [sizes, setSizes] = useState<Record<string, number>>({});
  const [revision, setRevision] = useState(0);
  const [draggingPanelId, setDraggingPanelId] = useState<string | null>(null);

  useEffect(() => {
    const move = (event: MouseEvent) => moveResize(event.clientY);
    const end = () => endResize();
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", end);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", end);
      document.body.style.cursor = "";
    };
  }, [minPanelSize]);

  const registerPanel = useCallback((registration: SideBarPanelRegistration) => {
    const index = registrations.current.findIndex((item) => item.panelId === registration.panelId);
    if (index >= 0) {
      registrations.current[index] = registration;
    } else {
      registrations.current.push(registration);
    }
    setSizes((current) =>
      current[registration.panelId] === undefined
        ? {
            ...current,
            [registration.panelId]: rememberedPanelSizes[registration.panelId] ?? registration.initialSize
          }
        : current
    );
    setRevision((current) => current + 1);
  }, []);

  const unregisterPanel = useCallback((panelId: string) => {
    registrations.current = registrations.current.filter((item) => item.panelId !== panelId);
    setRevision((current) => current + 1);
  }, []);

  const getPanelSize = useCallback(
    (panelId: string, initialSize: number) => sizes[panelId] ?? initialSize,
    [sizes]
  );

  const isPanelSizeable = useCallback(
    (panelId: string) => {
      const panels = registrations.current;
      const index = panels.findIndex((item) => item.panelId === panelId);
      return !!panels[index]?.expanded && !!panels[index + 1]?.expanded;
    },
    [revision]
  );

  const startResize = useCallback(
    (panelId: string, clientY: number) => {
      const panels = registrations.current;
      const index = panels.findIndex((item) => item.panelId === panelId);
      const panel = panels[index];
      const nextPanel = panels[index + 1];
      if (!panel?.expanded || !nextPanel?.expanded) return;

      const panelHeight = panel.elementRef.current?.offsetHeight ?? 0;
      const nextPanelHeight = nextPanel.elementRef.current?.offsetHeight ?? 0;
      if (!panelHeight || !nextPanelHeight) return;

      dragState.current = {
        panelId: panel.panelId,
        nextPanelId: nextPanel.panelId,
        startY: clientY,
        panelHeight,
        nextPanelHeight
      };
      setDraggingPanelId(panel.panelId);
      document.body.style.cursor = "row-resize";
    },
    []
  );

  const contextValue = useMemo(
    () => ({
      draggingPanelId,
      minPanelSize,
      getPanelSize,
      isPanelSizeable,
      registerPanel,
      startResize,
      unregisterPanel
    }),
    [
      draggingPanelId,
      minPanelSize,
      getPanelSize,
      isPanelSizeable,
      registerPanel,
      startResize,
      unregisterPanel
    ]
  );

  return (
    <SideBarPanelStackContext.Provider value={contextValue}>
      <div className={styles.stack}>{children}</div>
    </SideBarPanelStackContext.Provider>
  );

  function moveResize(clientY: number): void {
    const drag = dragState.current;
    if (!drag) return;

    const total = drag.panelHeight + drag.nextPanelHeight;
    const delta = clientY - drag.startY;
    let panelHeight = drag.panelHeight + delta;
    let nextPanelHeight = total - panelHeight;

    if (panelHeight < minPanelSize) {
      panelHeight = minPanelSize;
      nextPanelHeight = total - minPanelSize;
    }
    if (nextPanelHeight < minPanelSize) {
      nextPanelHeight = minPanelSize;
      panelHeight = total - minPanelSize;
    }

    rememberedPanelSizes[drag.panelId] = panelHeight;
    rememberedPanelSizes[drag.nextPanelId] = nextPanelHeight;

    setSizes((current) => ({
      ...current,
      [drag.panelId]: panelHeight,
      [drag.nextPanelId]: nextPanelHeight
    }));
  }

  function endResize(): void {
    dragState.current = null;
    setDraggingPanelId(null);
    document.body.style.cursor = "";
  }
}
