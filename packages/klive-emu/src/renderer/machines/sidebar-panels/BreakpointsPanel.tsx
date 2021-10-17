import * as React from "react";

import { CSSProperties } from "styled-components";
import { SideBarProps, SideBarState } from "../../ide/SideBarPanelBase";
import { SideBarPanelDescriptorBase } from "../../ide/side-bar/SideBarService";
import { VirtualizedSideBarPanelBase } from "../../ide/VirtualizedSideBarPanelBase";
import { BreakpointDefinition } from "@abstractions/code-runner-service";
import { getState, getStore } from "@core/service-registry";
import { compareBreakpoints } from "@abstractions/debug-helpers";
import { Icon } from "@components/Icon";

const TITLE = "Breakpoints";

type State = {
  breakpoints?: BreakpointDefinition[];
};

/**
 * Z80 disassembly panel
 */
export default class BreakpointsPanel extends VirtualizedSideBarPanelBase<
  SideBarProps<{}>,
  SideBarState<State>
> {
  private _onBreakpointsChanged: (bps: BreakpointDefinition[]) => void;

  width = "fit-content";

  /**
   * Initialize with the current breakpoints
   * @param props
   */
  constructor(props: SideBarProps<{}>) {
    super(props);
    this._onBreakpointsChanged = (bps) => this.onBreakpointsChanged(bps);
  }

  /**
   * Defines the message to show, if there are no items to render
   */
  get noItemsMessage(): string {
    return "No breakpoints defined yet.";
  }

  /**
   * Sets the default item height
   */
  get itemHeight(): number {
    return 24;
  }

  // --- Listen to run events
  componentDidMount(): void {
    super.componentDidMount();
    this.setState({
      breakpoints: getState()?.debugger?.breakpoints ?? [],
    });
    const store = getStore();
    store.breakpointsChanged.on(this._onBreakpointsChanged);
  }

  // --- Stop listening to run events
  componentWillUnmount(): void {
    const store = getStore();
    store.breakpointsChanged.off(this._onBreakpointsChanged);
    super.componentWillUnmount();
  }

  /**
   * Override to get the number of items
   */
  getItemsCount(): number {
    return this.state?.breakpoints?.length ?? 0;
  }

  /**
   * Renders an item of the list
   * @param index Index of the item
   * @param style Style to provide
   * @param item Item data
   */
  renderItem(index: number, style: CSSProperties) {
    const item = this.state?.breakpoints[index];
    const itemStyle: CSSProperties = {
      ...style,
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      fontFamily: "var(--main-font-family)",
      width: "100%",
      background:
        index === this.state.selectedIndex
          ? this.state.focused
            ? "var(--selected-background-color)"
            : "var(--list-selected-background-color)"
          : undefined,
      border:
        index === this.state.selectedIndex
          ? this.state.focused
            ? "1px solid var(--selected-border-color)"
            : "1px solid transparent"
          : "1px solid transparent",
    };
    return (
      <div
        className="listlike"
        key={index}
        style={{ ...itemStyle }}
        onClick={() => {
          this.setState({ selectedIndex: index });
          this.listApi.forceRefresh();
        }}
      >
        <Icon
          iconName="circle-filled"
          width={18}
          height={18}
          fill={
            item.disabled ? "--debug-disabled-bp-color" : "--debug-bp-color"
          }
          style={{ flexShrink: 0, flexGrow: 0 }}
        />

        {item.type}
      </div>
    );
  }

  /**
   * Respond to breakpoint changes
   * @param breakpoints
   */
  onBreakpointsChanged(breakpoints: BreakpointDefinition[]): void {
    this.setState({ breakpoints: breakpoints.sort(compareBreakpoints) });
    this.listApi.forceRefresh();
  }
}

/**
 * Descriptor for the sample side bar panel
 */
export class BreakpointsPanelDescriptor extends SideBarPanelDescriptorBase {
  /**
   * Panel title
   */
  get title(): string {
    return TITLE;
  }

  /**
   * Creates a node that represents the contents of a side bar panel
   */
  createContentElement(): React.ReactNode {
    return <BreakpointsPanel descriptor={this} needsMachine={false} />;
  }
}
