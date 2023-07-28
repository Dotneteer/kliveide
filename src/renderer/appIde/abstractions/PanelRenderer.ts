import { ReactElement } from "react";

/**
 * Represents a function that can render a particular panel
 */
export type PanelRenderer = (...props: any[]) => ReactElement;
