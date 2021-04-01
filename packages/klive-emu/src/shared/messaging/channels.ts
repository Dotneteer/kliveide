// ============================================================================
// Communication channel identifiers

// --- Channels used for application state communication
export const MAIN_STATE_REQUEST_CHANNEL = "MainStateRequest";
export const RENDERER_STATE_RESPONSE_CHANNEL = "RendererStateResponse";
export const RENDERER_STATE_REQUEST_CHANNEL = "RendererStateRequest";
export const MAIN_STATE_RESPONSE_CHANNEL = "MainStateResponse";

// --- Source identifiers of application state messages
export const EMU_SOURCE = "EmuSource";
export const IDE_SOURCE = "IdeSource";
export const MAIN_SOURCE = "MainSource";

// --- Channels used for main to emulator communication
export const MAIN_TO_EMU_REQUEST_CHANNEL = "MainToEmuRequest";
export const MAIN_TO_EMU_RESPONE_CHANNEL = "MainToEmuResponse";
