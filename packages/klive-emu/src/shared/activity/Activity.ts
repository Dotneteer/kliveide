/**
 * Describes an activity in the Activity bar
 */
export interface Activity {
  /**
   * The identifier of the activity.
   */
  readonly id: string;

  /**
   * The name of the associated icon.
   */
  readonly iconName: string;

  /**
   * Signs that the activity is a system activity
   */
  readonly isSystemActivity?: boolean;
}
