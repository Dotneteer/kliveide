import type { ReactNode } from "react";
import { closePanelInstanceAction } from "../../../common/state/actions";
import type { PanelPlacement } from "../../../common/state/ide-panel-layout-state";
import { dispatchSharedAction } from "../../shared-store";
import { writePanelDragPayload } from "./panelDragDrop";

type Props = {
  instanceId: string;
  placement?: PanelPlacement;
  groupId?: string;
  closeable?: boolean;
  children?: ReactNode;
};

export function PanelDragSourceReact({
  instanceId,
  placement,
  groupId,
  closeable = false,
  children
}: Props) {
  return (
    <div
      draggable
      style={{ position: "relative", width: "100%", height: "100%", minWidth: 0, minHeight: 0 }}
      onDragStart={(event) => {
        writePanelDragPayload(event, {
          type: "klive/panel-instance",
          instanceId,
          sourcePlacement: placement,
          sourceGroupId: groupId
        });
      }}
    >
      {closeable && (
        <button
          aria-label="Close panel"
          type="button"
          draggable={false}
          style={{
            position: "absolute",
            top: 4,
            right: 4,
            zIndex: 2,
            width: 22,
            height: 22,
            border: 0,
            borderRadius: 3,
            background: "transparent",
            color: "var(--xmlui-textColor-EditorSubtle, currentColor)",
            cursor: "pointer",
            fontSize: 16,
            lineHeight: "20px"
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            dispatchSharedAction(closePanelInstanceAction(instanceId));
          }}
          onDragStart={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          x
        </button>
      )}
      {children}
    </div>
  );
}
