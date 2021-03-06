import * as React from "react";
import { CSSProperties, useState } from "react";
import { themeService } from "../../../renderer/themes/theme-service";
import { SvgIcon } from "../../common/SvgIcon";
import CommandIconButton from "../command/CommandIconButton";
import { documentService, IDocumentPanel } from "./DocumentService";
import { contextMenuService} from "../command/ContextMenuService";
import { MenuItem } from "../../../shared/command/commands";

interface Props {
  title: string;
  active: boolean;
  index: number;
  isLast: boolean;
  document: IDocumentPanel;
  clicked?: () => void;
  closed?: () => void;
}

/**
 * Represents the statusbar of the emulator
 */
export default function DocumentTab({
  title,
  active,
  index,
  isLast,
  document,
  clicked,
  closed,
}: Props) {
  const [pointed, setPointed] = useState(false);
  const hostElement = React.createRef<HTMLDivElement>();

  const normalColor = themeService.getProperty("--document-tab-color");
  const activeColor = themeService.getProperty("--document-tab-active-color");

  const style: CSSProperties = {
    display: "flex",
    flexDirection: "row",
    flexGrow: 0,
    flexShrink: 0,
    height: "100%",
    background: active
      ? "var(--document-tab-active-background-color)"
      : "var(--document-tab-background-color)",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: "10px",
    paddingRight: "10px",
    cursor: "pointer",
    borderRight: "1px solid var(--document-tab-active-background-color)",
    fontSize: "0.9em",
    color: active
      ? "var(--document-tab-active-color)"
      : "var(--document-tab-color)",
  };

  // --- Create menu items
  const menuItems: MenuItem[] = [
    {
      id: "close",
      text: "Close",
      execute: () => {
        documentService.unregisterDocument(document);
      },
    },
    {
      id: "closeAll",
      text: "CloseAll",
      execute: () => {
        documentService.closeAll();
      },
    },
    {
      id: "closeOthers",
      text: "Close Others",
      execute: () => {
        documentService.closeOthers(document);
      },
    },
    {
      id: "closeToTheRight",
      text: "Close to the Right",
      enabled: !isLast,
      execute: () => {
        documentService.closeToTheRight(document);
      },
    },
    "separator",
    {
      id: "moveLeft",
      text: "Move Panel Left",
      enabled: index > 0,
      execute: () => {
        documentService.moveLeft(document);
      },
    },
    {
      id: "moveRight",
      text: "Move Panel Right",
      enabled: !isLast,
      execute: () => {
        documentService.moveRight(document);
      },
    },
  ];

  return (
    <div
      ref={hostElement}
      style={style}
      onMouseDown={async (e: React.MouseEvent) => {
        if (e.button === 0) {
          clicked?.();
        } else if (e.button === 2) {
          await contextMenuService.openMenu(
            menuItems,
            e.clientY,
            e.clientX,
            hostElement.current
          );
        }
      }}
      onMouseEnter={() => setPointed(true)}
      onMouseLeave={() => setPointed(false)}
    >
      <SvgIcon iconName="file-code" width={16} height={16} />
      <span style={{ marginLeft: 6, marginRight: 6 }}>{title}</span>
      <CommandIconButton
        iconName="close"
        title="Close"
        size={16}
        fill={
          pointed
            ? active
              ? activeColor
              : normalColor
            : active
            ? activeColor
            : "transparent"
        }
        clicked={() => closed?.()}
      />
    </div>
  );
}
