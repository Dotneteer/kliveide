# Floating Document Windows Plan

**Status: approved (2026-11-14).** Nothing is implemented yet. The decisions are in §4 (Q1-Q6, all
settled by the project author).

A document tab in the IDE can pop out into its own window: a real Electron `BrowserWindow`, moved and
resized like the IDE and emulator windows. The window shows the one document and a header with two
buttons: **Dock** (put the document back into the IDE) and **Close** (close the document and destroy the
window). A floating window reaches the main API and the emulator API exactly like the IDE window does,
and receives the main process's notifications and state the same way. At most 8 floating windows exist at
a time.

## 1. What exists today

| Part | Where | Notes |
|---|---|---|
| Renderer bootstrap | `src/renderer/main.tsx` | One bundle; `?emu` picks `EmuApp` + `EmuToMainMessenger`, anything else `IdeApp` + `IdeToMainMessenger`. Registers the main→renderer IPC at module load (the comment explains why it cannot wait for React). |
| Message sources | `src/common/messaging/messages-core.ts` | `MessageSource = "emu" \| "ide" \| "main"`; channels `MainToEmu`, `EmuToMain`, `MainToIde`, `IdeToMain` and their `*Response`. |
| Renderer → main | `src/main/index.ts`, `ipcMain.on("IdeToMain")` | Dispatches `ForwardAction` into the main store, else `processRendererToMainMessages(msg, ideWindow)`; **replies to the fixed `ideWindow`**, not to the sender. |
| Relaying to the emulator | `src/main/RendererToMainProcessor.ts` | A request with `targetId: "emu"` is relayed with `sendFromMainToEmu`; `"ide"` with `sendFromMainToIde`. This is how the IDE uses the emulator API (`buildMessagingProxy` in `MessageProxy.ts`). |
| Main → IDE | `src/common/messaging/MainToIdeMessenger.ts`, `IdeApi.ts` | One messenger bound to one window (`registerMainToIdeMessenger(ideWindow)`). `IdeApi`: output, script output, show memory/disassembly/BASIC, dialogs, commands, save-all-before-quit, annotation file / disk image changed, project structure. 63 call sites in `src/main`. |
| Shared state | `src/main/main-store.ts` | Actions from `"emu"` go to the IDE, from `"ide"` to the emulator, from `"main"` to both. Hard-coded for two renderers. |
| Document hubs | `src/renderer/appIde/services/DocumentHubService.ts`, `ProjectService.ts` | A hub is one tab strip (one area of the split grid). `hubId` keys `ideView.documentHubState` in the shared store. `ProjectService` owns the hubs, the file-content cache, the delayed (as-you-type) saves and the document ↔ hub map. |
| Document areas | `src/renderer/features/documents/` | Split grid of areas (`documentAreaLayout.ts`), tab strip (`DocumentTabs.tsx`), tab context menu (`DocumentTab.tsx`: close, close others/all, move left/right, move to previous/next area). |
| Workspace persistence | `useDocumentWorkspacePersistence.ts`, `restoreLastOpenDocuments.ts` | `SavedDocumentInfo` = `{ type, id, position, viewState }`: exactly what is needed to move a document between processes. Version 2 stores per-area documents. |
| Document panels | `src/renderer/registry.ts` (`documentPanelRegistry`), `src/renderer/appIde/DocumentPanels/` | ~80 document kinds. Many use `useAppServices()` (project service, output pane, commands, navigation history, language intel). |
| Volatile documents | `ideView.volatileDocs`, `IdeApi.showMemory/showDisassembly/showBasic` | Memory, disassembly, BASIC listing, toggled from the View menu. |
| Window focus in menus | `src/main/app-menu.ts`, `menu-context.ts` | `ideFocus` / `emuWindowFocused` decide which window's items show. |

## 2. Behaviour (the specification)

### 2.1 Popping out

- The tab context menu gets **Pop Out to Window** (after the "move to area" items). A button in the
  documents header for the active document is a possible follow-up, like dragging a tab out (Q6).
- Disabled when 8 floating windows are open, with the reason in the tooltip; main enforces the limit too.
- Popping out **moves** the document: it leaves its IDE tab strip and lives only in the new window. A
  document is never open in two places.
- The window opens near the IDE window at a default size (or the document's last floating bounds, Q3),
  focused, showing the document with its caret/scroll position and view state.

### 2.2 The floating window

- **Frameless** (`frame: false`; on macOS `titleBarStyle: "hidden"` without traffic lights, Q2) with Klive's
  own header: the document's icon and name, the dirty/locked/read-only marks the tab shows, then **Dock**
  and **Close** buttons. The header is the drag region (`-webkit-app-region: drag`, buttons `no-drag`).
- Resizable, minimizable through the OS, follows the theme, accent, fonts and UI language live (they come
  through the shared store, like in the IDE).
- **Dock**: the document goes back into the IDE (the area it came from if it still exists, otherwise the
  active area), activated, with its current view state; the window is destroyed.
- **Close**: the same as closing the tab in the IDE (delayed saves flushed first, the same prompts for
  unsaved documents); the window is destroyed.
- The OS close (Alt+F4, Cmd+W) behaves as **Close** (Q4).
- Keyboard shortcuts that work in an IDE editor (save, find, go to line, run/debug/step accelerators) work
  in the floating window.

### 2.3 Working with the rest of the IDE

- Opening a document that is floating (Explorer double-click, Go to Definition, error list, breakpoints
  panel, navigation history) **focuses its window** and navigates there, instead of opening a second copy.
- An action inside a floating document that opens *another* document (Go to Definition into another file,
  "show in disassembly", navigating from the memory view) opens it in the IDE window and brings the IDE
  forward, unless that document is itself floating.
- Output (build output, script output) goes to the IDE's output pane, as now.
- Closing the project closes every floating window (after the same save flush). Quitting flushes every
  floating window's saves before the app exits (`saveAllBeforeQuit` covers them).
- Renaming or deleting a file in the Explorer updates or closes its floating window, like a tab.
- A machine change closes floating documents that the new machine cannot show, by the same rule the IDE
  applies to its tabs.
- The IDE window hidden (its close only hides it) leaves the floating windows as they are (Q1).

## 3. Design

### 3.1 The floating renderer is an IDE renderer in "satellite" mode

Same bundle, `index.html?float=<slot>` (slot 1-8). `main.tsx` picks `FloatApp`, a `FloatToMainMessenger`
and message source `float<slot>`. `FloatApp` mounts the IDE's service stack (`AppServicesProvider`: project
service, commands, language intel, navigation history) in satellite mode, plus one `DocumentHubService` and
the header, and renders the document through the same `documentPanelRegistry` path the IDE uses. No
activity bar, side bar, tool area or status bar.

Why not a thin window that calls the IDE renderer for every service: the panels call their services
synchronously and often (the editor, language intel, the memory view); turning that into IPC would mean
rewriting the panels. Running the same services in the satellite keeps every panel unchanged; the plan's
work is in keeping the satellites consistent (§3.5).

Satellite mode switches off what must exist once: project-wide startup work (restoring the workspace,
opening the last documents), the output pane's ownership, the command line, script output collection,
build orchestration. `useIdeStartup` and `AppServicesProvider` get a `role: "ide" | "satellite"` input.

Hub ids must not collide in `ideView.documentHubState`: a satellite's hubs start at `slot * 1000`.

### 3.2 Messaging: many renderers instead of two

- `MessageSource` becomes `"emu" | "ide" | "main" | FloatSource` with `FloatSource = \`float${1..8}\``.
  Helpers `isFloatSource`, `floatSlotOf`.
- Channels: `FloatToMain` / `FloatToMainResponse` and `MainToFloat` / `MainToFloatResponse`. The response
  of a renderer request goes back to **`event.sender`** (the `WebContents` that asked), not to a fixed
  window; the `IdeToMain`/`EmuToMain` handlers move to the same rule while at it, and the three handlers
  share one function.
- `MainToFloatMessenger`: one instance per open window, keyed by slot, created with the window and dropped
  when it closes (`src/main/floating-windows.ts` owns them). Per-window response correlation: the response
  carries `sourceId`, so one `ipcMain.on("MainToFloatResponse")` routes to the right messenger.
- The emulator API and main API need nothing new: a satellite's `createEmuApi`/`createMainApi` proxies send
  `targetId: "emu"`/`"main"` and `RendererToMainProcessor` already relays them. `processRendererToMainMessages`
  receives the satellite's `BrowserWindow` (for dialogs parented to it).
- **Store routing** (`main-store.ts`): replace the two-renderer switch with "deliver to every live renderer
  except the source", over a registry of renderers (`emu`, `ide`, each open float). Failures stay isolated
  (`allSettled`), as now.
- **Startup race**: the satellite registers its IPC at module load like the IDE, then asks main for the
  full current state (`requestFullState`) before rendering, because it opens long after the broadcasts the
  other windows received at startup.

### 3.3 Notifications (`IdeApi`) to satellites

Every `IdeApi` method is classified once, in one table in code (`ide-api-routing.ts`), with a test that
fails when a method is added without a class:

| Class | Methods (today) | Delivered to |
|---|---|---|
| Broadcast | `annotationFileChanged`, `diskImageChanged` | IDE and every satellite |
| Document-owned | `showMemory`, `showDisassembly`, `showBasic` | the window that holds that volatile document, else the IDE |
| IDE-only | `displayOutput(Batch)`, `scriptOutput(Batch)`, `displayDialog`, `executeCommand(Captured)`, `getProjectStructure` | the IDE |
| Fan-out and gather | `saveAllBeforeQuit` | every satellite first, then the IDE; `false` from any stops the quit |

`getIdeApi()` keeps returning the IDE's proxy; `getFloatApis()` / `broadcastToIdeRenderers(fn)` serve the
other classes. Call sites in `src/main` are reviewed against the table (63 today).

### 3.4 Moving a document between windows

The transfer format is the workspace's `SavedDocumentInfo` (+ the source area id for Dock):

1. **Pop out** (IDE renderer): flush the document's delayed saves, capture `SavedDocumentInfo`, ask main
   `openFloatingDocument(info)`. Main checks the limit, picks a free slot, creates the window, records
   `floatingDocuments[slot] = { docId, type, sourceAreaId }` in the shared store, and only then the IDE closes
   the tab. A failure leaves the tab where it was.
2. **Satellite start**: reads its slot's entry, opens the document through the same code path as
   `restoreLastOpenDocuments` (so view state and position come back the same way).
3. **Dock**: the satellite flushes saves, captures `SavedDocumentInfo`, asks main `dockFloatingDocument(slot,
   info)`; main forwards to the IDE (`IdeApi.openDockedDocument`), which opens it in the source area or the
   active one; main then destroys the window and clears the slot.
4. **Close**: the satellite runs the normal close path, then asks main to destroy its window.

`floatingDocuments` in the shared store is what lets `ProjectService.isDocumentOpen` / `openDocument` in the
IDE and in every satellite see a floating document and route to it (`focusFloatingDocument(docId)` in main:
show, focus, and forward the navigation target).

### 3.5 Keeping the satellites consistent

- **File contents**: each renderer's `ProjectService` caches file contents. After any save (immediate or
  delayed), main broadcasts `fileContentChanged(path)` (broadcast class, §3.3) and the other renderers drop
  that file from their cache. A document is open in one place only, so there is no edit conflict; the
  cache matters for language intel and for opening a file elsewhere.
- **Project tree**: satellites load the tree from main (`getProjectStructure` / the existing project-open
  path) and follow `incExploreViewVersionAction` like the IDE's Explorer does.
- **Language intel**: each satellite builds its own index for the files it needs; acceptable cost for ≤8
  windows. Measured in Phase 4; if it is too slow, the IDE's index gets served to satellites instead.
- **Breakpoints, execution point, watch, settings, theme, language**: already in the shared store.
- **Navigation history**: one history, owned by the IDE; satellites report their navigation points to it
  (IDE-only class) so Go Back can return to a floating document (which then focuses its window).

### 3.6 Main process: `src/main/floating-windows.ts`

- Slots 1-8, `MAX_FLOATING_WINDOWS = 8`.
- `openFloatingDocument`, `dockFloatingDocument`, `closeFloatingDocument`, `focusFloatingDocument`,
  `closeAllFloatingWindows(reason)`; window creation (`frame: false`, preload, the same `webPreferences` as
  the IDE window, `minWidth`/`minHeight`), bounds memory (Q3), `focus`/`blur` reporting into the store so the
  menu knows a satellite has focus.
- Wired into `index.ts`: project close, app quit (`saveAllBeforeQuit` fan-out), IDE window lifecycle (Q1).
- Menus: a focused satellite counts as "IDE focused" for the menu builder (`ideFocus`), and accelerators
  that act on "the focused document" act on the satellite's.

### 3.7 UI

- `src/renderer/appFloat/FloatApp.tsx`, `FloatHeader.tsx` (+ `.module.scss`): tokens only, header height
  from `theming/tokens/rowSizes.ts`, icons from `src/renderer/assets/icons/` (dock and close), `t()` for every
  text (`documents.float.*`, with translator context, then `npm run i18n:keys`).
- Tab context menu item and its disabled reason in `DocumentTab.tsx`.

## 4. Decisions

All decided by the project author on 2026-11-14.

- **Q1. IDE window hidden or closed: floating windows stay.** They stay open and keep working while the
  IDE window is hidden (the emulator stays too); they close only with the project or the app.
- **Q2. Window frame: frameless with Klive's own header** (Dock and Close) on every platform.
- **Q3. Remember floating windows: yes, per project.** The workspace (version 3) saves each floating
  document with its window bounds, and reopening the project reopens them floating.
- **Q4. OS close (Alt+F4, Cmd+W) = Close**, not Dock.
- **Q5. Which documents can float:** Phases 1-3 every document the workspace can restore (files and the
  restorable special documents); volatile documents (Memory, Disassembly, BASIC) in Phase 4. A document kind
  that turns out not to work floating is marked `floatable: false` in the registry.
- **Q6. Dragging a tab out to pop it out: not in this plan.** The context menu first; dragging is a
  follow-up.

## 5. Phases

### Phase 0: messaging for many renderers (no visible change)

- `MessageSource` with float sources; shared request handler replying to `event.sender`; store routing over
  a renderer registry; `IdeApi` routing table and its test.
- Tests: main-store routing (every source × every live renderer set, one unreachable renderer); the handler
  replies to the sender; the routing table covers every `IdeApi` method.

### Phase 1: an empty floating window

- `floating-windows.ts` (slots, limit, lifecycle, bounds), `?float=` bootstrap, `FloatToMainMessenger`,
  `MainToFloatMessenger`, full-state request, `FloatApp` with the header only; Close destroys it.
- A temporary developer command opens one (removed in Phase 2).
- Tests: slot allocation and the limit of 8 with fake windows; state arrives in a late window;
  theme/language follow live.

### Phase 2: moving documents (code and text editors, viewers)

- Pop Out in the tab menu, Dock, Close, `floatingDocuments` in the store, transfer via `SavedDocumentInfo`,
  `FloatApp` in satellite mode with one hub, satellite-mode switches in `useIdeStartup`/`AppServicesProvider`.
- Opening a floating document focuses its window; file-content cache invalidation; rename/delete; project
  close; quit flush.
- Tests: transfer round trip keeps position and view state (jsdom + model tests); open-elsewhere routing;
  cache invalidation; quit with dirty satellites; the limit in the menu.

### Phase 3: the IDE's behaviour inside a satellite

- Accelerators and in-editor shortcuts, menu focus, Go to Definition / navigation history across windows,
  breakpoints and execution point in a floating editor while debugging, dialogs parented to the satellite.
- Workspace version 3 with floating documents and bounds (Q3).
- Check in the running app with `dev/scripts/cdp/` (every window is a CDP target) and extend the IDE-check
  scripts with a pop-out/dock round trip.

### Phase 4: volatile and machine documents

- Memory, Disassembly, BASIC (`IdeApi.show*` routed to the owning window), the Next inspectors, debug
  recording views; mark any kind that cannot float `floatable: false`. Measure language-intel and memory
  cost with 8 windows open.

### Phase 5: finish

- Docs: a guides page section (documents and windows), with a `guides-*` doc-shot recipe if the screenshot
  helps; `dev/patterns/` note on the satellite renderer and the messaging rules, so later features know how
  to stay satellite-safe.
- `dev/ai/ui-theming-intent-and-lessons.md` for the header's style rules.
- Changeset (`feature`) with the commit that completes the plan; `npm run test:fast`, `npm run test:slow`,
  `npm run lint:renderer`, `npm run build:check`, the Vite build.

## 6. Risks

- **Services that assume one IDE renderer** (singletons, "the" output pane, startup work): the satellite
  role switch must be explicit; Phase 2 audits `AppServicesProvider` and `useIdeStartup` line by line.
- **Lost early broadcasts** in a late window: the full-state request (§3.2) and a test for it.
- **Main call sites that mean "the IDE" vs "every IDE renderer"**: the routing table and its test (§3.3).
- **Quit/close data loss**: the save flush fan-out runs before any window is destroyed; tested with dirty
  satellites.
- **Memory**: each window is a renderer process with its own Monaco and services (~100-200 MB each); 8 is
  the cap for that reason. Measured in Phase 4.
