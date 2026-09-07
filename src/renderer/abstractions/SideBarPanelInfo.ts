import type { PanelRenderer } from "./PanelRenderer";

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
   * Whether the panel's content should be wrapped in a `ScrollViewer`. Defaults to `true`.
   *
   * Set this to `false` for panels that scroll themselves — anything rendering a
   * `VirtualizedList`, which supplies its own `ScrollViewer`. Nesting one inside another leaves
   * the virtualizer without a bounded viewport to measure against.
   *
   * Previously named `noScrollViewer`, whose sense was inverted: `noScrollViewer: false`
   * *suppressed* the viewer. The behaviour is unchanged; only the name now matches it.
   */
  readonly useScrollViewer?: boolean;

  /**
   * Is the panel expanded when initializing?
   */
  readonly expandedOnInit?: boolean;

  /**
   * The initial size of the panel
   */
  readonly initialSize?: number;

  /**
   * The machine IDs this panel is restricted to
   */
  readonly restrictTo?: string[];

  /**
   * The features required for this panel
   */
  readonly requireFeature?: string[];

  /**
   * The configuration values required for this panel
   */
  readonly requireConfig?: string[];
};
