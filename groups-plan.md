# Klive IDE Editor Groups Plan

## Goal

Replace the current hard-coded `EditorGrid` split prototype with a VS Code-like editor group system that starts as a single editor group, then grows into split, movable, resizable, persistent editor groups.

The design should support Klive documents and generic panel UIs in the document area. A document group is a container of tabs/views; the editor layout decides where those groups appear on screen.

Official VS Code behavior used as reference:

- VS Code opens editors side by side vertically and horizontally, creates editor groups through split/open-to-side commands, and lets users resize and reorder groups.
- Split commands can duplicate the current editor into a new group left, right, above, or below.
- Editor groups can be arranged in grids, resized with sashes, maximized/expanded, and later moved into floating windows.
- "Split in Group" is separate from editor groups; it splits one editor inside the same group and should be a later feature.

## Current Klive Starting Point

- `src/renderer/src/components/ide/EditorGrid.xmlui` uses local `splitMode` state and hard-coded `group1` through `group4` placeholders.
- `src/renderer/src/components/ide/EditorGroup.xmlui` already renders a group shell with tabs and can host document-area `PanelRenderer` instances.
- `IdePanelLayoutState.documentGroups` stores tab membership per group, but it does not yet store the visible group topology.
- `PanelInstance.placement === "document"` plus `groupId` already gives us a good foundation for moving registered panels into document tabs.

## Model Design

Keep the existing document tab storage, but add an explicit editor group layout tree.

```ts
type EditorGroupId = string;

type EditorLayoutNode =
  | {
      type: "group";
      groupId: EditorGroupId;
    }
  | {
      type: "split";
      axis: "horizontal" | "vertical";
      children: EditorLayoutNode[];
      sizes?: number[];
    };

type EditorGroupState = {
  activeInstanceId?: string;
  instanceIds: string[];
  locked?: boolean;
};

type EditorLayoutState = {
  root: EditorLayoutNode;
  activeGroupId: EditorGroupId;
  nextGroupOrdinal: number;
  maximizedGroupId?: EditorGroupId;
};
```

Incremental state shape:

```ts
type IdePanelLayoutState = {
  // Existing fields stay intact.
  documentGroups: Record<EditorGroupId, EditorGroupState>;

  // New field.
  documentLayout: EditorLayoutState;
};
```

Default state starts with exactly one visible group:

```ts
documentGroups: {
  group1: {
    activeInstanceId: "main.asm",
    instanceIds: ["main.asm"]
  }
},
documentLayout: {
  root: { type: "group", groupId: "group1" },
  activeGroupId: "group1",
  nextGroupOrdinal: 2
}
```

The `main.asm` entry can initially remain a placeholder document instance, then later become a first-class document/panel instance. This keeps the first visible slice small.

## Command Semantics

Implement Klive command IDs with VS Code-like names and behavior:

- `workbench.action.splitEditorRight`: create a new group to the right of the active group and copy/open the active editor there.
- `workbench.action.splitEditorLeft`: create a new group to the left of the active group and copy/open the active editor there.
- `workbench.action.splitEditorDown`: create a new group below the active group and copy/open the active editor there.
- `workbench.action.splitEditorUp`: create a new group above the active group and copy/open the active editor there.
- `workbench.action.moveEditorToRightGroup`: move the active editor tab to the nearest group on the right.
- `workbench.action.moveEditorToLeftGroup`: move the active editor tab to the nearest group on the left.
- `workbench.action.moveEditorToAboveGroup`: move the active editor tab to the nearest group above.
- `workbench.action.moveEditorToBelowGroup`: move the active editor tab to the nearest group below.
- `workbench.action.moveActiveEditorGroupRight`: move the whole active group right in the layout tree.
- `workbench.action.moveActiveEditorGroupLeft`: move the whole active group left.
- `workbench.action.moveActiveEditorGroupUp`: move the whole active group up.
- `workbench.action.moveActiveEditorGroupDown`: move the whole active group down.
- `workbench.action.focusRightGroup`, `focusLeftGroup`, `focusAboveGroup`, `focusBelowGroup`: change `activeGroupId`.
- `workbench.action.closeEditorsInGroup`: close all tabs in the active group.
- `workbench.action.closeActiveEditorGroup`: remove the active group, promote focus to a neighbor, and normalize the layout tree.
- `workbench.action.toggleEditorGroupLayout`: toggle the top-level layout between horizontal and vertical where this is structurally safe.
- `workbench.action.toggleMaximizeEditorGroup`: maximize or restore the active group.

Split means "copy/open the active editor in a new group", not "move the tab". For ordinary files, this means the same document identity may have multiple view instances with separate scroll/cursor state. For registered panel UIs, the contribution must decide whether it allows multiple document instances; if not, fall back to moving the existing instance or disable the split command for that panel.

## Rendering Design

Create an `EditorGroupGrid` React-backed XMLUI component, or a small XMLUI component backed by a React renderer, that receives the layout state and renders the tree recursively:

- `group` leaf renders `EditorGroup`.
- `split.horizontal` renders children in a horizontal stack with persisted vertical sashes.
- `split.vertical` renders children in a vertical stack with persisted horizontal sashes.

Prefer reusing the existing `PersistedSizeSplitter` behavior for group sashes, but only after confirming it can represent nested group sizes cleanly. If it becomes awkward, extract a lower-level generic splitter core from it.

`EditorGrid.xmlui` should eventually become a thin shell:

- Header/toolbar.
- `SharedAppState`.
- `EditorGroupGrid layout="{state.value.idePanelLayout.documentLayout}" groups="{state.value.idePanelLayout.documentGroups}"`.

## Slice Plan

### Slice 0: Plan And Baseline

Deliverables:

- Save this plan as `groups-plan.md`.
- No runtime behavior changes.

Verification:

- Document-only change; no tests required.

### Slice 1: Add Single-Group Editor Layout State

Deliverables:

- Add `documentLayout` to `IdePanelLayoutState`.
- Add default single-group layout.
- Add migration/sanitization so old settings without `documentLayout` get `group1`.
- Keep existing `documentGroups` shape.

Unit tests:

- Default layout has one `group1` leaf and active group `group1`.
- Loading old persisted layout without `documentLayout` creates a valid single-group layout.
- Layout normalization removes references to missing groups.

UI testability:

- App still shows the same single editor group or current prototype view.

### Slice 2: Render Single Group From State

Deliverables:

- Replace `EditorGrid` local `splitMode` with state-driven single-group rendering.
- Remove hard-coded `group2`, `group3`, `group4` display paths from the first active code path.
- Keep placeholder tabs/documents so the UI is visible immediately.
- Selecting/clicking inside a group sets `documentLayout.activeGroupId`.

Unit tests:

- Reducer action `SET_ACTIVE_EDITOR_GROUP` updates `activeGroupId`.
- Invalid group IDs are ignored.

Manual checks:

- IDE starts with one group.
- Existing document/panel tabs render.
- Dropping a document panel into `group1` still works.

### Slice 3: Split Right And Split Down

Deliverables:

- Add reducer actions for `SPLIT_EDITOR_GROUP` with `direction: "right" | "down"`.
- Add toolbar buttons in `EditorGroup` for Split Right and Split Down.
- New group receives a copy/opened view of the active editor where allowed.
- If there is no active editor, create an empty placeholder group.

Unit tests:

- Split right creates a horizontal split containing old and new groups.
- Split down creates a vertical split.
- Active group moves to the new group.
- Original group keeps its tab list.

Manual checks:

- Clicking Split Right shows two groups.
- Clicking Split Down shows stacked groups.

### Slice 4: Split Left And Split Up

Deliverables:

- Extend `SPLIT_EDITOR_GROUP` with `direction: "left" | "up"`.
- Insert the new group before the active group on the appropriate axis.
- Normalize nested splits with the same axis so the tree does not grow unnecessary wrappers.

Unit tests:

- Split left inserts before active group.
- Split up inserts above active group.
- Splitting inside an existing split preserves sibling order.

Manual checks:

- All four split directions are reachable from the group header or tab context menu placeholder.

### Slice 5: Recursive Group Renderer And Sashes

Deliverables:

- Implement recursive rendering for arbitrary layout trees.
- Add group resize sashes.
- Persist group split sizes in `documentLayout.root.sizes`.
- Use theme variables/classes for sash color, hover color, active color, and thickness.

Unit tests:

- Resize action updates only the target split node.
- Persisted sizes survive state roundtrip.
- Normalization clamps invalid size arrays.

Manual checks:

- Two-column, two-row, and nested split layouts resize smoothly.
- Resizing one split does not move unrelated groups.

### Slice 6: Active Group And Open Target

Deliverables:

- Clicking a group, tab, or document surface activates that group.
- Opening a file from Explorer targets the active unlocked group.
- Opening to the side uses the configured default direction, initially `right`.

Unit tests:

- `OPEN_DOCUMENT_IN_ACTIVE_GROUP` appends/reuses a tab in active group.
- `OPEN_DOCUMENT_TO_SIDE` creates a side group when needed.
- Existing tabs are focused rather than duplicated unless explicitly split/copied.

Manual checks:

- Click group 2, then open a file: file appears in group 2.
- Open to side creates/focuses a side group.

### Slice 7: Move Active Editor Between Groups

Deliverables:

- Add directional move-editor actions.
- Find nearest group by layout geometry.
- Move active tab from source group to target group.
- If source group becomes empty, either leave the empty group or close it according to an explicit setting. Start by leaving it empty for predictable testing.

Unit tests:

- Move right transfers active instance to right neighbor.
- Move left/up/down behave symmetrically.
- Moving with no neighbor is a no-op.
- Active instance and active group update predictably.

Manual checks:

- Tabs can be moved between groups using menu commands.

### Slice 8: Move Active Editor Group

Deliverables:

- Add directional move-group actions.
- Reorder the active group leaf within the layout tree.
- Keep group contents unchanged.
- Preserve split sizes as much as possible; normalize when a split becomes degenerate.

Unit tests:

- Move group right swaps or relocates the group with the nearest right group.
- Nested moves do not lose groups.
- Active group remains active after move.

Manual checks:

- Whole groups move without changing their tabs.

### Slice 9: Close And Normalize Groups

Deliverables:

- Close active editor group.
- Close all editors in group.
- When closing the last group, recreate a single empty `group1` or keep one empty group.
- Normalize layout tree after every group removal.

Unit tests:

- Closing middle group removes only that group.
- Parent split with one child collapses.
- Active focus moves to the nearest visible group.
- Last group close leaves a valid single-group state.

Manual checks:

- Close commands never leave a blank document area.

### Slice 10: Menu Integration

Deliverables:

- Add View > Editor Layout menu commands matching VS Code names where appropriate:
  - Split Editor Right
  - Split Editor Down
  - Split Editor Left
  - Split Editor Up
  - Toggle Vertical/Horizontal Editor Layout
  - Single Editor Group
  - Two Columns
  - Two Rows
  - Grid (2x2)
- Add editor tab/group context menu placeholders if the existing menu infrastructure supports it.
- Dispatch through shared state actions, not renderer globals.

Unit tests:

- Menu command handlers dispatch the intended shared actions.

Manual checks:

- Menu commands change the IDE UI immediately.

### Slice 11: Predefined Layouts

Deliverables:

- Add commands for common layouts:
  - Single
  - Two Columns
  - Three Columns
  - Two Rows
  - Three Rows
  - Grid 2x2
- Reuse existing groups when possible; create empty groups only when needed.
- Move surplus groups into the first group or preserve them as hidden only if a clear UX is defined. Start by preserving all groups visibly through generated grid cells.

Unit tests:

- Each predefined layout produces a valid normalized tree.
- Existing group tab contents survive layout changes.

Manual checks:

- Switching layouts does not lose open documents/panels.

### Slice 12: Drag And Drop Tabs Between Groups

Deliverables:

- Drag tabs from one editor group to another.
- Support move by default and copy with a modifier later.
- Show drop indicators for before/after tab positions and group-edge split targets.
- Reuse existing panel drag source/drop target conventions where possible.

Unit tests:

- Drop tab into group inserts at requested tab index.
- Drop tab on group edge creates a split group.
- Copy drop creates a separate view instance when allowed.

Manual checks:

- Drag a Memory document tab into another group.
- Drag a file tab to the right edge to create a new group.

### Slice 13: Maximize, Expand, And Restore

Deliverables:

- Implement `toggleMaximizeEditorGroup`.
- Start with maximize: hide other groups and let active group fill the editor area.
- Later add expand: keep other groups visible at minimum sizes.
- Double-clicking a tab can call the maximize command if desired.

Unit tests:

- Maximize stores and restores previous layout.
- Closing a maximized group restores a valid layout.

Manual checks:

- Maximize/restore behaves without side bar or tool panel layout changes.

### Slice 14: Split In Group

Deliverables:

- Add optional per-editor split state inside a single group.
- Keep it separate from editor groups.
- Support split, join, toggle layout, focus first side, focus second side, focus other side.

Unit tests:

- Split-in-group affects only the active editor tab.
- Group topology is unchanged.

Manual checks:

- Split one code editor inside `group1` without creating `group2`.

### Slice 15: Locked Groups

Deliverables:

- Add `locked` group state.
- New ordinary document opens skip locked groups unless explicitly targeted.
- Persist lock state.

Unit tests:

- Open document skips active locked group and chooses nearest unlocked group.
- Explicit move/drop into locked group still works.

Manual checks:

- Lock a Memory group, open a source file, source file opens elsewhere.

## Persistence And Migration

- Extend existing IDE panel layout persistence to include `documentLayout`.
- Persist group sizes, active group, active tab per group, maximized state, and lock state.
- Keep a sanitizer that guarantees:
  - Every group leaf has a matching `documentGroups[groupId]`.
  - Every `documentGroups` entry referenced by visible layout has valid `instanceIds`.
  - There is always at least one group leaf.
  - Split nodes never have fewer than two children after normalization.
  - Size arrays match child count or are discarded.

## Open Design Decisions

- File document identity should be separated from view instance identity before true split/copy semantics are considered complete.
- Empty group behavior should be explicit. VS Code can keep group structure in some scenarios; Klive can initially keep empty groups until close commands are implemented.
- Floating editor windows are out of scope for the first implementation.
- Pinned tabs and preview tabs are out of scope until the core group model is stable.
- `Split in Group` is intentionally later because it is not the same thing as editor groups.

## Suggested Implementation Order

Implement Slices 1 through 5 first. At that point the UI will have real state-backed editor groups, visible split commands, nested rendering, resizable groups, persistence, and useful reducer coverage.

Then implement Slices 6 through 10 to make editor groups feel like a real workbench feature: active group targeting, move commands, close commands, and menu integration.

Treat Slices 11 through 15 as polish and advanced VS Code parity.
