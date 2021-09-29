import { MenuItem } from "@shared/command/commands";
import { ILiteEvent } from "@shared/utils/LiteEvent";

/**
 * IActivityService provides helper functionality around the redux store to
 * manage changes of the activity bar state.
 */
export interface IActivityService {
  /**
   * Raised when the current activity has been changed
   */
  readonly activityChanged: ILiteEvent<string | null>;
}

/**
 * Describes an activity in the Activity bar
 */
 export type Activity = {
  /**
   * The identifier of the activity.
   */
  readonly id: string;

  /**
   * Activity title
   */
  readonly title: string;

  /**
   * The name of the associated icon.
   */
  readonly iconName: string;

  /**
   * Signs that the activity is a system activity
   */
  readonly isSystemActivity?: boolean;

  /**
   * Optional menu commands of the activity
   */
  readonly commands?: MenuItem[];
}
