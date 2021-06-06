import * as React from "react";
import { ILiteEvent, LiteEvent } from "../../../shared/utils/LiteEvent";
import { activityService } from "../activity-bar/ActivityService";

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
   * Current height percentage of the panel
   */
  heightPercentage: number;

  /**
   * Creates a node that represents the contents of a side bar panel
   */
  createContentElement(): React.ReactNode;

  /**
   * Gets the current height of the content element
   */
  getContentsHeight(): number;

  /**
   * Gets the state of the side bar to save
   */
  getPanelState(): Record<string, any>;

  /**
   * Sets the state of the side bar
   * @param state Optional state to set
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
  constructor(public readonly title: string) {
    this.heightPercentage = 100;
  }

  /**
   * Signs if the specified panel is expanded
   * @param expanded
   */
  expanded: boolean = false;

  /**
   * Current height percentage of the panel
   */
  heightPercentage: number;

  /**
   * Creates a node that represents the contents of a side bar panel
   */
  abstract createContentElement(): React.ReactNode;

  /**
   * Gets the current height of the content element
   */
  getContentsHeight(): number {
    return 0;
  }

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
  setPanelState(state: Record<string, any> | null): void {
    if (state) {
      this._panelState = { ...this._panelState, ...state };
    }
  }
}

/**
 * Represents a service that handles side bar related communication
 */
class SideBarService {
  private readonly _panels = new Map<string, ISideBarPanel[]>();
  private readonly _sideBarChanging = new LiteEvent<void>();
  private readonly _sideBarChanged = new LiteEvent<void>();
  private _activity: string | null = null;

  constructor() {
    this.reset();
    activityService.activityChanged.on((activity) => {
      this._sideBarChanging.fire();
      this._activity = activity;
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
