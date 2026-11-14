# Satellite renderers: floating document windows and the messaging rules

Klive has more than two renderers. Besides the emulator (`emu`) and the IDE (`ide`), up to eight
floating document windows (`float1`..`float8`) run at a time, each an IDE renderer in **satellite
mode** holding one document (`dev/plans/FLOATING_DOCUMENT_WINDOWS_PLAN.md`). Read this before adding
an `IdeApi` method, a shared-state action, or anything that assumes "the IDE window".

## The pieces

| Part | Where |
|---|---|
| Sources and channels | `src/common/messaging/messages-core.ts`: `FloatSource`, `isFloatSource`, `floatSlotOf`, `MAX_FLOATING_WINDOWS`; channels `FloatToMain*`, `MainToFloat*` |
| Renderer → main | `FloatToMainMessenger`; main answers through `src/main/renderer-request-handler.ts`, **always to `event.sender`** (also for `EmuToMain`/`IdeToMain`) |
| Main → satellite | `MainToFloatMessenger.ts`: one messenger per window, one `MainToFloatResponse` listener routing by `sourceId` |
| Store routing | `src/main/renderer-routing.ts`: an action goes to **every live renderer except its source** |
| `IdeApi` routing | `src/common/messaging/ide-api-routing.ts`: every method has a class; a test fails on an unclassified one |
| Window lifecycle | `src/main/floating-windows.ts` (rules, testable with fake windows), `floating-windows-host.ts` (the app's instance, broadcast helpers) |
| Satellite app | `src/renderer/appFloat/` (`FloatApp`, `FloatHeader`, `satelliteController`) |
| Moving documents | `src/renderer/features/documents/floatingDocumentTransfer.ts` |
| Shared bookkeeping | `src/common/messaging/floating-documents.ts`; `AppState.floatingDocuments` |

## Rules for staying satellite-safe

- **A satellite runs the IDE's own services** (`AppServicesProvider role="satellite"`), so a document
  panel works unchanged. Work that must happen once (signing the IDE loaded, the activity bar, tool
  panels, reopening the last project, restoring the workspace) is skipped for `role === "satellite"`
  in `useIdeStartup`. New project-wide startup work goes behind the same switch.
- **`dispatch(action, "ide")` means "this IDE renderer"**: in a satellite the store forwards it under
  the window's own source. Actions arriving from main are replayed with the `"main"` source there, so
  they never echo back. Do not add new hard-coded `"emu"`/`"ide"` routing in main; use
  `getLiveRendererTargets()`.
- **Document hub IDs are shared-store keys** (`ideView.documentHubState`): a satellite's start at
  `slot * 1000` (`floatHubIdBase`).
- **A new `IdeApi` method needs a class** in `IDE_API_ROUTING`: `ide` (output, dialogs, commands),
  `broadcast` (use `broadcastToIdeRenderers`), `document` (use `ideApiForDocument`), `fanout`
  (`saveAllBeforeQuit`: floating windows first, `false` from any stops the quit) or `float` (only the
  addressed window, answered through `satelliteController`).
- **"Open this document" checks `floatingDocuments` first** (`routeToFloatingDocument`,
  `findFloatingSlot`): a document is open in one place only. In a satellite, `nav` to another document
  goes to the IDE (`MainApi.navigateInIde`).
- **A file saved while windows float is announced** (`IdeApi.fileContentChanged`) so the other
  renderers drop their cached copy; without floating windows nothing is sent.
- **Moving a document saves it first** (`saveDocumentBeforeTransfer`: the delayed saves and the view's
  `beforeDocumentDisposal`), then transfers the workspace's saved-document shape
  (`captureSavedDocument` → `restoreDocument`). The receiving window opens it before the giving one
  lets go.
- **The menu belongs to the focused window, floating ones included** (`setupMenu`): a new
  window-dependent menu rule must handle a focused floating window, or its accelerators go dead.
- **One navigation history, the IDE's.** A satellite's `NavigationHistoryService` is remote
  (`setRemote`); the IDE restores a floating document's entries in its window (`setFloatingRestorer`).
  A new kind of jump recorded outside `recordJump` must go through `recordExternal` in the IDE.
- **A request to a floating window that may be destroyed meanwhile ends with the window** (the
  manager's `gone` promise), when it has no timeout of its own.
- **A late window starts from main's full state** (`MainApi.getFullState`) before rendering; its IPC
  listener is registered at module load like the IDE's.

## Testing

- Messaging and routing: `test/messaging/floating-messaging.test.ts`.
- The window manager with fake windows: `test/main/floating-windows.test.ts`.
- Transfer, routing, workspace version 3: `test/renderer/floatingDocuments.test.ts`.
- The menu with a focused floating window: `test/main/app-menu-floating.test.ts`; the shared history:
  `test/navigation/floatingNavigationHistory.test.ts`.
- Cost with 8 windows: `node dev/scripts/floating-windows-cost.cjs`.
- In the running app: `node dev/scripts/floating-windows-ide-check.cjs` (after an
  `electron-vite build`), every window is also a CDP target for `dev/scripts/cdp/drive.mjs float ...`.
