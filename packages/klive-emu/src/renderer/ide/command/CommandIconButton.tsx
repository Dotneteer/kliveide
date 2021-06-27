import * as React from "react";
import { useState } from "react";
import { SvgIcon } from "../../common/SvgIcon";

interface Props {
  iconName: string;
  size?: number;
  title?: string;
  fill?: string;
  enable?: boolean;
  clicked?: (ev: React.MouseEvent) => void;
}

/**
 * Represents the statusbar of the emulator
 */
export default function CommandIconButton({
  iconName,
  size = 16,
  title,
  fill,
  enable,
  clicked
}: Props) {
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

  const handleMouseDown = (ev: React.MouseEvent) => {
    if (ev.button === 0) {
      clicked?.(ev);
    }
    ev.preventDefault();
    ev.stopPropagation();
  }

  const handleMouseUp = (ev: React.MouseEvent) => {
    ev.preventDefault();
    ev.stopPropagation();
  }

  return (
    <div
      style={style}
      title={title}
      onMouseDown={(ev) => handleMouseDown(ev)}
      onMouseUp={(ev) => handleMouseUp(ev)}
      onMouseEnter={() => setPointed(true)}
      onMouseLeave={() => setPointed(false)}
    >
      <SvgIcon
        iconName={iconName}
        fill={
          enable ?? true ? fill : "--toolbar-button-disabled-fill"
        }
        width={size}
        height={size}
      />
    </div>
  );
}
