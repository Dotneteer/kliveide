import * as React from "react";
import { CSSProperties } from "react";
import { SvgIcon } from "../../common/SvgIcon";

interface Props {
  title: string;
  active: boolean;
}

/**
 * Represents the statusbar of the emulator
 */
export default function DocumentTab(props: Props) {
  const style: CSSProperties = {
    display: "flex",
    flexDirection: "row",
    flexGrow: 0,
    flexShrink: 0,
    height: "100%",
    background: props.active
      ? "var(--document-tab-active-background-color)"
      : "var(--document-tab-background-color)",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: "10px",
    paddingRight: "10px",
    cursor: "pointer",
    borderRight: "1px solid var(--document-tab-active-background-color)",
    color: props.active
      ? "var(--document-tab-active-color)"
      : "var(--document-tab-color)",
  };

  return (
    <div style={style}>
      <SvgIcon iconName="file-code" width={16} height={16} />
      <span>{props.title}</span>
      <SvgIcon iconName="close" width={16} height={16} />
    </div>
  );
}
