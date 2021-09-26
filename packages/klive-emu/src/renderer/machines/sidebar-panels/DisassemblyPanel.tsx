import * as React from "react";
import { CSSProperties } from "styled-components";
import { SideBarProps, SideBarState } from "../../ide/SideBarPanelBase";
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
import { VirtualizedSideBarPanelBase } from "../../ide/VirtualizedSideBarPanelBase";
import { virtualMachineToolsService } from "../core/VitualMachineToolBase";
import { getState } from "../../../shared/services/store-helpers";

const TITLE = "Z80 Disassembly";
const DISASS_LENGTH = 2560;

type State = {
  output?: DisassemblyOutput;
};

/**
 * Z80 disassembly panel
 */
export default class Z80DisassemblyPanel extends VirtualizedSideBarPanelBase<
  SideBarProps<{}>,
  SideBarState<State>
> {
  width = "fit-content";
  noMacineLine2 = "to see the disassembly";

  /**
   * Override to get the number of items
   */
  getItemsCount(): number {
    const items = this.state.output?.outputItems ?? [];
    return this.state.output ? this.state.output.outputItems.length : 0;
  }

  /**
   * Renders an item of the list
   * @param index Index of the item
   * @param style Style to provide
   * @param item Item data
   */
  renderItem(index: number, style: CSSProperties) {
    const item = this.state.output.outputItems[index];
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
          this.listApi.forceRefresh();
        }}
      >
        {!item?.prefixComment && (
          <>
            <div
              style={{
                marginLeft: 4,
                width: 30,
                color: item?.hasLabel
                  ? "var(--console-ansi-bright-magenta)"
                  : "var(--console-ansi-bright-blue)",
                fontWeight: item?.hasLabel ? 600 : 100,
              }}
            >
              {item.address.toString(16).padStart(4, "0").toUpperCase()}
            </div>
            {index === 0 ? (
              <SvgIcon iconName="chevron-right" fill="--console-ansi-green" />
            ) : (
              <div style={{ width: 14 }} />
            )}
            <div style={{ width: 100 }}>{item.opCodes}</div>
            <div
              style={{
                width: 40,
                color: "var(--console-ansi-bright-cyan)",
                fontWeight: 600,
              }}
            >
              {item.instruction}
            </div>
          </>
        )}
        {item?.prefixComment && (
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
    const cpuState = (await engineProxy.getCachedCpuState()) as Z80CpuState;
    const memory = await engineProxy.getCachedMemoryContents();
    const pcValue = cpuState._pc;

    // --- Create the disassebler
    const disassembler = new Z80Disassembler(
      [new MemorySection(pcValue, pcValue + DISASS_LENGTH)],
      memory
    );

    // --- Set up custom disassembler, if available
    const machineTools = virtualMachineToolsService.getTools(
      getState().machineType
    );
    if (machineTools) {
      const customDisass = machineTools.provideCustomDisassembler();
      if (customDisass) {
        disassembler.setCustomDisassembler(customDisass);
      }
    }

    // --- Now, create the disassembly
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
    this.listApi.forceRefresh(0);
  }
}

/**
 * Descriptor for the sample side bar panel
 */
export class Z80DisassemblyPanelDescriptor extends SideBarPanelDescriptorBase {
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
    return <Z80DisassemblyPanel descriptor={this} />;
  }
}

// --- The style of the list
const listStyle: CSSProperties = {
  fontFamily: "var(--console-font)",
  fontSize: "0.8em",
};
