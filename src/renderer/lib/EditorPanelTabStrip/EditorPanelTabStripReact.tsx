import { useEffect, useRef, useState } from "react";
import {
  closeActiveEditorGroupAction,
  joinSplitInGroupAction,
  setActiveEditorGroupAction,
  setEditorGroupLockedAction,
  splitEditorGroupAction,
  toggleMaximizeEditorGroupAction,
  toggleSplitInGroupAction,
  toggleSplitInGroupLayoutAction
} from "../../../common/state/actions";
import type { Action } from "../../../common/state/Action";
import { dispatchSharedAction, useSharedState } from "../../shared-store";
import styles from "./EditorPanelTabStrip.module.scss";

type Props = {
  groupId: string;
  menuRequest?: {
    x?: number;
    y?: number;
    stamp?: number;
  };
};

export function EditorPanelTabStripReact({ groupId, menuRequest }: Props) {
  const state = useSharedState();
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const layout = state.idePanelLayout;
  const group = layout?.documentGroups[groupId];
  const activeInstanceId = group?.activeInstanceId;
  const activeDocumentId = group?.activeDocument?.id ?? activeInstanceId;
  const splitState =
    activeDocumentId && group?.splitInGroupByDocument
      ? group.splitInGroupByDocument[activeDocumentId]
      : undefined;
  const isLocked = group?.locked ?? false;
  const isMaximized = layout?.documentLayout.maximizedGroupId === groupId;

  useEffect(() => {
    if (!menuRequest) {
      return;
    }
    const x = typeof menuRequest.x === "number" ? menuRequest.x : 0;
    const y = typeof menuRequest.y === "number" ? menuRequest.y : 0;
    dispatchSharedAction(setActiveEditorGroupAction(groupId));
    setMenu({ x, y });
  }, [groupId, menuRequest]);

  useEffect(() => {
    if (!menu) {
      return;
    }
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node | null)) {
        setMenu(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenu(null);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menu]);

  if (!group) {
    return null;
  }

  return (
    <>
      {menu && (
        <div
          ref={menuRef}
          className={styles.menu}
          style={{ left: `${menu.x}px`, top: `${menu.y}px` }}
          role="menu"
        >
          <MenuItem
            label={isMaximized ? "Restore Editor Group" : "Maximize Editor Group"}
            onSelect={() => runGroupAction(toggleMaximizeEditorGroupAction())}
          />
          <MenuItem
            label={isLocked ? "Unlock Editor Group" : "Lock Editor Group"}
            onSelect={() => runGroupAction(setEditorGroupLockedAction(groupId, !isLocked))}
          />
          <div className={styles.menuSeparator} />
          <MenuItem
            label={splitState ? "Join Split in Group" : "Split in Group"}
            onSelect={() =>
              runGroupAction(
                splitState ? joinSplitInGroupAction() : toggleSplitInGroupAction("horizontal")
              )
            }
          />
          <MenuItem
            label="Toggle Split in Group Layout"
            disabled={!splitState}
            onSelect={() => runGroupAction(toggleSplitInGroupLayoutAction())}
          />
          <div className={styles.menuSeparator} />
          <MenuItem label="Split Editor Right" onSelect={() => runGroupAction(splitEditorGroupAction("right"))} />
          <MenuItem label="Split Editor Down" onSelect={() => runGroupAction(splitEditorGroupAction("down"))} />
          <MenuItem label="Split Editor Left" onSelect={() => runGroupAction(splitEditorGroupAction("left"))} />
          <MenuItem label="Split Editor Up" onSelect={() => runGroupAction(splitEditorGroupAction("up"))} />
          <div className={styles.menuSeparator} />
          <MenuItem label="Close Placeholder Split" onSelect={() => runGroupAction(closeActiveEditorGroupAction())} />
        </div>
      )}
    </>
  );

  function runGroupAction(action: Action) {
    dispatchSharedAction(setActiveEditorGroupAction(groupId));
    dispatchSharedAction(action);
    setMenu(null);
  }
}

function MenuItem({
  label,
  disabled,
  onSelect
}: {
  label: string;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.menuItem}
      disabled={disabled}
      role="menuitem"
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      {label}
    </button>
  );
}
