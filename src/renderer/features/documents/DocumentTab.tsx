import { Icon } from "../../controls/Icon";
import { TabButton } from "@controls/TabButton";
import { type DragEvent, useLayoutEffect, useRef } from "react";
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

/**
 * Size of every icon on a document tab: the file-type glyph and the read-only
 * and locked badges.
 *
 * 16, not 20. Matching `TabButton`'s close affordance was the old rule, and it
 * sized the strip's icons off another icon rather than off the thing they label:
 * at 20 against `--font-size-300` type, every glyph was drawn half again as
 * large as the filename it belongs to, and a strip of open files read as a row
 * of coloured tiles with captions. 16 puts the glyph just above the cap height
 * of the name beside it, which is the relationship the Explorer tree now uses
 * for exactly the same reason (see NODE_GLYPH_SIZE in ExplorerProjectItem.tsx).
 *
 * The close/dirty affordance stays at TabButton's 20 on purpose: it is a hit
 * target, not a label, and it is the one mark on the tab that has to stay easy
 * to click.
 */
const TAB_ICON_SIZE = 16;

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
  isInActiveArea?: boolean;
  isReadOnly?: boolean;
  isLocked?: boolean;
  isTemporary?: boolean;
  awaiting?: boolean;
  hasChanges?: boolean;
  dragOverPlacement?: "before" | "after";
  tabsCount?: number;
  canMoveLeft?: boolean;
  canMoveRight?: boolean;
  canMoveToNextArea?: boolean;
  canMoveToPreviousArea?: boolean;
  tabDisplayed?: (el: HTMLDivElement) => void;
  tabClicked?: () => void;
  tabDoubleClicked?: () => void;
  tabCloseClicked?: (mode: CloseMode) => void;
  tabMoveLeft?: () => void;
  tabMoveRight?: () => void;
  tabMoveToNextArea?: () => void;
  tabMoveToPreviousArea?: () => void;
  tabSplitRight?: () => void;
  tabSplitDown?: () => void;
  tabDragEnd?: () => void;
  tabDragLeave?: (event: DragEvent<HTMLDivElement>) => void;
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
  isInActiveArea = true,
  awaiting = false,
  hasChanges = false,
  dragOverPlacement,
  tabsCount,
  canMoveLeft = false,
  canMoveRight = false,
  canMoveToNextArea = false,
  canMoveToPreviousArea = false,
  tabDisplayed,
  tabClicked,
  tabDoubleClicked,
  tabCloseClicked,
  tabMoveLeft,
  tabMoveRight,
  tabMoveToNextArea,
  tabMoveToPreviousArea,
  tabSplitRight,
  tabSplitDown,
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
  const readOnlyRef = useTooltipRef<HTMLDivElement>();
  const lockedRef = useTooltipRef<HTMLDivElement>();
  const isWindows = !!store.getState().isWindows;

  // --- Whenever the tab is displayed or its position has changed, report it to the
  // --- parent (DocumentsHeader) so that the entire tab viewport could be displayed
  useLayoutEffect(() => {
    if (ref.current) {
      tabDisplayed?.(ref.current);
    }
  });

  const dismissTooltips = () => {
    [nameRef.current, readOnlyRef.current, lockedRef.current].forEach((element) => {
      element?.dispatchEvent(new MouseEvent("mouseleave"));
    });
  };

  const [contextMenuState, contextMenuApi] = useContextMenuState();
  const contextMenu = renderDocumentTabContextMenu({
    contextMenuApi,
    contextMenuState,
    isWindows,
    mainApi,
    path,
    canMoveLeft,
    canMoveRight,
    canMoveToNextArea,
    canMoveToPreviousArea,
    tabCloseClicked,
    tabMoveLeft,
    tabMoveRight,
    tabMoveToNextArea,
    tabMoveToPreviousArea,
    tabSplitRight,
    tabSplitDown,
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
      onDragStart={(event) => {
        dismissTooltips();
        tabDragStart?.(event);
      }}
      onDrop={tabDrop}
      onClick={(e) => {
        if (e.button === 0) tabClicked?.();
      }}
      onAuxClick={(e) => {
        if (e.button === 1) tabCloseClicked?.(CloseMode.This);
      }}
      onDoubleClick={() => tabDoubleClicked?.()}
      onContextMenu={contextMenuApi.show}
    >
      <span className={styles.tabGlyph}>
        <Icon
          iconName={iconName}
          width={TAB_ICON_SIZE}
          height={TAB_ICON_SIZE}
          fill={iconFill}
        />
      </span>
      <span
        ref={nameRef}
        className={classnames(styles.titleText, {
          [styles.activeTitle]: isActive && isInActiveArea,
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
        // Visibility is CSS (`.documentTab:hover`, `.active`): the browser re-evaluates :hover when
        // tabs reorder or rename under a stationary pointer, which is exactly the case the old
        // elementFromPoint probe existed to paper over.
        xclass={styles.closeButton}
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
  canMoveLeft,
  canMoveRight,
  canMoveToNextArea,
  canMoveToPreviousArea,
  tabCloseClicked,
  tabMoveLeft,
  tabMoveRight,
  tabMoveToNextArea,
  tabMoveToPreviousArea,
  tabSplitRight,
  tabSplitDown,
  tabsCount
}: {
  contextMenuApi: ReturnType<typeof useContextMenuState>[1];
  contextMenuState: ReturnType<typeof useContextMenuState>[0];
  isWindows: boolean;
  mainApi: MainApi;
  path?: string;
  canMoveLeft?: boolean;
  canMoveRight?: boolean;
  canMoveToNextArea?: boolean;
  canMoveToPreviousArea?: boolean;
  tabCloseClicked?: (mode: CloseMode) => void;
  tabMoveLeft?: () => void;
  tabMoveRight?: () => void;
  tabMoveToNextArea?: () => void;
  tabMoveToPreviousArea?: () => void;
  tabSplitRight?: () => void;
  tabSplitDown?: () => void;
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
        text="Move Left"
        disabled={!canMoveLeft}
        clicked={() => {
          contextMenuApi.conceal();
          tabMoveLeft?.();
        }}
      />
      <ContextMenuItem
        text="Move Right"
        disabled={!canMoveRight}
        clicked={() => {
          contextMenuApi.conceal();
          tabMoveRight?.();
        }}
      />
      <ContextMenuSeparator />
      <ContextMenuItem
        text="Move To Previous Editor Area"
        disabled={!canMoveToPreviousArea}
        clicked={() => {
          contextMenuApi.conceal();
          tabMoveToPreviousArea?.();
        }}
      />
      <ContextMenuItem
        text="Move To Next Editor Area"
        disabled={!canMoveToNextArea}
        clicked={() => {
          contextMenuApi.conceal();
          tabMoveToNextArea?.();
        }}
      />
      <ContextMenuSeparator />
      <ContextMenuItem
        text="Split Editor Right"
        disabled={!tabSplitRight}
        clicked={() => {
          contextMenuApi.conceal();
          tabSplitRight?.();
        }}
      />
      <ContextMenuItem
        text="Split Editor Down"
        disabled={!tabSplitDown}
        clicked={() => {
          contextMenuApi.conceal();
          tabSplitDown?.();
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
  readOnlyRef: ReturnType<typeof useTooltipRef<HTMLDivElement>>,
  isActive: boolean
) {
  return (
    <div className={styles.readOnlyIcon} ref={readOnlyRef}>
      <Icon
        iconName="shield"
        width={TAB_ICON_SIZE}
        height={TAB_ICON_SIZE}
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

function renderLockedBadge(lockedRef: ReturnType<typeof useTooltipRef<HTMLDivElement>>) {
  return (
    <div className={styles.lockedIcon} ref={lockedRef}>
      <Icon
        iconName="lock"
        width={TAB_ICON_SIZE}
        height={TAB_ICON_SIZE}
        fill="--console-ansi-bright-red"
      />
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
