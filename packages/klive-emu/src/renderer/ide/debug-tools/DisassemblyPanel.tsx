import * as React from "react";
import { SideBarPanelDescriptorBase } from "../side-bar/SideBarService";
import { SideBarPanelBase, SideBarProps } from "../SideBarPanelBase";
import VirtualizedList, {
  VirtualizedListApi,
} from "../../common/VirtualizedList";
import { CSSProperties } from "styled-components";
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
        text: `Item # ${i}`,
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
              style={style}
              onClick={() => {
                this._data.push({
                  text: `Item # ${this._data.length}`,
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
