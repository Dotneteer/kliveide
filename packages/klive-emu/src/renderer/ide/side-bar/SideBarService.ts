import * as React from "react";
import { setSideBarStateAction } from "../../../shared/state/side-bar-reducer";
import { SideBarState } from "../../../shared/state/AppState";
import { ILiteEvent, LiteEvent } from "../../../shared/utils/LiteEvent";
import { activityService } from "../activity-bar/ActivityService";
import { ideStore } from "../ideStore";

/**
 * Represents an abstract side bar panel
 */
export interface ISideBarPanel {
  /**
   * The title of the side bar panel
   */
  readonly title: string;

  /**
   * Signs if the specified panel is expanded
   * @param expanded
   */
  expanded: boolean;

  /**
   * The current height of the panel. Set when the rendering engine
   * updates the related DOM element
   */
  height: number;

  /**
   * The current percentage height of the panel. Set when the panel
   * is resized.
   */
  heightPercentage: number;

  /**
   * Creates a node that represents the contents of a side bar panel
   */
  createContentElement(): React.ReactNode;

  /**
   * Gets the state of the side bar to save
   */
  getPanelState(): Record<string, any>;

  /**
   * Sets the state of the side bar
   * @param state Optional state to set
   * @param fireImmediate Fire a panelStateLoaded event immediately?
   */
  setPanelState(state: Record<string, any> | null): void;
}

/**
 * The base class for all side bar panel descriptors
 */
export abstract class SideBarPanelDescriptorBase implements ISideBarPanel {
  private _panelState: Record<string, any> = {};

  /**
   * Instantiates the panel with the specified title
   * @param title
   */
  constructor(public readonly title: string) {}

  /**
   * Signs if the specified panel is expanded
   * @param expanded
   */
  expanded: boolean = false;

  /**
   * The current height of the panel
   */
  height: number = -1;

  /**
   * The current percentage height of the panel. Set when the panel
   * is resized.
   */
  heightPercentage = 100;

  /**
   * Creates a node that represents the contents of a side bar panel
   */
  abstract createContentElement(): React.ReactNode;

  /**
   * Gets the state of the side bar to save
   */
  getPanelState(): Record<string, any> {
    return this._panelState;
  }

  /**
   * Sets the state of the side bar panel
   * @param state Optional state to set
   */
  setPanelState(
    state: Record<string, any> | null
  ): void {
    if (state) {
      this._panelState = { ...this._panelState, ...state };
    }
  }
}

/**
 * Represents a service that handles side bar panels
 */
class SideBarService {
  private readonly _panels = new Map<string, ISideBarPanel[]>();
  private readonly _sideBarChanging = new LiteEvent<void>();
  private readonly _sideBarChanged = new LiteEvent<void>();
  private _activity: string | null = null;

  constructor() {
    this.reset();
    activityService.activityChanged.on((activity) => {
      // --- Save the state of the panels
      const state: SideBarState = {};
      let panels = this.getSideBarPanels();
      for (let i = 0; i < panels.length; i++) {
        const panel = panels[i];
        state[`${this.activity}-${i}`] = panel.getPanelState() ?? {};
      }
      if (this.activity) {
        const fullState = Object.assign({}, ideStore.getState().sideBar ?? {}, {
          [this.activity]: state,
        });
        ideStore.dispatch(setSideBarStateAction(fullState));
      }

      // --- Invoke custom action
      this._sideBarChanging.fire();

      // --- Set the new activity
      this._activity = activity;

      // --- Restore the panel state
      panels = this.getSideBarPanels();
      const sideBarState = (ideStore.getState().sideBar ?? {})[this.activity];
      for (let i = 0; i < panels.length; i++) {
        const panel = panels[i];
        const panelState = sideBarState?.[`${this.activity}-${i}`];
        if (panelState) {
          panel.setPanelState(panelState);
        }
      }

      // --- Invoke custom action
      this._sideBarChanged.fire();
    });
  }

  /**
   * Removes every registered panel
   */
  reset(): void {
    this._panels.clear();
  }

  /**
   * Gets the current activity ID
   */
  get activity(): string | null {
    return this._activity;
  }

  /**
   * Registers a side bar panel for a particular activity.
   * @param activityPaneId ID of the activity
   * @param panel Panel to register
   */
  registerSideBarPanel(activityPaneId: string, panel: ISideBarPanel): void {
    let panelList = this._panels.get(activityPaneId);
    if (panelList) {
      panelList.push(panel);
    } else {
      this._panels.set(activityPaneId, [panel]);
    }
  }

  /**
   * Gets the current set of side bar panels
   * @returns
   */
  getSideBarPanels(): ISideBarPanel[] {
    return this._panels.get(this._activity) ?? [];
  }

  /**
   * Refreshes side bar panels
   */
  refreshSideBarPanels(): void {
    this._sideBarChanged.fire();
  }

  /**
   * This event is fired whenever the current activity is about to change.
   */
  get sideBarChanging(): ILiteEvent<void> {
    return this._sideBarChanging;
  }

  /**
   * This event is fired whenever the current activity has changed.
   */
  get sideBarChanged(): ILiteEvent<void> {
    return this._sideBarChanged;
  }
}

/**
 * The singleton instance of the service
 */
export const sideBarService = new SideBarService();
