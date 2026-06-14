import type { DragEvent } from "react";
import type { PanelPlacement } from "../../../common/state/ide-panel-layout-state";

export const PANEL_DRAG_MIME_TYPE = "application/x-klive-panel-instance";

export type PanelDragPayload = {
  type: "klive/panel-instance";
  instanceId: string;
  sourcePlacement?: PanelPlacement;
  sourceGroupId?: string;
};

export function writePanelDragPayload(
  event: DragEvent,
  payload: PanelDragPayload
): void {
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData(PANEL_DRAG_MIME_TYPE, JSON.stringify(payload));
}

export function hasPanelDragPayload(event: DragEvent): boolean {
  return Array.from(event.dataTransfer.types).includes(PANEL_DRAG_MIME_TYPE);
}

export function readPanelDragPayload(event: DragEvent): PanelDragPayload | undefined {
  const json = event.dataTransfer.getData(PANEL_DRAG_MIME_TYPE);
  if (!json) {
    return undefined;
  }

  try {
    const payload = JSON.parse(json) as PanelDragPayload;
    return payload?.type === "klive/panel-instance" && payload.instanceId ? payload : undefined;
  } catch {
    return undefined;
  }
}
