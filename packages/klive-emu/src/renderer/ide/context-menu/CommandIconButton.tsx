import { executeCommand } from "@abstractions/command-registry";
import * as React from "react";
import { useState } from "react";
import { Icon } from "../../common-ui/Icon";

interface Props {
  iconName: string;
  size?: number;
  title?: string;
  fill?: string;
  enabled?: boolean;
  clicked?: ((ev: React.MouseEvent) => void) | string;
  doNotPropagate?: boolean;
}

/**
 * Represents the statusbar of the emulator
 */
export default function CommandIconButton({
  iconName,
  size = 16,
  title,
  fill,
  enabled = true,
  clicked,
  doNotPropagate = false,
}: Props) {
  const hostElement = React.createRef<HTMLDivElement>();
  const [pointed, setPointed] = useState(false);

  const style = {
    display: "flex",
    padding: "2px 2px",
    margin: "0",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    background: pointed ? "#3d3d3d" : "transparent",
  };

  const handleClick = async (ev: React.MouseEvent) => {
    if (clicked && enabled) {
      if (typeof clicked === "string") {
        await executeCommand(clicked);
      } else {
        clicked(ev);
      }
    }
    if (doNotPropagate) {
      ev.preventDefault();
      ev.stopPropagation();
    }
  };

  return (
    <div
      ref={hostElement}
      style={style}
      title={title}
      onClick={handleClick}
      onMouseEnter={() => setPointed(true)}
      onMouseLeave={() => setPointed(false)}
    >
      <Icon
        iconName={iconName}
        fill={enabled ?? true ? fill : "--toolbar-button-disabled-fill"}
        width={size}
        height={size}
      />
    </div>
  );
}
