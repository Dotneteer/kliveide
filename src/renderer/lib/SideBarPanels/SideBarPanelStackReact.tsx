import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { movePanelInstanceAction, setPanelSizeAction } from "../../../common/state/actions";
import type { PanelPlacement } from "../../../common/state/ide-panel-layout-state";
import { hasPanelDragPayload, readPanelDragPayload } from "../PanelDragDrop/panelDragDrop";
import { dispatchSharedAction } from "../../shared-store";
import styles from "./SideBarPanels.module.scss";
import {
  SideBarPanelStackContext,
  type SideBarPanelRegistration
} from "./SideBarPanelStackContext";

type Props = {
  minPanelSize?: number;
  placement?: PanelPlacement;
  activity?: string;
  children?: ReactNode;
};

type DragState = {
  panelId: string;
  nextPanelId: string;
  startY: number;
  panelHeight: number;
  nextPanelHeight: number;
  panelSize: number;
  nextPanelSize: number;
};

const rememberedPanelSizes: Record<string, number> = {};

export function SideBarPanelStackReact({
  minPanelSize = 120,
  placement,
  activity,
  children
}: Props) {
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
        nextPanelHeight,
        panelSize: sizes[panel.panelId] ?? panel.initialSize,
        nextPanelSize: sizes[nextPanel.panelId] ?? nextPanel.initialSize
      };
      setDraggingPanelId(panel.panelId);
      document.body.style.cursor = "row-resize";
    },
    [sizes]
  );

  const movePanelToIndex = useCallback(
    (panelId: string, targetPanelId: string) => {
      if (!placement || panelId === targetPanelId) return;
      const orderIndex = registrations.current.findIndex((item) => item.panelId === targetPanelId);
      dispatchSharedAction(
        movePanelInstanceAction(
          panelId,
          placement,
          activity,
          undefined,
          orderIndex < 0 ? undefined : orderIndex
        )
      );
    },
    [activity, placement]
  );

  const contextValue = useMemo(
    () => ({
      draggingPanelId,
      isResizing: draggingPanelId !== null,
      minPanelSize,
      getPanelSize,
      isPanelSizeable,
      movePanelToIndex,
      registerPanel,
      startResize,
      unregisterPanel
    }),
    [
      draggingPanelId,
      minPanelSize,
      getPanelSize,
      isPanelSizeable,
      movePanelToIndex,
      registerPanel,
      startResize,
      unregisterPanel
    ]
  );

  return (
    <SideBarPanelStackContext.Provider value={contextValue}>
      <div
        className={styles.stack}
        onDragOver={(event) => {
          if (!placement || !hasPanelDragPayload(event)) return;
          event.preventDefault();
        }}
        onDrop={(event) => {
          if (!placement) return;
          const payload = readPanelDragPayload(event);
          if (!payload) return;
          event.preventDefault();
          dispatchSharedAction(movePanelInstanceAction(payload.instanceId, placement, activity));
        }}
      >
        {children}
      </div>
    </SideBarPanelStackContext.Provider>
  );

  function moveResize(clientY: number): void {
    const drag = dragState.current;
    if (!drag) return;

    const pixelTotal = drag.panelHeight + drag.nextPanelHeight;
    const sizeTotal = drag.panelSize + drag.nextPanelSize;
    if (!pixelTotal || !sizeTotal) return;

    const delta = clientY - drag.startY;
    const sizeDelta = (delta * sizeTotal) / pixelTotal;
    let panelSize = drag.panelSize + sizeDelta;
    let nextPanelSize = sizeTotal - panelSize;
    const minSize = (minPanelSize * sizeTotal) / pixelTotal;

    if (panelSize < minSize) {
      panelSize = minSize;
      nextPanelSize = sizeTotal - minSize;
    }
    if (nextPanelSize < minSize) {
      nextPanelSize = minSize;
      panelSize = sizeTotal - minSize;
    }

    rememberedPanelSizes[drag.panelId] = panelSize;
    rememberedPanelSizes[drag.nextPanelId] = nextPanelSize;

    setSizes((current) => ({
      ...current,
      [drag.panelId]: panelSize,
      [drag.nextPanelId]: nextPanelSize
    }));
  }

  function endResize(): void {
    const drag = dragState.current;
    if (drag) {
      dispatchSharedAction(
        setPanelSizeAction(drag.panelId, rememberedPanelSizes[drag.panelId] ?? drag.panelSize)
      );
      dispatchSharedAction(
        setPanelSizeAction(
          drag.nextPanelId,
          rememberedPanelSizes[drag.nextPanelId] ?? drag.nextPanelSize
        )
      );
    }
    dragState.current = null;
    setDraggingPanelId(null);
    document.body.style.cursor = "";
  }
}
