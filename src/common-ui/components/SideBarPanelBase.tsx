import * as React from "react";

import { getState } from "@core/service-registry";

import { CSSProperties } from "styled-components";
import ScrollablePanel from "./ScrollablePanel";
import { scrollableContentType } from "./content-utils";
import { ISideBarPanel } from "@abstractions/side-bar-service";
import { getEngineProxyService, RunEventArgs } from "../services/engine-proxy";

export type SideBarProps<P> = P & {
  descriptor: ISideBarPanel;
  needsMachine?: boolean;
};

export type SideBarState<S> = S & {
  focused?: boolean;
  hasMachine?: boolean;
  selectedIndex: number;
};

/**
 * Base class for side bar panel implementations
 */
export class SideBarPanelBase<
  P = { descriptor: ISideBarPanel },
  S = {}
> extends React.Component<SideBarProps<P>, SideBarState<S>> {
  private _isSizing = false;
  private _eventCount = 0;
  private _initialized = false;
  private _executionState = 0;
  private _runEvent: (args: RunEventArgs) => void;
  private _expandedChanged: (args: boolean) => void;

  // --- Override this property to set with item width in the scrollable panel
  width: string | number = "fit-content";

  // --- Override this propertes to define the messages to show when there is
  // --- no machine turned on
  noMachineLine1 = "Turn on the virtual machine";
  noMacineLine2 = "";

  constructor(props: SideBarProps<P>) {
    super(props);
    this._executionState = getState().emulatorPanel?.executionState ?? 0;
    this._runEvent = (args) => this.runEvent(args);
    this._expandedChanged = (arg) => this.onExpandedChanged(arg);
  }

  /**
   * The virtual machine's current execution state
   */
  protected get executionState(): number {
    return this._executionState;
  }

  // --- Listen to run events
  componentDidMount(): void {
    getEngineProxyService().runEvent.on(this._runEvent);
    this.props.descriptor.expandedChanged.on(this._expandedChanged);
    this.setState({
      hasMachine: !!getState()?.emulatorPanel?.executionState as any,
      selectedIndex: -1 as any,
    });
  }

  // --- Stop listening to run events
  componentWillUnmount(): void {
    getEngineProxyService().runEvent.off(this._runEvent);
    this.props.descriptor.expandedChanged.off(this._expandedChanged);
  }

  renderContent(): React.ReactNode {
    return <>{this.props.descriptor.title}</>;
  }

  // --- Override the default rendering
  render() {
    if (
      !this._initialized &&
      this.state?.hasMachine &&
      this.props.descriptor.expanded
    ) {
      this._initialized = true;
      const emuPanelState = getState()?.emulatorPanel;
      const hasMachine = !!emuPanelState?.executionState;
      if (hasMachine) {
        this.onRunEvent(
          emuPanelState.executionState,
          emuPanelState.runsInDebug,
          this._eventCount
        );
      }
    }

    const needsMachine = this.props.needsMachine ?? true;
    return !needsMachine || (needsMachine && this.state?.hasMachine) ? (
      this.renderPanel()
    ) : (
      <div
        style={{
          ...sidebarPlaceholderStyle,
          fontFamily: "var(--main-font-family)",
        }}
      >
        {this.noMachineLine1 && (
          <span style={{ textAlign: "center" }}>{this.noMachineLine1}</span>
        )}
        {this.noMacineLine2 && (
          <span style={{ textAlign: "center" }}>{this.noMacineLine2}</span>
        )}
      </div>
    );
  }

  /**
   * Renders the panel
   */
  renderPanel() {
    return (
      <div style={sidebarPlaceholderStyle}>
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
  protected async onRunEvent(
    _execState: number,
    _isDebug: boolean,
    _eventCount: number
  ): Promise<void> {
    // --- Define this in overridden components
  }

  // --- Take care of run events
  private runEvent = async ({ execState, isDebug }: RunEventArgs) => {
    this._executionState = execState;
    this.setState({ hasMachine: true as any });
    if (this.props.descriptor.expanded) {
      if (execState === 1) {
        this._eventCount++;
      }
      if (!this._isSizing) {
        await this.onRunEvent(execState, isDebug, this._eventCount);
      }
    }
  };

  private onExpandedChanged(expanded: boolean): void {
    console.log("Expanded changed");
  }
}

// --- Panel placeholder style
export const sidebarPlaceholderStyle: CSSProperties = {
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
  color: "#cccccc",
};
