import * as React from "react";
import VirtualizedList, {
  VirtualizedListApi,
} from "../../common-ui/VirtualizedList";
import { CSSProperties } from "styled-components";
import { SideBarPanelBase, SideBarProps } from "../../ide/SideBarPanelBase";
import { SideBarPanelDescriptorBase } from "../../ide/side-bar/SideBarService";
import { engineProxy } from "../../ide/engine-proxy";
import { Z80CpuState } from "../../cpu/Z80Cpu";
import { Z80Disassembler } from "../../../shared/z80/disassembler/z80-disassembler";
import {
  DisassemblyOutput,
  MemorySection,
} from "../../../shared/z80/disassembler/disassembly-helper";

const TITLE = "Z80 Disassembly";
const DISASS_LENGTH = 256;

type State = {
  itemCount: number;
  output?: DisassemblyOutput;
};

/**
 * Z80 disassembly panel
 */
export default class Z80DisassemblyPanel extends SideBarPanelBase<
  SideBarProps<{}>,
  State
> {
  private _data: { text: string; id: string }[] = [];
  private _listApi: VirtualizedListApi;

  title = TITLE;

  width = "fit-content";

  constructor(props: SideBarProps<{}>) {
    super(props);
    for (let i = 0; i < 1000; i++) {
      this._data.push({
        text: `Disassembly Item # ${i}`,
        id: i.toString(),
      });
    }
    this.state = {
      itemCount: this._data.length,
    };
  }

  render() {
    const items = this.state.output?.outputItems ?? [];
    const numItems = this.state.output
      ? this.state.output.outputItems.length
      : 0;
    return (
      <VirtualizedList
        itemHeight={18}
        numItems={numItems}
        renderItem={(index: number, style: CSSProperties) => {
          return (
            <div key={index} style={{ ...style }}>
              {items[index].instruction}
            </div>
          );
        }}
        registerApi={(api) => (this._listApi = api)}
      />
    );
  }

  /**
   * Respond to a run event
   * @param execState Execution state
   */
  protected async onRunEvent(
    execState: number,
    isDebug: boolean,
    eventCount: number
  ): Promise<void> {
    const cpuState = (await engineProxy.getCpuState()) as Z80CpuState;
    const memory = await engineProxy.getMemoryContents();
    const pcValue = cpuState._pc;
    const disassembler = new Z80Disassembler(
      [new MemorySection(pcValue, pcValue + DISASS_LENGTH)],
      memory
    );
    const disassemblyOutput = await disassembler.disassemble(
      pcValue,
      pcValue + DISASS_LENGTH
    );
    this.setState({
      output: disassemblyOutput,
    });
    this._listApi.forceRefresh(0);
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
