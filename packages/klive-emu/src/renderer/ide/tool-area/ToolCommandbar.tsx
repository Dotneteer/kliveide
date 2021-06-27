import * as React from "react";
import CommandIconButton from "../command/CommandIconButton";

import { CSSProperties } from "react";
import { useSelector } from "react-redux";
import { AppState } from "../../../shared/state/AppState";
import { ideStore } from "../ideStore";
import { ideToolFrameMaximizeAction } from "../../../shared/state/tool-frame-reducer";

/**
 * Represents the statusbar of the emulator
 */
export default function ToolCommandBar() {
  const maximized = useSelector(
    (state: AppState) => state.toolFrame?.maximized ?? false
  );

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
    paddingRight: "6px",
    background: "var(--shell-canvas-background-color)",
  };

  return (
    <div style={style}>
      <CommandIconButton
        iconName={maximized ? "chevron-down" : "chevron-up"}
        title={maximized ? "Restore panel size" : "Maximize panel size"}
        clicked={() => {
          console.log(!maximized);
          ideStore.dispatch(ideToolFrameMaximizeAction(!maximized));
        }}
      />
      <CommandIconButton iconName="close" title="Close" clicked={() => {}} />
    </div>
  );
}
