import * as React from "react";
import { CSSProperties } from "styled-components";
import { engineProxy, RunEventArgs } from "./engine-proxy";
import { ISideBarPanel } from "./side-bar/SideBarService";

export type SideBarProps<P> = { descriptor: ISideBarPanel };

/**
 * Base class for side bar panel implementations
 */
export class SideBarPanelBase<
  P = { descriptor: ISideBarPanel },
  S = {}
> extends React.Component<SideBarProps<P>, S> {
  private _eventCount = 0;

  // --- Override the title in other panels
  title = "(Panel)";

  // --- Listen to run events
  componentDidMount(): void {
    engineProxy.runEvent.on(this.runEvent);
  }

  // --- Stop listening to run events
  componentWillUnmount(): void {
    engineProxy.runEvent.off(this.runEvent);
  }

  // --- Override the default rendering
  render() {
    return <div style={placeholderStyle}>{this.title}</div>;
  }

  /**
   * Respond to a run event
   * @param execState Execution state
   */
  protected onRunEvent(
    execState: number,
    isDebug: boolean,
    eventCount: number
  ): void {
    // --- Define this in overridden components
  }

  // --- Take care of run events
  runEvent = ({ execState, isDebug }: RunEventArgs) => {
    if (this.props.descriptor.expanded) {
      if (execState === 1) {
        this._eventCount++;
      }
      this.onRunEvent(execState, isDebug, this._eventCount);
    }
  };
}

// --- Panel placeholder style
const placeholderStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  flexGrow: 1,
  flexShrink: 1,
  width: "100%",
  height: "100%",
  justifyContent: "center",
  alignItems: "center",
  fontSize: "0.8em",
  color: "#a0a0a0",
};
