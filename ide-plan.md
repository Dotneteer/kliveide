# Klive IDE Window UX Re-Implementation Plan

This plan focuses on the IDE window UX and interaction model before implementation. The goal is to rebuild the current placeholder XMLUI IDE surface into a VS Code-style workbench while preserving Klive-specific concepts from the old React implementation in `/Users/dotneteer/source/kliveide-ref`.

## UX Goals

- Keep the IDE visually and behaviorally close to VS Code: Activity Bar, Side Bar, central editor/workbench area, tabbed document header, bottom/top panel, status bar, and optional toolbar.
- Keep Klive's emulator-aware workflow visible: project explorer, debugging, machine information, scripting history, command/output tools, compiler/build actions, memory and disassembly surfaces.
- Prefer XMLUI markup for layout, simple view composition, and reactive settings bindings.
- Use React-backed XMLUI components for interaction-heavy surfaces: trees, document tabs, Monaco editor hosting, command consoles, output buffers, debugger panels, context menus, and any component that needs direct DOM measurement.
- Keep renderer code Electron-safe. File access, settings persistence, dialogs, and process commands should go through the preload/main API and shared reducer flow.

## Existing Current Workspace Baseline

The current XMLUI IDE scaffold already has these files:

- `src/renderer/src/components/ide/IdeApp.xmlui`
- `src/renderer/src/components/ide/ActivityBar.xmlui`
- `src/renderer/src/components/ide/SideBar.xmlui`
- `src/renderer/src/components/ide/MainWorkbench.xmlui`
- `src/renderer/src/components/ide/Workbench.xmlui`
- `src/renderer/src/components/ide/DocumentsPanel.xmlui`
- `src/renderer/src/components/ide/ToolsArea.xmlui`
- `src/renderer/src/components/ide/IdeStatusBar.xmlui`

These are currently placeholders. The high-level split is already directionally right:

- optional toolbar at the top
- Activity Bar on the far edge
- Side Bar next to it
- editor/workbench center
- tools panel split from documents
- status bar at the bottom

The current custom XMLUI integration examples to reuse are:

- `SharedAppState`: exposes shared reducer state and persisted settings APIs.
- `ToolbarButton` and `ToolbarSeparator`: good pattern for wrapped React toolbar atoms.
- `PersistedSettingOnRelease`: useful for persisting splitter sizes after pointer release.
- `SplitterSizeGuard`: useful for validating persisted splitter sizes.

XMLUI built-ins to prefer before adding custom React wrappers:

- `ModalDialog`: focused modal overlay with backdrop, focus management, imperative `open()`/`close()`, parameter passing, and form integration.
- `Tree`: virtualized hierarchical/flat tree with icons, selection, expand/collapse state, async child loading, item templates, and keyboard-aware tree actions.
- `Tabs` and `TabItem`: useful for early tool/document placeholders and simple tabbed surfaces; replace with custom React-backed tabs only when VS Code-like close buttons, context menus, scrolling, dirty states, or tab ordering require it.
- `HStack`, `VStack`, `HSplitter`, and `VSplitter`: keep the workbench layout in XMLUI for as long as the behavior remains straightforward.

Local XMLUI docs are also available at `/Users/dotneteer/source/xmlui/website/content/docs`, and the XMLUI MCP server can be used to check component behavior before implementation.

## Old IDE UX Concepts To Preserve

The old React implementation uses a registry-driven workbench:

- Activity Bar activities:
  - Explorer
  - Debug
  - Machine info
  - Scripting
  - Testing
- Side Bar panels are filtered by active activity, machine type, machine features, and machine config.
- Side Bar panels are collapsible and, when adjacent panels are expanded, vertically resizable.
- Document area has scrollable tabs, active/dirty/temporary/readonly/locked states, context menu actions, and document-specific command buttons.
- Tools area has tabs, currently Commands and Output, plus per-tool header actions.
- Tools area can be bottom or top, shown/hidden, or maximized over the document area.
- VS Code-style Side Bar behavior is now two-container: Primary Side Bar plus independent Secondary Side Bar, each showable/hideable with its own width and panel state.
- Status bar summarizes machine state, compilation status, transient IDE status messages, and editor cursor position.

## Proposed Workbench Layout

`IdeApp.xmlui` should become the top-level composition owner:

```text
IdeApp
  SharedAppState
  IdeLifecycle
  optional Toolbar
  HStack
    Primary Activity Bar
    Primary Side Bar/workbench splitter
      Primary Side Bar
      WorkbenchFrame
        Editor/Panel splitter
          EditorGrid
            EditorGroup
            optional split EditorGroup(s)
          ToolsArea
      Secondary Side Bar splitter
        Secondary Side Bar
  IdeStatusBar
  DialogHost
  Backdrop
```

The IDE should support two side bars with VS Code-like semantics:

- Primary Side Bar: the main view container controlled by the Activity Bar. It usually hosts Explorer, Debug, Machine info, Scripting, and Testing views.
- Secondary Side Bar: an independent view container on the opposite side, used when a user wants a second set of views visible at the same time.
- A view can be moved between Primary Side Bar, Secondary Side Bar, Document Area, and Tools Area if its registry entry allows that placement.
- Primary and secondary side bars have independent visibility, width, active view container, and view/panel expansion state.
- The Activity Bar remains associated with the Primary Side Bar in the first implementation. A secondary activity affordance can be added later only if it proves useful.

The document area should support split editor groups from the first implementation:

- The initial placeholder UI should already show one or two editor groups and allow splitting horizontally/vertically with sample documents.
- Editor groups own their own tab list, active tab, and view layout.
- A document/view instance can move between editor groups.
- Split support should be present in the shell before Monaco and the real document service are ported.

The layout should read persisted settings through `SharedAppState`:

- `ideViewOptions.showToolbar`
- `ideViewOptions.showStatusBar`
- `ideViewOptions.showPrimarySideBar`
- `ideViewOptions.showSecondarySideBar`
- `ideViewOptions.primarySideBarWidth`
- `ideViewOptions.secondarySideBarWidth`
- `ideViewOptions.showTools`
- `ideViewOptions.toolPanelsOnTop`
- `ideViewOptions.maximizeTools`
- `ideViewOptions.toolPanelHeight`
- `ideViewOptions.activeTool`
- `ideViewOptions.activeOutputPane`

The current workspace still has older single-sidebar setting constants such as `ideViewOptions.showSidebar` and `ideViewOptions.sideBarWidth`. Add new setting constants/definitions for the two-sidebar model, and migrate or alias the old values during the transition.

Use XMLUI splitters for the main resizing behavior where possible:

- left/right `HSplitter` regions for Primary and Secondary Side Bar widths
- inner `VSplitter` for Tools Area height
- nested editor group splitters for initial split editor groups
- `PersistedSettingOnRelease` to persist the last splitter size only after drag release
- `SplitterSizeGuard` to keep restored sizes valid after a window resize or monitor change

## Delivery Strategy: Thin, Visible Slices

Build the IDE shell in small, testable slices. Each slice should leave a visible UI in the IDE window, even if the content is still backed by fixture data or placeholder commands.

Rules for early increments:

- Do not wait for project services, document services, or command services before rendering the final workbench regions.
- Every region should have a real-looking placeholder: title, icon, header actions, empty state, and a small sample body.
- Prefer XMLUI built-ins for the first visible version. Add React-backed XMLUI components only when interaction complexity or service integration demands it.
- Keep placeholders wired through the same registry and host model planned for the final implementation, so they can be replaced one panel at a time.
- Add one interaction per slice and verify it manually: toggle an activity, expand a panel, switch a tool tab, open a dialog, or move the tools panel.
- Keep code changes narrow enough that `npm run typecheck` is the normal verification step after each slice.

## Reusable View Hosting Model

Some IDE content should be displayable in more than one host: Side Bar, Document Area, and Tools Area. Treat these as placements for reusable workbench views rather than as completely separate component families.

Add a small view registry concept:

```ts
type IdeViewPlacement = "primarySideBar" | "secondarySideBar" | "document" | "tool";

type IdeViewInfo = {
  id: string;
  title: string;
  iconName?: string;
  preferredPlacement: IdeViewPlacement;
  allowedPlacements: IdeViewPlacement[];
  renderer: React.ComponentType<IdeViewHostProps>;
};

type IdeViewHostProps = {
  viewId: string;
  placement: IdeViewPlacement;
  chrome: "compact" | "document" | "tool";
};
```

Examples of portable views:

- Memory: Primary/Secondary Side Bar compact inspector, Document Area full editor, Tool Area utility pane.
- Disassembly: Document Area full navigation view, Primary/Secondary Side Bar compact current-frame view.
- Output: Tool Area primary view, Document Area transcript view.
- Scripting history: Side Bar history, Tool Area command-adjacent history.
- Breakpoints: Side Bar compact list, Document Area detailed table later.
- Palette/Sprite viewers: Document Area full editor, Side Bar preview later.

Host-specific chrome should adapt around the same renderer:

- Primary/Secondary Side Bar host: compact title, collapsible body, narrow controls, vertical scrolling.
- Document host: tab title, document commands, full-size canvas/editor/table affordances.
- Tool host: tab title, utility header actions, command/output density.

This means registry entries should not hard-code "this is only a side bar panel" unless the view truly cannot work elsewhere. The old `sideBarPanelRegistry`, `toolPanelRegistry`, and `documentPanelRegistry` can still exist, but they should increasingly point at reusable `IdeViewInfo` entries.

View placement persistence should be mixed:

- IDE-level defaults decide where built-in views normally appear.
- Workspace settings can override the placement and order of project-specific views.
- Runtime state tracks the current visible placement, active side bar view container, active tool tab, active editor group, and transient drag/drop movement.

## Component Plan

### `IdeLifecycle`

Add a non-visual React-backed XMLUI component.

Responsibilities:

- initialize IDE-only services when the IDE renderer mounts
- dispatch `ideLoadedAction()`
- register IDE commands
- initialize default active activity if missing
- initialize tool registry state if the reducer owns visible tool metadata
- optionally request opening the last project after settings sync
- expose readiness and initialization errors to XMLUI state

Why React-backed:

- it will interact with services, main API, and effects
- it should avoid putting async startup logic directly in XMLUI markup

### `ActivityBar`

Use XMLUI for the first simple version, with a small `ActivityButton` UDC or wrapped React component.

Activities:

- Explorer: `files`
- Debug: `debug-alt`
- Machine info: `output`
- Scripting: `symbol-event`
- Testing: `beaker`

Interactions:

- clicking an inactive activity selects it and shows the Primary Side Bar
- clicking the active activity toggles Primary Side Bar visibility
- active item has a clear selected background and icon color
- hover/focus shows tooltip with activity title
- keyboard navigation supports focus, Enter, and Space

State:

- selected activity should be reducer state, probably `ideView.primaryActivity`
- Primary Side Bar visibility should be persisted setting `ideViewOptions.showPrimarySideBar`
- Secondary Side Bar active view/container should be independent, probably `ideView.secondaryActivity`

Implementation options:

- Early phase: XMLUI `VStack` with repeated buttons hard-coded from a local XMLUI variable.
- Durable phase: `IdeActivityBar` React-backed XMLUI component backed by an `activityRegistry`.

### `SideBar`

This is the VS Code View Container surface.

Structure:

- header showing active activity title
- list of panels for the active activity
- each panel has a compact uppercase header with chevron
- expanded panels show content
- collapsed panels occupy only their header

Initial panel set:

- Explorer activity:
  - Klive Project
- Debug activity:
  - CPU panel, feature-dependent
  - Call Stack
  - Watch
  - Breakpoints
  - Memory Mapping, machine-dependent
  - Registers, machine-dependent
- Machine info activity:
  - System Variables
  - ULA and I/O
  - PSG
  - disk controller log
  - palette view
- Scripting activity:
  - Scripting History
- Testing activity:
  - placeholder panel until real test support returns

Interactions:

- click or Enter/Space toggles a panel
- panel expanded state persists in shared IDE view state or workspace state
- adjacent expanded panels can be resized vertically
- panel content scrolls independently
- panel availability responds to `emulatorState.machineId`, `emulatorState.config`, and machine feature metadata

Recommended implementation:

- Add a React-backed `IdeSideBar` XMLUI component for the durable version.
- Keep the shell in `SideBar.xmlui`, but delegate registry filtering, measuring, panel expansion, and nested resize handling to React.

Why React-backed:

- DOM measurement and drag resizing are awkward in XMLUI-only markup
- panel renderers will often be React components
- registry filtering by machine capabilities belongs in TypeScript

### `ExplorerPanel`

This should be the highest-priority Side Bar content.

UX:

- compact tree view of the active Klive project
- folders expandable/collapsible
- files open on single click as preview/temporary documents
- double click or edit action makes document permanent
- context menu for New File, New Folder, Rename, Delete, Exclude, Reveal in Finder/File Explorer
- visual states for excluded, build root, readonly, dirty, and locked files
- empty state when no project is open, with Open Folder and New Project actions

Recommended implementation:

- Early version: XMLUI `Tree` with fixture project data, icons, selection, and an empty-state branch for "no project".
- Service-connected version: XMLUI `Tree` can still be used if project data can be mapped cleanly to flat or hierarchical nodes.
- React-backed XMLUI component only when project-specific behavior exceeds the built-in `Tree`: complex context menus, drag/drop, custom inline rename, highly custom keyboard commands, or tight integration with project services.

First visible placeholder:

- show a root project folder, `src`, `roms`, `build`, and a few representative files
- selecting a file opens a placeholder document tab
- right-click can initially open a `ModalDialog` placeholder that lists the intended context actions

### `EditorGrid` And `EditorGroup`

This is the split-capable document/view surface.

Structure:

- `EditorGrid`
  - one or more `EditorGroup` instances
  - splitters between groups
- each `EditorGroup`
  - `EditorGroupHeader`
  - `EditorGroupHost`
  - empty editor area when the group has no document/view open

`EditorGroupHeader` interactions:

- scrollable tabs
- active, inactive, temporary, dirty, readonly, and locked tab states
- close button appears on hover/active tab
- dirty tabs show a filled circle instead of close when not hovered
- middle click closes a tab
- double click makes a temporary tab permanent
- context menu:
  - Close
  - Close Others
  - Close All
  - Reveal in Finder/File Explorer
- tab order commands:
  - move active tab left
  - move active tab right
- group commands:
  - split right
  - split down
  - close group
  - move document/view to another group
- document-specific command area, especially build-root commands:
  - Compile
  - Inject
  - Run
  - Debug
  - Show script output

`EditorGroupHost` responsibilities:

- route document type to viewer/editor renderer
- route reusable workbench views to document placement
- preserve and restore view state per document
- integrate Monaco for code/text editors
- host binary/media viewers
- host memory and disassembly editors

Recommended implementation:

- Early version: XMLUI splitters plus XMLUI `Tabs` in each editor group, with sample tabs such as `main.asm`, `memory`, and `README.md`; use custom `headerTemplate` for file icons and active styling.
- Include split right/split down placeholders from the first visible version.
- Add React-backed XMLUI components:
  - `IdeEditorGrid`
  - `IdeEditorGroup`
  - `IdeDocumentTabs`
  - `IdeEditorGroupHost`
- Promote document tabs to React-backed once close buttons, dirty markers, tab scrolling, tab context menus, temporary/permanent documents, and tab ordering are implemented.
- Use XMLUI for the surrounding layout, empty states, and simple placeholder document bodies.

First visible placeholder:

- one editor group by default, plus a toolbar action that creates a second placeholder group
- split right and split down affordances visible from the first implementation
- sample document tabs when a placeholder file is selected from Explorer
- document body placeholder that changes by document type: code, memory, disassembly, image, output transcript

Document hub direction:

- Redesign the document hub around editor groups, reusable views, and document/view instances.
- Avoid porting the old document hub service as-is.
- Keep the new service focused on open instances, editor group layout, active instance, view state, dirty state, and placement/move operations.
- Let file/project services own project structure and file I/O; let renderers own editor/view APIs.

### `ToolsArea`

This is the VS Code Panel equivalent.

Initial tools:

- Commands
- Output

Interactions:

- tab selection persists in `ideViewOptions.activeTool`
- show/hide through menu/toolbar setting
- maximize/restore hides or restores the document area
- move top/bottom toggles `ideViewOptions.toolPanelsOnTop`
- per-tool header actions render on the right side
- active Output pane selection persists in `ideViewOptions.activeOutputPane`

Command panel UX:

- command input/history
- execute command on Enter
- clear history
- cancel running script/build when applicable
- output target selection when relevant
- future IDE commands should be made available here as interactive terminal-style commands, not through a command palette

Output panel UX:

- output pane selector: Emulator, Build, Script Output
- append-only monospace output buffer
- clear output action
- auto-scroll behavior with user override
- warning/error coloring

Recommended implementation:

- Early version: XMLUI `Tabs` with `Commands` and `Output` tab items.
- React-backed `IdeToolsArea` XMLUI component later for command history, command execution, output buffering, auto-scroll, and service-backed output panes.
- XMLUI shell handles placement and splitter only.

First visible placeholder:

- `Commands` tab with an input-like row, command history sample, and disabled run/clear buttons
- `Output` tab with Emulator, Build, and Script Output selector placeholders
- header actions for move top/bottom and maximize/restore should work before command execution works

### `IdeStatusBar`

Keep the status bar compact and information-dense.

Left side:

- machine state icon and text: Turned off, Running, Paused, Stopped, etc.
- compilation status for Klive projects:
  - not compiled
  - compilation in progress
  - compilation successful
  - compilation failed
- transient IDE status message with success/error icon

Right side:

- cursor position for Monaco-backed documents: `Ln`, line, `Col`, column
- active language/file mode if useful
- selected machine/model if space allows

Interactions:

- clickable compilation status opens Build output
- clickable machine state can focus or bring emulator window later
- clickable cursor position can open Go To Line later

Implementation:

- XMLUI-only first version is possible.
- React-backed version becomes useful when cursor/document status comes from document services.

### `Toolbar`

The current shared toolbar should remain a top-level optional surface.

IDE-specific toolbar actions should eventually be real commands/settings, not demo keys:

- Run Project
- Pause/Stop/Restart machine
- Step Into/Over/Out
- Sync source with current breakpoint
- Show Memory panel
- Show Disassembly panel
- Compile
- Inject
- Debug

Replace placeholder settings:

- `demo.ideMemoryVisible`
- `demo.ideDisassemblyVisible`
- `ide.syncSourceBreakpoints`

with either:

- existing setting constants such as `ideViewOptions.syncBreakpoints`
- command-driven tool/document opening state

### `DialogHost`

The old IDE had dialogs for:

- New Project
- Export Code
- Excluded Project Items
- First Start
- New Item
- Rename
- Delete
- Set Memory

Plan:

- Use XMLUI `ModalDialog` for the first dialog host.
- Keep dialog markup in XMLUI for simple forms and confirmations.
- Use a React-backed dialog body only when the dialog needs service access, file APIs, or advanced validation.
- The active dialog id should be reducer-owned IDE view state.
- Prefer imperative `dialog.open(params)` for UI-triggered dialogs and `when` binding only if a dialog later needs deep-link-like state.

First visible placeholder:

- one `ModalDialog` for New Project
- one confirmation-style `ModalDialog` for Delete
- one parameterized generic "Action Placeholder" dialog that can be opened from Explorer context actions until real dialogs are ported

### `Backdrop`

Use a simple XMLUI overlay or React-backed component controlled by `state.value.dimMenu`.

Purpose:

- dim UI when main menu or modal flow requires blocked interaction
- match old `BackDrop visible={dimmed}`

## State Ownership Plan

### Persisted settings

Persist through `state.setSettingValue(...)` for user preferences:

- Primary Side Bar visible
- Primary Side Bar width
- Secondary Side Bar visible
- Secondary Side Bar width
- toolbar visible
- status bar visible
- tools visible
- tools top/bottom
- tools maximized
- tool panel height
- active tool
- active output pane
- default view placement/order
- default side panel expansion and size
- editor options

### Workspace-specific settings

Store these with workspace/project settings when a project is open:

- project-specific view placement/order overrides
- project-specific Primary and Secondary Side Bar panel expansion and sizes
- editor group split layout for that workspace
- open project documents/views and active editor group
- document/view state such as cursor, scroll position, selected memory address, or selected disassembly location

Use IDE-level persisted settings as defaults when no workspace override exists.

### Shared reducer IDE view state

Add an `ideView` subtree to `AppState`.

Suggested shape:

```ts
type IdeViewState = {
  primaryActivity?: string;
  secondaryActivity?: string;
  primarySideBarPanels?: Record<string, {
    expanded: boolean;
    size?: number;
  }>;
  secondarySideBarPanels?: Record<string, {
    expanded: boolean;
    size?: number;
  }>;
  editorGroups?: Array<{
    id: string;
    activeInstanceId?: string;
    instances: string[];
  }>;
  activeEditorGroupId?: string;
  tools?: Array<{
    id: string;
    name: string;
    visible?: boolean;
  }>;
  statusMessage?: string;
  statusSuccess?: boolean;
  cursorLine?: number;
  cursorColumn?: number;
  dialogToDisplay?: string;
  editorVersion?: number;
  toolCommandSeqNo?: number;
};
```

Reducers/actions to add or finish:

- `SET_ACTIVITY`
- `SET_PRIMARY_ACTIVITY`
- `SET_SECONDARY_ACTIVITY`
- `SET_SIDEBAR_PANEL_EXPANDED`
- `SET_SIDEBAR_PANEL_SIZE`
- `SET_SIDEBAR_PANELS_STATE`
- `SET_EDITOR_GROUPS`
- `SPLIT_EDITOR_GROUP`
- `CLOSE_EDITOR_GROUP`
- `MOVE_EDITOR_INSTANCE`
- `SET_ACTIVE_EDITOR_GROUP`
- `SET_TOOLS`
- `SET_STATUS_MESSAGE`
- `SET_CURSOR_POSITION`
- `DISPLAY_DIALOG`
- `INC_EDITOR_VERSION`
- `INC_TOOL_COMMAND_SEQ_NO`

### Local XMLUI state

Keep local-only, transient interaction state out of the reducer:

- hover state
- focused tab/button state
- currently dragged splitter value before release
- temporary UI-only popover state
- local panel search/filter text unless it should persist

### Service-owned state

Document hub, project service, command service, and output buffers should stay service-owned or React-owned unless there is a clear cross-window/shared-state need.

## Registry Plan

Create a current-workspace registry near renderer IDE code, for example:

- `src/renderer/src/ide/ide-registry.ts`

Suggested registries:

- `activityRegistry`
- `sideBarPanelRegistry`
- `toolPanelRegistry`
- `documentPanelRegistry`
- `outputPaneRegistry`

Keep registry entries data-oriented:

```ts
type ActivityInfo = {
  id: string;
  title: string;
  iconName: string;
};

type SideBarPanelInfo = {
  id: string;
  title: string;
  hostActivity: string;
  renderer: React.ComponentType<any>;
  expandedOnInit?: boolean;
  initialSize?: number;
  noScrollViewer?: boolean;
  restrictTo?: string[];
  requireFeature?: string[];
  requireConfig?: string[];
};

type ToolPanelInfo = {
  id: string;
  name: string;
  renderer: React.ComponentType<any>;
  headerRenderer?: React.ComponentType<any>;
};
```

The first implementation can keep the old registry names and IDs to ease migration.

## Visual Design Notes

Use a restrained VS Code-like workbench, not a marketing UI.

Suggested dimensions:

- toolbar height: 38px
- activity bar width: 48-52px
- sidebar minimum width: 160px
- panel minimum height: 160px
- status bar height: 22-26px, not 48px long term
- document tabs height: 34-36px
- sidebar panel header height: 24px

Theme variables to add:

- `backgroundColor-ActivityBar`
- `backgroundColor-ActivityBar--hover`
- `backgroundColor-ActivityBar--active`
- `textColor-ActivityBar`
- `textColor-ActivityBar--active`
- `backgroundColor-SideBar`
- `backgroundColor-SideBarHeader`
- `borderColor-SideBarPanel`
- `textColor-SideBarPanelHeader`
- `backgroundColor-Editor`
- `backgroundColor-DocumentTab`
- `backgroundColor-DocumentTab--active`
- `textColor-DocumentTab`
- `textColor-DocumentTab--active`
- `borderColor-DocumentTab`
- `backgroundColor-ToolsArea`
- `backgroundColor-ToolsHeader`
- `backgroundColor-IdeStatusBar`
- `textColor-IdeStatusBar`

Use existing icons in `icons/` where possible:

- `files`
- `debug-alt`
- `output`
- `symbol-event`
- `beaker`
- `chevron-right`
- `close`
- `circle-filled`
- `shield`
- `lock`
- `layout-panel`
- `chevron-up`
- `chevron-down`
- `combine`
- `inject`
- `play`
- `debug`
- `pop-out`

## Accessibility And Keyboard Interaction

Activity Bar:

- focusable buttons
- `aria-pressed` for active activity
- tooltip or accessible label from activity title
- Enter/Space activates

Side Bar:

- panel headers focusable
- Enter/Space toggles expansion
- chevron rotation communicates expanded state
- panel title remains visible and ellipsized

Document Tabs:

- active tab has selected semantics
- close buttons have labels
- middle-click close remains a pointer shortcut only
- context menu actions also need keyboard equivalents later

Tools Area:

- tabs have selected semantics
- command input should keep focus rules predictable
- output panel should not steal focus on append

Status Bar:

- compact text must remain readable
- clickable sections need tooltips/labels

## Suggested Implementation Slices

Each slice should be small enough to review and verify independently. Prefer `npm run typecheck` after every slice, and use manual IDE-window inspection for layout/interactions. Avoid bundling service ports with layout work.

### Slice 0: Workbench Skeleton Cleanup

Changes:

- Normalize `IdeApp.xmlui`, `MainWorkbench.xmlui`, and `Workbench.xmlui` into one clear layout tree.
- Keep two side bar regions: Primary Side Bar on the Activity Bar side and Secondary Side Bar on the opposite side.
- Set final-looking dimensions: compact status bar, 48-52px Activity Bar, real primary/secondary side/tool/editor splitters.
- Add an initial `EditorGrid` placeholder with one group and visible split affordances.
- Add theme variables for all surfaces.

Visible result:

- The IDE window looks like a VS Code-style shell with Primary Side Bar, split-capable editor area, Tools Area, and Secondary Side Bar.
- Every region has a title or placeholder body.

Manual checks:

- resizing the window keeps regions stable
- no text overlaps
- status bar is compact

### Slice 1: Placeholder Activity Bar

Changes:

- Add Explorer, Debug, Machine info, Scripting, and Testing buttons with real icons.
- Keep active activity in local XMLUI state for this first slice if reducer support is not ready.
- Clicking an activity changes the Primary Side Bar title and placeholder body.
- Keep Secondary Side Bar independent, initially showing a "Secondary Side Bar" placeholder and one portable view.

Visible result:

- Activity Bar switching is visible immediately.
- Primary Side Bar content visibly changes by activity.
- Secondary Side Bar remains visible/independent when enabled.

Manual checks:

- every Activity Bar button has a tooltip/accessibility label
- active styling is obvious
- Enter/Space works if implemented with focusable buttons

### Slice 2: Persisted Layout Toggles

Changes:

- Bind toolbar, status bar, Primary Side Bar, Secondary Side Bar, tools panel, tools top/bottom, and tools maximize to `ideViewOptions.*` settings.
- Use `PersistedSettingOnRelease` and `SplitterSizeGuard` for primary side, secondary side, tool, and editor splitter sizes.
- Wire any toolbar/menu placeholder buttons to `state.setSettingValue(...)` rather than demo settings.

Visible result:

- The IDE can show/hide major regions and move/maximize the tools panel.

Manual checks:

- hide/show Primary Side Bar
- hide/show Secondary Side Bar
- move tools top/bottom
- maximize/restore tools
- splitter sizes persist through reload if the app is restarted by the user

### Slice 3: Primary And Secondary Side Bar Panels

Changes:

- Add a small `ideView` reducer slice or equivalent XMLUI state for primary activity, secondary activity, and panel expansion.
- Render Primary Side Bar panels for each activity with headers, chevrons, and placeholder bodies.
- Render Secondary Side Bar with independent panel state and at least one portable placeholder view.
- Use simple XMLUI layout first; postpone vertical resize between panels unless it stays small.

Visible result:

- Primary Explorer shows "Klive Project".
- Debug shows CPU, Call Stack, Watch, Breakpoints placeholders.
- Machine info shows System Variables and machine-specific placeholders.
- Scripting shows Scripting History.
- Testing shows a clear placeholder.
- Secondary Side Bar can show a different view at the same time.

Manual checks:

- panel expand/collapse works
- Primary activity switches preserve reasonable panel state
- Secondary Side Bar state is independent
- narrow side bar text ellipsizes cleanly

### Slice 4: XMLUI Tree Explorer Placeholder

Changes:

- Implement `ExplorerPanel` with XMLUI `Tree` and fixture data.
- Use file/folder icons and a custom item template if needed.
- Selecting a fixture file sets a placeholder active document.
- Add a `ModalDialog` placeholder for context actions.

Visible result:

- The Explorer looks and behaves like a real project tree before project services are ported.
- Selecting files opens visible placeholder documents.

Manual checks:

- tree expand/collapse works
- file selection changes active document area
- context action dialog opens and closes

### Slice 5: Document Area Placeholders

Changes:

- Implement `EditorGrid` with at least one `EditorGroup`.
- Use XMLUI `Tabs` for initial document tabs inside each group.
- Add split right and split down actions that create visible placeholder editor groups.
- Add placeholder document renderers for code, memory, disassembly, output transcript, image, and unknown file.
- Add a document command strip with disabled or placeholder Compile/Inject/Run/Debug buttons.

Visible result:

- Document tabs and bodies are visible early.
- Editor splits are visible and testable early.
- The same placeholder Memory and Disassembly views can be opened as document-area content.

Manual checks:

- switching tabs changes the document body
- split right and split down create stable editor groups
- closing a placeholder group leaves a sensible active group
- long names ellipsize
- no tab/body layout shift on resize

### Slice 6: Tools Area Placeholders

Changes:

- Use XMLUI `Tabs` for Commands and Output.
- Add placeholder command input/history UI.
- Add placeholder output pane selector for Emulator, Build, and Script Output.
- Keep top/bottom and maximize controls working.

Visible result:

- Tools Area feels like the final panel even before command execution and output buffers exist.

Manual checks:

- switching tools works
- active tool persists if setting binding is included
- maximize/restore still works with tabs mounted

### Slice 7: XMLUI Modal Dialog Host

Changes:

- Add `ModalDialog` instances for New Project, Delete confirmation, and generic placeholder action.
- Open them from visible buttons/context placeholders.
- Keep dialog forms XMLUI-only unless a dialog needs service-backed behavior.

Visible result:

- The IDE has real modal behavior with backdrop and focus management.

Manual checks:

- dialogs open with parameters where needed
- close button and outside click close
- forms cancel/submit close when appropriate

### Slice 8: Reusable View Host Proof

Changes:

- Add the `IdeViewInfo` registry shape.
- Register Memory, Disassembly, Output, and Scripting History as portable placeholder views.
- Render at least one view in two placements, for example Memory in Primary Side Bar and Document Area.
- Render a second portable view in Secondary Side Bar to prove side bar independence.

Visible result:

- The app proves that views are not trapped in one region.

Manual checks:

- same view identity renders with compact Side Bar chrome and full Document chrome
- placement-specific commands do not overlap or crowd the UI

### Slice 9: First Service Connection

Changes:

- Connect one placeholder to real state/service data, preferably machine state in Status Bar or project file data in Explorer.
- Keep the rest of the UI placeholder-backed.

Visible result:

- One real data path flows through the new shell without forcing a big-bang migration.

Manual checks:

- state updates re-render only the expected region
- no reducer forwarding loops
- no renderer import of Electron or Node APIs

### Later Slices: Replace Placeholders Gradually

Recommended order:

- redesigned editor/document service for editor groups and view instances
- project Explorer service integration
- command panel execution
- output buffers
- React-backed document tabs
- Monaco editor
- memory and disassembly views
- debugger side panels
- remaining dialogs

Each replacement should keep the placeholder contract intact until the real component is fully wired, so the shell remains usable throughout.

## First Concrete Components To Add

Recommended first additions in the current workspace should be minimal and visible:

- `src/renderer/src/ide/ide-registry.ts`
- `src/renderer/src/components/ide/ActivityButton.xmlui`
- `src/renderer/src/components/ide/SideBarPanel.xmlui`
- `src/renderer/src/components/ide/PlaceholderView.xmlui`
- `src/renderer/src/components/ide/ExplorerPanel.xmlui`
- `src/renderer/src/components/ide/EditorGrid.xmlui`
- `src/renderer/src/components/ide/EditorGroup.xmlui`
- `src/renderer/src/components/ide/DocumentPlaceholder.xmlui`
- `src/renderer/src/components/ide/IdeDialogHost.xmlui`

React-backed components should be added only when a slice needs them:

- `src/renderer/lib/IdeLifecycle/IdeLifecycle.tsx`
- `src/renderer/lib/IdeLifecycle/IdeLifecycleReact.tsx`
- `src/renderer/lib/IdeEditorGrid/IdeEditorGrid.tsx`
- `src/renderer/lib/IdeEditorGrid/IdeEditorGridReact.tsx`
- `src/renderer/lib/IdeEditorGroup/IdeEditorGroup.tsx`
- `src/renderer/lib/IdeEditorGroup/IdeEditorGroupReact.tsx`
- `src/renderer/lib/IdeToolsArea/IdeToolsArea.tsx`
- `src/renderer/lib/IdeToolsArea/IdeToolsAreaReact.tsx`
- `src/renderer/lib/IdeSideBar/IdeSideBar.tsx`
- `src/renderer/lib/IdeSideBar/IdeSideBarReact.tsx`

Register React-backed components in `src/renderer/lib/index.tsx` only as they are introduced.

Keep small XMLUI-only helper components near `src/renderer/src/components/ide` when they are purely presentational. Promote them to React-backed components only when interaction complexity justifies it.

## Resolved Design Decisions

- The IDE will have two side bars with VS Code-like semantics: Primary Side Bar and Secondary Side Bar.
- The document area will support split editor groups in the first implementation, starting with placeholder groups before real editors are ported.
- Klive IDE will not have a command palette. Interactive IDE commands belong in the Commands tool, using a terminal-like prompt/history model.
- Panel expansion sizes and view placement are a mix of IDE-level defaults and workspace-specific overrides.
- The old document hub service does not need to be preserved. Redesign it around editor groups, reusable workbench views, document/view instances, and placement/move operations.
