import { PanelRenderer } from "./PanelRenderer";

/**
 * Represents the information about a tool and its renderer
 */
export type DocumentRendererInfo = {
  /**
   * The ID of the document renderer
   */
  id: string;

  /**
   * Renderer function to display the tool
   */
  renderer: PanelRenderer;

  /**
   * The accompanying icon
   */
  icon?: string;

  /**
   * The icon's fill color
   */
  iconFill?: string;
};
