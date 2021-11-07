import * as React from "react";
import { useState } from "react";
import { Icon } from "./Icon";

const DEFAULT_SIZE = 22;
const DEFAULT_HILITE_SIZE = 28;

/**
 * Properties of a toolbar icon button
 */
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
  clicked,
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
      onMouseDown={(ev) => {
        if ((enable ?? true) && ev.button === 0) {
          updateSize(true);
        }
      }}
      onMouseUp={() => {
        updateSize(false);
        clicked?.();
      }}
      onMouseLeave={() => {
        if (enable ?? true) {
          updateSize(false);
        }
      }}
    >
      <Icon
        iconName={iconName}
        fill={enable ?? true ? fill : "--toolbar-button-disabled-fill"}
        width={currentSize}
        height={currentSize}
      />
    </div>
  );

  function updateSize(pointed: boolean): void {
    setCurrentSize(
      pointed ? highlightSize ?? DEFAULT_HILITE_SIZE : size ?? DEFAULT_SIZE
    );
  }
}
