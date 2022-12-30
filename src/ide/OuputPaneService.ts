import { IOutputBuffer } from "@/controls/ToolArea/abstractions";
import { OutputPaneBuffer } from "@/controls/ToolArea/OutputPaneBuffer";
import { outputPaneRegistry } from "@/registry";
import { IOutputPaneService, OutputPaneInfo } from "./abstractions";

/**
 * This class implements the output pane services
 */
class OutputPaneService implements IOutputPaneService {
    private _buffers= new Map<string,OutputPaneBuffer>();
    getRegisteredOutputPanes(): OutputPaneInfo[] {
        return outputPaneRegistry.map(e => ({...e}));
    }
    
    getOutputPaneBuffer(id: string): IOutputBuffer {
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
export function createOutputPaneService() {
    return new OutputPaneService();
};
