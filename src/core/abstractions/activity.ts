import { MenuItem } from "./command-definitions";

// --- Predefined activity IDs
export const ACTIVITY_FILE_ID = "file-view";
export const ACTIVITY_DEBUG_ID = "debug-view";
export const ACTIVITY_LOG_ID = "log-view";
export const ACTIVITY_TEST_ID = "test-view";
export const ACTIVITY_SETTINGS_ID = "settings";

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
};
