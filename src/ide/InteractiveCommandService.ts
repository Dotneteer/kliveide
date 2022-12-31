import { IOutputBuffer } from "@/controls/ToolArea/abstractions";
import { OutputPaneBuffer } from "@/controls/ToolArea/OutputPaneBuffer";
import { AppState } from "@state/AppState";
import { Store } from "@state/redux-light";
import { IInteractiveCommandService } from "./abstractions";

class InteractiveCommandService implements IInteractiveCommandService {
    private _buffer = new OutputPaneBuffer()
    constructor(private readonly store: Store<AppState>) {
    }
    
    /**
     * Gets the output buffer of the interactive commands
     */
    getBuffer(): IOutputBuffer {
        return this._buffer;
    }
}

/**
 * Creates an interactive commands service instance
 * @param dispatch Dispatch function to use
 * @returns Interactive commands service instance
 */
export function createInteractiveCommandsService(store: Store<AppState>) {
    return new InteractiveCommandService(store);
};