import type { ReactNode } from "react";
import { movePanelInstanceAction } from "../../../common/state/actions";
import type { PanelPlacement } from "../../../common/state/ide-panel-layout-state";
import { dispatchSharedAction } from "../../shared-store";
import {
  clearPanelDragPayload,
  hasPanelDragPayload,
  readPanelDragPayload
} from "./panelDragDrop";

type Props = {
  placement: PanelPlacement;
  activity?: string;
  groupId?: string;
  children?: ReactNode;
};

export function PanelDropTargetReact({ placement, activity, groupId, children }: Props) {
  return (
    <div
      style={{ width: "100%", height: "100%", minWidth: 0, minHeight: 0 }}
      onDragOver={(event) => {
        if (!hasPanelDragPayload(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={(event) => {
        const payload = readPanelDragPayload(event);
        if (!payload) return;
        event.preventDefault();
        dispatchSharedAction(
          movePanelInstanceAction(payload.instanceId, placement, activity, groupId)
        );
        clearPanelDragPayload();
      }}
    >
      {children}
    </div>
  );
}
