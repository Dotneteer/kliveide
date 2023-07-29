import { ToolInfo } from "@renderer/abstractions/ToolInfo";
import { PanelRenderer } from "./PanelRenderer";

/**
 * Represents the information about a tool and its renderer
 */
export type ToolRendererInfo = ToolInfo & {
  /**
   * Renderer function to display the tool
   */
  renderer: PanelRenderer;

  /**
   * Renderer function to display the tool's header
   */
  headerRenderer?: PanelRenderer;
};
