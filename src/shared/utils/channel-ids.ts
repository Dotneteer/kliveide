/**
 * The name of the IPC channel we use when forward main process
 * actions to the renderer process.
 */
export const REDUX_ACTION_CHANNEL = "redux-action";

/**
 * The main process uses this channel to send messages to a renderer process
 */
export const MAIN_MESSAGING_CHANNEL = "main-messages";

/**
 * A renderer process uses this channel to send messages to the main process
 */
export const RENDERER_MESSAGING_CHANNEL = "renderer-messages";