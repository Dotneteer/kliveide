import type { ToolInfo } from "@renderer/abstractions/ToolInfo";
import type { PanelRenderer } from "./PanelRenderer";

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
