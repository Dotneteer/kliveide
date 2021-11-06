import * as React from "react";

import { SideBarProps, SideBarState } from "@components/SideBarPanelBase";
import { SideBarPanelDescriptorBase } from "@services/SideBarService";
import { BreakpointDefinition } from "@abstractions/code-runner-service";
import {
  dispatch,
  getContextMenuService,
  getState,
  getStore,
} from "@core/service-registry";
import {
  compareBreakpoints,
  resolveBreakpoints,
} from "@abstractions/debug-helpers";
import { Icon } from "@components/Icon";
import { MenuItem } from "@abstractions/command-definitions";
import {
  clearBreakpointsAction,
  removeBreakpointAction,
} from "@core/state/debugger-reducer";
import { navigateToDocumentPosition } from "../../ide/document-area/document-utils";
import { getEngineProxyService } from "../../common-ui/services/engine-proxy";
import { Z80CpuState } from "../../modules/cpu-z80/z80-cpu";
import { VirtualizedSideBarPanelBase } from "@ide/VirtualizedSideBarPanelBase";
import { CSSProperties } from "react";

const TITLE = "Breakpoints";

type State = {
  breakpoints?: BreakpointDefinition[];
  currentPc?: number;
};

/**
 * Z80 disassembly panel
 */
export default class BreakpointsPanel extends VirtualizedSideBarPanelBase<
  SideBarProps<{}>,
  SideBarState<State>
> {
  private _refreshBreakpoints: () => void;

  width = "fit-content";

  /**
   * Initialize with the current breakpoints
   * @param props
   */
  constructor(props: SideBarProps<{}>) {
    super(props);
    this._refreshBreakpoints = () => this.refreshBreakpoints();
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
  async componentDidMount(): Promise<void> {
    super.componentDidMount();
    this.setState({
      breakpoints: (getState()?.debugger?.breakpoints ?? []).sort(
        compareBreakpoints
      ),
    });
    const store = getStore();
    store.breakpointsChanged.on(this._refreshBreakpoints);
    store.compilationChanged.on(this._refreshBreakpoints);
    await new Promise((r) => setTimeout(r, 100));
    this.refreshBreakpoints();
  }

  // --- Stop listening to run events
  componentWillUnmount(): void {
    const store = getStore();
    store.breakpointsChanged.off(this._refreshBreakpoints);
    store.compilationChanged.off(this._refreshBreakpoints);
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
      paddingLeft: 4,
      paddingRight: 4,
      textAlign: "center",
      height: 24,
    };
    const addressStr =
      item.location == undefined
        ? ""
        : `$${item.location
            .toString(16)
            .padStart(4, "0")
            .toLocaleLowerCase()} (${item.location.toString(10)})`;
    const isCurrent = this.state.currentPc === item.location;
    return (
      <div
        className="listlike"
        key={index}
        style={{ ...itemStyle }}
        onClick={() => {
          this.setState({ selectedIndex: index });
          this.listApi.forceRefresh();
        }}
        onContextMenu={(ev) => this.onContextMenu(ev, index, item)}
        onDoubleClick={() => this.navigateToSource(item)}
      >
        <Icon
          iconName={
            isCurrent
              ? "debug-current"
              : "circle-filled"
          }
          width={22}
          height={22}
          fill={
            item.type == "source" && item.unreachable
              ? "--debug-unreachable-bp-color"
              : (isCurrent ? "--console-ansi-yellow": "--debug-bp-color")
          }
          style={{ flexShrink: 0, flexGrow: 0, paddingRight: 4 }}
        />
        <div>
          {item.type === "binary"
            ? addressStr
            : `${item.resource}:${item.line}`}
        </div>
        {item.type === "source" && item.unreachable && (
          <div style={{ fontStyle: "italic" }}>&nbsp;[unreachable]</div>
        )}
        {item.type === "source" && item.location != undefined && (
          <div style={{ fontStyle: "italic" }}>&nbsp;[{addressStr}]</div>
        )}
      </div>
    );
  }

  /**
   * Respond to breakpoint changes
   * @param breakpoints
   */
  refreshBreakpoints(): void {
    const breakpoints = resolveBreakpoints();
    this.setState({ breakpoints });
    this.listApi?.forceRefresh();
  }

  /**
   * Handles the context menu click of the specified item
   * @param ev Event information
   * @param index Item index
   * @param item Item data
   */
  async onContextMenu(
    ev: React.MouseEvent,
    index: number,
    item: BreakpointDefinition
  ): Promise<void> {
    this.setState({ selectedIndex: index });
    this.listApi.forceRefresh();
    const menuItems: MenuItem[] = [
      {
        id: "removeBreakpoint",
        text: "Remove breakpoint",
        execute: async () => {
          dispatch(removeBreakpointAction(item));
          this.listApi.focus();
          this.listApi.forceRefresh();
        },
      },
      "separator",
      {
        id: "removeAllBreakpoints",
        text: "Remove all",
        execute: async () => {
          dispatch(clearBreakpointsAction());
        },
      },
    ];
    if (item.type === "source") {
      menuItems.unshift(
        {
          id: "navigateToBreakpoint",
          text: "Navigate to code",
          execute: async () => {
            this.navigateToSource(item);
          },
        },
        "separator"
      );
    }

    const rect = (ev.target as HTMLElement).getBoundingClientRect();
    await getContextMenuService().openMenu(
      menuItems,
      rect.y + 22,
      ev.clientX,
      ev.target as HTMLElement
    );
  }

  /**
   * Navigates to the source code of the specified item
   * @param item
   */
  async navigateToSource(item: BreakpointDefinition): Promise<void> {
    if (item.type === "binary") {
      return;
    }
    const projectRoot = getState().project.path;
    const resource = (projectRoot + item.resource).replace(/\\/g, "/");
    navigateToDocumentPosition(resource, item.line, 0);
  }

  /**
   * Refresh the disassembly screen
   */
  protected async onRunEvent(): Promise<void> {
    const engineProxy = getEngineProxyService();
    const cpuState = (await engineProxy.getCachedCpuState()) as Z80CpuState;
    const execState = getState().emulatorPanel?.executionState ?? 0;
    this.setState({ currentPc: execState === 3 ? cpuState._pc : undefined });
    this.listApi?.forceRefresh();
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
