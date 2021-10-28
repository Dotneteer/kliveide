import { ILiteEvent } from "@core/utils/lite-event";
import { AppState } from "@core/state/AppState";

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
   * Signs if the panel is focused
   */
  focused: boolean;

  /**
   * The current height of the panel. Set when the rendering engine
   * updates the related DOM element
   */
  height: number;

  /**
   * The current percentage height of the panel. Set when the panel
   * is resized.
   */
  heightPercentage: number;

  /**
   * Creates a node that represents the contents of a side bar panel
   */
  createContentElement(): React.ReactNode;

  /**
   * Gets the state of the side bar to save
   */
  getPanelState(): Record<string, any>;

  /**
   * Sets the state of the side bar
   * @param state Optional state to set
   * @param fireImmediate Fire a panelStateLoaded event immediately?
   */
  setPanelState(state: Record<string, any> | null): void;

  /**
   * Respond to state changes
   * @param state
   */
  onStateChange(state: AppState): Promise<void>;

  /**
   * Should update the panel header?
   */
  shouldUpdatePanelHeader(): Promise<boolean>;
}

/**
 * Defines the interface of the service handling the side bar
 */
export interface ISideBarService {
  /**
   * Removes every registered panel
   */
  reset(): void;

  /**
   * Gets the current activity ID
   */
  readonly activity: string | null;

  /**
   * Registers a side bar panel for a particular activity.
   * @param activityPaneId ID of the activity
   * @param panel Panel to register
   */
  registerSideBarPanel(
    activityPaneId: string,
    panel: ISideBarPanel,
    machines?: string[]
  ): void;

  /**
   * Gets the current set of side bar panels
   * @returns
   */
  getSideBarPanels(): ISideBarPanel[];

  /**
   * Refreshes side bar panels
   */
  refreshSideBarPanels(): void;

  /**
   * This event is fired whenever the current activity is about to change.
   */
  readonly sideBarChanging: ILiteEvent<void>;

  /**
   * This event is fired whenever the current activity has changed.
   */
  readonly sideBarChanged: ILiteEvent<void>;

  /**
   * Moves the specified panel up
   * @param index Panel index
   */
  moveUp(index: number): void;

  /**
   * Moves the specified panel up
   * @param index Panel index
   */
  moveDown(index: number): void;
}
