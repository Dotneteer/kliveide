import { PanelRenderer } from "../abstractions";

/**
 * Describes a particular side bar panel
 */
export type SideBarPanelInfo = {
  /**
   * The ID of the panel
   */
  readonly id: string;
  /**
   * The title of the side bar panel
   */
  readonly title: string;

  /**
   * The host activity of the side bar panel
   */
  readonly hostActivity: string;

  /**
   * The function that renders the side bar panel
   */
  readonly renderer: PanelRenderer;

  /**
   * Indicates if the panel does not require a scroll viewer
   */
  readonly noScrollViewer?: boolean;

  /**
   * Is the panel expanded when initializing?
   */
  readonly expandedOnInit?: boolean;

  /**
   * The initial size of the panel
   */
  readonly initialSize?: number;
};
