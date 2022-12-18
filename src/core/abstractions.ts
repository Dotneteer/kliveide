import { ReactNode } from "react";

export const ACTIVITY_FILE_ID = "file-view";
export const ACTIVITY_DEBUG_ID = "debug-view";
export const ACTIVITY_LOG_ID = "log-view";
export const ACTIVITY_TEST_ID = "test-view";

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
  };

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
    readonly renderer: PanelRenderer

    /**
     * Is the panel expanded when initializing?
     */
    readonly expandedOnInit?: boolean;

    /**
     * The initial size of the panel
     */
    readonly initialSize?: number;

}

/**
 * The application context in which panels can be rendered
 */
export type AppContext = {

}

/**
 * Represents a function that can render a particular panel
 */
export type PanelRenderer = (appContext: AppContext) => ReactNode
