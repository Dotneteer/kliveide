import type { DocumentNavigationAdapter } from "./DocumentNavigationAdapter";
import type { PanelRenderer } from "./PanelRenderer";

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

  /**
   * Open the editor in permanent mode
   */
  openPermanent?: boolean;

  /**
   * How documents of this type take part in the navigation history (Go Back / Go Forward). Omit it
   * and the type never becomes a history entry.
   */
  navigation?: DocumentNavigationAdapter;
};
