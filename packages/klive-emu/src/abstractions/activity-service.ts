import { MenuItem } from "@shared/command/commands";
import { ILiteEvent } from "@shared/utils/LiteEvent";

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
