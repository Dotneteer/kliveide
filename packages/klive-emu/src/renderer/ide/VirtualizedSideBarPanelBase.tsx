import * as React from "react";
import { ISideBarPanel } from "@abstractions/side-bar-service";
import { CSSProperties } from "styled-components";
import VirtualizedList, {
  VirtualizedListApi,
} from "../../emu-ide/components/VirtualizedList";
import {
  SideBarPanelBase,
  SideBarProps,
  SideBarState,
} from "./SideBarPanelBase";

/**
 * Base class for side bar panel implementations
 */
export abstract class VirtualizedSideBarPanelBase<
  P = { descriptor: ISideBarPanel },
  S = {}
> extends SideBarPanelBase<SideBarProps<P>, SideBarState<S>> {
  /**
   * The API of the virtual list
   */
  protected listApi: VirtualizedListApi;

  /**
   * Override to get the number of items
   */
  abstract getItemsCount(): number;

  /**
   * Renders an item in the list
   * @param index Item index
   * @param style Item style to apply
   */
  abstract renderItem(index: number, style: CSSProperties): JSX.Element;

  /**
   * Renders the panel with a virtualized list
   */
  renderPanel() {
    return (
      <VirtualizedList
        itemHeight={18}
        numItems={this.getItemsCount()}
        style={listStyle}
        renderItem={(index: number, style: CSSProperties) =>
          this.renderItem(index, style)
        }
        onFocus={() => {
          this.signFocus(true);
          this.listApi.forceRefresh();
        }}
        onBlur={() => {
          this.signFocus(false);
          this.listApi.forceRefresh();
        }}
        handleKeys={(e) => this.handleKeys(e)}
        registerApi={(api) => (this.listApi = api)}
      />
    );
  }

  /**
   * Signs if this panel is in focused/blurred state
   * @param focused Is the panel focused?
   */
  protected signFocus(focused: boolean): void {
    this.props.descriptor.focused = focused;
    this.setState({ focused: focused as any });
  }

  /**
   * Respond to a run event
   * @param execState Execution state
   */
  protected async onRunEvent(
    _execState: number,
    _isDebug: boolean,
    _eventCount: number
  ): Promise<void> {
    // --- Define this in overridden components
  }

  /**
   * Allow moving in the project explorer with keys
   */
  handleKeys(e: React.KeyboardEvent): void {
    let newIndex = -1;
    const numItems = this.getItemsCount();
    const { startIndex, endIndex } = this.listApi.getViewPort();
    console.log(startIndex, endIndex);
    const viewportItems = startIndex >= 0 ? endIndex - startIndex : 10;
    switch (e.code) {
      case "ArrowUp":
        newIndex = this.state.selectedIndex - 1;
        break;

      case "ArrowDown": {
        newIndex = this.state.selectedIndex + 1;
        break;
      }

      case "PageUp":
        newIndex =
          this.state.selectedIndex - viewportItems * (e.ctrlKey ? 5 : 1);
        break;

      case "PageDown":
        newIndex =
          this.state.selectedIndex + viewportItems * (e.ctrlKey ? 5 : 1);
        break;

      case "ArrowDown": {
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
    if (newIndex < 0) {
      newIndex = 0;
    } else if (newIndex > numItems - 1) {
      newIndex = numItems - 1;
    }
    if (newIndex >= 0) {
      this.listApi.ensureVisible(newIndex);
      this.setState({
        selectedIndex: newIndex as any,
      });
      this.listApi.forceRefresh();
    }
  }
}

// --- The style of the list
const listStyle: CSSProperties = {
  fontFamily: "var(--console-font)",
  fontSize: "0.8em",
};
