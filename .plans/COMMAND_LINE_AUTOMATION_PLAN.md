# Command Line and Automation Plan (G6.1)

Status: **live half implemented** (2026-10-09): Phases 3–6 are done (§10 records what was built,
the departures and the findings). Phases 0–2 - the CLI skeleton's headless verbs, `klive run`, the
harness move and packaging - are open. D1–D18 are the decisions; the author accepted the suggested
answers to all §9 questions (2026-10-08), which the decisions already assume.
**Build order (Q2):** the live half (Phases 3–6) comes first. Phases 0–2 come after it, unless G5.6
has built the skeleton by then. **G5.6 has (2026-10-09):** `klive test`, `klive build`, the packaged
launchers and the PATH installers are in place ([UNIT_TESTS_CLI_PLAN.md](UNIT_TESTS_CLI_PLAN.md) §9),
so what remains here is headless `klive run` and the harness move.

Scope:
- [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md) **G6.1**: drive Klive from a command line or
  a script to build, run, test and read memory. It covers CI and automation, **not** editor
  integration (roadmap decision D1: no DAP server, no VS Code, no DeZog remote).
- G6.1 has two halves:
  - **Headless verbs.** `klive build` and `klive run` work on a fresh machine instance in a Node
    process, with no window, the same way as G5.6's `klive test`. These are for CI.
  - **A live-IDE transport.** A local, authenticated channel into a *running* Klive, and the
    `klive ide …` verbs that use it. These are for scripts, editors' task runners and the user's own
    tooling: build and run the open project, pause it, read memory and registers, set breakpoints,
    run any IDE command, and wait for a breakpoint.

Builds on:
- [UNIT_TESTS_CLI_PLAN.md](UNIT_TESTS_CLI_PLAN.md) (G5.6). That plan defines the CLI skeleton:
  - the Electron binary in Node mode (its D1);
  - the verb shape and exit codes (D2, D3);
  - packaging outside the asar and the launchers (D11, D12);
  - the `src/cli/` layout, which leaves room for this plan's verbs and transport (D13).
  
  This plan **adopts those decisions unchanged**. Whichever of G5.6 and G6.1 lands first builds the
  skeleton (§1.2).
- [Z80_UNIT_TESTS_PLAN.md](Z80_UNIT_TESTS_PLAN.md) (G5.5) §4.2: `HeadlessMachineFactory`, which maps
  a machine id/model to its `*WasmV2Machine`, WASM artifact and ROMs. `klive run` needs the same
  factory. Whichever plan lands first builds it.
- The IDE's existing remote-control surface in the main process:
  - `getIdeApi().executeCommand(text)` already runs any IDE command from main. Menus, Klive Script
    and `history-export` use it.
  - `getEmuApi()` already covers the machine commands, `getMemoryContents`, `getCpuState`,
    `setMemoryContent`, `setRegisterValue`, breakpoints, and code injection and running.
  
  The transport is a thin layer in main over these two APIs. It needs no new renderer machinery
  except output capture (D9).

Not in scope:
- A DAP server, a DeZog remote or a gdbstub (roadmap D1).
- Network access from another machine. The transport is local-only (D3). A TCP option for Docker or
  WSL is §1.3.
- A GUI-less IDE. The live transport drives a Klive whose windows exist. The IDE window may stay
  hidden (`--noide`).
- Real-hardware targets. G6.4 brings its own link. Once that lands, `klive ide` works against a
  hardware session without changes, because it talks to `EmuApi`.

---

## 1. What is being added, and why

Today the only way to drive Klive from outside is Playwright: `scripts/doc-shots/harness.cjs` types
into the command prompt and reads the DOM. That works for our own screenshots, but no user can
depend on it. The competitive analysis (§2 "Scripting / automation", §4 W6) records the gap:
ZEsarUX has ZRCP, CSpect has plugins, MAME has a gdbstub, and Klive has no external API.

Klive Script (`.ksx`) already gives automation *inside* the IDE: `$emu`, `$command` and build hooks.
G6.1 brings the same power to the outside, in two forms:

1. **Headless, for CI.** Examples: `klive build`, then `klive run game.nex --frames 500 --screenshot
   out.png`, then `klive run --until-pc $8100 --dump-mem $C000:256=state.bin`. No window, no display
   server, results byte-identical between runs. This extends G5.6 from "run tests" to "run a
   program and look at it".
2. **Live, for a developer's own tools.** Examples: `klive ide build && klive ide debug`,
   `klive ide wait --stopped --timeout 30`, `klive ide regs`, `klive ide mem $5C00 64`, and a small
   JSON-RPC protocol that a Python or Node script can speak directly. These work on the open project
   in the IDE the user is looking at.

### 1.1 Decisions

| # | Decision |
| --- | --- |
| D1 | **One executable, two families of verbs.** `klive` is G5.6's launcher (the Electron binary in Node mode; G5.6 D1). Headless verbs: `test` (G5.6), `build` (G5.6 D2) and `run` (this plan). Live verbs live under `klive ide <verb>`, so a reader of a CI script can tell at a glance which commands need a running IDE. `klive ide` with no verb prints the connection status. |
| D2 | **The live transport is JSON-RPC 2.0 over a local stream socket, one JSON message per line** (NDJSON, UTF-8). Node's `net` module gives a Unix domain socket on macOS and Linux and a named pipe on Windows with the same code. This needs no new dependency. JSON-RPC is chosen because every language has a client, and because requests, responses and notifications (D11) map onto it directly. Binary payloads (memory, screenshots) are base64 strings in the JSON. |
| D3 | **Local only; never TCP, never HTTP.** A socket file or named pipe cannot be reached from another machine. It also cannot be reached from a web page. A localhost HTTP or WebSocket server could be: DNS rebinding and cross-origin requests from any site the user opens are the classic attacks on such servers. There is no listening port to firewall, scan or explain. |
| D4 | **Off by default.** The server starts only when the setting `automation.enabled` is on: Settings › IDE › Automation, or `set -u automation.enabled 1`, effective immediately with no restart. It also starts when Klive is launched with `--automation`, for that run only. `klive ide … --launch` uses this flag (D12). A status-bar item shows that automation is listening and how many clients are connected. A click on it opens the Automation output pane (D13). |
| D5 | **Authentication by a per-session token in a private connection file**, as Jupyter does it. When the server starts, it creates a 32-byte random token and writes `<klive-home>/run/automation.json`: `{ protocol: 1, socket, token, pid, version, startedAt }`. The file has mode `0600` in a `0700` folder; on Windows it is in the user profile, which is per-user. The first request on a connection must be `session.hello { token, client }`, checked with a constant-time compare. Anything else, or a wrong token, gets an error and the connection is closed. The token changes on every start. The file is deleted on quit, and a stale file is recognised by its dead `pid`. `<klive-home>` follows `KLIVE_SETTINGS_FILE` (`src/main/settings-path.ts`), so isolated test instances get their own file and socket (T6). |
| D6 | **The socket itself is private too.** POSIX: the socket lives in `<klive-home>/run/` (`0700`). If that path is longer than the platform's socket-path limit (104 bytes on macOS, 108 on Linux; T3), it falls back to `$XDG_RUNTIME_DIR` or a `0700` folder under `os.tmpdir()`, named by a hash of the home path. Windows: `\\.\pipe\klive-<user-sid-hash>-<random>`. The pipe name is random per start and published only in the connection file. The token check is what actually guards it, because Node cannot set a pipe DACL (T4). |
| D7 | **Three permission levels, chosen in settings, enforced per method.** `read` covers state, memory, registers, breakpoint lists and screenshots. `control` adds start/pause/stop/step, breakpoints, memory and register writes, and building and running the open project. `full` adds `ide.command` (any IDE command text) and `project.open`. **The default when enabled is `control`.** `full` is a separate opt-in (`automation.level full`), because IDE commands reach the file system (`set`, `ncp`, `script-run` with `fs`) and amount to running code as the user. Each method declares its level in one table (`src/main/automation/methods.ts`), and a test checks that no method is unlisted. |
| D8 | **The method set (protocol 1).** Each method maps onto an existing API; §4.2 has the full table. In summary: `session.*` (hello, info, capabilities), `machine.*` (state, start, pause, stop, reset, restart, debug, step, wait), `cpu.get`/`cpu.set`, `memory.read`/`memory.write` (address or partition, max 64 KB per call), `breakpoints.list/set/remove/clear`, `project.info/build/run/debug/inject/export`, `screen.capture`, `ide.command`, and `events.subscribe`/`unsubscribe`. Method names are stable API: renaming one needs a protocol version bump. |
| D9 | **`ide.command` returns the command's output, not only its result.** `IdeApi.executeCommand` writes to the Build pane and returns `{ success, finalMessage, value }`. A new `IdeApi.executeCommandCaptured(text)` runs the command into a fresh `OutputPaneBuffer` and also *mirrors* it to the Build pane, so the user can still see what a script did. It returns the lines as plain text (`getContents()`, colours stripped) plus the result. `build` uses the same path, so `project.build` can return the diagnostics. |
| D10 | **Building goes through the IDE's own commands.** The IDE renderer orchestrates compilation; there is no build entry point in main. So `project.build`, `project.run`, `project.debug` and `project.export` call the same command texts the Machine menu uses (`outp build`, `run`, `debug`, `expc …`). Their structured results are parsed from the command's `value`. Where a command has no structured `value` yet, the plan adds one (e.g. `compile` returns `{ errors: [{file, line, column, message}] }`) instead of parsing text. |
| D11 | **Events are JSON-RPC notifications, sent only after `events.subscribe`.** Protocol 1 has `machine.stateChanged {state, pc}`, `machine.breakpointHit {address, partition, kind}`, `project.built {success, errorCount}` and `ide.output {pane, text}` (opt-in, noisy). They come from the main store subscription that `index.ts` already has for machine state. `machine.wait { until: "paused"\|"stopped"\|"running", timeoutMs }` is implemented on top of them, so the CLI needs no polling. |
| D12 | **The `klive ide` client.** Verbs: `status`, `start`, `pause`, `stop`, `reset`, `debug`, `step [into\|over\|out]`, `wait`, `build`, `run`, `inject`, `export`, `regs [--json]`, `mem <addr> [<len>] [--partition p] [--out file] [--format hex\|bin\|json]`, `poke <addr> <bytes…>`, `bp list\|set\|rm\|clear`, `screenshot <file.png>`, `cmd "<ide command>"`, `events [--json]` (streams notifications until Ctrl+C) and `rpc <method> [json]` (raw calls). Options: `--timeout <s>`, `--json` (machine-readable output on every verb), and `--launch` (start Klive with `--automation --noide` when no live server answers, then wait for the connection file; the launched instance stays open). Exit codes follow G5.6 D3: **0** ok; **1** the command ran but reported failure (`cmd` with `success: false`, a build with errors as **2**); **3** usage, no running Klive, automation off, or a permission level too low (the message names the setting to change); **4** internal or protocol error. **5** is added for a `wait` timeout. |
| D13 | **The user can see and stop automation.** The Automation output pane logs each connection (client name from `session.hello`) and each method call, one line per call, with arguments summarised and memory payloads never printed. **Klive › Automation › Disconnect all** drops every client. Turning the setting off closes the server and deletes the connection file. |
| D14 | **Requests run one at a time, in arrival order, across all clients.** The IDE was not written for concurrent command execution, and the user is typing too. One queue in main makes ordering predictable. Each request has a server-side timeout: 60 s by default, overridable per call with `timeoutMs`, and unbounded for `machine.wait`, which waits outside the queue. A timed-out request answers with an error. Its underlying IDE command cannot be cancelled and finishes in the background (T5). |
| D15 | **`klive run` is the headless runner** (no IDE, Node mode). `klive run [<project-dir>\|<file.tap\|.tzx\|.sna\|.z80\|.szx\|.nex\|.kls>] [--machine id[:model]] [--rom p=file]…` loads a project build (compiling it as `klive build` does) or a file. It runs until one of these stops it: `--frames n`, `--tstates n`, `--until-pc <addr>[,…]`, `--until-halt`, a breakpoint hit (`--bp <addr>`, the IDE syntax), or `--timeout <emulated-s>`. Optional inputs: `--keys "<text>"` (typed with the harness's key-free frames) and `--wait-frames n` before typing. After the stop it writes `--dump-mem <addr>[:<len>]=<file>`, `--dump-regs [file.json]`, `--screenshot <file.png>` and `--save-state <file.kls>`. Exit codes: **0** when the stop condition was reached; **5** when `--timeout` ran out first; **2**, **3** and **4** as in G5.6. Runs are deterministic: identical inputs give byte-identical outputs (G5.6 D10). |
| D16 | **The headless runner reuses the harness's machine handling, moved out of `test/`.** The harness sessions (`test/harness/sp48`, `zxnext`, `zx81`, …) already boot real ROMs, type keys, load `.P`/`.TAP` files and render the picture. Their machine-agnostic parts move to `src/common/headless/`, next to `HeadlessMachineFactory`. The harness and the CLI then share one implementation, and the harness becomes a thin test wrapper over it. A PNG encoder (currently test-only, in `test/zx8081-hw/goldens.ts`) moves to `src/common/imaging/png.ts`. |
| D17 | **The protocol is documented as a public contract.** `docs/content/working-with-ide/automation.mdx` gives the setting, the security model, every `klive ide` verb, the JSON-RPC method reference, and two short clients (Node and Python, each under 40 lines, using only the standard library). A **protocol test** (§6) drives a real server with the documented examples, so the docs cannot drift. |
| D18 | **Advanced-debugging features stay behind their switch.** Methods that read history, coverage or the profile (`history.*` and `coverage.*`, protocol 1.1, §1.3) answer `feature-disabled` unless `isAdvancedDebuggingEnabled` is on (CLOSING_THE_GAPS_PLAN.md G5 feature switch). |

### 1.2 Ordering with G5.6

G5.6 and G6.1 share the skeleton: the `src/cli/` layout, Node-mode launch, packaging, PATH install
and exit codes. G5.5 and G6.1 share `HeadlessMachineFactory`.

- **If G5.6 lands first**, this plan adds `verbs/run.ts`, `verbs/ide/*` and `src/cli/rpc/`, plus the
  server in main. Its Phase 2 (packaging) shrinks to adding the new files to `extraResources`.
- **If G6.1 lands first**, its Phase 1 builds the skeleton exactly as G5.6 §4 and D13 describe:
  `index.ts`, `args.ts`, `project.ts`, `appState.ts`, `roms.ts` and the plain reporter. It also
  builds `HeadlessMachineFactory` exactly as G5.5 §4.2 describes, and implements `build` (G5.6 D2).
  G5.6 then adds only `test`. Either way, the code ends up where both plans say it lives.

The live half (Phases 3–5) depends on neither G5.5 nor G5.6. It can be built first if it is wanted
sooner (Q2).

### 1.3 Out of scope, and the hooks left for later

- **TCP for containers and WSL.** It could be added as `--automation-tcp 127.0.0.1:port` with the
  token mandatory and an `Origin` check. It stays out until someone needs it (D3).
- **History, coverage and profile methods** (`history.export`, `coverage.export`, `profile.top`).
  These are protocol 1.1. `ide.command` already reaches them through `history-export` and the
  `coverage` commands at level `full`.
- **Driving the IDE's UI** (opening documents, showing panels). `ide.command` covers what the
  command prompt can do; nothing more is planned.
- **A published npm client** (`@klive/client`). The protocol is small enough that D17's examples
  suffice.
- **Headless `klive run` for the Z88 and C64.** These come later through `HeadlessMachineFactory`,
  following its machine list. Protocol 1 targets the Spectrum family, ZX80/81 and the Next.

---

## 2. Current code paths this touches

| Concern | Where |
| --- | --- |
| IDE commands from main | `src/common/messaging/IdeApi.ts` (`executeCommand`, unbounded methods l.133–146); `src/renderer/appIde/MainToIdeProcessor.ts` l.188–206 (writes into the Build pane via `CompositeOutputBuffer`); `src/main/app-menu.ts` l.296 `executeIdeCommand` |
| Command service | `src/renderer/appIde/services/IdeCommandService.ts` (`executeCommand` l.261); `src/renderer/abstractions/IdeCommandResult.ts`; output buffer `src/renderer/appIde/ToolArea/abstractions.ts` (`getContents()`) |
| Emulator from main | `src/common/messaging/EmuApi.ts`: `issueMachineCommand` l.99, `getCpuState` l.378, `getMemoryContents` l.446, `setMemoryContent` l.905, `setRegisterValue` l.894, breakpoints l.406–561; `src/common/messaging/MainToEmuMessenger.ts` (`getEmuApi`) |
| Build/run commands | `src/renderer/appIde/commands/CompilerCommand.ts`, `KliveCompilerCommands.ts` (`klive.build`, `expc`), `MachineCommands.ts`; the menu idiom `src/main/menus/machine-menu.ts` l.209–210 |
| Existing in-process automation | `src/main/ksx-runner/emulator.ts` (`$emu`, the closest prior art for the method set), `ide-commands.ts` |
| Startup, argv, lifecycle | `src/main/index.ts`: single-instance lock l.120, `--noide`/`--showide` l.282–283, messengers l.317, store subscription l.326–443, `second-instance` l.622 (ignores argv), `before-quit` l.607 |
| Settings | `src/common/settings/setting-definitions.ts`, `setting-const.ts`, `settings-pages.ts`; `src/main/settings-utils.ts` (`getSettingValue`); `src/main/settings-path.ts` (`KLIVE_SETTINGS_FILE`); `KLIVE_HOME_FOLDER` in `src/main/settings.ts` |
| Menus | `src/main/menus/help-menu.ts` (macOS app menu), `menu-utils.ts` |
| Feature switch | `src/common/features/advancedDebugging.ts` |
| Headless machines | `test/harness/sp48/session.ts`, `test/harness/zxnext/`, `test/harness/zx81/`, `test/harness/sp128/`, `test/harness/timex/`; PNG writing in `test/zx8081-hw/goldens.ts` |
| Playwright automation it replaces for users | `scripts/doc-shots/harness.cjs` (`cmd()` types into the prompt) |

---

## 3. The traps

1. **T1: The single-instance lock and `--launch`.** A second Klive process quits at once
   (`index.ts` l.120), and `second-instance` ignores argv. The client must therefore never launch the
   IDE to "pass it a command". It starts the app only when no server answers. If the IDE is open but
   automation is off, `--launch` cannot turn it on, because the new process just focuses the old
   one. The client detects this case: there is no connection file, but the lock is held, which it
   sees when the launched process exits within 2 s. It exits **3** with "Klive is running; turn on
   Settings › IDE › Automation". `second-instance` stays argv-blind: honouring argv there would be a
   second, unauthenticated control channel.
2. **T2: The IDE renderer is not ready yet.** `MainToIdeIpc` answers `NotReady` until app services
   exist, and the emulator needs `emuLoaded`. The server accepts connections early, but `session.hello`
   reports `ready: false` and holds every other method until both windows are up. The wait is bounded
   by the request timeout. This makes `--launch` followed straight away by `build` safe.
3. **T3: Unix socket path length.** `sun_path` is 104 bytes on macOS and 108 on Linux. A long home
   folder, or a test's temporary settings folder, overflows it, and `listen` fails with `EINVAL` or
   silently truncates the path. D6's fallback handles this, and a test uses a 150-character home
   path.
4. **T4: Windows pipe ACLs.** Node cannot set a security descriptor on a named pipe. The default
   pipe DACL lets other local users open it read-only. They cannot send a request, but the random
   name and the token (D5, D6) are the real protection. The docs state the model plainly: **any
   process running as the same user can drive Klive once automation is on**. This is the same trust
   boundary as the settings file and `~/.ssh`.
5. **T5: Uncancellable commands.** `executeCommand` has no cancellation, and some commands are long
   (export, RZX render, NextZXOS boot). D14's timeout answers the client but cannot stop the work, so
   the queue must not wait for it forever. A timed-out request releases the queue, and the late
   result is logged and discarded. `ide.command` refuses the few commands that would deadlock an
   unattended run because they open a modal dialog or quit the app. These are marked with a new
   `IdeCommandInfo.automation: "deny"` flag, and a test lists them.
6. **T6: Test isolation.** E2e tests start real Klive instances with `KLIVE_SETTINGS_FILE`. If the
   connection file sat in a fixed `~/Klive/run/`, a test could connect to the developer's own IDE and
   drive it. D5 derives the folder from the resolved settings path, and the test helper asserts that
   the connection file is under the test's temporary folder before it sends any request, as the
   doc-shots fixture guard does.
7. **T7: Structured clone versus JSON.** `IdeCommandResult.value` and `EmuApi` results contain
   `Uint8Array`s, `Map`s and `undefined`s. The server converts at one boundary,
   `src/main/automation/encode.ts`: bytes become base64, `undefined` fields are dropped, and maps
   become objects. A round-trip test runs over every method's sample result.
8. **T8: Partitions and banking.** "Read memory at `$C000`" is ambiguous on a 128K or the Next.
   `memory.read` takes either `{ address }` (the CPU's current view, as `getMemoryContents()` with no
   partition gives) or `{ partition, offset }`, using the IDE's partition labels
   (`getPartitionLabels`, e.g. `R0`, `B5`, the Next's `8K` pages). The CLI's `mem` accepts `B5:$0100`
   like the memory panel does.
9. **T9: The user interferes.** The user can pause, edit or close the project mid-script. Results
   always report the state *after* the call. `machine.wait` resolves on `stopped` as well as on
   `paused`, so a script never hangs because someone pressed Stop. `project.*` fails with `no-project`
   when no project is open.
10. **T10: Determinism of headless `run`.** `--keys` typing, tape loading and the Next's SD boot must
    replay identically. The harness already does this for its tests (fixed key timing, the ROM's
    debounce, cached NextZXOS boots). Moving that code (D16) must keep its self-tests green, and a
    `klive run` test runs the same command twice and compares every output file byte for byte.
11. **T11: Logging leaks.** The Automation pane (D13) must never print the token or memory payloads.
    Neither may an error message that echoes a request. The logger redacts the `token` key and
    truncates base64 fields, and a test checks it.

---

## 4. Design

### 4.1 Layout

```
src/main/automation/
  AutomationServer.ts   # net.Server lifecycle, connection file, hello/token, queue (D5, D6, D14)
  connection-file.ts    # path resolution (follows KLIVE_SETTINGS_FILE), write 0600, stale detection
  socket-path.ts        # POSIX length fallback, Windows pipe name (T3)
  methods.ts            # method table: name → { level, handler, queued } (D7, D8)
  handlers/             # session, machine, cpu, memory, breakpoints, project, screen, ide, events
  encode.ts             # structured-clone → JSON (T7)
  log.ts                # Automation pane lines, redaction (D13, T11)

src/common/automation/
  protocol.ts           # method names, param/result types, error codes - shared with the client

src/cli/                # G5.6's skeleton (§1.2), plus:
  verbs/run.ts          # D15
  verbs/ide/*.ts        # D12, one file per verb group
  rpc/client.ts         # find connection file, connect, hello, request, notifications

src/common/headless/    # D16: HeadlessMachineFactory, boot/typing/loading/picture, moved from test/harness
src/common/imaging/png.ts
```

The server starts from `index.ts` after the messengers are registered, if `automation.enabled` is on
or `--automation` was passed. A settings subscription starts and stops it when the setting changes.

### 4.2 Methods (protocol 1)

| Method | Level | Maps to |
| --- | --- | --- |
| `session.hello {token, client}` → `{protocol, version, ready, level, machine}` | — | — |
| `session.info` | read | main store: machine id/model, state, project folder, build root |
| `machine.state` | read | `emulatorState.machineState`, plus `pc` when paused |
| `machine.start/pause/stop/reset/restart/debug` | control | `EmuApi.issueMachineCommand` |
| `machine.step {kind: into\|over\|out}` | control | `issueMachineCommand("stepInto"…)` |
| `machine.wait {until, timeoutMs}` | read | store subscription (D11), not queued |
| `cpu.get` / `cpu.set {register, value}` | read / control | `getCpuState`, `setRegisterValue` |
| `memory.read {address\|partition+offset, length}` | read | `getMemoryContents` (slice server-side) |
| `memory.write {…, bytes}` | control | `setMemoryContent` |
| `breakpoints.list/set/remove/clear` | read / control | `EmuApi` breakpoint methods; `set` accepts the `bp-set` text syntax so conditions and hit counts work unchanged |
| `project.info` | read | `IdeApi.getProjectStructure` |
| `project.build/run/debug/inject` | control | `executeCommandCaptured("outp build" / "run" / …)` (D9, D10) |
| `project.export {format, file, options}` | control | `expc …` |
| `project.open {folder}` | full | `MainApi.openFolder` path in main |
| `screen.capture {format: png}` | read | the emu renderer's current frame buffer → PNG (new `EmuApi.getScreenImage`) |
| `ide.command {text}` → `{success, message, value, output[]}` | full | `executeCommandCaptured` |
| `events.subscribe {events[]}` / `unsubscribe` | read | D11 |

Error codes are JSON-RPC's standard ones plus a `data.kind` of `unauthorized`, `not-ready`,
`level-too-low`, `no-project`, `no-machine`, `timeout`, `feature-disabled`, `command-denied` or
`command-failed`.

### 4.3 What `klive ide build && klive ide debug && klive ide wait --stopped` does

1. The client reads the connection file, connects and sends `hello`. The server checks the token and
   answers with the level, `control`.
2. `project.build` is queued. It runs `outp build` captured, and returns
   `{success, errors[], output[]}`. The client prints the errors in gcc format (G5.6 D5) and exits
   **0**, or **2** on build errors.
3. `project.debug` is queued and runs `debug`. The machine starts.
4. `machine.wait {until: "stopped"\|"paused"}` subscribes and resolves on the first state change to
   either. The client prints `paused at $8103 (breakpoint)` and exits **0**.

---

## 5. Phases

| Phase | Work | Done when |
| --- | --- | --- |
| 0 | **Skeleton and factory, unless G5.6/G5.5 already built them** (§1.2). | G5.6's Phase 1 "done when" for the skeleton parts; `HeadlessMachineFactory` creates and boots every machine in protocol 1's list |
| 1 | **Headless `build` and `run`** (D15, D16). Harness code moves to `src/common/headless/`; PNG encoder moved | Harness self-tests unchanged and green; e2e: `klive run` on 48K, 128K, ZX81 and Next fixtures with each stop condition, `--keys`, every dump; the two-run byte-identity test (T10); exit codes 0/2/3/4/5 |
| 2 | **Packaging** of the new verbs (G5.6 D11) | Packaged smoke on Linux, macOS and Windows: `klive run` on a fixture writes the expected screenshot |
| 3 | **The server**: settings, `--automation`, connection file, socket path, hello/token, levels, queue, logging, status-bar item, Disconnect all; methods `session.*`, `machine.*`, `cpu.*`, `memory.*`, `breakpoints.*` | Node tests for `connection-file`, `socket-path` (T3), the method/level table, encode (T7) and redaction (T11). E2e on a real Klive started with `KLIVE_SETTINGS_FILE` covers: a wrong or missing token is rejected; a level that is too low is rejected; a 128K memory read by partition; breakpoints with a condition; `wait` resolves on a breakpoint and on Stop (T9); the connection file is removed on quit; a stale file is detected; the T6 guard |
| 4 | **IDE and project methods**: `executeCommandCaptured` (D9), structured `value`s for `compile` and `expc` (D10), `project.*`, `ide.command` with the deny list (T5), `screen.capture`, events | E2e: build with errors returns them structured; run then debug then wait; `ide.command` output equals what the Build pane shows; a denied command is refused; a timed-out command releases the queue |
| 5 | **The `klive ide` client** (D12), `--launch` (T1, T2), `--json` everywhere | E2e: every verb against a live instance; `--launch` from cold, then `build`; `--launch` while a non-automation instance holds the lock exits 3 with the message |
| 6 | **Docs and the standing rule**: `automation.mdx` with the protocol reference and the Node/Python clients (D17); `klive run` in the CLI docs page; the protocol test runs the docs' examples; roadmap and competitive analysis (§7); `.ai/ui-theming-intent-and-lessons.md` only if the status-bar item needs a new rule | `npm run doc:build && npm run doc:check` pass; the docs' clients pass in the protocol test |

---

## 6. Tests

- **Node unit** (`test/automation/`, `test/cli/`):
  - argument parsing for `run` and `ide`;
  - connection-file creation, mode bits and stale detection;
  - socket-path fallback;
  - the method table is complete and every method has a level;
  - encode round-trips;
  - log redaction;
  - exit-code mapping.
- **Protocol test** (e2e, listed in `build/e2e-tests.ts`): starts the server in-process against fake
  `EmuApi`/`IdeApi` implementations and replays every request/response example from
  `automation.mdx` (D17). It runs in seconds and catches drift between the docs and the protocol.
- **Live e2e** (e2e tier): starts the built app with `--automation --noide` and an isolated
  `KLIVE_SETTINGS_FILE`, then drives it through `src/cli/rpc/client.ts`. Uses the Klive asm fixture
  projects that G5.6 adds under `test/cli/fixtures/`.
- **Headless `run` e2e**: on the real cores, through the moved harness code.
- **Packaging smoke** (CI only): `klive --version`, plus `klive run` on a fixture on all three OSes.

The Playwright scripts (`scripts/kbasic-ide-check.cjs`, `scripts/debug-recording-ide-check.cjs`,
doc-shots) keep working unchanged. They *may* later switch their `cmd()` helper to the transport,
which is faster and needs no sleeps. That is a follow-up, not part of this plan.

---

## 7. Effort and the standing rule

**M–L**, about three weeks. The roadmap's **M** assumed only the transport. Headless `run` adds
the harness move (about a week), and the live half is about two weeks: one for the server and
methods, half a week for the client, and docs. If G5.6 has landed, Phase 0 and most of Phase 2 drop
out and it is a solid **M**.

When it lands:
- mark G6.1 done in [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md) (its row and the G6 overview
  line);
- update [LANDING_PAGE_COMPETITIVE_ANALYSIS.md](LANDING_PAGE_COMPETITIVE_ANALYSIS.md):
  - §2 "Scripting / automation": Klive Script plus a local JSON-RPC automation API and a headless
    `klive run`;
  - §4 W6: the "no external API" half closes; remote and real-hardware debugging stay open under
    G6.4.

The only visual change is the status-bar item. If it needs a style decision (e.g. a colour for
"clients connected"), record it in `.ai/ui-theming-intent-and-lessons.md` in the same change.

---

## 8. Risks

- **Security perception.** Any local API that can run IDE commands looks like a remote-code
  surface. Mitigations: off by default, local-only, a token, `control` rather than `full` as the
  default level, a visible status item and log, and a docs page that states the trust boundary
  (T4).
- **Command output is text.** Scripts that parse `ide.command` output break when the wording
  changes. D10 adds structured `value`s for the commands scripts most need. The docs say that only
  the methods are a stable contract; command output text is not.
- **The harness move (D16) touches every hardware test.** Do it as a pure move, with the self-tests
  as the gate, before any new behaviour lands on it.

---

## 9. Questions (all answered, 2026-10-08: the suggested answers)

1. **Q1: Two halves or one?** The suggested answer is both: headless `run`/`build` for CI, and the
   live transport for local tooling. The roadmap row says "headlessly", but G5.6 redefined G6.1 as
   "driving a live IDE". The alternative is to ship only the live transport now and leave `klive run`
   for later.
2. **Q2: Order relative to G5.5/G5.6.** The suggestion is to build the live half (Phases 3–6) first,
   because it depends on nothing, and to leave the shared skeleton to whichever of G5.6 or G6.1's
   Phase 0 comes next. Alternatively, wait for G5.6 and build on it.
3. **Q3: The default permission level.** The suggestion is `control` when enabled, with `full`
   (arbitrary IDE commands) opt-in (D7). Alternatives: `full` by default for convenience, or no
   levels at all.
4. **Q4: The `--automation` flag.** Should a launch flag be able to enable automation for one run
   without the setting (D4)? It makes `--launch` and CI-on-a-desktop work, but any process that can
   start Klive can then open the API. That process already runs as the user, so the suggestion is
   yes.
5. **Q5: The transport.** The suggestion is JSON-RPC over a Unix socket or named pipe (D2, D3). The
   alternative is a localhost WebSocket or HTTP server, which browser-based tools could use, at the
   cost of the cross-origin attack surface D3 avoids.
6. **Q6: `klive ide` or top-level live verbs?** The suggestion is the `ide` prefix (D1), so CI
   scripts show which steps need a running app. The alternative is `klive pause`, `klive mem` and so
   on, with headless and live verbs told apart by an `--attach` flag.
7. **Q7: Screenshots from the live IDE.** Should `screen.capture` return the emulated picture only
   (suggested), or also offer a capture of the IDE window (`webContents.capturePage`) for doc-shots?

---

## 10. Implementation notes (2026-10-09: Phases 3–6)

### What was built

- **Server** (`src/main/automation/`): `AutomationServer.ts` (socket, hello/token, levels, the
  queue with deadlines counted from arrival, readiness, waits and events), `connection-file.ts`,
  `socket-path.ts`, `encode.ts`, `log.ts`, `errors.ts`, `method-types.ts`, `methods.ts` and
  `handlers/`; `automation-controller.ts` wires it to the store, the settings and `--automation`.
  The shared contract is `src/common/automation/protocol.ts`.
- **IDE and emulator**: `IdeApi.executeCommandCaptured` (D9), `IdeCommandInfo.automation: "deny"`
  (T5), structured `value`s for `compile`/`run`/`debug`/`inject` (`{ errors }`) and `expc`
  (`{ file }`) (D10), and three `EmuApi` methods: `getScreenImage`, `getStopInfo` and
  `setMemoryBytes`. The Automation output pane, the status-bar item, Klive › Automation (File ›
  Automation elsewhere) › Show Output / Disconnect All, and two Settings rows.
- **Client** (`src/cli/`): `index.ts` (entry), `run-cli.ts`, `args.ts`, `exit-codes.ts`, `io.ts`,
  `format.ts`, `rpc/client.ts`, `rpc/launch.ts` and `verbs/ide/*`. Bundled as `out/main/cli.js`, an
  extra input of the main build; dev use is `ELECTRON_RUN_AS_NODE=1 npx electron out/main/cli.js`.
- **Shared code moved**: the PNG encoder to `src/common/imaging/png.ts` (D16's half that the server
  needed), and `breakpointCommandSpec`/`breakpointStatusText`/`quoteLogTemplate` plus a new
  `breakpointKind` to `src/common/utils/breakpoint-spec.ts`, so main can list breakpoints as `bp-set`
  text.
- **Docs**: `docs/content/working-with-ide/automation.mdx` (D17), with Node and Python clients.
- **Tests**: `test/automation/` (connection file, socket path with a 150-character home, encode
  round-trips, log redaction, the method table, the server end to end on a fake host, and the docs'
  examples and both clients replayed against a real server), `test/cli/` (arguments, exit codes,
  formatting, every verb in-process), `test/commands/automation-commands.test.ts` (the deny list,
  captured output, D10's value) and the Settings rows. The live check against the real app is
  `scripts/automation-ide-check.cjs` (28 checks: build errors as exit 2, a conditional breakpoint,
  `wait`, registers, memory by address and by partition on a 128K, screenshots, Stop ending a wait,
  a denied command, a wrong token, a level too low, the file deleted on quit).

### Departures from the decisions

- **`debug` is the project's.** D12 lists `debug` among both the machine and the project verbs; §4.3
  uses it for `project.debug`, so `klive ide debug` builds and debugs the project and
  `klive ide start --debug` starts the machine as it is (`machine.debug`).
- **The settings live on Settings › General › Automation**: there is no "IDE" page. They are **user
  settings only**, never read from a project's settings, so a downloaded project cannot turn
  automation on or raise its level. The Settings rows write them through `set:automationEnabled` /
  `set:automationLevel` UI actions (`applyUserSetting`, shared with `set -u`).
- **The protocol test runs in the unit tier**, not the e2e tier: it runs no core and takes about a
  second. The live e2e is a script beside `unit-tests-ide-check.cjs`, not a vitest file, because it
  starts the built app.
- **`ide.output`** carries what the main process relays to the IDE's panes - the Emulator and Log
  panes (machine messages, logpoints) - as whole lines. Build-pane text is not relayed through main;
  a client gets a command's output in its result instead.
- **The deny list is per command**: `exit`, `settings`, `display-dialog`, `history-take-over`.
  `open` without a folder would show a dialog but is not denied, because the flag cannot depend on
  arguments; a timed-out request releases the queue (T5), and the docs say `open` needs its folder.
- **D18 has nothing to gate yet**: protocol 1 has no history, coverage or profile methods.
- **Windows** is implemented (named pipe, `0600`-equivalent profile folder) but was not run.

### Findings

- **The 128K core reads a flat mirror of paged-in memory** (`sp128Memory`, which `Z80_MEMORY_PTR()`
  names), so writing straight into a paged-in bank's array leaves the CPU seeing stale bytes. The
  live check caught it: a `memory.write` to `B5` was invisible at `$4000`. `setMemoryBytes` therefore
  writes a partition that is paged in through the CPU's view (which keeps every mirror current) and
  refuses a paged-in ROM partition. Banked code injection (`injectSpectrumCode`, `writeCodeSegment`)
  writes partitions directly and likely has the same problem; it is flagged as separate work.
- **Main's relay between the two renderers mixed up correlation IDs** (a bug that predates this
  plan): an emulator→IDE request (Emulator-pane output) was relayed with the emulator's own
  correlation ID, which `MessengerBase.sendMessage` keeps, so it could overwrite a pending request
  of main's own with the same number, and the IDE's answer went to the wrong caller. Under automation
  `project.debug` then never returned (whenever the numbers lined up); in the IDE the lost call was
  a fire-and-forget menu command, so nobody noticed. `relayedRequest` (`MessengerBase.ts`) drops the
  sender's ID on relay; the IPC handler already answers the sender with its own.
- **Status published before the IDE window loads is lost**: the server starts at `whenReady`, before
  the IDE renderer can receive actions. The controller re-publishes the status (and says how many log
  lines were held) when the IDE becomes ready.
