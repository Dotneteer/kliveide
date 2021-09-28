import { Activity } from "../activity/Activity";
import { ILiteEvent } from "../utils/LiteEvent";

/**
 * Defines the interface handling th activity bar
 */
export interface IActivityService {
  /**
   * Raised when the current activity has been changed
   */
  readonly activityChanged: ILiteEvent<string | null>;

  /**
   * Gets the curent activity
   */
  readonly activeActivity: Activity | null;

  /**
   * Selects the specified activity
   * @param index Index of activity to select
   */
  selectActivity(index: number): void;

  /**
   * Marks the specified activity as the pointed one
   * @param index Pointed activity index
   */
  pointActivity(index: number): void;
}
