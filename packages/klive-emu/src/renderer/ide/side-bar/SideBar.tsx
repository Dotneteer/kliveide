import * as React from "react";
import { createSizedStyledPanel } from "../../common/PanelStyles";
import SideBarPanel from "./SideBarPanel";
import { ISideBarPanel, sideBarService } from "./SideBarService";
import { SideBarState } from "../../../shared/state/AppState";
import { ideStore } from "../ideStore";
import { setSideBarStateAction } from "../../../shared/state/side-bar-reducer";

/**
 * Root panel of the side bar
 */
const Root = createSizedStyledPanel({
  splitsVertical: true,
  fitToClient: false,
  others: {
    "background-color": "var(--sidebar-background-color)",
  },
});

/**
 * Side bar component state
 */
interface State {
  panels: ISideBarPanel[];
  changeCounter: number;
}

/**
 * Represents the side bar of the IDE.
 */
export default class SideBar extends React.Component<{}, State> {
  constructor(props: {}) {
    super(props);
    this.state = {
      panels: [],
      changeCounter: 0,
    };

    // --- Save the states of the side bar panels before navigating away
    sideBarService.sideBarChanging.on(() => {
      const state: SideBarState = {};
      const panels = sideBarService.getSideBarPanels();
      for (let i = 0; i < panels.length; i++) {
        const panel = panels[i];
        state[getPanelId(panel, i)] = panel.getPanelState() ?? {};
      }
      if (sideBarService.activity) {
        const fullState = Object.assign({}, ideStore.getState().sideBar ?? {}, {
          [sideBarService.activity]: state,
        });
        ideStore.dispatch(setSideBarStateAction(fullState));
      }
    });

    // --- Set up the side bar panels with their state
    sideBarService.sideBarChanged.on(() => {
      const panels = sideBarService.getSideBarPanels();
      const sideBarState = (ideStore.getState().sideBar ?? {})[
        sideBarService.activity
      ];
      for (let i = 0; i < panels.length; i++) {
        const panel = panels[i];
        const panelState = sideBarState?.[getPanelId(panel, i)];
        if (panelState) {
          panel.setPanelState(panelState);
        }
      }
      this.setState({ panels });
    });

    // --- Helper to calculate panel ID
    function getPanelId(panel: ISideBarPanel, index: number): string {
      return `${sideBarService.activity}-${index}`;
    }
  }

  /**
   * We use the `changeCounter` field of the state to re-render the component any
   * time a panel is expanded or collapsed.
   */
  render() {
    let sideBarPanels: React.ReactNode[] = [];
    if (this.state.panels) {
      // --- Let's collect all side bar panels registered with the current activity
      // --- and calculate if they are sizable
      let prevExpanded = false;
      for (let index = 0; index < this.state.panels.length; index++) {
        const descriptor = this.state.panels[index];
        sideBarPanels.push(
          <SideBarPanel
            key={index}
            descriptor={descriptor}
            sizeable={prevExpanded && descriptor.expanded}
            visibilityChanged={() =>
              this.setState({ changeCounter: this.state.changeCounter + 1 })
            }
          />
        );
        prevExpanded = descriptor.expanded;
      }
    }
    return <Root data-initial-size={200}>{sideBarPanels}</Root>;
  }
}
