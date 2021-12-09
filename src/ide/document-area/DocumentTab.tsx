import * as React from "react";
import { CSSProperties, useEffect, useRef, useState } from "react";

import {
  getContextMenuService,
  getDocumentService,
  getThemeService,
} from "@core/service-registry";
import { Icon } from "@components/Icon";
import { IDocumentPanel } from "@abstractions/document-service";
import { MenuItem } from "@abstractions/command-definitions";
import CommandIconButton from "../context-menu/CommandIconButton";

interface Props {
  title: string;
  active: boolean;
  index: number;
  isLast: boolean;
  descriptor: IDocumentPanel;
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
  descriptor,
  clicked,
  closed,
}: Props) {
  const [pointed, setPointed] = useState(false);
  const [temporary, setTemporary] = useState(true);
  const hostElement = useRef<HTMLDivElement>();

  const themeService = getThemeService();
  const documentService = getDocumentService();
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
      execute: async () => {
        await documentService.unregisterDocument(descriptor);
      },
    },
    {
      id: "closeAll",
      text: "Close All",
      execute: async () => {
        await documentService.closeAll();
      },
    },
    {
      id: "closeOthers",
      text: "Close Others",
      execute: async () => {
        await documentService.closeOthers(descriptor);
      },
    },
    {
      id: "closeToTheRight",
      text: "Close to the Right",
      enabled: !isLast,
      execute: async () => {
        await documentService.closeToTheRight(descriptor);
      },
    },
    "separator",
    {
      id: "moveLeft",
      text: "Move Panel Left",
      enabled: index > 0,
      execute: () => {
        documentService.moveLeft(descriptor);
      },
    },
    {
      id: "moveRight",
      text: "Move Panel Right",
      enabled: !isLast,
      execute: () => {
        documentService.moveRight(descriptor);
      },
    },
  ];

  const onDescriptorChanged = () => {
    setTemporary(descriptor.temporary);
  }

  useEffect(() => {
    descriptor.documentDescriptorChanged.on(onDescriptorChanged);

    return () => {
      descriptor.documentDescriptorChanged.off(onDescriptorChanged);
    }
  }, [descriptor])

  return (
    <div
      ref={hostElement}
      style={style}
      title={descriptor.id}
      onMouseDown={async (e: React.MouseEvent) => {
        if (e.button === 0) {
          clicked?.();
        } else if (e.button === 2) {
          await getContextMenuService().openMenu(
            menuItems,
            e.clientY,
            e.clientX,
            hostElement.current
          );
        }
      }}
      onMouseEnter={() => setPointed(true)}
      onMouseLeave={() => setPointed(false)}
      onDoubleClick={() => {
        descriptor.temporary = false;
        setPointed(false);
      }}
    >
      <Icon iconName="@file-tap-tzx" width={16} height={16} />
      <span
        style={{
          marginLeft: 6,
          marginRight: 6,
          fontStyle: temporary ? "italic" : "normal",
        }}
      >
        {title}
      </span>
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
