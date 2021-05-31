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
   * Creates a node that represents the contents of a side bar panel
   */
  createContentElement(): React.ReactNode;

  /**
   * Gets the current height of the content element
   */
  getContentsHeight(): number;

  /**
   * Signs if the specified panel is expanded
   * @param expanded
   */
  expanded: boolean;
}

/**
 * Represents a service that handles side bar related communication
 */
class SideBarService {
  private readonly _panels = new Map<string, ISideBarPanel[]>();
  private readonly _sideBarChanged = new LiteEvent<void>();
  private _activity: string | null = null;

  constructor() {
    this.reset();
    activityService.activityChanged.on((activity) => {
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
   * This event is fired whenever the current activity changes.
   */
  get sideBarChanged(): ILiteEvent<void> {
    return this._sideBarChanged;
  }
}

/**
 * The singleton instance of the service
 */
export const sideBarService = new SideBarService();
