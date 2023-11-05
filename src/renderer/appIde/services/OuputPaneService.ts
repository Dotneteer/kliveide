import { IOutputBuffer } from "@appIde/ToolArea/abstractions";
import { OutputPaneBuffer } from "@appIde/ToolArea/OutputPaneBuffer";
import { outputPaneRegistry } from "@renderer/registry";
import { IOutputPaneService } from "../../abstractions/IOutputPaneService";
import { OutputPaneInfo } from "../../abstractions/OutputPaneInfo";

/**
 * This class implements the output pane services
 */
class OutputPaneService implements IOutputPaneService {
  private _buffers = new Map<string, OutputPaneBuffer>();
  getRegisteredOutputPanes (): OutputPaneInfo[] {
    return outputPaneRegistry.map(e => ({ ...e }));
  }

  getOutputPaneBuffer (id: string): IOutputBuffer {
    if (outputPaneRegistry.find(p => p.id === id)) {
      let pane = this._buffers.get(id);
      if (!pane) {
        pane = new OutputPaneBuffer();
        this._buffers.set(id, pane);
      }
      return pane;
    }
    return undefined;
  }
}

/**
 * Creates an output pane service instance
 * @param dispatch Dispatch function to use
 * @returns Output pane service instance
 */
export function createOutputPaneService () {
  return new OutputPaneService();
}
