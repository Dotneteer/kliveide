import { useMemo, useState, type DragEvent } from "react";
import {
  copyPanelInstanceToDocumentGroupAction,
  movePanelInstanceAction,
  movePanelInstanceToEditorEdgeAction,
  setActiveDocumentPanelInstanceAction
} from "../../../common/state/actions";
import { getIdePanelContribution } from "../../../common/state/ide-panel-contributions";
import type { PanelInstance } from "../../../common/state/ide-panel-layout-state";
import { dispatchSharedAction, useSharedState } from "../../shared-store";
import {
  clearPanelDragPayload,
  hasPanelDragPayload,
  readPanelDragPayload,
  writePanelDragPayload
} from "../PanelDragDrop/panelDragDrop";
import styles from "./EditorPanelTabStrip.module.scss";

type Props = {
  groupId: string;
};

type DropPreview =
  | { kind: "tab"; index: number; x: number }
  | { kind: "edge"; direction: "left" | "right" | "up" | "down" };

export function EditorPanelTabStripReact({ groupId }: Props) {
  const state = useSharedState();
  const [draggingInstanceId, setDraggingInstanceId] = useState<string | null>(null);
  const [dropPreview, setDropPreview] = useState<DropPreview | null>(null);
  const layout = state.idePanelLayout;
  const group = layout?.documentGroups[groupId];
  const activeInstanceId = group?.activeInstanceId;
  const tabs = useMemo(() => {
    if (!layout || !group) {
      return [];
    }
    return group.instanceIds
      .map((instanceId) => layout.instances[instanceId])
      .filter((instance): instance is PanelInstance => !!instance && instance.placement === "document");
  }, [group, layout]);

  if (!group || tabs.length === 0) {
    return null;
  }

  return (
    <div
      className={styles.strip}
      onDragOver={(event) => {
        if (!hasPanelDragPayload(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = event.altKey ? "copy" : "move";
        setDropPreview(getDropPreview(event));
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
          return;
        }
        setDropPreview(null);
      }}
      onDrop={(event) => {
        const payload = readPanelDragPayload(event);
        if (!payload) return;
        event.preventDefault();
        const preview = getDropPreview(event);
        setDropPreview(null);
        if (preview.kind === "edge") {
          dispatchSharedAction(
            movePanelInstanceToEditorEdgeAction(payload.instanceId, groupId, preview.direction)
          );
        } else if (event.altKey) {
          dispatchSharedAction(
            copyPanelInstanceToDocumentGroupAction(payload.instanceId, groupId, preview.index)
          );
        } else {
          dispatchSharedAction(
            movePanelInstanceAction(payload.instanceId, "document", undefined, groupId, preview.index)
          );
        }
        clearPanelDragPayload();
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.instanceId}
          type="button"
          draggable
          className={[
            styles.tab,
            activeInstanceId === tab.instanceId ? styles.tabActive : "",
            draggingInstanceId === tab.instanceId ? styles.tabDragging : ""
          ].join(" ")}
          onClick={() => {
            dispatchSharedAction(setActiveDocumentPanelInstanceAction(groupId, tab.instanceId));
          }}
          onDragStart={(event) => {
            setDraggingInstanceId(tab.instanceId);
            writePanelDragPayload(event, {
              type: "klive/panel-instance",
              instanceId: tab.instanceId,
              sourcePlacement: "document",
              sourceGroupId: groupId
            });
          }}
          onDragEnd={() => {
            setDraggingInstanceId(null);
            setDropPreview(null);
            clearPanelDragPayload();
          }}
        >
          <span className={styles.label}>{getTabTitle(tab)}</span>
        </button>
      ))}
      {dropPreview?.kind === "tab" && (
        <span className={styles.dropIndicator} style={{ left: `${dropPreview.x}px` }} />
      )}
      {dropPreview?.kind === "edge" && (
        <span className={`${styles.edgeIndicator} ${edgeClassName(dropPreview.direction)}`} />
      )}
    </div>
  );

  function getDropPreview(event: DragEvent<HTMLDivElement>): DropPreview {
    const rect = event.currentTarget.getBoundingClientRect();
    const edgeSize = Math.max(24, Math.min(rect.width, rect.height) * 0.12);
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (x <= edgeSize) return { kind: "edge", direction: "left" };
    if (x >= rect.width - edgeSize) return { kind: "edge", direction: "right" };
    if (y <= edgeSize) return { kind: "edge", direction: "up" };
    if (y >= rect.height - edgeSize) return { kind: "edge", direction: "down" };

    const buttons = Array.from(event.currentTarget.querySelectorAll("button"));
    const targetIndex = buttons.findIndex((button) => {
      const buttonRect = button.getBoundingClientRect();
      return event.clientX < buttonRect.left + buttonRect.width / 2;
    });
    const index = targetIndex < 0 ? tabs.length : targetIndex;
    const indicatorX =
      index >= tabs.length
        ? (buttons.at(-1)?.getBoundingClientRect().right ?? rect.left) - rect.left
        : buttons[index].getBoundingClientRect().left - rect.left;
    return { kind: "tab", index, x: indicatorX };
  }
}

function getTabTitle(instance: PanelInstance): string {
  return getIdePanelContribution(instance.contributionId)?.title ?? instance.contributionId;
}

function edgeClassName(direction: "left" | "right" | "up" | "down"): string {
  return direction === "left"
    ? styles.edgeLeft
    : direction === "right"
      ? styles.edgeRight
      : direction === "up"
        ? styles.edgeTop
        : styles.edgeBottom;
}
