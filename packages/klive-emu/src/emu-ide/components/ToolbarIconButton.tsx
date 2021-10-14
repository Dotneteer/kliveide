import * as React from "react";
import { useState } from "react";
import { Icon } from "./Icon";

const DEFAULT_SIZE = 22;
const DEFAULT_HILITE_SIZE = 28;

interface Props {
  iconName: string;
  size?: number;
  highlightSize?: number;
  title?: string;
  fill?: string;
  enable?: boolean;
  selected?: boolean;
  clicked?: () => void;
}

/**
 * Represents the statusbar of the emulator
 */
export function ToolbarIconButton({
  iconName,
  size,
  highlightSize,
  title,
  fill,
  enable,
  selected,
  clicked
}: Props) {
  const [currentSize, setCurrentSize] = useState(size ?? DEFAULT_SIZE);
  const style = {
    display: "flex",
    width: "36px",
    height: "36px",
    padding: "4px 4px",
    margin: "0",
    alignItems: "center",
    justifyContent: "center",
    cursor: enable ? "" : "default",
    border: selected
      ? "2px solid var(--selected-border-color)"
      : "1px solid transparent",
  };

  return (
    <div
      style={style}
      title={title}
      onMouseDown={(ev) => handleMouseDown(ev)}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      <Icon
        iconName={iconName}
        fill={
          enable ?? true ? fill : "--toolbar-button-disabled-fill"
        }
        width={currentSize}
        height={currentSize}
      />
    </div>
  );

  function handleMouseDown(ev: React.MouseEvent): void {
    if (!(enable ?? true)) {
      return;
    }
    if ( ev.button === 0) {
      updateSize(true);
    }
  }

  function handleMouseUp(): void {
    updateSize(false);
    clicked?.();
  }

  function handleMouseLeave(): void {
    if (!(enable ?? true)) {
      return;
    }
    updateSize(false);
  }

  function updateSize(pointed: boolean): void {
    setCurrentSize(
      pointed
        ? highlightSize ?? DEFAULT_HILITE_SIZE
        : size ?? DEFAULT_SIZE
    );
  }
}
