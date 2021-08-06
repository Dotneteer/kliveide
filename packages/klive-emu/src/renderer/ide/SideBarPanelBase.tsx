import * as React from "react";
import { CSSProperties } from "styled-components";
import ScrollablePanel from "../common-ui/ScrollablePanel";
import { engineProxy, RunEventArgs } from "./engine-proxy";
import { ISideBarPanel } from "./side-bar/SideBarService";
import { scrollableContentType } from "./utils/content-utils";

export type SideBarProps<P> = P & {
  descriptor: ISideBarPanel;
};

export type SideBarState<S> = S & { focused?: boolean };

/**
 * Base class for side bar panel implementations
 */
export class SideBarPanelBase<
  P = { descriptor: ISideBarPanel },
  S = {}
> extends React.Component<SideBarProps<P>, SideBarState<S>> {
  private _isSizing = false;
  private _eventCount = 0;

  // --- Override the title in other panels
  title = "(Panel)";

  // --- Override this property to set with item width in the scrollable panel
  width: string | number = "fit-content";

  // --- Listen to run events
  componentDidMount(): void {
    engineProxy.runEvent.on(this.runEvent);
  }

  // --- Stop listening to run events
  componentWillUnmount(): void {
    engineProxy.runEvent.off(this.runEvent);
  }

  renderContent(): React.ReactNode {
    return <>{this.title}</>;
  }

  // --- Override the default rendering
  render() {
    return (
      <div style={placeholderStyle}>
        <ScrollablePanel
          scrollBarSize={10}
          sizing={(isSizing) => (this._isSizing = isSizing)}
          onFocus={() => this.signFocus(true)}
          onBlur={() => this.signFocus(false)}
        >
          <div style={scrollableContentType(this.width)}>
            {this.renderContent()}
          </div>
        </ScrollablePanel>
      </div>
    );
  }

  /**
   * Signs if this panel is in focused/blurred state
   * @param focused Is the panel focused?
   */
  protected signFocus(focused: boolean): void {
    this.props.descriptor.focused = focused;
    this.setState({ focused: focused as any });
  }

  /**
   * Respond to a run event
   * @param execState Execution state
   */
  protected onRunEvent(
    _execState: number,
    _isDebug: boolean,
    _eventCount: number
  ): void {
    // --- Define this in overridden components
  }

  // --- Take care of run events
  private runEvent = ({ execState, isDebug }: RunEventArgs) => {
    if (this.props.descriptor.expanded) {
      if (execState === 1) {
        this._eventCount++;
      }
      if (!this._isSizing) {
        this.onRunEvent(execState, isDebug, this._eventCount);
      }
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
  fontFamily: "var(--console-font)",
  color: "#a0a0a0",
};
