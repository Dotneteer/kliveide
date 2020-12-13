/**
 * The name of the IPC channel we use when forward main process
 * actions to the renderer process.
 */
export const REDUX_ACTION_CHANNEL = "redux-action";

/**
 * The main process uses this channel to send request to a renderer process
 */
export const MAIN_REQUEST_CHANNEL = "main-request";

/**
 * The main process uses this channel to send responses to a renderer process
 */
export const MAIN_RESPONSE_CHANNEL = "main-response";

/**
 * A renderer process uses this channel to send requests to the main process
 */
export const RENDERER_REQUEST_CHANNEL = "renderer-request";

/**
 * A renderer process uses this channel to send responses to the main process
 */
export const RENDERER_RESPONSE_CHANNEL = "renderer-response";