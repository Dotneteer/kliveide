// ============================================================================
// Klive uses three processes:
//
// Main: The main Node.js process that accesses host machine resources
// Emu: The renderer (browser) process for the emulator
// Ide: The renderer (browser) process for the IDE
//
// Most extensibility constructs (e.g., commands) may behave differently
// according to their host process.
//
// The helper methods here allow to set and query the current Klive process so
// that the code can use this information.
// ============================================================================

import { KliveProcess } from "@core/abstractions/command-def";

// ----------------------------------------------------------------------------
// Site management methods

// --- Stores the current Klive site
let kliveSite: KliveProcess;

/**
 * Registers the current Klive process to belong to the specified
 * Klive process
 * @param site Klive site the current process belongs to
 */
export function registerSite(site: KliveProcess): void {
  kliveSite = site;
}

/**
 * Retrieves the current site
 * @returns 
 */
export function getSite(): KliveProcess {
  return kliveSite;
}
