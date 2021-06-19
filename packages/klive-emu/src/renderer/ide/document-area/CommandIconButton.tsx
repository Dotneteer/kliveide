import * as React from "react";
import { useState } from "react";
import { SvgIcon } from "../../common/SvgIcon";

interface Props {
  iconName: string;
  size?: number;
  title?: string;
  fill?: string;
  enable?: boolean;
  selected?: boolean;
  clicked?: () => void;
}

/**
 * Represents the statusbar of the emulator
 */
export default function CommandIconButton(props: Props) {
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

  return (
    <div
      style={style}
      title={props.title}
      onMouseDown={(ev) => handleMouseDown(ev)}
      onMouseEnter={() => setPointed(true)}
      onMouseLeave={() => setPointed(false)}
    >
      <SvgIcon
        iconName={props.iconName}
        fill={
          props.enable ?? true ? props.fill : "--toolbar-button-disabled-fill"
        }
        width={props.size}
        height={props.size}
      />
    </div>
  );

  function handleMouseDown(ev: React.MouseEvent): void {
    if (ev.button === 0) {
      props?.clicked?.();
    }
  }
}
