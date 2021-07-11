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

// --- Channels used for main to IDE communication
export const MAIN_TO_IDE_REQUEST_CHANNEL = "MainToIdeRequest";
export const MAIN_TO_IDE_RESPONE_CHANNEL = "MainToIdeResponse";

// --- Channels used for emulator to main communication
export const EMU_TO_MAIN_REQUEST_CHANNEL = "EmuToMainRequest";
export const EMU_TO_MAIN_RESPONSE_CHANNEL = "EmuToMainResponse";

// --- Channels used for ide to emulator communication
export const IDE_TO_EMU_MAIN_REQUEST_CHANNEL = "IdeToEmuMainRequest";
export const IDE_TO_EMU_MAIN_RESPONSE_CHANNEL = "IdeToEmuMainResponse";
export const IDE_TO_EMU_EMU_REQUEST_CHANNEL = "IdeToEmuEmuRequest";
export const IDE_TO_EMU_EMU_RESPONSE_CHANNEL = "IdeToEmuEmuResponse";
