import { Icon } from "../../controls/Icon";
import { TabButton } from "@controls/TabButton";
import { type DragEvent, type MouseEvent, useLayoutEffect, useRef, useState } from "react";
import { TooltipFactory, useTooltipRef } from "@controls/Tooltip";

import styles from "./DocumentTab.module.scss";
import classnames from "classnames";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
  useContextMenuState
} from "@renderer/controls/ContextMenu";
import { useRendererContext } from "@renderer/core/RendererProvider";
import { useMainApi } from "@renderer/core/MainApi";
import type { MainApi } from "@common/messaging/MainApi";

// Preserves the hover affordance when tab order or labels change under a stationary pointer.
let lastDocumentTabPointerPosition: { clientX: number; clientY: number } | undefined;

export enum CloseMode {
  All,
  Others,
  This
}

type Props = {
  name: string;
  path?: string;
  iconName?: string;
  iconFill?: string;
  isActive?: boolean;
  isReadOnly?: boolean;
  isLocked?: boolean;
  isTemporary?: boolean;
  awaiting?: boolean;
  hasChanges?: boolean;
  dragOverPlacement?: "before" | "after";
  tabsCount?: number;
  tabDisplayed?: (el: HTMLDivElement) => void;
  tabClicked?: () => void;
  tabDoubleClicked?: () => void;
  tabCloseClicked?: (mode: CloseMode) => void;
  tabDragEnd?: () => void;
  tabDragLeave?: () => void;
  tabDragOver?: (event: DragEvent<HTMLDivElement>) => void;
  tabDragStart?: (event: DragEvent<HTMLDivElement>) => void;
  tabDrop?: (event: DragEvent<HTMLDivElement>) => void;
};

/**
 * Renders a single document tab, including close affordances, status badges,
 * tooltips, context menu actions, and drag/drop event bridges.
 */
export const DocumentTab = ({
  name,
  isTemporary,
  isReadOnly = false,
  isLocked = false,
  path,
  iconName = "file-code",
  iconFill = "--color-doc-icon",
  isActive = false,
  awaiting = false,
  hasChanges = false,
  dragOverPlacement,
  tabsCount,
  tabDisplayed,
  tabClicked,
  tabDoubleClicked,
  tabCloseClicked,
  tabDragEnd,
  tabDragLeave,
  tabDragOver,
  tabDragStart,
  tabDrop
}: Props) => {
  // --- Services used in this component
  const { store } = useRendererContext();
  const mainApi = useMainApi();

  const ref = useRef<HTMLDivElement>(null);
  const nameRef = useTooltipRef();
  const readOnlyRef = useTooltipRef();
  const lockedRef = useTooltipRef();
  const isWindows = !!store.getState().isWindows;
  const [pointed, setPointed] = useState(false);

  // --- Whenever the tab is displayed or its position has changed, report it to the
  // --- parent (DocumentsHeader) so that the entire tab viewport could be displayed
  useLayoutEffect(() => {
    if (ref.current) {
      tabDisplayed?.(ref.current);
    }
  });

  useLayoutEffect(() => {
    const element = ref.current;
    const pointerPosition = lastDocumentTabPointerPosition;
    if (!element || !pointerPosition) return;

    const hoveredElement = document.elementFromPoint(
      pointerPosition.clientX,
      pointerPosition.clientY
    );
    const isPointerOverTab = !!hoveredElement && element.contains(hoveredElement);
    setPointed((current) => current === isPointerOverTab ? current : isPointerOverTab);
  }, [awaiting, isActive, name, path, tabsCount]);

  const rememberPointerPosition = (e: MouseEvent<HTMLDivElement>): void => {
    lastDocumentTabPointerPosition = {
      clientX: e.clientX,
      clientY: e.clientY
    };
  };

  const [contextMenuState, contextMenuApi] = useContextMenuState();
  const contextMenu = renderDocumentTabContextMenu({
    contextMenuApi,
    contextMenuState,
    isWindows,
    mainApi,
    path,
    tabCloseClicked,
    tabsCount
  });

  return (
    <div
      ref={ref}
      className={classnames(styles.documentTab, {
        [styles.active]: isActive,
        [styles.awaiting]: awaiting,
        [styles.dragBefore]: dragOverPlacement === "before",
        [styles.dragAfter]: dragOverPlacement === "after"
      })}
      draggable={!awaiting}
      onDragEnd={tabDragEnd}
      onDragLeave={tabDragLeave}
      onDragOver={tabDragOver}
      onDragStart={tabDragStart}
      onDrop={tabDrop}
      onMouseEnter={(e) => {
        rememberPointerPosition(e);
        setPointed(true);
      }}
      onMouseMove={rememberPointerPosition}
      onMouseDown={rememberPointerPosition}
      onMouseLeave={() => setPointed(false)}
      onClick={(e) => {
        if (e.button === 0) tabClicked?.();
      }}
      onAuxClick={(e) => {
        if (e.button === 1) tabCloseClicked?.(CloseMode.This);
      }}
      onDoubleClick={() => tabDoubleClicked?.()}
      onContextMenu={contextMenuApi.show}
    >
      <Icon iconName={iconName} width={16} height={16} fill={iconFill} />
      <span
        ref={nameRef}
        className={classnames(styles.titleText, {
          [styles.activeTitle]: isActive,
          [styles.temporaryTitle]: isTemporary
        })}
      >
        <bdi>{name}</bdi>
        {path && (
          <TooltipFactory
            refElement={nameRef.current}
            placement="right"
            offsetX={-28}
            offsetY={28}
            content={path}
          />
        )}
      </span>
      {isReadOnly && renderReadOnlyBadge(readOnlyRef, isActive)}
      {isLocked && renderLockedBadge(lockedRef)}

      {contextMenu}

      <TabButton
        iconName={hasChanges ? "circle-filled" : "close"}
        hide={!pointed && !isActive}
        fill={"--color-tabbutton-fill-" + (isActive ? "active" : "inactive")}
        clicked={() => tabCloseClicked?.(CloseMode.This)}
      />
    </div>
  );
};

function renderDocumentTabContextMenu({
  contextMenuApi,
  contextMenuState,
  isWindows,
  mainApi,
  path,
  tabCloseClicked,
  tabsCount
}: {
  contextMenuApi: ReturnType<typeof useContextMenuState>[1];
  contextMenuState: ReturnType<typeof useContextMenuState>[0];
  isWindows: boolean;
  mainApi: MainApi;
  path?: string;
  tabCloseClicked?: (mode: CloseMode) => void;
  tabsCount?: number;
}) {
  return (
    <ContextMenu state={contextMenuState} onClickOutside={contextMenuApi.conceal}>
      <ContextMenuItem
        text="Close"
        clicked={() => {
          contextMenuApi.conceal();
          tabCloseClicked?.(CloseMode.This);
        }}
      />
      <ContextMenuItem
        text="Close Others"
        disabled={tabsCount < 2}
        clicked={() => {
          contextMenuApi.conceal();
          tabCloseClicked?.(CloseMode.Others);
        }}
      />
      <ContextMenuItem
        text="Close All"
        clicked={() => {
          contextMenuApi.conceal();
          tabCloseClicked?.(CloseMode.All);
        }}
      />
      <ContextMenuSeparator />
      <ContextMenuItem
        text={`Reveal in ${isWindows ? "File Explorer" : "Finder"}`}
        clicked={() => {
          contextMenuApi.conceal();
          mainApi.showItemInFolder(path);
        }}
      />
    </ContextMenu>
  );
}

function renderReadOnlyBadge(
  readOnlyRef: ReturnType<typeof useTooltipRef>,
  isActive: boolean
) {
  return (
    <div className={styles.readOnlyIcon} ref={readOnlyRef}>
      <Icon
        iconName="shield"
        width={16}
        height={16}
        fill={"--color-readonly-icon-" + (isActive ? "active" : "inactive")}
      />
      <TooltipFactory
        refElement={readOnlyRef.current}
        placement="right"
        offsetX={-16}
        offsetY={28}
        content="This file is read-only"
      />
    </div>
  );
}

function renderLockedBadge(lockedRef: ReturnType<typeof useTooltipRef>) {
  return (
    <div className={styles.lockedIcon} ref={lockedRef}>
      <Icon iconName="lock" width={16} height={16} fill="--console-ansi-bright-red" />
      <TooltipFactory
        refElement={lockedRef.current}
        placement="right"
        offsetX={-16}
        offsetY={28}
        content="This file is locked while the project is running"
      />
    </div>
  );
}
