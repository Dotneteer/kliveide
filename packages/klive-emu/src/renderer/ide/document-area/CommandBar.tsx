import * as React from "react";
import CommandIconButton from "../command/CommandIconButton";

import { documentService } from "./DocumentService";
import { CSSProperties } from "react";

/**
 * Represents the statusbar of the emulator
 */
export default function CommandBar() {
  const style: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    flexGrow: 0,
    flexShrink: 0,
    height: "100%",
    width: "auto",
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: "6px",
    paddingRight: "6px",
    background: "var(--commandbar-background-color)",
  };

  return (
    <div style={style}>
      <CommandIconButton
        iconName="close"
        title="Close All"
        clicked={() => {
          documentService.closeAll();
        }}
      />
    </div>
  );
}
