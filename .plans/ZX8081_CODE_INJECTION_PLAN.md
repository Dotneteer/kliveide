# ZX80 / ZX81 machine code: assemble, export, inject, run and debug

Status: **implemented** (2026-10-16), phases 0-5; phase 6 partly (headless `klive run` works, the
unit-test runner and boot checkpoints remain). The §7 decisions are binding. §8 records how the
implementation refined the design.

Follow-up named in `ZX8081_WASM_PLAN.md` §14 ("Assembler support: a `.model zx81`, `.P` export, and
code injection via a REM line or direct PC"), which that plan kept as a non-goal (§1). The machines
themselves - core, tape, debugger, reverse debugging - are done (G9.3).

## 1. Goal

A ZX81 (and ZX80) project in Klive works the way a Spectrum project does:

1. `code.kz80.asm` starts with `.model ZX81` (or `.model ZX80`).
2. **Compile** checks it against ZX81 rules.
3. **Inject**, **Run** and **Debug** (toolbar, `inj`/`r`/`rd`, `klive.*` in `build.ksx`) put the code
   into the running ZX81 and start it; Debug stops at source breakpoints, steps, and shows the source
   line of the execution point.
4. **Export** (`expc`, the Export dialog) writes a `.p` (ZX81) or `.o` (ZX80) file that loads and
   runs on the emulator, on other emulators, and on real hardware.

Non-goals: Klive BASIC / zxbc / Pasta80 / sjasmplus targeting the ZX80/81 (§9 says what they must do
instead); ZX81 BASIC source compilation; the unit-test runner on these machines (phase 6, optional).

## 2. What exists today (survey, 2026-10-16)

| Layer | State | Where |
|---|---|---|
| `.model` pragma | Four models only: Spectrum48/128/P3/Next | `src/main/z80-compiler/SpectrumModelTypes.ts`; `VALID_MODELS` in `z80-assembler.ts:55`; `processModelPragma` in `compiler-common/common-assembler.ts:1008` |
| `#ifmod` / `#ifnmod` | Works for any name in `VALID_MODELS` | `common-assembler.ts:944` |
| Model-dependent checks | `.bank` (`modelSupportsBankPragma` accepts **any non-48 model**), Next pragmas, Next instructions | `z80-assembler.ts:102`, `common-assembler.ts:2158+` |
| Model → machine | `modelTypeToMachineType` (renderer), `bootModelFor` (headless) | `renderer/appIde/utils/compile-code.ts:37`, `main/unit-tests/UnitTestRunner.ts:105` |
| Gate | `MF_INJECT_SUPPORT: false` on both; it blocks inject **and** run/debug | `machine-registry.ts:502,534`; `KliveCompilerCommands.ts:1107-1123`; `DocumentCommandBar.tsx:51` |
| Machine host | `getCodeInjectionFlow` / `injectCodeToRun` throw `ZX8081_NO_CODE_INJECTION` | `Zx8081WasmHost.ts:27-29,227-233` |
| Reusable flow | `getTapeLoadFlow`: `ReachExecPoint` KEY_WAIT → `KeepPc` → `Start` → `QueueKey`; auto-RUN by typing `R` NEWLINE | `Zx8081WasmHost.ts:240-270`, `Zx8081WasmV2Machine.ts:517` |
| Flow executor | Handles a flow that ends with the machine running (switches to debug in place, suppresses breakpoints until keys land) | `MachineController.ts:1023-1230` |
| Program files | `.p`/`.o` parsing, charsets, ZX81 tokens; **no writer** except the emulated SAVE | `src/emu/machines/zx8081/ZxPFile.ts` |
| Export | TAP/TZX/HEX/NEX only | `KliveCompilerCommands.ts:182-260`, `dialogs/exportCode/ExportCodeModel.ts:12` |
| Debugger | Shared `wasmDebugLoop`, PC/memory/IO breakpoints, step in/over/out, history, reverse; source breakpoints are unbanked so partitions are `undefined` (fine) | `Zx8081WasmV2Machine.ts:551-623`, `common/utils/source-breakpoint-partition.ts` |
| Templates | None for `zx80`/`zx81` | `src/public/project-templates/` |
| Headless / CLI | `klive run` refuses projects on these machines | `src/cli/run/inputs.ts:174` |

## 3. ZX80 / ZX81 facts that shape the design

These are the hardware/ROM facts the design rests on. Each **(verify)** was checked in phase 0 by
typing the lines on the emulated machines and reading memory back; the results are recorded inline
and pinned by `test/zx8081/program-image.test.ts` and `test/zx8081-hw/program-image.test.ts`.

- **Executable RAM.** On a stock machine an M1 fetch at `$8000+` of a byte with bit 6 clear becomes a
  NOP (`zx8081-memory.c:43-67`): user machine code must execute below `$8000`. RAM is `$4000-$43FF`
  (1K) or `$4000-$7FFF` (16K), echoed upwards; the 64K model maps RAM from `$2000`.
- **ZX81 `.P` layout.** The file is memory from `$4009` (VERSN) to `E_LINE-1`: sysvars, the BASIC
  program from `$407D`, the display file at `D_FILE`, the variables at `VARS` ending in `$80`. A line is
  number (2 bytes, **big-endian**), length (2 bytes, little-endian), body, `$76`.
- **ZX81 REM container.** `1 REM ...` puts its first body byte at `$4082` (16514) - the classic home of
  ZX81 machine code. The ROM walks lines by the length field, so the REM body may contain any byte,
  `$76` included; only LIST shows garbage. REM = `$EA`, RAND = `$F9`, USR = `$D4` (from `ZX81_TOKENS`).
  A numeric literal in a line is its digits followed by `$7E` and the 5-byte float **(verified)**:
  `2 RAND USR 16514` is `00 02 0E 00 F9 D4 1D 22 21 1D 20 7E 8F 01 04 00 00 76`.
- **ZX81 auto-run.** A `.P` runs on load when the saved `NXTLIN` (`$4029`) points at a line
  **(verified)**; pointing it at the display file's leading `$76` stops instead.
- **ZX81 display file.** Collapsed (25 × `$76`) is valid on any RAM size; expanded (25 lines of 32
  spaces) is what a 16K machine builds after CLS. `RUN` clears the screen, which rebuilds it.
- **ZX80 `.O` layout.** Memory from `$4000` to `E_LINE-1`; program from `$4028`. A line is number
  (2 bytes, big-endian), body, `$76` - **no length field**, so the ROM finds the next line by scanning
  for `$76`. A REM container on the ZX80 therefore must not contain `$76` in its body.
  ZX80 integer BASIC stores numbers as text. **(verified)** The ZX80's tokens are $D4-$FE in the
  order of the ROM's keyword table ($00BA-$013A), now `ZX80_TOKENS` in `src/common/zx8081/charset.ts`:
  REM = `$FE`, RANDOMISE = `$EF`, `(` = `$DA`, `)` = `$D9`; functions such as `USR` are stored as
  letters. `2 RANDOMISE USR(16427)` is `00 02 EF 3A 38 37 DA 1D 22 20 1E 23 D9 76`. The display
  file lies after E_LINE and is not part of a `.o`.
- **Calling convention.** `USR` calls the code with the ROM's state intact: on the ZX81 `IY = $4000`,
  and in SLOW mode the NMI display routine needs `IX`, `IY` and `AF'` untouched - the same rules a
  ZX81 programmer already knows. `RET` goes back to BASIC (report 0/2: line 2 finished).
- **Typing.** `R` NEWLINE types `RUN` in K mode on both machines (`ZX8081_RUN_COMMAND`); keys need 4
  key-free frames between them.

## 4. Design

### D1 - Two new models in the shared model enum

`SpectrumModelType` gains `ZX80 = 5` and `ZX81 = 6` (names `"ZX80"`, `"ZX81"`). The enum is shared by
every compiler and the renderer, so extending it is cheaper than a parallel enum; renaming it to
`TargetModelType` is a separate, mechanical change and not part of this plan.

RAM size is **not** part of the model: the same `.p` runs on 1K and 16K if it fits. The fit is
checked at inject/export time against the running machine (D5).

### D2 - What `.model ZX81` / `.model ZX80` changes in the assembler

| Rule | Behaviour under ZX80/ZX81 |
|---|---|
| `.bank`, `.page` | Error (Z0308 / Z0333). Fix `modelSupportsBankPragma`, which today accepts any non-48 model. |
| Next instructions and Next pragmas | Already errors (they test `!== Next`); add tests. |
| `#ifmod ZX81` / `#ifnmod ZX80` | Work once the names are in `VALID_MODELS`. |
| Segment above `$7FFF` | **Warning** (new code, e.g. Z0350): code there cannot execute on a stock machine. A warning, not an error, because data may legitimately live there on the 64K model. |
| Segment overlapping the sysvars/program area | Error only in REM-container layout (D3), reported by the layout builder, not the assembler. |
| Predefined symbol | `__ZX81__` / `__ZX80__` defined, so plain `IF` works as well as `#ifmod`. Optional; only if `predefinedSymbols` is wired for the IDE compile (today it is not - `compile-code.ts` passes `undefined`). |
| Error texts | Z0206 and Z0303 list the model names - extend them. |

New pragma, ZX80/81 only (Z0414-style error under other models):

- **`.defzx "TEXT"`** - emits text in the ZX81 or ZX80 character set (by model): `A`-`Z`, `0`-`9`,
  the punctuation both sets share, `%`-prefix or escape for inverse video. Every ZX81 program needs
  this and `.defm` emits ASCII, which is garbage on these machines. Tables come from
  `ZX81_CHARSET`/`ZX80_CHARSET` (see D6 for where they live). A character the set lacks is an error.

Deliberately **not** added: a pragma to write BASIC lines, a pragma to choose the layout (D3 picks it
from the addresses, which is how ZX81 sources are already written).

### D3 - How code becomes a program image: two layouts

One builder, `buildZx8081ProgramImage(output, isZx81, options)`, turns the assembler output into the
memory image a `.p`/`.o` file holds (ZX81: `$4009`…`E_LINE-1`; ZX80: `$4000`…). Injection and export
both use it, so what Run executes is byte-for-byte what Export writes.

**Layout A - REM container (the default).** The source just `org`s somewhere at or above the REM body
(`$4082` on the ZX81) and writes code. The builder generates:

```
   1 REM <every byte from $4082 to the end of the highest segment; gaps zero-filled>
   2 RAND USR <entry>          (entry = .ent / entryAddress, else the first segment's start)
```

then a display file (collapsed for a 1K target, expanded for 16K - option), the variables end marker,
and consistent sysvars (`D_FILE`, `DF_CC`, `VARS`, `E_LINE`, `STKBOT`, `STKEND`, `NXTLIN`, `CDFLAG`,
`MODE`, ...). The sysvar defaults come from a ROM-booted machine's own values, captured once in a test
fixture, not typed in by hand.

Errors: a segment below the REM body; a segment reaching `$8000`; the image plus a minimal stack not
fitting the target RAM; on the ZX80, a `$76` anywhere in the REM body (the message names the address
and suggests Layout B).

**Layout B - full image (raw).** When the first segment starts at the image base (`$4009` on the ZX81,
`$4000` on the ZX80), the source *is* the image - the classic way ZX81 assembler sources are written,
with the sysvars, BASIC lines and display file spelled out in `defb`/`defw`. The builder copies it
verbatim and only validates it (contiguous from the base, `E_LINE` equals the image end, `D_FILE` and
`VARS` inside it), reporting what is inconsistent. This also covers the ZX80 programs Layout A cannot.

Anything else (segments starting between the base and the REM body) is an error naming both layouts.

### D4 - Running and debugging: boot, write the image, type RUN

`Zx8081WasmHost.getCodeInjectionFlow(model)`:

```
ReachExecPoint  ROM0, ZX81_KEY_WAIT | ZX80_KEY_WAIT     (booted, K cursor, idle)
Inject                                                  (writes the image, D5)
KeepPc
Start
QueueKey        R, NEWLINE                              (types RUN)
```

Why type RUN instead of setting PC to the entry like the Spectrum flows do: the code then starts
exactly as it would after LOAD on real hardware - through `USR`, with the ROM's registers, stack,
calculator stack and display state set up by the ROM. Jumping in from the middle of the KEY_WAIT loop
would leave the ROM's own stack frame and register expectations (IX for the SLOW-mode NMI) up to luck,
and RET would land somewhere meaningless. The flow ends with the machine running, which
`executeInjectionFlow` already handles for Debug (it switches to debug in place and keeps user
breakpoints quiet until the keystrokes land - the Next path).

- A model mismatch (`.model ZX80` on a ZX81 and vice versa, or a Spectrum model) throws the usual
  "Code for machine model '…' cannot run on this virtual machine." A source with **no** `.model` on a
  ZX81 is treated as ZX81 (as the Spectrum treats it as the running machine) - but the 48K default of
  `currentModel = 1` in `AssemblerOptions` makes `modelType` look like Spectrum48; phase 3 fixes
  this by passing the running machine's model to the compile (§7, Q1).
- `.injectopt subroutine` is meaningless here (USR always calls) and is ignored with a note in the
  output; `noCls`/`cursorl`/`cursork` likewise.
- **Inject** alone (`inj`) writes the image and nothing else - the machine keeps running, the user
  types `RUN`. The machine must be at the K cursor for that to be safe; otherwise inject warns that the
  program may be overwritten by the running ROM, as the Spectrum does not check either.
- Checkpointing the boot (`checkpoint: "zx81-boot"`) is free to add once the ZX80/81 core implements
  `captureCheckpoint`/`tryRestoreCheckpoint` (open item in `ZX8081_WASM_PLAN.md` §14). Not needed:
  booting to K takes well under a second of emulated time.

`injectCodeToRun(code)`: builds the image (D3) for the running machine's RAM size, writes it with
`doWriteMemory`, and returns the entry address. It does **not** do the Spectrum's CLS (`$4000`/`$5800`
are program memory here).

### D5 - Where the code lives in `CodeToInject`

`CodeToInject` stays as it is. The image is built on the emulator side from `segments` +
`entryAddress` + `model`, because only the emulator knows the RAM size. Export builds it on the
renderer side with the RAM size taken from the export options (default: the running machine's, else
16K). The builder therefore lives in `src/common/` and must not import from `src/emu/` or
`src/renderer/` (D6).

### D6 - Shared code placement

- New: `src/common/zx8081/programImage.ts` (the D3 builder), `src/common/zx8081/charset.ts` (the
  charsets and token tables).
- **Move** `ZX81_CHARSET`, `ZX80_CHARSET`, `ZX81_TOKENS` from `src/emu/machines/zx8081/ZxPFile.ts` to
  `src/common/zx8081/charset.ts` and update every consumer to the new path (AGENTS.md: no re-export
  wrapper). The main-process assembler needs them for `.defzx`.
- Machine constants the builder needs (`$4009`, `$407D`, `$4082`, sysvar offsets) come from
  `Zx81SysVars.ts`/`Zx80SysVars.ts`; if those live under `src/emu`, move the plain-data parts to
  `src/common/zx8081/` the same way.

### D7 - Source-level debugging

Nothing new is needed in the compiler: the REM container keeps every byte at the address it was
assembled for, so `sourceMap`/`listFileItems` are already right, and `resolvedPartitionFor` returns
`undefined` for unbanked segments. What needs proving in the running IDE (phase 4):

- a source breakpoint in the code stops there after RUN, and the editor shows the line;
- step into/over/out inside user code; stepping while the SLOW-mode NMI fires every scanline must not
  drop the user into `$0066` on every step-over (if it does, step-over must treat NMI service like it
  treats interrupt service today - check `interruptDepth` handling in the debug loop);
- the call stack shows the ROM's USR caller under the user's frames;
- execution history and reverse stepping from a breakpoint in user code;
- the display-file NOP quirk does not mis-map the execution point to a source line (D_FILE|$8000 has
  no source line; make sure the editor does not highlight a stale one).

### D8 - Export

`expc` gains `-f p` (ZX81) and `-f o` (ZX80); with no `-f`, a ZX80/81 model defaults to its own
format instead of TAP. Options: `--ram 1|16` (display-file shape and the fit check) and, for `.p`,
`--autorun` (sets `NXTLIN` to the `RAND USR` line; default on). TAP/TZX/NEX on a ZX80/81 model is an
error. The Export dialog (`ExportCodeModel.ts`) offers formats by the compiled model and hides the
Spectrum-only fields (screen file, border, BASIC loader options). The `.p` written must round-trip:
load it through the existing tape flow and it runs.

### D9 - Other compilers on a ZX80/81 machine

Klive BASIC, zxbc and Pasta80 always emit Spectrum code; sjasmplus falls back to the running machine
id (`SjasmPCompiler.getSjasmModelType`). On a ZX80/81 machine each must report a clear "this compiler
does not target the ZX81" instead of injecting Spectrum code - the model-mismatch error from D4 gives
this for free as long as none of them maps the machine id `zx81` to a Spectrum model. Add a test per
compiler.

## 5. Phases

Each phase ends with focused tests, `npm run build:check`, and `npm run lint:renderer` when renderer
React code changed.

**Phase 0 - facts (harness only, no product code).** Tests in `test/zx8081-hw/program-image.test.ts`
on `test/harness/zx81/`: boot, type `1 REM ...` / `2 RAND USR 16514` by hand, read memory back, and
pin down every **(verify)** in §3: the numeric literal encoding, NXTLIN auto-run, the sysvar values
after boot (1K and 16K, ZX80 and ZX81), the ZX80 token codes, what `RET` from USR returns to. Record
the results in §3 of this plan. These bytes become the fixtures of phase 2.

**Phase 1 - assembler.** `SpectrumModelTypes.ts`, `VALID_MODELS`, Z0206/Z0303 texts,
`modelSupportsBankPragma`, the `$8000` warning, `.defzx` (token, parser, emitter, docs), editor
completions (`z80-completion-data.ts:274`, `asmKz80LanguageProvider.ts:291`). Tests in the existing
assembler test folders: model accepted, `#ifmod`, `.bank`/Next pragma errors, `.defzx` bytes for both
sets and inverse, the warning.

**Phase 2 - program image builder.** D6 moves, then `programImage.ts` with both layouts and every
validation error. Unit tests compare against the phase 0 fixtures; an e2e test (listed in
`build/e2e-tests.ts`) writes a built image into the core and checks that `RUN` executes it and that
the ROM's LIST/`zx8081BasicListing` show lines 1 and 2.

**Phase 3 - inject, run, debug.** `getCodeInjectionFlow`/`injectCodeToRun` in `Zx8081WasmHost.ts`
(delete `ZX8081_NO_CODE_INJECTION`), `MF_INJECT_SUPPORT: true` for both machines, the run/debug gate
in `KliveCompilerCommands.ts:1107` (make it read the flag, not a Next special case),
`modelTypeToMachineType`, `bootModelFor`, the model the compile receives (§7 Q1, with tests on the Spectrum machines for the changed default). Tests:
`test/zx8081-hw/inject.test.ts` drives the flow through `playInjectionFlow` (`common/headless/frameRunner.ts`)
on the real core - inject, RUN, the code's effect on the screen, `RET` back to BASIC; model mismatch.

**Phase 4 - debugging in the IDE.** Extend `scripts/` with a ZX81 variant of the IDE check (compare
`scripts/kbasic-ide-check.cjs`): source breakpoint, execution point, step in/over/out, call stack,
history. Fix the NMI step-over behaviour if D7's check fails, with a
`test/wasm/debug-loop-equivalence.test.ts` case if a core stop candidate changes (AGENTS.md rule).

**Phase 5 - export and templates.** `expc -f p|o`, the dialog, round-trip test (export → tape load →
runs). Project templates `src/public/project-templates/zx81/default` and `zx80/default`
(`build.ksx`, `code.kz80.asm` with `.model`, `.defzx`, a sysvar `equ` include). Docs:
`docs/content/z80-assembly/pragmas.mdx` (MODEL, DEFZX), `directives.mdx` (IFMOD), a new page "ZX81
machine code" (layouts, calling convention, IX/IY/AF', the `$8000` rule). Verify with
`npm run doc:build && npm run doc:check`.

**Phase 6 - optional.** Headless `klive run` for ZX80/81 projects (`cli/run/inputs.ts:174`); the
unit-test runner (`unitTestMachines.ts`), which needs a `RET`-to-runner return point on these
machines; boot checkpoints once the core has them.

## 6. Bookkeeping (AGENTS.md standing instructions)

- If this lands as a `CLOSING_THE_GAPS_PLAN.md` item, add it there and update §2/§4 of
  `LANDING_PAGE_COMPETITIVE_ANALYSIS.md` in the same change (DeZog already lists ZX81 debugging; the
  ZX80/81 row gains "assemble, inject, debug, `.p` export").
- Update `ZX8081_WASM_PLAN.md` §14 to point here.
- A visual change to the Export dialog updates `.ai/ui-theming-intent-and-lessons.md`.

## 7. Decisions (accepted by the project author, 2026-10-16)

- **Q1 - default model: the running machine.** With no `.model`, a compile assumes the model of the
  running machine: a ZX81 source needs no `.model ZX81` to run on a ZX81. `compile-code.ts` passes
  `currentModel` derived from `emulatorState.machineId` (it passes `undefined` today, so every compile
  assumes 48K). This changes behaviour on every machine - a no-`.model` source on a 128K/+3/Next now
  compiles as that model - so phase 3 adds tests for the Spectrum machines too and checks that
  `.bank` / Next instruction rules still give the errors they did for sources that relied on the 48K
  default.
- **Q2 - REM line number: line 1.** Layout A generates `1 REM` / `2 RAND USR`, the ZX81 convention.
  No option for line 0 until someone asks.
- **Q3 - RAMTOP layout: not done.** A `.p` cannot set RAMTOP (it is not saved), so this would need a
  copying loader. Layout B can express it by hand.
- **Q4 - 64K model's `$2000-$3FFF`: not used.** Layouts A and B do not place code there.

## 8. As implemented (2026-10-16)

What the work changed or added against the design above; the tests named here hold it.

- **Code placement.** `src/common/zx8081/charset.ts` (the tables moved out of `ZxPFile.ts`, plus
  `ZX80_TOKENS`, `zx8081CharCode`) and `src/common/zx8081/programImage.ts` (the D3 builder). Both are
  shared by the assembler (main), the renderer's checks and export, and the machine host.
- **Default origin.** Code with no `.org` under a ZX80/ZX81 model starts at the REM body ($4082 /
  $402B) instead of $8000, which cannot execute there (`modelDefaultStartAddress` in
  `common-assembler.ts`). Found when the Q1 default first assembled a no-`.org` source for the ZX81.
- **Q1 lives in `Z80Compiler`.** With no options (the IDE, the worker, the CLI), `Z80Compiler` builds
  `AssemblerOptions` with `currentModel` from the app state's machine (`defaultModelTypeForMachine`);
  `output.modelType` stays unset, so run/debug still take the machine's own flow. Next pragmas now
  work on a Next without `.model`; `.bank` and Next instructions still need an explicit `.model`
  (`test/z80-assembler/default-model.test.ts`).
- **Injection writes, it does not LOAD.** `injectCodeToRun` writes the program area and only the
  *layout* system variables (`ZX81_LAYOUT_SYSVARS` / `ZX80_LAYOUT_SYSVARS`); FRAMES, CDFLAG, MARGIN
  and the keyboard state stay the running machine's. The ZX81 gets an empty edit line (`7F 76`) at the
  new E_LINE. The ZX80's edit line and display file live after E_LINE, so they are moved with it and
  its D_FILE/DF_EA/DF_END/P_PTR relocated. Typing RUN then clears and rebuilds everything else.
- **The 8K-ROM ZX80 waits elsewhere.** It has no NMI generator, so its ROM idles in FAST mode and
  never reaches SLOW-DISP ($04CF); its key-wait point is the FAST-mode display call $0229
  (`ZX81_FAST_KEY_WAIT`). This also fixed its tape-load flow, which waited on $04CF and hung.
- **Model strings.** The code's model reaches the host as `"zx80"`/`"zx81"` (from
  `modelTypeToMachineType` and `bootModelFor`). Known limitation: on a ZX80 with the 8K ROM, `"zx80"`
  is also the machine id that code with no `.model` arrives as, so `.model ZX80` code is not refused
  there; the image is laid out by the ROM (ZX81), whatever the model says.
- **Renderer pre-check.** `zx8081InjectionProblem` (`renderer/appIde/utils/zx8081-code.ts`) builds the
  image before anything is sent, so a layout error is a plain command error; it also refuses
  debugging a unit test on these machines.
- **Export.** `expc -f p|o`; with no `-f` the build's model (or the machine's ROM) picks it. `-as`
  means *run when loaded* on a `.p` (D8's `--autorun`); `--ram` was not added: the running ZX80/81's
  RAM is used, else 16K. The Export dialog offers formats by machine (`formatOptionsFor`), swaps a
  saved Spectrum format for the machine's, hides the Spectrum loader options and labels the
  checkbox *Run the program when loaded* on a `.p`.
- **D7 held.** Stepping in the IDE is not disturbed by the SLOW-mode NMI: `scripts/zx81-ide-check.cjs`
  stops at a source breakpoint, steps into, over and out, continues to the breakpoint again and runs
  to the end, all with the execution point on the right source line.
- **Templates.** `project-templates/zx81/default` mirrors the Spectrum templates: a centred welcome
  at line 10 and the machine's name in inverse video at line 11, from a message stream with AT and
  inverse control codes, printed with the ROM's `PRINT-AT` ($08F5) and `PRINT-A` (`RST $10`);
  `zx80/default` prints the same screen. The ZX80's `RST $10` keeps its print state in the alternate
  registers (DE' = DF_EA, BC' = S_POSN), which `USR` code must load and store back as the ROM's
  PRINT does ($06E0 / $073A); with no PRINT AT it positions by NEWLINEs, made at run time because a
  REM line cannot hold $76 (`test/zx8081-hw/project-templates.test.ts`).
- **Harness note.** A tiny program finishes its fast load while the harness is still typing
  `LOAD ""`, so `loadProgram` never sees the auto-RUN; such tests wait on the program's effect.

Tests: `test/z80-assembler/zx8081-model.test.ts`, `default-model.test.ts`,
`test/zx8081/program-image.test.ts`, `zx8081-code.test.ts`, `test/zx8081-hw/program-image.test.ts`,
`inject.test.ts`, `project-templates.test.ts`, `test/dialogs/exportCode/ExportCodeZx8081.test.ts`,
`test/cli/klive-run-e2e.test.ts` (the `runzx81` fixture), `test/common/machine-inject-support.test.ts`;
in the running IDE, `scripts/zx81-ide-check.cjs`.

Still open (phase 6): the unit-test runner on these machines (`unitTestMachines.ts`), and boot
checkpoints once the core implements them.
