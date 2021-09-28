import {
  changeActivityAction,
  pointActivityAction,
} from "../../../shared/state/activity-bar-reducer";
import { Activity } from "../../../shared/activity/Activity";
import { ILiteEvent, LiteEvent } from "../../../shared/utils/LiteEvent";
import {
  dispatch,
  getState,
  getStore,
} from "../../../shared/services/store-helpers";
import { ActivityBarState } from "../../../shared/state/AppState";
import { IActivityService } from "../../../shared/services/IActivityService";

/**
 * This class provides services for the activity bar
 */
export class ActivityService implements IActivityService {
  private _activities: Activity[] = [];
  private readonly _activityChanged = new LiteEvent<string | null>();
  private _lastActivityIndex: number;

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

  /**
   * Gets the curent activity
   */
  get activeActivity(): Activity | null {
    const currentActivity = getState().activityBar?.activeIndex ?? -1;
    if (!this._activities || currentActivity < 0) {
      return null;
    }
    return this._activities[currentActivity] ?? null;
  }

  /**
   * Selects the specified activity
   * @param index Index of activity to select
   */
  selectActivity(index: number): void {
    dispatch(changeActivityAction(index));
  }

  /**
   * Marks the specified activity as the pointed one
   * @param index Pointed activity index
   */
  pointActivity(index: number): void {
    dispatch(pointActivityAction(index));
  }
}
