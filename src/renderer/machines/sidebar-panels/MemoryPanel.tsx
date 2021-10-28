import * as React from "react";

import { SideBarPanelDescriptorBase } from "../../ide/side-bar/SideBarService";
import { SideBarProps, SideBarState } from "../../ide/SideBarPanelBase";
import { CSSProperties } from "react";
import { Z80CpuState } from "../../../extensions/cpu-z80/z80-cpu";
import { VirtualizedSideBarPanelBase } from "../../ide/VirtualizedSideBarPanelBase";
import { getEngineProxyService } from "../../ide/engine-proxy";

const TITLE = "Memory";
const BYTES_IN_LINE = 8;

/**
 * Memory panel
 */
export default class MemoryPanel extends VirtualizedSideBarPanelBase<
  SideBarProps<{}>,
  SideBarState<{}>
> {
  private _memoryContents: Uint8Array | null = null;
  private _cpu: Z80CpuState | null = null;

  width = "fit-content";
  noMacineLine2 = "to see the memory content";

  /**
   * Override to get the number of items
   */
  getItemsCount(): number {
    return 0x1_0000 / BYTES_IN_LINE;
  }

  /**
   * Renders an item of the list
   * @param index Index of the item
   * @param style Style to provide
   */
  renderItem(index: number, style: CSSProperties) {
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
    const byteItems: React.ReactNode[] = [];
    const baseAddr = index * BYTES_IN_LINE;
    let charContents = "";
    for (let i = baseAddr; i < baseAddr + BYTES_IN_LINE; i++) {
      const byte = this._memoryContents?.[i] ?? 0;
      let hasReference = false;
      let pointedBy = "";
      if (this._cpu) {
        const cpu = this._cpu;
        if (i === cpu._bc) {
          pointedBy = "BC";
          hasReference = true;
        }
        if (i === cpu._de) {
          pointedBy += (pointedBy.length > 0 ? ", " : "") + "DE";
          hasReference = true;
        }
        if (i === cpu._hl) {
          pointedBy += (pointedBy.length > 0 ? ", " : "") + "HL";
          hasReference = true;
        }
        if (i === cpu._pc) {
          pointedBy += (pointedBy.length > 0 ? ", " : "") + "PC";
          hasReference = true;
        }
        if (i === cpu._sp) {
          pointedBy += (pointedBy.length > 0 ? ", " : "") + "SP";
          hasReference = true;
        }
        if (i === cpu._ix) {
          pointedBy += (pointedBy.length > 0 ? ", " : "") + "IX";
          hasReference = true;
        }
        if (i === cpu._iy) {
          pointedBy += (pointedBy.length > 0 ? ", " : "") + "IY";
          hasReference = true;
        }
      }
      let tooltip =
        `$${i.toString(16).padStart(4, "0").toUpperCase()} (${i}): ` +
        `$${byte.toString(16).padStart(2, "0").toUpperCase()} (${byte}${
          byte >= 128 ? " / " + (byte - 256) : ""
        })` +
        (hasReference ? `\r\nPointed by: ${pointedBy}` : "");

      byteItems.push(
        <div
          style={{
            width: 22,
            color: hasReference
              ? "var(--console-ansi-bright-magenta)"
              : "var(--console-ansi-bright-cyan)",
            fontWeight: hasReference ? 600 : 100,
          }}
          key={i}
          title={tooltip}
        >
          {byte.toString(16).padStart(2, "0").toUpperCase()}
        </div>
      );

      charContents +=
        byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : ".";
    }

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
        <div
          style={{
            marginLeft: 4,
            width: 40,
            color: "var(--console-ansi-bright-blue)",
          }}
        >
          {baseAddr.toString(16).padStart(4, "0").toUpperCase()}
        </div>
        {byteItems}
        <div style={{ marginLeft: 4 }}>{charContents}</div>
      </div>
    );
  }

  /**
   * Refresh the disassembly screen
   */
  protected async onRunEvent(): Promise<void> {
    const engineProxy = getEngineProxyService();
    this._memoryContents = await engineProxy.getCachedMemoryContents();
    this._cpu = (await engineProxy.getCachedCpuState()) as Z80CpuState;
    this.listApi.forceRefresh();
  }
}

/**
 * Descriptor for the sample side bar panel
 */
export class MemoryPanelDescriptor extends SideBarPanelDescriptorBase {
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
    return <MemoryPanel descriptor={this} />;
  }
}
