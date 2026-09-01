# IPC Communication Audit & Fix Plan

Created: 2026-09-01

## Verdict

The main ↔ EMU-renderer ↔ IDE-renderer messaging layer has one dominant
architectural pattern repeated everywhere: cross-process state sync rides on
**fire-and-forget action forwarding** with no acknowledgment of delivery, no
retry, and no timeout anywhere in the request/response transport either. This
session already found and fixed four concrete bugs caused by this pattern
(see "Already Fixed This Session" below). This audit found the same pattern
responsible for several more bugs of materially larger blast radius — most
notably, the IDE window's *entire* initial settings/machine-state broadcast
can be silently and permanently lost (C1) — plus two independent
data-integrity risks unrelated to the timing pattern (A1/A3) and a handful of
smaller correctness bugs.

None of this is exotic: every failure mode below is a plain, everyday app
action (open a project, insert a disk, exclude a folder, save on rename)
racing against ordinary IPC/process-scheduling latency, which is why it
reads as intermittent and disproportionately hits Windows.

## Scope Checked

Core transport:
- `src/common/messaging/MessengerBase.ts`, `MessageProxy.ts`, `messages-core.ts`
- `src/common/messaging/{Emu,Ide}ToMainMessenger.ts`, `MainTo{Emu,Ide}Messenger.ts`
- `src/common/state/redux-light.ts`, `src/main/main-store.ts`
- `src/main/index.ts` IPC registration/handlers (`ipcMain.on("EmuToMain"/"IdeToMain", ...)`, `forwardActions`, window creation/menu setup ordering)
- `src/renderer/appEmu/MainToEmuIpc.ts`, `src/renderer/appIde/MainToIdeIpc.ts` (renderer-side request-listener registration)

API surfaces:
- Renderer → Main: `src/main/RendererToMainProcessor.ts` (~32 methods), `src/common/messaging/MainApi.ts` (~53 declarations)
- Main → EMU: `src/renderer/appEmu/MainToEmuProcessor.ts` (~42 methods), `src/common/messaging/EmuApi.ts`, `src/renderer/appEmu/MachineService.ts`
- Main → IDE: `src/renderer/appIde/MainToIdeProcessor.ts` (~6 methods), `src/common/messaging/IdeApi.ts`
- A renderer-wide sweep for the same "read forwarded state right after an unrelated awaited call" race already found twice this session

Every finding below was traced to exact file:line citations; the highest-impact
and most surprising ones (copyToSdCard race, IDE-startup effect ordering,
saveKliveProject await inconsistency, MessageProxy NotReady handling) were
independently re-verified by direct reading, not taken solely on audit-agent
report.

## Already Fixed This Session (context/traceability)

These five fixes are already merged (commit `52f3beda0`) and establish the
pattern the rest of this plan continues:

1. `src/renderer/appIde/IdeEventsHandler.tsx` — added `ensureBuildRootsLoaded()`, used by `NewProjectDialog.tsx` before reading `buildRoots`, so the "navigate to build root" step doesn't race the forwarded `SET_BUILD_ROOT` action.
2. `src/renderer/appIde/useIdeStartup.ts` — "open last project at startup" now reads settings directly via `mainApi.getAppSettings()` instead of depending on the one-shot `INIT_GLOBAL_SETTINGS` broadcast landing in the store before a listener exists.
3. `src/renderer/appIde/IdeEventsHandler.tsx` — `ensureProjectLoaded()` now returns `boolean` and callers skip document restoration instead of silently attempting it against an empty tree.
4. `src/renderer/appIde/restoreLastOpenDocuments.ts` — per-document/per-area try/catch so one failing document doesn't cascade into dropping every other tab.
5. `src/renderer/appEmu/MachineService.ts` — `setMachineType()` gained a generation counter so two overlapping calls (app-default-machine startup vs. project-open) can no longer publish a not-yet-set-up machine.

---

## Part 1 — Architectural Issues

> **STATUS: IMPLEMENTED (2026-09-01).** All five recommended systemic fixes below
> (S1, S2, S3, S5, S6, plus the required forwarder-rejection companion) have
> been carried out. S4 is addressed only in the "surface failures" sense — the
> forwarding path still has no delivery guarantee by design; see the note under
> "Recommended systemic fixes" for what was deliberately left out. S7 was
> skipped: it is not a bug, and renumbering the correlation counters would have
> added churn with no behavioral benefit.
>
> Two refinements were discovered while implementing, and are worth recording
> because they changed the shape of the fix:
>
> 1. **`NotReady` responses never carried a `correlationId`**
>    (`MainToEmuIpc.ts`, `MainToIdeIpc.ts`). So the S3 symptom was not, as the
>    audit concluded, "silently returns `undefined`" — the response could never
>    be matched to its pending request at all, so the caller **hung forever**.
>    Fixing `MessageProxy` alone would therefore have changed nothing on this
>    path; echoing the correlation ID back was the necessary other half.
> 2. **Registering the listener earlier (S6) was not by itself sufficient to fix
>    C1.** With the listener registered but the app services not yet cached, the
>    readiness guard answered `NotReady` and still dropped the action — trading a
>    silent transport-level drop for a silent handler-level rejection. A
>    forwarded state action needs only the store, so the store and messenger are
>    now published to the out-of-React path at module load, and the guard only
>    demands app services for requests that actually use them.

These are root causes; fixing them closes whole classes of the endpoint
findings in Part 2 at once.

**S1. No timeout anywhere in the request/response transport.**
`MessengerBase.sendMessage()` (`src/common/messaging/MessengerBase.ts:27-47`)
creates a Promise whose *only* resolution path is a correlationId-matched
response via `processResponse()`. There is no timeout, no rejection path for
"never arrived," and no cleanup of the resolver `Map` entry if that happens —
a hang and a memory leak together. Every one of the ~90+ `MainApi`/`EmuApi`/
`IdeApi` methods goes through this. Only `NewProjectDialog.tsx` (4 call
sites) wraps calls in a local, one-off `withTimeout()` helper; nothing else
is protected. (One edge case: if the underlying `send()` throws *synchronously*
— e.g. a non-serializable argument causing a structured-clone error — the
outer promise does reject, but the Map entry still leaks.)

**S2. A destroyed/missing target window silently drops the message.**
Both directions: `src/main/index.ts:599,616` only send an `EmuToMain`/
`IdeToMain` *response* `if (window?.isDestroyed() === false)`; `MainToEmuMessenger.send()`/`MainToIdeMessenger.send()` (`src/common/messaging/MainToEmuMessenger.ts:25-29`, `MainToIdeMessenger.ts:27-31`) apply the same check to *requests* going the other way. Combined with S1, a window closing/destroying at the wrong moment produces a permanent, silent hang with zero signal to the caller.

**S3. `NotReady` responses are silently treated as success.**
`src/common/messaging/MessageProxy.ts:20-23` only special-cases
`response.type === "ErrorResponse"`; a `NotReadyResponse` (sent by
`MainToEmuIpc.ts`/`MainToIdeIpc.ts` when `getCachedAppServices()` isn't ready
yet) falls through to `return response.result`, which is `undefined` for a
`NotReady` message — masquerading as "call succeeded, returned nothing"
instead of surfacing the real "target not ready yet" condition.

**S4. Fire-and-forget action forwarding is the default mechanism for *all*
cross-window state sync**, not just the two cases already fixed this session.
`redux-light.ts` `dispatch()` (`src/common/state/redux-light.ts:103-124`,
line ~119): `if (source && forwarder) { (async () => await forwarder(action, source))(); }`
— never awaited, no `.catch()`. `main-store.ts`'s own forwarder
(`src/main/main-store.ts:11-35`) relays main-originated actions to *both*
renderers the same way. Every UI-triggered dispatch with a `source` rides
this path. Electron does not queue undelivered `webContents.send`/
`ipcRenderer.send` messages for listeners that register later — a message
sent before the target's listener exists is gone forever, no redelivery.

**S5. `forwardActions()` in `main/index.ts` isn't try/catch'd, and its ack
lies about what actually happened.**
`src/main/index.ts:643-647`:
```ts
async function forwardActions(message: RequestMessage): Promise<ResponseMessage | null> {
  if (message.type !== "ForwardAction") return null;
  mainStore.dispatch(message.action, message.sourceId);
  return defaultResponse();
}
```
Unlike the adjacent `processRendererToMainMessages` branch (which *is*
try/catch'd), a throwing dispatch here (malformed action, reducer error)
becomes an unhandled rejection in the `ipcMain.on` handler and no response is
ever sent — permanent hang for the caller (combines with S1). Separately,
`defaultResponse()` is returned the instant the *local* `mainStore.dispatch`
call returns — before the action has even started relaying to the other
renderer (that relay is itself another instance of S4) — so a "success" ack
here only ever means "main's local reducer ran," never "delivered."

**S6. Renderer-side IPC *request* listeners register too late, structurally.**
`registerMainToEmuIpc()`/`registerMainToIdeIpc()` are called from a plain
passive `useEffect` (`src/renderer/appEmu/useEmuStartup.ts:47`,
`src/renderer/appIde/useIdeStartup.ts:51`). In the IDE window specifically,
that `useEffect` is declared *before* the same component's
`useLayoutEffect` (line 53) — but React guarantees all layout effects
(across the whole tree) run before any passive effects, so the heavier
`useLayoutEffect` work (Monaco init, `ideLoadedAction()`) actually commits
*first*, and the IPC listener registers *after*. Both windows are shown
immediately with no `show: false` gate (EMU always; IDE whenever
`showIdeOnStartup`/`--showide` applies), so OS focus events and main's own
`emuLoaded`-gated broadcast burst can fire well before either renderer has
had a chance to run this effect. By contrast, the *response* listeners
(`EmuToMainMessenger`/`IdeToMainMessenger`, constructed synchronously at
renderer module load in `main.tsx`) and the *main-side* request listeners
(`ipcMain.on(...)`, registered at main's module top-level) are both safely
early — this gap is specific to the two renderer-side request listeners.

**S7. Minor: ad hoc, per-messenger correlation-ID scheme.**
`MainToIdeMessenger` seeds its request counter at `1000` for no functional
reason (each messenger has its own private `Map`, so there's no collision
risk either way) — a small sign this layer grew organically. Not a bug;
worth normalizing only if `MessengerBase` is being touched anyway.

### Recommended systemic fixes, ranked by effort:value

1. **Fix S3** (`MessageProxy.ts`) — treat `NotReady` the same as `ErrorResponse`. One file, isolated, no behavior change for any currently-working path.
2. **Fix S6** — move `registerMainToEmuIpc()`/`registerMainToIdeIpc()` out of a passive `useEffect` into synchronous/early registration (module load, or at minimum a `useLayoutEffect` that runs before any other work in that component). This single change closes the two highest-impact findings in Part 2 (B1, C1) and the focus-state-sync gap, at the root, for both windows.
3. **Fix S5** — wrap `forwardActions(msg)` in the same try/catch pattern already used for `processRendererToMainMessages`.
4. **Add a default timeout + rejection to `MessengerBase.sendMessage()`**, with per-call override and — critically — resolver-Map cleanup on timeout so S1's leak closes too. This must land together with a `.catch()` on every fire-and-forget forwarder call site (`redux-light.ts`, `main-store.ts`) — otherwise the newly-possible rejections just become unhandled-rejection console noise instead of hangs, which is progress but should be deliberate, not incidental.
5. **Harden S2's destroyed-window guards to at least log** instead of silently dropping, so a timeout (from #4) at least has diagnostic context.
6. **Not recommended near-term:** true delivery guarantees (sequence numbers, gap detection, persistent retry with receiver-side idempotency). This would be a deliberate, larger redesign of the message envelope (`messages-core.ts`) and both send/receive paths — treat it as a separate decision if the app ever needs it, not an incremental patch alongside the above.

---

## Part 2 — Endpoint-Specific Findings

### Group A — Renderer → Main

**A1. [Data-integrity risk, HIGH confidence] `copyToSdCard` races the cached SD-card file handle.**
`src/main/RendererToMainProcessor.ts:396-416` calls `invalidateSdCardHandler()`
(clears the shared `cimHandler` singleton in `src/main/machine-menus/zx-next-menus.ts:260-291`,
closing its fd), then opens its **own** independent `CimFile`/`Fat32Volume`/
`FileManager` on the same `.cim` file and awaits a real, multi-chunk
`fm.copyFile(...)`. Any `readSdCardSector`/`writeSdCardSector` call that
lands during that window (e.g. the running emulated machine doing SD I/O —
reachable from a KSX script or normal NextZXOS activity while a build's
`copyToSdCard` runs) calls `getSdCardHandler()`, finds the cache empty, and
**lazily opens a second, independent handler on the same file** — two
uncoordinated writers mutating one FAT32 image. The code's own comments show
awareness of "stale handle" conflicts but don't close this window.
*Fix:* route `copyToSdCard`'s mutation through the same shared handler (or a
mutex/queue) instead of invalidating the cache and operating independently.

**A2. [Data-integrity risk, confirmed] `copyToSdCard` has no try/finally.**
Same method, same lines: if `fm.copyFile(...)` throws (missing source, disk
full), `cimFile.close()` is skipped — leaking the fd *and* leaving the
handler cache empty from A1's invalidation, so all subsequent SD-card access
transparently opens a fresh handler while the failed copy's handle lingers.
*Fix:* `try { await fm.copyFile(...); } finally { cimFile.close(); }`.

**A3. [Data-integrity risk, HIGH confidence, verified directly] `saveKliveProject()` is un-awaited from 4 call sites.**
`src/main/projects.ts:356-368` awaits a real cross-window IPC round trip
(`getEmuApi().listBreakpoints()`) before writing `project.json`. Confirmed by
direct grep: `RendererToMainProcessor.ts:423` (inside `saveProject()`, the
main "save" API renderers call directly), `:472` (inside
`applyProjectSettings()`), `:691` (inside `checkBuildRoot()`), and
`settings-utils.ts:94` (inside `setSettingValue()` when a setting has
`saveWithProject`) all call `saveKliveProject()` **without** `await` — while
~20 other call sites elsewhere (`app-menu.ts`, `machine-menus/*.ts`) correctly
await it. Two overlapping un-awaited saves can resolve out of start-order;
the **last to finish** (not last to start) wins and silently overwrites
`project.json` with its (possibly stale) snapshot — exact same shape as the
already-fixed `MachineService.setMachineType` bug, applied to project-file
persistence, reachable through everyday actions (rename/delete in the
explorer, resizing a panel, toggling a project-scoped setting).
*Fix:* add `await` at all 4 sites; consider also serializing
`saveKliveProject()` itself (an in-flight-promise dedup) so it's safe
regardless of caller discipline. Note also: the function swallows all errors
silently (`catch { /* intentionally ignored */ }`) — even the correctly
awaited call sites never learn if a save actually failed; worth a follow-up
even though it's outside this audit's IPC-timing focus.

**A4. [Silent no-op on Windows, second confirmed instance] Path-separator first-occurrence-only bug.**
`src/main/directory-content.ts:78`: `.map((v) => v.replace("/", path.sep))`
pairs with the already-known, still-unfixed `RendererToMainProcessor.ts:252`:
`.replace(path.sep, "/")`. Both use `String.prototype.replace` with a plain
string (first occurrence only). Concrete effect: excluding a *nested* folder
(2+ path segments) from the project via the explorer context menu produces a
path that's only partially separator-converted; on Windows the resulting
mixed-separator string never prefix-matches `path.join()`-built paths, so the
exclusion silently fails to apply even though the setting reports as saved.
*Fix:* use global-regex replacement (`.replace(/\\/g, "/")` and
`.replace(/\//g, path.sep)`) at **both** sites.

**A5. [Hang risk]** Same issue as **S5** above — `forwardActions()` in
`main/index.ts` not try/catch'd — independently surfaced by this audit too.

**A6. [Resource leak, MEDIUM impact] `hasNextAutoExec()` leaks a file descriptor.**
`src/main/RendererToMainProcessor.ts:777-787` opens a `CimFile` (real
`fs.openSync` fd) and never calls `.close()` on any path. Invoked once per ZX
Next code injection/load — accumulates over a long dev session toward OS fd
limits. *Fix:* try/finally with `cimFile.close()`.

**A7. [Low priority, not recommended for near-term work]** `deleteFileEntry`/
`renameFileEntry`/`addNewFileEntry` (`RendererToMainProcessor.ts:275-343`)
use `fs.existsSync` check-then-act (TOCTOU). Real, but requires external
interference with the same file mid-call; low likelihood for a single-user
desktop app. Listed for completeness only.

### Group B — Main → EMU renderer

**B1. [Hang risk, HIGH confidence, unusually high severity] EMU menu commands — and the app's own mandatory startup call — can fire before `registerMainToEmuIpc()` has run.**
Same root cause as S6: the EMU window is shown immediately (no `show:false`),
its menu is live before the renderer's `useEffect` runs, and — critically —
main's own `await setMachineType(...)` at `main/index.ts:340` (the app's
default-machine initialization, unconditional on every launch) sends over
this same channel. If it races ahead of the listener, the entire startup
subscriber callback stalls forever on that `await`, since nothing after it
in that callback ever runs. *Fix:* covered by the S6/F2 systemic fix.

**B2. [Correctness gap in this session's own fix, MEDIUM impact] Superseded `setMachineType` calls resolve as silent success.**
The generation-counter fix (already shipped) correctly stops the crash, but
`MainToEmuProcessor.setMachineType()` still resolves as plain success either
way — so `openFolderByPath()` (`main/projects.ts:167` onward, which then
applies machine-specific settings and replays breakpoints) has no way to
know it "lost" and is now operating against a different live machine than
requested. More likely to matter now that this session's `useIdeStartup.ts`
fix made "open last project" fire reliably. *Fix:* have `setMachineType`
return/throw a "superseded" signal that `MainToEmuProcessor` and
`registeredMachines.ts` propagate, so callers can detect and retry.

**B3. [Cosmetic but user-visible, trivial fix] `setDiskFile` always reports "Drive A".**
`src/renderer/appEmu/MainToEmuProcessor.ts:199`: `diskIndex[0] ? "B" : "A"`
— `diskIndex` is a `number`, not indexable, so this is always `undefined` →
always `"A"`. The actual disk operation is correct (uses a separately
computed `mediaId`); only the confirmation message text is wrong.
*Fix:* `diskIndex ? "B" : "A"`.

**B4. [Dead code today, live trap tomorrow] `getAllBreakpoints` missing `return`.**
`MainToEmuProcessor.ts:604-610` — always yields `undefined`. Harmless today
(not exposed on `EmuApi.ts`, zero callers), but should be fixed or deleted so
it doesn't silently break whoever wires it up next.

**B5. [Narrow-window data race, MEDIUM confidence] Breakpoint mutation has no mutual exclusion.**
The project-open replay (`main/projects.ts:178-187`: erase-all then a
setBreakpoint/enableBreakpoint loop, one IPC round trip at a time) and any
IDE-driven single-breakpoint edit sent independently straight to the same
EMU handler (`breakpoint-utils.ts`, `BreakpointCommands.ts`, `ScriptService.ts`)
have no serialization. A user toggling a gutter breakpoint at the exact
moment a project finishes loading can have their edit silently wiped, or
vice versa. *Fix:* serialize breakpoint mutations through one queue/lock in
the EMU renderer, or replace erase+loop with one atomic "reset to this set"
message.

### Group C — Main → IDE renderer, and cross-window race sweep

**C1. [Highest blast-radius finding in this audit, HIGH confidence] The IDE window's entire initial state batch can be silently, permanently lost.**
`main/index.ts:299-370` fires roughly a dozen `mainStore.dispatch(..., "main")`
calls — theme, "is Windows," screen-recording availability, **every** global
setting (`INIT_GLOBAL_SETTINGS`), start-screen flag, machine-specific
settings, clock multiplier, sound level, every media slot, machine type, and
model type — the instant the EMU window reports ready, completely decoupled
from IDE-window readiness. Each is forwarded fire-and-forget (S4) over the
same "MainToIde" channel whose listener registers too late (S6). If this
whole burst arrives before that listener exists — plausible whenever IDE's
heavier startup (Monaco init) lags EMU's lighter one, exactly the scenario
already confirmed responsible for two other bugs fixed this session — the
IDE window is left running with default theme, wrong/default machine type
and model, no key mappings, wrong sound level and clock multiplier,
**indefinitely, with zero fallback** (unlike "open last project," which this
session's fix made resilient specifically because it no longer trusts this
broadcast). *Fix:* S6/F2 closes the root cause. As defense in depth, consider
also having `useIdeStartup.ts` pull a full settings/machine-state snapshot
directly via a request/response call, the same pattern already used for
"open last project."

**C2. [Exact duplicate of an already-fixed bug — independently confirmed by two separate audit passes] `NewProjectCommand.ts` never got the `ensureBuildRootsLoaded` fix.**
`src/renderer/appIde/commands/NewProjectCommand.ts:56-62` (the `newp ... -o`
command-palette/CLI path) reproduces the exact build-root race fixed in
`NewProjectDialog.tsx` this session — it reads `buildRoots` right after
`ensureWorkspaceLoaded()` without calling the already-existing
`ensureBuildRootsLoaded(store)` helper. *Fix:* one line —
`await ensureBuildRootsLoaded(context.store);` before the read, exactly
mirroring `NewProjectDialog.tsx`.

**C3. [Structural, can be mitigated but not fully closed, MEDIUM impact] Imperative IDE commands trust a lagging state mirror with zero wait.**
`emulatorState.machineState` reads in `MachineCommands.ts` (multiple sites),
`CompilerCommand.ts`, `KliveCompilerCommands.ts`; `.project.buildRoots`/
`.isKliveProject`/`.hasBuildFile` in `CompilerCommand.ts`/`ScriptCommands.ts`.
These are command handlers, not React renders, so `useSelector`-style
self-correcting reactivity doesn't apply — a value read here is a one-shot
synchronous snapshot of whatever the last-forwarded action happened to set.
Two machine/build commands issued in quick succession (keybinding, or a KSX
script driving Start then Pause) can have the second act on a stale value.
*Fix:* for the highest-value commands (start/stop/pause/inject), query EMU
directly via a request/response call instead of trusting the mirror — the
same "read live, don't trust the mirror" principle behind this session's
fixes. Full closure isn't realistic; this is a mitigation, not a fix.

**C4. [Minor UX ordering, low severity]** `app-menu.ts:739-740` fires two
`getIdeApi().executeCommand(...)` calls back-to-back without awaiting the
first ("switch to build output pane" then "run"/"debug") — no serialization
on `IdeCommandService`, so the two round trips can interleave.
*Fix:* `await` the first call.

**C5. [Cleanup only, not a bug]** `ideStateSynched`/`emuStateSynched`
(`AppState.ts`, `app-state-flags-reducer.ts`) are written but never read
anywhere anymore — vestigial from the approach this session's fix replaced.
*Fix:* delete, so a future change doesn't accidentally reintroduce the old
race by gating something on them again.

---

## Part 3 — Recommended Implementation Order

**Phase 1 — Quick, isolated, high-confidence wins** (low risk, do first):
1. C2 — `NewProjectCommand.ts`: add the missing `ensureBuildRootsLoaded` call (1 line, mirrors existing code)
2. ~~S3 — `MessageProxy.ts`: treat `NotReady` as an error, same as `ErrorResponse`~~ **DONE**
3. B3 — `setDiskFile` drive-letter message fix
4. B4 — `getAllBreakpoints` missing `return`
5. C5 — delete vestigial `ideStateSynched`/`emuStateSynched`
6. C4 — await ordering fix in `app-menu.ts`

**Phase 2 — Root-cause fix for the two biggest findings** (B1, C1) and the general listener-registration gap:
7. ~~S6 — move `registerMainToEmuIpc()`/`registerMainToIdeIpc()` to synchronous/early registration instead of a passive `useEffect`~~ **DONE** (plus the store/messenger caching and readiness-guard refinement described in the Part 1 status note — needed for C1 to actually close)

**Phase 3 — Data-integrity fixes** (independent of the transport work; should not wait):
8. A1 + A2 — `copyToSdCard` handler race + missing try/finally
9. A3 — `await saveKliveProject()` at all 4 sites; consider serializing the function itself
10. A4 — global-regex path-separator fix at both sites (`directory-content.ts:78` + the still-open `RendererToMainProcessor.ts:252`)
11. A6 — `hasNextAutoExec` fd leak

**Phase 4 — Transport hardening** (do together — they interact): **ALL DONE**
12. ~~S5/A5 — try/catch around `forwardActions()` in `main/index.ts`~~ **DONE** (also guards the null-response `TypeError` noted under S2)
13. ~~Default timeout + rejection in `MessengerBase.sendMessage()`, with resolver-Map cleanup~~ **DONE** — `DEFAULT_REQUEST_TIMEOUT_MS = 60s`, per-call override, and an explicit opt-out list (`UNBOUNDED_*_METHODS`) for calls that block on user input or run indefinitely
14. ~~S2 — destroyed-window guards start logging/signaling instead of silently dropping~~ **DONE** — main→renderer sends now throw a typed `TargetWindowUnavailableError` (fail fast rather than waiting out the timeout); renderer→main response drops log a warning
15. ~~Add `.catch()` handlers to the fire-and-forget forwarder chains~~ **DONE** — centralized in `redux-light.ts`'s dispatch, which ignores `TargetWindowUnavailableError` (expected during shutdown) and logs everything else; `main-store.ts` now delivers to both renderers via `allSettled` so one unreachable window cannot suppress the other

**Phase 5 — Remaining correctness/robustness items** (lower urgency, opportunistic):
16. B2 — propagate a "superseded" signal from `setMachineType`
17. B5 — breakpoint-mutation serialization
18. C3 — highest-value IDE commands query EMU live instead of trusting the mirror

**Explicitly not recommended near-term:**
- True delivery guarantees / persistent-outbox redesign (Part 1, item 6) — a deliberate bigger decision, not an incremental patch
- A7 — TOCTOU file-entry checks — low likelihood for a single-user desktop app
- S7 — correlation-ID scheme normalization — only worth doing opportunistically if `MessengerBase` is touched anyway for Phase 4

## Validation Commands

```
npm run build:check
npx vitest run --config build/vitest.config.ts
```

Manual verification recommended for the data-integrity fixes (A1-A3), since
they involve real timing windows that unit tests may not exercise: rapid
rename/delete in the explorer while a project setting is being toggled (A3),
and a `copyToSdCard` operation started while the emulated machine is actively
doing SD I/O (A1) — both are hard to write a deterministic automated
regression test for without dedicated fault-injection hooks.
