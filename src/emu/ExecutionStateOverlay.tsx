import * as React from "react";
import { CSSProperties } from "react";

interface Props {
  text: string;
  clicked?: () => void;
}

/**
 * Represents the overlay of the emulator's panel
 */
export default function ExecutionStateOverlay(props: Props) {
  if (props.text) {
    return (
      <div style={rootStyle} onClick={handleClick}>
        <div style={overlayStyle} title="Hide overlay (click to show again)">
          {props.text}
        </div>
      </div>
    );
  } else {
    return null;
  }

  function handleClick(e: React.MouseEvent): void {
    e.stopPropagation();
    props.clicked?.();
  }
}

const rootStyle: CSSProperties = {
  position: "relative",
  flexShrink: 0,
  flexGrow: 0,
  height: 0,
  left: 8,
  top: 8,
  marginRight: 16,
};

const overlayStyle: CSSProperties = {
  display: "inline-block",
  backgroundColor: "#404040",
  color: "lightgreen",
  opacity: 0.9,
  padding: "2px 10px 4px 10px",
  borderRadius: 4,
  cursor: "pointer"
}