import * as React from "react";
import { useRef } from "react";
import { CSSProperties, useState } from "react";
import { themeService } from "../../../renderer/themes/theme-service";
import { SvgIcon } from "../../common/SvgIcon";
import { MenuItem } from "../command/command";
import ContextMenu from "../command/ContextMenu";
import CommandIconButton from "./CommandIconButton";

interface Props {
  title: string;
  active: boolean;
  index: number;
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
  clicked,
  closed,
}: Props) {
  const [pointed, setPointed] = useState(false);
  const menuId = useRef(0);

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
      id: "moveLeft",
      text: "Move Left",
    },
    "separator",
    {
      id: "moveRight",
      text: "Move Right",
      enabled: false,
    },
    "separator",
    {
      id: "other",
      text: "Other",
      items: [
        {
          id: "moveLeft1",
          text: "Move Left",
          enabled: false,
        },
        {
          id: "moveRight1",
          text: "Move Right",
        },
      ],
    },
  ];

  menuId.current = 1;

  return (
    <div
      id={`id-${menuId.current}`}
      style={style}
      onMouseDown={(e) => {
        if (e.button === 0) {
          clicked?.();
        }
      }}
      onMouseEnter={() => setPointed(true)}
      onMouseLeave={() => setPointed(false)}
    >
      <ContextMenu
        context={index}
        target={`#id-${menuId.current}`}
        items={menuItems}
      />
      <SvgIcon iconName="file-code" width={16} height={16} />
      <span style={{ marginLeft: 6, marginRight: 6 }}>{title}</span>
      <CommandIconButton
        iconName="close"
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
