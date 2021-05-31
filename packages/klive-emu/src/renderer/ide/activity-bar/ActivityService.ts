import {
  changeActivityAction,
  pointActivityAction,
} from "../../../shared/state/activity-bar-reducer";
import { Activity } from "../../../shared/activity/Activity";
import { ILiteEvent, LiteEvent } from "../../../shared/utils/LiteEvent";
import { ideStore } from "../ideStore";
import { StateAwareObject } from "../../../shared/state/StateAwareObject";
import { ActivityBarState } from "../../../shared/state/AppState";

/**
 * This class provides services for the activity bar
 */
class ActivityService {
  private _activities: Activity[] = [];
  private readonly _activityChanged = new LiteEvent<string | null>();
  private _lastActivityIndex: number;

  constructor() {
    this._lastActivityIndex = -1;
    const stateAware = new StateAwareObject(ideStore, "activityBar");
    stateAware.stateChanged.on((state) => {
      // --- Keep trach of changing the activity index
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

  selectActivity(index: number): void {
    ideStore.dispatch(changeActivityAction(index));
  }

  pointActivity(index: number): void {
    ideStore.dispatch(pointActivityAction(index));
  }
}

/**
 * The singleton instance of the service
 */
export const activityService = new ActivityService();
