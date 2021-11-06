import * as React from "react";

/**
 * Represents a toolbar separator comonent
 */
export function ToolbarSeparator() {
  return (
    <div style={{ height: "100%", padding: "4px 8px" }}>
      <div style={{ height: "100%", borderLeft: "var(--toolbar-separator)" }} />
    </div>
  );
}
