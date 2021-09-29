import * as React from "react";

import { CSSProperties } from "react";
import { IToolPanel } from "@abstractions/tool-area-service";

type Props = {
  tool?: IToolPanel;
};

/**
 * Represents the statusbar of the emulator
 */
export default function ToolPropertyBar({ tool }: Props) {
  const style: CSSProperties = {
    display: "flex",
    flexDirection: "row",
    flexGrow: 0,
    flexShrink: 0,
    height: "100%",
    width: "auto",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: "6px",
    background: "var(--shell-canvas-background-color)",
  };

  return <div style={style}>{tool?.createHeaderElement()}</div>;
}
