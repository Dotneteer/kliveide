import { IOutputBuffer } from "@appIde/ToolArea/abstractions";
import { OutputPaneInfo } from "./OutputPaneInfo";

/**
 * This interface defines the functions managing the output panes within the IDE
 */
export interface IOutputPaneService {
  /**
   * Retrieve the registered output panes
   */
  getRegisteredOutputPanes(): OutputPaneInfo[];

  /**
   * Gets an output buffer for the specified pane
   * @param id ID of the output pane
   */
  getOutputPaneBuffer(id: string): IOutputBuffer;
}
