import * as React from "react";
import { connect } from "react-redux";
import { AppState } from "../../shared/state/AppState";
import { ISideBarPanel, ISideBarPanelHost } from "../abstraction/side-bar";
import { createSizedStyledPanel } from "../common/PanelStyles";
import SideBarPanel from "./SideBarPanel";
import SampleSideBarPanel from "./SampleSideBarPanel";

const Root = createSizedStyledPanel({
  splitsVertical: true,
  fitToClient: false,
  others: {
    "background-color": "var(--sidebar-background-color)",
  },
});

interface Props {}

interface State {}

type SideBarPanelMap = Map<string, ISideBarPanel>;

/**
 * Represents the statusbar of the emulator
 */
class SideBar
  extends React.Component<Props, State>
  implements ISideBarPanelHost
{
  private _panels: ISideBarPanel[] = [];

  constructor(props: Props) {
    super(props);
    this.state = {
      activeIndex: -1,
      pointedIndex: -1,
    };
  }

  render() {
    return (
      <Root data-initial-size={200}>
        <SideBarPanel>
          <SampleSideBarPanel id={0} host={this} color="red" />
        </SideBarPanel>
        <SideBarPanel>
          <SampleSideBarPanel id={1} host={this} color="green" />
        </SideBarPanel>
        <SideBarPanel>
          <SampleSideBarPanel id={2} host={this} color="blue" />
        </SideBarPanel>
      </Root>
    );
  }

  // --------------------------------------------------------------------------
  // ISideBarPanelHost implementation
  // --------------------------------------------------------------------------

  /**
   * Registers the header of a side bar panel
   * @param id
   */
  registerHeader(id: number): void {}

  /**
   * Signs that a child panel is available for the host
   * @param id Child identifier
   * @param panel The panel interface
   */
  registerPanel(id: number, panel: ISideBarPanel): void {
    if (!this._panels[id]) {
      this._panels[id] = panel;
    }
  }

  /**
   * Signs that a child panel in not available any more for the host
   * @param id Child identifier
   */
  unregisterPanel(id: number): void {
    delete this._panels[id];
  }
}

export default connect((state: AppState) => {
  return {};
}, null)(SideBar);
