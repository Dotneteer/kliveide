import * as React from "react";
import { useState } from "react";
import { SvgIcon } from "./SvgIcon";

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
export function ToolbarIconButton(props: Props) {
  const [currentSize, setCurrentSize] = useState(props.size ?? DEFAULT_SIZE);
  const style = {
    display: "flex",
    width: "36px",
    height: "36px",
    padding: "4px 4px",
    margin: "0",
    alignItems: "center",
    justifyContent: "center",
    cursor: props.enable ? "" : "default",
    border: props.selected
      ? "2px solid var(--toolbar-selected-border-color)"
      : "1px solid transparent",
  };

  return (
    <div
      style={style}
      title={props.title}
      onMouseDown={(ev) => handleMouseDown(ev)}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      <SvgIcon
        iconName={props.iconName}
        fill={
          props.enable ?? true ? props.fill : "--toolbar-button-disabled-fill"
        }
        width={currentSize}
        height={currentSize}
      />
    </div>
  );

  function handleMouseDown(ev: React.MouseEvent): void {
    if (ev.button === 0) {
      updateSize(true);
    }
  }

  function handleMouseUp(): void {
    updateSize(false);
    props?.clicked?.();
  }

  function handleMouseLeave(): void {
    if (!(props.enable ?? true)) {
      return;
    }
    updateSize(false);
  }

  function updateSize(pointed: boolean): void {
    setCurrentSize(
      pointed
        ? props.highlightSize ?? DEFAULT_HILITE_SIZE
        : props.size ?? DEFAULT_SIZE
    );
  }
}
