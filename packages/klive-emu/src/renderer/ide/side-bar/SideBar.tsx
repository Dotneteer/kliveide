import * as React from "react";
import { createSizedStyledPanel } from "../../common/PanelStyles";
import SideBarPanel from "./SideBarPanel";
import SampleSideBarPanel from "../SampleSideBarPanel";
import { ISideBarPanel } from "./SideBarService";

const Root = createSizedStyledPanel({
  splitsVertical: true,
  fitToClient: false,
  others: {
    "background-color": "var(--sidebar-background-color)",
  },
});

interface State {
  panels: ISideBarPanel[]
}

/**
 * Represents the statusbar of the emulator
 */
export default class SideBar
  extends React.Component<{}, State>
{
  constructor(props: {}) {
    super(props);
    this.state = {
      panels: []
    }
  }

  render() {
    return (
      <Root data-initial-size={200}>
        <SideBarPanel>
          <SampleSideBarPanel id={0} color="red" />
        </SideBarPanel>
        <SideBarPanel>
          <SampleSideBarPanel id={1} color="green" />
        </SideBarPanel>
        <SideBarPanel>
          <SampleSideBarPanel id={2} color="blue" />
        </SideBarPanel>
      </Root>
    );
  }
}
