# Generic IDE Panels Plan

## Goal

Create a unified panel/view system for Klive IDE where one registered UI contribution can appear in multiple IDE locations:

- Primary side bar
- Secondary side bar
- Document/editor area
- Tool area

The same registered UI should be movable between locations, support multiple independent view instances where appropriate, and persist its layout between activity changes and Klive app sessions.

## Core Terms

- **Panel contribution**: The registered UI type, for example `memory`, `watch`, `breakpoints`, `z80Cpu`, `scriptingHistory`.
- **Panel renderer**: The XMLUI user-defined component that renders the contribution UI.
- **Panel instance**: A concrete visible instance of a contribution. It has its own `instanceId`, placement, size, transient UI state, and context.
- **Placement**: Where an instance lives: `primarySideBar`, `secondarySideBar`, `document`, or `toolArea`.
- **Activity attachment**: Optional metadata saying a contribution should initially appear in the primary side bar for a particular Activity Bar activity.
- **View state**: Per-instance UI state such as memory scroll position, selected address, collapsed sections, active tab, or filter text.

## Important XMLUI Constraint

XMLUI currently does not provide a clean mechanism to render an arbitrary user-defined component by string name and pass arbitrary context into it.

So this plan should not depend on runtime code like:

```xmlui
<DynamicComponent name="{panel.componentName}" context="{panel.context}" />
```

Instead, use a central static XMLUI dispatcher:

```xmlui
<Component name="PanelRenderer">
  <MemoryPanel when="{$props.panelId === 'memory'}" context="{$props.context}" />
  <WatchPanel when="{$props.panelId === 'watch'}" context="{$props.context}" />
  <BreakpointsPanel when="{$props.panelId === 'breakpoints'}" context="{$props.context}" />
  <Z80CpuPanel when="{$props.panelId === 'z80Cpu'}" context="{$props.context}" />
</Component>
```

This is less magical but reliable. It also keeps all XMLUI panel UDCs discoverable by the compiler and language tooling.

Later, if XMLUI adds dynamic component instantiation, only `PanelRenderer` needs to change.

## Panel Registration

Create a TypeScript panel registry, for example:

```ts
export type PanelPlacement = "primarySideBar" | "secondarySideBar" | "document" | "toolArea";

export type PanelContribution = {
  id: string;
  title: string;
  icon: string;
  rendererId: string;
  defaultPlacement?: PanelPlacement;
  defaultActivityId?: string;
  allowMultipleDocumentInstances?: boolean;
  allowSideBar?: boolean;
  allowDocument?: boolean;
  allowToolArea?: boolean;
  defaultSize?: number;
  initiallyExpanded?: boolean;
};
```

Example contributions:

```ts
[
  {
    id: "z80Cpu",
    title: "Z80 CPU",
    icon: "debug-alt",
    rendererId: "z80Cpu",
    defaultPlacement: "primarySideBar",
    defaultActivityId: "debug",
    allowSideBar: true,
    allowDocument: true,
    initiallyExpanded: true
  },
  {
    id: "memory",
    title: "Memory",
    icon: "memory-icon",
    rendererId: "memory",
    defaultPlacement: "secondarySideBar",
    allowSideBar: true,
    allowDocument: true,
    allowToolArea: true,
    allowMultipleDocumentInstances: true
  }
]
```

The registry answers “what can exist?” but not “where is it now?”. The layout state answers that.

## Layout State

Add a reducer-owned IDE layout model to shared state or persisted global settings.

Suggested shape:

```ts
export type PanelInstance = {
  instanceId: string;
  contributionId: string;
  placement: PanelPlacement;
  activityId?: string;
  groupId?: string;
  expanded?: boolean;
  size?: number;
  order: number;
  context?: Record<string, unknown>;
};

export type IdePanelLayoutState = {
  instances: Record<string, PanelInstance>;
  primarySideBarByActivity: Record<string, string[]>;
  secondarySideBar: string[];
  toolArea: string[];
  documentGroups: Record<string, {
    activeInstanceId?: string;
    instanceIds: string[];
  }>;
  viewStateByInstance: Record<string, Record<string, unknown>>;
};
```

This layout state should persist as an IDE/workspace-specific setting. If there is no persisted layout, initialize it from the panel registry:

- Contributions with `defaultActivityId` appear in the primary side bar for that activity.
- Contributions with `defaultPlacement: "secondarySideBar"` appear in the secondary side bar.
- Tool-area defaults appear in `toolArea`.
- No document instances are created unless a contribution wants an initial document tab.

## Primary Side Bar

The primary side bar should be activity-owned. It renders the panel instances attached to the current activity.

Flow:

1. Read `activeActivity` from `SharedAppState`.
2. Look up `layout.primarySideBarByActivity[activeActivity]`.
3. Render those instance IDs in order.
4. Each side-bar panel header uses contribution title/icon.
5. Each side-bar panel body renders:

```xmlui
<PanelRenderer
  panelId="{contribution.rendererId}"
  instanceId="{instance.instanceId}"
  placement="primarySideBar"
  context="{instance.context}"
/>
```

Current activity-specific UDCs such as `DebugSideBarPanels` should be transitional. The target is a generic `PanelStackHost` that receives a list of `PanelInstance` records.

## Secondary Side Bar

The secondary side bar should not be activity-owned. It should be layout-owned, like VS Code.

Behavior:

- It shows whatever panel instances the user pinned or dragged there.
- Changing Activity Bar selection should not replace its contents.
- It can host Memory, Outline, Scripting History, Watch, Breakpoints, etc.
- It uses the same `PanelStackHost` as the primary side bar, but the list comes from `layout.secondarySideBar`.

## Document Area

The document area needs one more layer: document groups.

A panel contribution can appear as a document tab. If the contribution allows multiple document instances, each editor group can have its own instance of the same contribution.

Example:

- Group 1 has `memory:instance-a`, scrolled to top.
- Group 2 has `memory:instance-b`, scrolled to bottom.

Those are two `PanelInstance`s with the same `contributionId` but different `instanceId`s and different `viewStateByInstance` records.

Document tabs should distinguish contribution identity from instance identity:

- Tab title can be `Memory`.
- Internal key is `instanceId`.
- Drag/drop moves an instance unless the command explicitly clones it into another group.

## Tool Area

The tool area can reuse the same model as side bars, probably as tabs rather than collapsible panels.

Target:

```xmlui
<ToolAreaHost instanceIds="{layout.toolArea}" />
```

Each tool tab renders `PanelRenderer`. The existing Commands and Output UI can become registered panel contributions:

- `commands`
- `output`

This makes the future command terminal movable to the document area or secondary side bar if desired.

## Panel Context

Every panel renderer receives a stable runtime context. This context is not just descriptive metadata; it is also the panel's state gateway.

```ts
export type PanelRenderContext = {
  contributionId: string;
  instanceId: string;
  placement: PanelPlacement;
  activityId?: string;
  groupId?: string;
  chrome: "sideBar" | "document" | "tool";
  readonly?: boolean;
  getState: <T = unknown>(key: string, defaultValue?: T) => T;
  setState: (key: string, value: unknown) => void;
  patchState: (patch: Record<string, unknown>) => void;
  getGlobalState: <T = unknown>(key: string, defaultValue?: T) => T;
  setGlobalState: (key: string, value: unknown) => void;
};
```

State scopes:

- **Instance state** is tied to `instanceId`. Use it for Memory scroll position, selected address, filters, watch panel input, etc.
- **Contribution global state** is tied to `contributionId`. Use it for defaults shared by all instances of the same panel contribution, such as preferred number format or column visibility.
- **Layout state** is tied to placement/order/size/expanded state and should stay in the panel layout reducer.

Example: two document groups can both display `memory`, but each has a different `instanceId`, so each can remember a different scroll position.

In XMLUI, do not pass opaque functions directly as arbitrary objects if a simpler bridge component can expose them. Prefer a small stateful React-backed XMLUI component:

```xmlui
<PanelRuntime
  id="panel"
  instanceId="{$props.instanceId}"
  contributionId="{$props.contributionId}"
  placement="{$props.placement}"
/>

<MemoryPanelBody
  instanceId="{panel.instanceId}"
  placement="{panel.placement}"
  initialAddress="{panel.getState('address', 0)}"
  onAddressChanged="address => panel.setState('address', address)"
/>
```

`PanelRuntime` should expose:

- reactive metadata: `instanceId`, `contributionId`, `placement`, `groupId`, `chrome`
- reactive state value: `panel.value`
- APIs: `getState`, `setState`, `patchState`, `getGlobalState`, `setGlobalState`

Avoid using an API property named `value` in `registerComponentApi`; publish reactive state through XMLUI `updateState`, following the existing `SharedAppState` pattern.

## XMLUI And React Context Bridge

Some panel bodies should remain XMLUI-only UDCs. Others will need high-performance React implementations, for example memory dump virtualization, disassembly lists, waveform/timeline displays, or trace views.

Both must use the same runtime context.

Recommended structure:

```text
PanelHost / PanelRenderer
  creates PanelRenderContext
  provides React context
  passes explicit XMLUI props

PanelRuntime XMLUI component
  bridges context/state APIs into XMLUI expressions

MemoryPanel.xmlui
  may call panel.getState(...) and panel.setState(...)
  may wrap a React component for heavy rendering

MemoryPanelReact.tsx
  reads the same context through usePanelRuntime()
  reports state changes through runtime.setState(...)
```

For React-backed panels, provide a normal React context:

```ts
export const PanelRuntimeReactContext = createContext<PanelRenderContext | null>(null);

export function usePanelRuntime(): PanelRenderContext {
  const runtime = useContext(PanelRuntimeReactContext);
  if (!runtime) throw new Error("Panel runtime is missing");
  return runtime;
}
```

`PanelHost` should wrap the rendered panel body with this provider. React-backed XMLUI components can then use `usePanelRuntime()` without receiving every context function as individual props.

For XMLUI UDCs, expose the same runtime through `PanelRuntime`:

```xmlui
<PanelRuntime id="panel" instanceId="{$props.instanceId}" />
```

This gives XMLUI markup a controlled API surface while React components get idiomatic hooks.

Do not create separate state stores for XMLUI and React panel bodies. The bridge and hook should both dispatch the same reducer actions:

- `PATCH_PANEL_VIEW_STATE`
- `SET_PANEL_INSTANCE_STATE`
- `SET_PANEL_CONTRIBUTION_STATE`

## Memory Panel State Example

Memory panel instance state:

```ts
{
  address: 0x8000,
  scrollTop: 420,
  bytesPerRow: 16,
  numberBase: "hex"
}
```

XMLUI shell:

```xmlui
<Component name="MemoryPanel">
  <PanelRuntime id="panel" instanceId="{$props.instanceId}" />
  <MemoryDump
    address="{panel.getState('address', 0)}"
    scrollTop="{panel.getState('scrollTop', 0)}"
    onAddressChanged="address => panel.setState('address', address)"
    onScrollChanged="scrollTop => panel.setState('scrollTop', scrollTop)"
  />
</Component>
```

React body:

```tsx
export function MemoryDumpReact() {
  const panel = usePanelRuntime();
  const scrollTop = panel.getState<number>("scrollTop", 0);

  return (
    <VirtualMemoryList
      initialScrollTop={scrollTop}
      onScrollIdle={(nextScrollTop) => panel.setState("scrollTop", nextScrollTop)}
    />
  );
}
```

For performance, scroll events should be throttled or persisted on idle/unmount. Do not dispatch shared-state updates for every raw wheel or scroll event.

## View State

Each panel UI stores transient per-instance view state through the runtime bridge. The bridge may be implemented as a React-backed XMLUI component, for example:

```xmlui
<PanelRuntime id="panel" instanceId="{$props.instanceId}" />
```

APIs:

- `panel.value`
- `panel.getState(key, defaultValue?)`
- `panel.setState(key, value)`
- `panel.patchState(object)`

This keeps `MemoryPanel` scroll position or selected address independent between document groups.

Persist view state selectively:

- Persist panel layout, placement, order, size, expanded state.
- Persist useful user intent such as memory address, selected bank, filters.
- Avoid persisting high-frequency pixel scroll on every frame; debounce or persist on unmount/idle.

## Drag And Drop

Add drag handles to panel headers and document/tool tabs.

Drag payload:

```ts
type PanelDragPayload = {
  type: "klive/panel-instance" | "klive/panel-contribution";
  instanceId?: string;
  contributionId: string;
  sourcePlacement?: PanelPlacement;
  sourceGroupId?: string;
};
```

Drop targets:

- Primary side bar stack
- Secondary side bar stack
- Document group tab strip/body
- Tool area tab strip

Rules:

- Dragging an existing instance moves it.
- Dragging a contribution from a future “views” menu creates an instance.
- Dropping into a document group creates or moves a document tab.
- If a contribution does not allow multiple document instances and one already exists, focus/move the existing instance instead of cloning.
- If a contribution does allow multiple document instances, dropping into another group can either move or clone. Use modifier-key behavior later; start with move.

Reducer actions:

```ts
MOVE_PANEL_INSTANCE
CREATE_PANEL_INSTANCE
CLOSE_PANEL_INSTANCE
SET_PANEL_EXPANDED
SET_PANEL_SIZE
SET_PANEL_ORDER
PATCH_PANEL_VIEW_STATE
RESET_PANEL_LAYOUT
```

## Persistence

Persist layout through the existing settings path:

- Global IDE preference: default secondary side bar visibility, general layout defaults.
- Workspace-specific preference: panel placements, panel sizes, document groups, panel view state.

Use one setting key initially:

```ts
ideViewOptions.panelLayout
```

Later split if needed:

- `ideViewOptions.panelLayout`
- `ideViewOptions.panelViewState`
- `ideViewOptions.documentGroups`

## Migration From Current Code

Current state:

- `SideBar.xmlui` chooses activity-specific UDCs.
- Activity-specific UDCs contain hardcoded `SideBarPanelItem`s.
- `IdeViewHost` already demonstrates view rendering by `viewId`, placement, and chrome.
- Document area has placeholder typed documents.
- Tool area has hardcoded tabs.

Migration target:

- Replace activity-specific side-bar UDCs with a generic `PanelStackHost`.
- Keep current panel body UDCs such as `Z80CpuPanel`, `WatchPanel`, and `BreakpointsPanel`.
- Move the panel list from XMLUI markup into the registry plus layout state.
- Keep `PanelRenderer.xmlui` as the one static switchboard that maps `rendererId` to actual UDC.

## Z80 CPU Panel Proof Of Concept

Use the old React panel at `/Users/dotneteer/source/kliveide-ref/src/renderer/appIde/SiteBarPanels/Z80CpuPanel.tsx` as the first real proof of the generic panel concept.

Why this panel is a good proof:

- It is currently visible in the Debug activity side bar, so it can be tested early without new navigation.
- It has a compact, known VS Code-like panel layout.
- It needs live emulator data, so it proves the IDE-to-emulator API path.
- It is display-heavy enough to justify a React-backed panel body while still being small enough to test.

Target shape:

```text
Debug primary side bar
  PanelStackHost
    PanelInstance z80Cpu/debug
      PanelRenderer rendererId="z80Cpu"
        Z80CpuPanel.xmlui
          Z80CpuPanelReact
            EmuApi.getCpuState()
```

`Z80CpuPanel.xmlui` should become a thin XMLUI wrapper, not the owner of the register rendering logic. The value-heavy body should live in React so formatting, refresh behavior, loading, and error states can be unit tested with normal TypeScript helpers.

### Z80 CPU State API

Add a renderer-to-renderer API method from IDE to Emulator:

```ts
export type Z80CpuState = {
  af?: number;
  bc?: number;
  de?: number;
  hl?: number;
  ix?: number;
  iy?: number;
  pc?: number;
  sp?: number;
  af_?: number;
  bc_?: number;
  de_?: number;
  hl_?: number;
  i?: number;
  r?: number;
  wz?: number;
  lastMemoryRead?: number;
  lastMemoryWrite?: number;
  lastIoRead?: number;
  lastIoWrite?: number;
  im?: number;
  snoozed?: boolean;
  iff1?: boolean;
  iff2?: boolean;
  interruptBlocked?: boolean;
  halted?: boolean;
  tacts?: number;
  tactsInFrame?: number;
};

export class EmuApi {
  getCpuState(): Promise<Z80CpuState | null> {
    return Promise.resolve(null);
  }
}
```

Implementation notes:

- Keep this in API messaging, not SharedAppState. CPU state is a queried emulator snapshot, not shared reducer state.
- Implement `getCpuState()` in `EmuMessageProcessor` in `src/renderer/messaging.ts`.
- Read from the active SP48 controller/machine through `getActiveSp48Controller()`.
- Return `null` if there is no active machine yet, instead of throwing.
- Keep the returned object plain and serializable. Do not expose machine/controller objects across process boundaries.
- Put machine-to-DTO mapping in a pure helper, for example `src/renderer/emu/sp48/z80CpuState.ts`, so it can be unit tested with a fake machine/controller.

The first implementation can map only the values already exposed by the active machine API. If some old fields are not available yet, leave them `undefined` and render placeholder values. The UI should still be visible and useful.

### Z80 Panel UI Behavior

The panel should support these states from the first visible implementation:

- **Loading**: compact body while the first `getCpuState()` request is in flight.
- **No emulator**: friendly placeholder when `getCpuState()` returns `null`.
- **Snapshot**: register/flag layout matching the old Klive IDE panel.
- **Refresh**: automatic refresh on emulator state/frame events when available; otherwise a short interval or explicit refresh button is acceptable for the proof.
- **Formatting**: hexadecimal values padded to 2, 4, or larger widths as appropriate.

The panel should receive `PanelRenderContext` as soon as the runtime exists. For the first proof, it does not need much instance state, but it should still be wired correctly:

- Store optional display preferences such as number casing or collapsed detail groups as instance state.
- Do not store the CPU snapshot itself in panel layout state.
- If the panel is later moved to the document area, the same React body should keep working through the same runtime hook.

## Suggested Implementation Slices

### Slice 0: Z80 API Contract And Formatting Helpers

- Add `Z80CpuState` and `EmuApi.getCpuState()` to `src/common/messaging/EmuApi.ts`.
- Add pure helpers for Z80 display formatting:
  - `toHex8(value)`
  - `toHex16(value)`
  - `toFlag(value, bitNo)`
  - placeholder formatting for `undefined`
- Add unit tests for formatting and flag extraction.
- Add a messaging/proxy unit test if an existing API proxy test pattern is available; otherwise keep this covered by typecheck until the messaging test harness is introduced.

UI testability: no visible UI change yet, but this slice is intentionally tiny and gives the next slice a typed contract.

### Slice 1: Visible React-Backed Z80 CPU Panel

- Replace the current static `Z80CpuPanel.xmlui` body with a thin wrapper around `Z80CpuPanelReact`.
- Render a deterministic sample `Z80CpuState` when no API provider is wired yet, or behind a `debugSampleState` prop used only by tests/development.
- Match the old panel's visual structure:
  - flag row `S Z 5 H 3 P N C`
  - main and shadow registers
  - `I/R/WZ`
  - last memory and IO read/write
  - interrupt/halt/clock fields
- Keep it in the current Debug side bar so it is visible immediately.
- Add unit tests for the pure view model that converts `Z80CpuState` into display rows.

UI testability: launch the IDE, select Debug, and the Z80 CPU panel should be visible even before the live API is complete.

### Slice 2: Live IDE-To-Emulator CPU Snapshot

- Implement `EmuMessageProcessor.getCpuState()`.
- Add a pure machine/controller-to-`Z80CpuState` mapper and unit test it with a fake machine.
- Wire `Z80CpuPanelReact` to call `emuApi.getCpuState()` from the IDE window.
- Display loading, null, and error states.
- Refresh on a conservative cadence or on the existing emulator state listener/event if one is already exposed cleanly.

UI testability: run emulator and IDE windows, then confirm the Debug Z80 CPU panel changes from sample/placeholder state to a live snapshot.

### Slice 3: Registry And Static Renderer

- Add `src/renderer/src/components/ide/panel-registry.ts`.
- Add `PanelRenderer.xmlui`.
- Register current panel UDCs in the registry.
- Keep current side bars unchanged except rendering panel bodies through `PanelRenderer`.
- Include `z80Cpu` as the first registered real panel contribution.
- Add unit tests for registry lookup and default contribution metadata.

### Slice 4: Panel Runtime Context

- Add `PanelRuntime` as a React-backed XMLUI bridge component.
- Add `PanelRuntimeReactContext` and `usePanelRuntime()` for React-backed panel bodies.
- Define state API semantics:
  - `getState`
  - `setState`
  - `patchState`
  - `getGlobalState`
  - `setGlobalState`
- Wire the bridge to temporary in-memory state first so panel bodies can be tested before persistence.
- Convert the Z80 CPU panel to receive the runtime hook, even if it only stores a small display preference at first.
- Convert `MemoryPanel` or a placeholder memory panel to read and update `scrollTop` through the runtime API.
- Add unit tests for per-instance `getState`, `setState`, and `patchState` behavior.

### Slice 5: Layout And View-State Reducer

- Add `IdePanelLayoutState`.
- Add reducer actions for expand/collapse, order, size, move, instance state, and contribution state.
- Initialize default layout from registry.
- Persist through `ideViewOptions.panelLayout`.
- Make `PanelRuntime` dispatch the reducer actions instead of using temporary in-memory state.
- Add reducer tests for:
  - default Debug layout includes `z80Cpu`
  - panel size/expanded state survives activity switches
  - per-instance state is independent

### Slice 6: Generic Side-Bar Stack Host

- Add React-backed `PanelStackHost` or extend the existing `SideBarPanelStack`.
- It accepts a list of `PanelInstance` records and renders panel headers/body.
- Use `PanelRenderer` for the body.
- Keep current resize, animation, and panel-size memory behavior.
- Add unit tests for stack sizing helpers where they are pure.

### Slice 7: Primary Side Bar From Layout

- Make primary side bar render `layout.primarySideBarByActivity[activeActivity]`.
- Remove hardcoded activity panel UDCs.
- Confirm activity switching preserves panel sizes and expanded states.
- Confirm `z80Cpu` is still visible in Debug after the hardcoded `DebugSideBarPanels` path is removed.

### Slice 8: Secondary Side Bar From Layout

- Render `layout.secondarySideBar`.
- Ensure activity switching does not change secondary side bar contents.
- Add placeholder “empty secondary side bar” state.
- Add reducer tests that moving/copying a panel into the secondary side bar is independent from `activeActivity`.

### Slice 9: Document Area Panel Instances

- Add panel document tabs.
- Allow opening a contribution as a document.
- Support multiple instances for panels that declare `allowMultipleDocumentInstances`.
- Store per-instance state separately.
- Confirm the same registered panel body can render in a document tab.
- Use Memory as the primary multiple-instance proof; use Z80 CPU as a single-instance or shared-snapshot proof unless duplication becomes useful.

### Slice 10: Tool Area Panel Instances

- Convert Commands and Output into panel contributions.
- Render tool tabs from layout.
- Persist active tool tab and order.

### Slice 11: Drag And Drop

- Add drag handles and drop targets.
- Implement moving between side bars first.
- Then side bar to document group.
- Then document group to tool area.
- Persist resulting layout.
- Add reducer tests for move/create/close operations before wiring pointer interactions.

### Slice 12: Workspace Layout Persistence

- Decide global vs workspace-specific boundaries.
- Store panel layout in workspace settings when a workspace exists.
- Fall back to IDE global settings when no workspace is open.
- Add reset layout command.

## Risks And Decisions

- XMLUI dynamic rendering by string is not available; use `PanelRenderer.xmlui` as the deliberate switchboard.
- Drag and drop should be implemented in React-backed host components, not ad hoc XMLUI handlers.
- Panel bodies should remain XMLUI UDCs unless they need complex DOM behavior.
- High-frequency state such as scroll should be debounced and stored per instance.
- Do not store mutable objects directly in reducers; layout updates must be immutable.
- Document-area panel instances need clear identity rules, or duplicate Memory tabs will become confusing.

## Near-Term Recommendation

Start with the Z80 CPU panel proof because it gives the fastest useful UI feedback and proves the IDE-to-emulator data path. Then introduce the registry and `PanelRenderer.xmlui` while keeping the current side-bar UI visible. After the same Z80 panel renders through the registry, replace the hardcoded side-bar UDCs with a generic stack. This keeps the UI testable at every step and avoids another blank side-bar failure.
