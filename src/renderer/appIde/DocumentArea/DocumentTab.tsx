import { Icon } from "../../controls/Icon";
import { TabButton } from "@controls/TabButton";
import { useLayoutEffect, useRef, useState } from "react";
import { TooltipFactory } from "@controls/Tooltip";

import styles from "./DocumentTab.module.scss";
import classnames from "@renderer/utils/classnames";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
  useContextMenuState
} from "@renderer/controls/ContextMenu";
import { useRendererContext } from "@renderer/core/RendererProvider";
import { useMainApi } from "@renderer/core/MainApi";

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
  isTemporary?: boolean;
  awaiting?: boolean;
  hasChanges?: boolean;
  tabsCount?: number;
  tabDisplayed?: (el: HTMLDivElement) => void;
  tabClicked?: () => void;
  tabDoubleClicked?: () => void;
  tabCloseClicked?: (mode: CloseMode) => void;
};

/**
 * Represents a single tab in the documents' header
 */
export const DocumentTab = ({
  name,
  isTemporary,
  isReadOnly = false,
  path,
  iconName = "file-code",
  iconFill = "--color-doc-icon",
  isActive = false,
  awaiting = false,
  hasChanges = false,
  tabsCount,
  tabDisplayed,
  tabClicked,
  tabDoubleClicked,
  tabCloseClicked
}: Props) => {
  // --- Services used in this component
  const { store } = useRendererContext();
  const mainApi = useMainApi();

  const ref = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLSpanElement>(null);
  const readOnlyRef = useRef<HTMLDivElement>(null);
  const isWindows = !!store.getState().isWindows;
  const [pointed, setPointed] = useState(false);

  // --- Whenever the tab is displayed or its position has changed, report it to the
  // --- parent (DocumentsHeader) so that the entire tab viewport could be displayed
  useLayoutEffect(() => {
    if (ref.current) {
      tabDisplayed?.(ref.current);
    }
  }, [ref.current, ref.current?.offsetLeft]);

  const [contextMenuState, contextMenuApi] = useContextMenuState();
  const contextMenu = (
    <ContextMenu state={contextMenuState} onClickAway={contextMenuApi.conceal}>
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

  return (
    <div
      ref={ref}
      className={classnames(styles.documentTab, {
        [styles.active]: isActive,
        [styles.awaiting]: awaiting
      })}
      onMouseEnter={() => setPointed(true)}
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
          <TooltipFactory refElement={nameRef.current} placement="right" offsetX={-28} offsetY={28}>
            {path}
          </TooltipFactory>
        )}
      </span>
      {isReadOnly && (
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
          >
            This file is read-only
          </TooltipFactory>
        </div>
      )}

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
