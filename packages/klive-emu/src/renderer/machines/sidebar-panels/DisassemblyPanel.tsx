import * as React from "react";
import VirtualizedList, {
  VirtualizedListApi,
} from "../../common-ui/VirtualizedList";
import { CSSProperties } from "styled-components";
import {
  SideBarPanelBase,
  sidebarPlaceholderStyle,
  SideBarProps,
} from "../../ide/SideBarPanelBase";
import { SideBarPanelDescriptorBase } from "../../ide/side-bar/SideBarService";
import { engineProxy } from "../../ide/engine-proxy";
import { Z80CpuState } from "../../cpu/Z80Cpu";
import { Z80Disassembler } from "../../../shared/z80/disassembler/z80-disassembler";
import {
  DisassemblyItem,
  DisassemblyOutput,
  MemorySection,
} from "../../../shared/z80/disassembler/disassembly-helper";
import { SvgIcon } from "../../common-ui/SvgIcon";
import { ideStore } from "../../ide/ideStore";

const TITLE = "Z80 Disassembly";
const DISASS_LENGTH = 256;

type State = {
  hasMachine: boolean;
  selectedIndex: number;
  output?: DisassemblyOutput;
};

/**
 * Z80 disassembly panel
 */
export default class Z80DisassemblyPanel extends SideBarPanelBase<
  SideBarProps<{}>,
  State
> {
  private _listApi: VirtualizedListApi;

  title = TITLE;

  width = "fit-content";

  constructor(props: SideBarProps<{}>) {
    super(props);
    this.state = { selectedIndex: -1, hasMachine: false };
  }

  async componentDidMount(): Promise<void> {
    super.componentDidMount();
    const hasMachine = !!ideStore.getState()?.emulatorPanel?.executionState;
    this.setState({ hasMachine });
    if (hasMachine) {
      this.onRunEvent();
    }
  }

  render() {
    const items = this.state.output?.outputItems ?? [];
    const numItems = this.state.output
      ? this.state.output.outputItems.length
      : 0;
    return this.state.hasMachine ? (
      <VirtualizedList
        itemHeight={18}
        numItems={numItems}
        style={listStyle}
        renderItem={(index: number, style: CSSProperties) =>
          this.renderItem(index, style, items[index])
        }
        onFocus={() => {
          this.signFocus(true);
          this._listApi.forceRefresh();
        }}
        onBlur={() => {
          this.signFocus(false);
          this._listApi.forceRefresh();
        }}
        handleKeys={(e) => this.handleKeys(e)}
        registerApi={(api) => (this._listApi = api)}
      />
    ) : (
      <div
        style={{
          ...sidebarPlaceholderStyle,
          fontFamily: "var(--main-font-family)",
        }}
      >
        <span style={{ textAlign: "center" }}>Turn on the virtual machine</span>
        <span style={{ textAlign: "center" }}>to see the disassembly</span>
      </div>
    );
  }

  /**
   * Renders an item of the list
   * @param index Index of the item
   * @param style Style to provide
   * @param item Item data
   */
  renderItem(index: number, style: CSSProperties, item: DisassemblyItem) {
    const itemStyle: CSSProperties = {
      ...style,
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      fontFamily: "var(--console-font)",
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
          this._listApi.forceRefresh();
        }}
      >
        {!item.prefixComment && (
          <>
            <div
              style={{
                marginLeft: 4,
                width: 32,
                color: item.hasLabel
                  ? "var(--console-ansi-bright-magenta)"
                  : "var(--console-ansi-bright-blue)",
                fontWeight: item.hasLabel ? 600 : 100,
              }}
            >
              {item.address.toString(16).padStart(4, "0").toUpperCase()}
            </div>
            {index === 0 ? (
              <SvgIcon iconName="chevron-right" />
            ) : (
              <div style={{ width: 12 }} />
            )}
            <div style={{ width: 106 }}>{item.opCodes}</div>
            <div
              style={{
                width: 40,
                color: "var(--console-ansi-bright-cyan)",
                fontWeight: 600,
              }}
            >
              {item.instruction}
            </div>{" "}
          </>
        )}
        {item.prefixComment && (
          <div style={{ marginLeft: 4, color: "var(--console-ansi-green)" }}>
            -- End of disassembly
          </div>
        )}
      </div>
    );
  }

  /**
   * Refresh the disassembly screen
   */
  protected async onRunEvent(): Promise<void> {
    this.setState({ hasMachine: true });
    const cpuState = (await engineProxy.getCachedCpuState()) as Z80CpuState;
    const memory = await engineProxy.getCachedMemoryContents();
    const pcValue = cpuState._pc;
    const disassembler = new Z80Disassembler(
      [new MemorySection(pcValue, pcValue + DISASS_LENGTH)],
      memory
    );
    const disassemblyOutput = await disassembler.disassemble(
      pcValue,
      pcValue + DISASS_LENGTH
    );
    disassemblyOutput.addItem({
      prefixComment: "Placeholder",
    } as DisassemblyItem);
    this.setState({
      output: disassemblyOutput,
    });
    this._listApi.forceRefresh(0);
  }

  /**
   * Allow moving in the project explorer with keys
   */
  handleKeys(e: React.KeyboardEvent): void {
    let newIndex = -1;
    const numItems = this.state.output
      ? this.state.output.outputItems.length
      : 0;
    switch (e.code) {
      case "ArrowUp":
        if (this.state.selectedIndex <= 0) return;
        newIndex = this.state.selectedIndex - 1;
        break;

      case "ArrowDown": {
        if (this.state.selectedIndex >= numItems - 1) return;
        newIndex = this.state.selectedIndex + 1;
        break;
      }
      case "Home": {
        newIndex = 0;
        break;
      }
      case "End": {
        newIndex = numItems - 1;
        break;
      }
      default:
        return;
    }
    if (newIndex >= 0) {
      this._listApi.ensureVisible(newIndex);
      this.setState({
        selectedIndex: newIndex,
      });
      this._listApi.forceRefresh();
    }
  }
}

/**
 * Descriptor for the sample side bar panel
 */
export class Z80DisassemblyPanelDescriptor extends SideBarPanelDescriptorBase {
  constructor() {
    super(TITLE);
  }

  /**
   * Creates a node that represents the contents of a side bar panel
   */
  createContentElement(): React.ReactNode {
    return <Z80DisassemblyPanel descriptor={this} />;
  }
}

// --- The style of the list
const listStyle: CSSProperties = {
  fontFamily: "var(--console-font)",
  fontSize: "0.8em",
};

// ============================================================================
// Helper functions
// ============================================================================
