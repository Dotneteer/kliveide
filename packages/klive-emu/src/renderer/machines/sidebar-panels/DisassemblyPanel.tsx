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
import { MemorySection } from "../../../shared/z80/disassembler/disassembly-helper";

const TITLE = "Z80 Disassembly";

type State = {
  itemCount: number;
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
    return (
      <VirtualizedList
        itemHeight={18}
        numItems={this.state.itemCount}
        renderItem={(index: number, style: CSSProperties) => {
          return (
            <div
              key={index}
              style={{ ...style }}
              onClick={() => {
                this._data.push({
                  text: `Disassembly Item # ${this._data.length}`,
                  id: this._data.length.toString(),
                });
                this.setState({ itemCount: this._data.length });
                this._listApi?.scrollToEnd();
              }}
            >
              {this._data[index].text}
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
      [new MemorySection(pcValue, pcValue + 255)],
      new Uint8Array()
    );
    console.log(pcValue, memory.length);
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
