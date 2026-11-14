// ====================================================================================================================
// The one `FloatingWindowManager` of the app (`dev/plans/FLOATING_DOCUMENT_WINDOWS_PLAN.md` §3.6).
//
// `src/main/index.ts` configures it with what only it knows (the preload script, the renderer URL,
// the IDE window); the message processor and the menus use it through the functions below.
// ====================================================================================================================

import { floatSourceOf, type FloatSlot, type MessageSource } from "@messaging/messages-core";
import type { IdeApi } from "@messaging/IdeApi";
import { findFloatingSlot } from "@messaging/floating-documents";
import { getIdeApi } from "@messaging/MainToIdeMessenger";
import {
  getFloatApi,
  getFloatApis,
  registerMainToFloatMessenger,
  unregisterMainToFloatMessenger
} from "@messaging/MainToFloatMessenger";
import { ideFocusedAction } from "@state/actions";
import { mainStore } from "./main-store";
import {
  FloatingWindowManager,
  type FloatingWindowDeps
} from "./floating-windows";

let manager: FloatingWindowManager | undefined;

/**
 * Creates the app's floating window manager
 * @param deps What `index.ts` provides: window creation, default bounds, showing the IDE
 */
export function initFloatingWindows(
  deps: Pick<FloatingWindowDeps, "createWindow" | "defaultBounds" | "showIdeWindow">
): FloatingWindowManager {
  manager = new FloatingWindowManager({
    ...deps,
    getState: () => mainStore.getState(),
    dispatch: (action) => mainStore.dispatch(action, "main"),
    registerMessenger: (slot, window) => registerMainToFloatMessenger(slot, window),
    unregisterMessenger: (slot) => unregisterMainToFloatMessenger(slot),
    getFloatApi: (slot) => getFloatApi(slot),
    getIdeApi: () => getIdeApi(),
    // --- A focused floating window counts as the IDE for the menus (plan §3.6)
    focusChanged: (focused) => mainStore.dispatch(ideFocusedAction(focused), "main")
  });
  return manager;
}

/**
 * The app's floating window manager (undefined before the windows exist)
 */
export function getFloatingWindows(): FloatingWindowManager | undefined {
  return manager;
}

/**
 * Flushes every floating window's saves; true when there is nothing to stop a quit or a project
 * switch (plan §3.3, the fan-out class)
 */
export async function saveAllFloatingBeforeQuit(): Promise<boolean> {
  return manager ? await manager.saveAllBeforeQuit() : true;
}

/**
 * Flushes the saves of every IDE renderer: the floating windows first, then the IDE
 */
export async function saveAllIdeRenderersBeforeQuit(): Promise<boolean> {
  // --- Without floating windows, straight to the IDE, as before they existed
  if (manager && manager.count > 0) {
    const floatsSaved = await saveAllFloatingBeforeQuit();
    if (!floatsSaved) return false;
  }
  return (await getIdeApi()?.saveAllBeforeQuit()) ?? true;
}

/**
 * Whether a floating window has the focus
 */
export function isFloatingWindowFocused(): boolean {
  return manager?.hasFocus() ?? false;
}

/**
 * The slot of a renderer's floating window, for the message processor
 */
export function isOpenFloatSlot(slot: FloatSlot): boolean {
  return manager?.openSlots.includes(slot) ?? false;
}

/**
 * Calls every IDE renderer: the IDE and each floating window (plan §3.3, the broadcast class).
 * One renderer failing does not stop the others; the failures are ignored, like before for the IDE
 * alone: a broadcast is a notification, not a request.
 * @param call The call to make on each renderer's API
 * @param except The renderer to leave out (the one the notification came from)
 */
export async function broadcastToIdeRenderers(
  call: (api: IdeApi) => Promise<unknown>,
  except?: MessageSource
): Promise<void> {
  const apis: IdeApi[] = [];
  const ideApi = getIdeApi();
  if (ideApi && except !== "ide") apis.push(ideApi);
  for (const { slot, api } of getFloatApis()) {
    if (floatSourceOf(slot) !== except) apis.push(api);
  }
  await Promise.allSettled(apis.map((api) => Promise.resolve().then(() => call(api))));
}

/**
 * The API of the renderer that holds a document: its floating window, else the IDE (plan §3.3, the
 * document-owned class)
 */
export function ideApiForDocument(documentId: string): IdeApi {
  const slot = findFloatingSlot(mainStore.getState(), documentId);
  if (slot && manager?.openSlots.includes(slot)) {
    const api = getFloatApi(slot);
    if (api) return api;
  }
  return getIdeApi();
}

/**
 * Tells the other IDE renderers that a file was saved, so they drop it from their file-content
 * cache (plan §3.5). Without floating windows there is nobody to tell, and nothing is sent.
 */
export function notifyFileContentChanged(filePath: string, source?: MessageSource): void {
  if (!manager || manager.count === 0) return;
  void broadcastToIdeRenderers((api) => api.fileContentChanged(filePath), source);
}
