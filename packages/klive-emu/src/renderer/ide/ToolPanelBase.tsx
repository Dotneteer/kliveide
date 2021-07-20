import * as React from "react";
import { CSSProperties } from "styled-components";
import ScrollablePanel from "../common/ScrollablePanel";
import { IToolPanel } from "./tool-area/ToolAreaService";
import { scrollableContentType } from "./utils/content-utils";

export type ToolPanelProps<P> = P & { descriptor: IToolPanel };

/**
 * Base class for side bar panel implementations
 */
export class ToolPanelBase<
  P = { descriptor: IToolPanel },
  S = {}
> extends React.Component<ToolPanelProps<P>, S> {

  // --- Override the title in other panels
  title = "(Panel)";

  renderContent(): React.ReactNode {
    return <>{this.title}</>;
  }

  // --- Override the default rendering
  render() {
    return (
      <div style={placeholderStyle}>
          {this.renderContent()}
      </div>
    );
  }
}

// --- Panel placeholder style
const placeholderStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  flexGrow: 1,
  flexShrink: 1,
  width: "100%",
  height: "100%",
  fontFamily: "var(--console-font)",
  fontSize: "1.0em",
  padding: "8px 16px",
  color: "var(--information-color)",
};
