import * as React from "react";
import { SideBarPanelDescriptorBase } from "../side-bar/SideBarService";
import { SideBarPanelBase, SideBarProps } from "../SideBarPanelBase";
import VirtualizedList from "../../common/VirtualizedList";
import { CSSProperties } from "styled-components";
const TITLE = "Z80 Disassembly";

/**
 * Z80 disassembly panel
 */
export default class Z80DisassemblyPanel extends SideBarPanelBase<
  SideBarProps<{}>
> {
  private _data: { text: string; id: string;}[] = [];

  title = TITLE;

  width = "100%";

  constructor(props: SideBarProps<{}>) {
    super(props);
    for (let i = 0; i < 1000; i++) {
      this._data.push({
        text: `Item # ${i}`,
        id: i.toString(),
      });
    }
  }

  render() {
    return (
      <VirtualizedList itemHeight={18} numItems={this._data.length} renderItem={(index: number, style: CSSProperties) => {
        return <div key={index} style={style}>{this._data[index].text}</div>
      }} />
    );
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
