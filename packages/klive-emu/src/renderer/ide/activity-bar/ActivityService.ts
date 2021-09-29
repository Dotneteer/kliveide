import { ILiteEvent, LiteEvent } from "@shared/utils/LiteEvent";
import {
  getState,
  getStore,
} from "@abstractions/service-helpers";
import { ActivityBarState } from "@state/AppState";
import { Activity, IActivityService } from "@abstractions/activity-service";

/**
 * Provides helper functionality around the redux store to
 * manage changes of the activity bar state.
 */
export class ActivityService implements IActivityService {
  private _activities: Activity[] = [];
  private readonly _activityChanged = new LiteEvent<string | null>();
  private _lastActivityIndex: number;

  /**
   * Initialize the service instance to watch activity bar state changes
   */
  constructor() {
    this._lastActivityIndex = -1;
    getStore().activityBarChanged.on((state) => {
      // --- Keep track of changing the activity index
      const activityBarState = state as ActivityBarState;
      this._activities = activityBarState.activities;
      if (activityBarState.activeIndex !== this._lastActivityIndex) {
        this._lastActivityIndex = activityBarState.activeIndex;
        const selected = this._activities[this._lastActivityIndex];
        this._activityChanged.fire(selected ? selected.id : null);
      }
    });
  }

  /**
   * This event is fired whenever the current activity changes.
   */
  get activityChanged(): ILiteEvent<string | null> {
    return this._activityChanged;
  }
}
