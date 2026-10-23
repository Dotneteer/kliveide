# HT-1080Z Code Injection — Implementation Plan

**Status:** complete 2026-10-23 (§9). Decisions accepted by the project author the same day (§7).
**Follows:** `.plans/HT1080Z_PLAN.md` (complete), whose §14 lists this as the first follow-up
("Assembler plan"). The pattern is `.plans/ZX8081_CODE_INJECTION_PLAN.md`; read its §4 and §8
before starting.

---

## 1. Goal

Write Z80 code for the HT-1080Z in a Klive project (`.kz80.asm`), and use it the way Spectrum and
ZX81 code is used:

- **Run** and **Debug** build the code, put it into the running HT-1080Z and start it, with source
  breakpoints, stepping, the call stack, execution history and reverse debugging working on the
  source lines;
- **Inject** (`inj`) puts the code into memory without starting it, so BASIC can call it;
- **Export** (`expc`) writes a `.cmd` or `.cas` file that loads and starts on the HT (and on any
  emulator that takes TRS-80 Model I files);
- a **project template** gets a new user to a running program in one step;
- the command line (`klive run <project>`) and, optionally, the Z80 unit-test runner take HT
  projects.

Out of scope: a BASIC compiler for the HT (Klive BASIC and zxbc target the Spectrum), and z88dk's
`+trs80` target (§6, follow-up).

## 2. What exists today (survey, 2026-10-23)

- **The machine** (`src/emu/machines/ht1080z/`): every model, the debugger, history, profile,
  reverse debugging, state files, headless runs. `MF_INJECT_SUPPORT` is `false`;
  `Ht1080zWasmHost.getCodeInjectionFlow` and `injectCodeToRun` throw "not supported yet".
- **Tapes**: `Ht1080zTapeFile.ts` turns a `.cmd` into a `SYSTEM` tape (`cmdToSystemTape`) and reads
  `.cas`; the tape-load flow types `SYSTEM`, the name and `/`. Export can reuse the conversion.
- **The assembler model** (`src/main/z80-compiler/SpectrumModelTypes.ts`): `SpectrumModelType` has
  `Spectrum48`..`Next`, `ZX80 = 5`, `ZX81 = 6`; `VALID_MODELS` in `z80-assembler.ts`;
  `defaultModelTypeForMachine` (no `.model` means the running machine's model);
  `modelSupportsBankPragma`; `modelTypeToMachineType` in `renderer/appIde/utils/compile-code.ts`.
- **The ZX81's way** (`ZX8081_CODE_INJECTION_PLAN.md`): code must live in a `1 REM` line, so it
  builds a program image and types `RUN`. **The HT does not need that**: Level II BASIC loads
  machine code into plain RAM and jumps to it (`SYSTEM`, then `/`), so the IDE can write the code
  where it was assembled and start it there.
- **Export** (`dialogs/exportCode/ExportCodeModel.ts`, `exportCodeCommand.ts`): formats per machine
  (`tap`, `tzx`, `hex`; `p`/`o` on the ZX80/81).
- **Unit tests** (`main/unit-tests/unitTestMachines.ts`): the runner needs an injectable machine;
  the HT is headless already.

## 3. HT-1080Z facts that shape the design

Observed on Klive's core (2026-10-23, every model) unless a source is named:

| Fact | Value |
|---|---|
| Memory | ROM 0000h-2FFFh, extension ROM 3000h-37FFh, keyboard 3800h-3BFFh, video RAM 3C00h-3FFFh, ROM work area 4000h-42E8h, BASIC program from 42E9h, RAM to 7FFFh (16K) or FFFFh (48K) |
| The power-on question | Series I/II ask `READY ?`, the /64 `MEMORY SIZE?`. **All models take a number there**: answering `28000` set MEMSIZ (40B1h) to 6D5Eh (the answer − 2) and BASIC came up at `>` below it. NEW LINE alone takes all memory. |
| Idle | The ROM's wait-for-key loop at 004Eh runs both at the power-on question and at the `>` prompt (the tape-load flow already paces by it) |
| Returning to BASIC | A routine started at the `>` prompt that `RET`s to **06CCh** comes back to `READY` with the BASIC program kept and BASIC working (checked on Series II and the /64). The research notes name 06CCh as the recommended return entry. |
| Interrupts | None (INT is unconnected); the RESET key is an NMI. Nothing interrupts a step. |
| `SYSTEM` | Loads the blocks, then `/` jumps to the entry with the stack at 4288h; it does not expect a return |
| USR | `X=USR(0)` calls the address held at 408Eh (Level II convention, *to verify in Phase 2*) |
| Text | Video RAM codes are ASCII on every model: writing 41h to 3C00h shows `A`. Series II has accents at 40h, 5Ch-5Eh, 60h, 7Ch-7Eh; the /64 has 32 specials at 00h-1Fh |

## 4. Design

### D1 - One new model in the shared model enum

`SpectrumModelType` gains `HT1080Z = 7` (name `"HT1080Z"`), in `SpectrumModelTypes`, `VALID_MODELS`,
`defaultModelTypeForMachine` (`ht1080z` → `HT1080Z`, every model) and `modelTypeToMachineType`.
Series I, II and the /64 are **one** model (D-Q1): the CPU, memory map and ROM entry points are the same;
the RAM size is checked at injection (D4), and code that wants the /64's AY or characters tests the
machine itself or uses `#ifdef` of its own.

### D2 - What `.model HT1080Z` changes in the assembler

| Rule | Behaviour |
|---|---|
| `.bank`, `.page` | Error, as on the ZX80/81 (`modelSupportsBankPragma`) |
| Next instructions and pragmas | Already errors under any non-Next model; add tests |
| `#ifmod HT1080Z` | Works once the name is in `VALID_MODELS` |
| Predefined symbol | `__HT1080Z__`, if the IDE compile passes predefined symbols by then (the ZX81 plan found it does not) |
| Segment in 0000h-3BFFh (ROM, keyboard) | **Error** at injection and export (D4): it cannot be written |
| Segment in 3C00h-3FFFh (video RAM) | **Warning**: legitimate for a picture, but BASIC's screen output overwrites it |
| Segment in 4000h-42E8h (ROM work area) | **Warning**: the ROM's variables and stack live there |
| Error texts | Z0206 and Z0303 list the model names: extend them |

Text needs nothing new: `.defm` emits ASCII, which is what the video RAM holds. A pragma for
accented text is a follow-up (D-Q5).

### D3 - Keeping BASIC away from the code

BASIC's stack and string space sit just below MEMSIZ and grow down, and its program grows up from
42E9h. Code above the program must therefore be above MEMSIZ. The flow answers the power-on question
the way a user does: **with the lowest address of the code** (D4), so the ROM sets MEMSIZ, the
string space and the stack itself. No system variable is poked. Code that ends below 42E9h + 1K
(too little room for BASIC to start) is an error that says where to `.org` the code. (D-Q2)

### D4 - Running and debugging: the flow

`Ht1080zWasmHost.getCodeInjectionFlow(model)`, after the model check ("Code for machine model '…'
cannot run on this virtual machine."):

```text
ReachExecPoint  004Eh                      (the power-on question; boot checkpointable)
QueueKey ×n     the digits of the lowest code address, then NEW LINE   (D3)
WaitKeyQueue
ReachExecPoint  004Eh                      (BASIC at the > prompt)
Inject                                     (writes the segments, D5)
SetReturn       06CCh                      (a RET from the code goes back to READY)
Start                                      (PC = entry)
```

- The machine is reset first, as for the other machines, so the power-on question is always there.
- The entry is `.ent`, else the build's `entryAddress`, else the first segment's start.
- **Every** start gets the 06CCh return (D-Q3): a program that loops forever never uses it, and one
  that returns lands in BASIC instead of at a random address. `.injectopt subroutine` is therefore
  not needed; it is accepted and ignored with a note, like the Spectrum-only `noCls`/`cursorl`.
- Debug: the same flow with the breakpoints armed once `Start` is reached (as on the other
  machines).
- The RAM-size check happens here, against the running model: a segment beyond 7FFFh on a 16K model
  is an error naming the model and the 48K variants.
- The keystrokes go through the machine's own key queue with the typer's timing (hold 3, gap 3,
  edges half a frame early), which the tape-load flow already relies on.

### D5 - Inject only

`injectCodeToRun` writes every segment with `doWriteMemory`, checks D2's address rules and the RAM
size, and returns the entry. For **Inject** (`inj`) the machine keeps running and is not reset; it
also sets the USR address (408Eh) to the entry, so BASIC can call the code with `X=USR(0)` (the code
returns with `RET`). Inject does not change MEMSIZ: the IDE cannot answer the power-on question of a
machine that is already past it, so it warns when the code lies below MEMSIZ (BASIC may overwrite
it) and suggests Run, or `CLEAR`-ing memory first (*the exact advice to be written once tried*).

### D6 - Export

- `expc` gains `-f cmd` (the default on an HT model, D-Q4) and `-f cas` (a `SYSTEM` tape, through
  `cmdToSystemTape`). `--name` sets the 6-character module name (default: the project's, upper-cased
  and cut to 6, characters the keyboard cannot type replaced).
- The `.cmd` holds one load block per segment (type 01h), a module header (05h) and the transfer
  address (02h). TAP/TZX/NEX/`.p` on an HT model are errors; HEX stays.
- The Export dialog offers `cmd`, `cas` and `hex` for an HT build and hides the Spectrum-only fields.
- Round trip: an exported `.cmd` and `.cas` load through the existing tape flow and start at the
  entry (a test, as for the ZX81's `.p`). Note the difference from Run: a tape started by `SYSTEM`
  has no 06CCh return, as on the real machine.

### D7 - Source-level debugging

Nothing new should be needed: there is no paging, so the source map's addresses are the CPU's, and
no interrupt drags a step into a service routine. Phase 2 proves it in the running IDE: a source
breakpoint stops after Run; step into/over/out; the call stack shows the 06CCh return under the
user's frames; history and reverse stepping from a breakpoint in user code; the RESET key during a
debug session.

### D8 - Project template and other compilers

- `src/public/project-templates/ht1080z/default/`: `code/main.kz80.asm` with `.model HT1080Z`,
  `.org 7000h` (fits 16K, D3 answers 28672), a loop that prints a message through the ROM's display
  routine (0033h) and draws a block-graphics frame in video RAM, and `RET` to BASIC on a key. The New
  Project dialog already lists the HT under "otherZ80".
- Klive BASIC, zxbc, Pasta80 and sjasmplus must refuse an HT project with a clear message instead of
  injecting Spectrum code: the model-mismatch error gives this as long as none of them maps
  `ht1080z` to a Spectrum model. A test per compiler, as the ZX81 plan did.

### D9 - Command line and unit tests

- `klive run <project>` on an HT project runs the D4 flow headless (the HT is already a headless
  machine).
- The Z80 unit-test runner (`unitTestMachines.ts`) can take the HT once injection works: the tests'
  entry is called with the D4 flow's return. In Phase 4 if it needs no more than the flow (D-Q6).

## 5. Phases

| Phase | Content | Exit criteria |
|---|---|---|
| **1. Assembler model** | D1, D2: the enum value, names, `VALID_MODELS`, default model, bank-pragma error, address rules, error texts, `#ifmod` | Assembler tests: `.model HT1080Z` accepted; `.bank` refused; the address warnings and errors; a source with no `.model` on the HT assembles as `HT1080Z` |
| **2. Run, Debug, Inject** | D3, D4, D5, D7; `MF_INJECT_SUPPORT: true` | Harness tests on every model: the flow sets MEMSIZ below the code, starts at the entry, and a `RET` reaches `READY` with BASIC working; a 16K model refuses code above 7FFFh; Inject sets USR (408Eh verified) and `X=USR(0)` runs the code. In the running IDE: a template-like project runs, stops at a source breakpoint, steps, and steps back. |
| **3. Export** | D6 | `.cmd` and `.cas` bytes checked; both load through the tape flow and start; the dialog shows only the HT's formats |
| **4. Template, compilers, CLI** | D8, D9 (the unit-test runner per D-Q6) | The template runs from New Project; each other compiler refuses an HT project; `klive run` on the template project stops at `--until-pc` |
| **5. Ship** | Docs (the HT guide gains "Writing machine code"; the assembler reference lists the model), a screenshot of the template in the debugger, changeset | `build:check`, `lint:renderer`, `test:fast`, `test:slow`, the electron-vite build, `doc:build`/`doc:check` green |

## 6. Follow-ups (not in this plan)

- z88dk's `+trs80` target for C projects on the HT (its CRT, `.cmd` output, and whether its
  library's screen and keyboard routines suit the HT's ROM).
- A Klive BASIC back end for Level II BASIC, if ever wanted.
- An accented-text pragma (D-Q5).
- Checkpointing the boot (`checkpoint` on the first `ReachExecPoint`) once the HT core can capture
  checkpoints; booting takes well under a second, so it is not needed now.

## 7. Decisions (accepted by the project author, 2026-10-23)

| | Decision | Why |
|---|---|---|
| D-Q1 | **One `.model HT1080Z`** for Series I, Series II, the /64 and the 48K variants. | The models differ in RAM (checked at run time, D4), characters and the /64's AY, none of which changes how code is assembled. |
| D-Q2 | **The code is protected by answering the power-on question** with its lowest address; the ROM sets MEMSIZ, the string space and the stack. No system variable is poked. | It is what a user does, and it was observed to work on every model (§3). |
| D-Q3 | **Every Run and Debug start pushes the 06CCh return**; `.injectopt subroutine` is accepted and ignored with a note. | It costs nothing for a program that never returns, and a `RET` lands safely in BASIC. |
| D-Q4 | **Export defaults to `.cmd`**; `.cas` and `.hex` are offered too. | The TRS-80 world's machine-code file, smaller, and Klive turns it into a tape when it loads. |
| D-Q5 | **No accented-text pragma in this plan**; it is a follow-up (§6). | `.defm` covers ASCII, and the encodings differ between Series II and the /64. |
| D-Q6 | **The Z80 unit-test runner takes the HT in Phase 4** if it needs no more than the D4 flow; if it needs more, it becomes a follow-up, recorded in §6. | Injection is what the runner lacks; the HT is already headless. |

## 8. Bookkeeping (AGENTS.md standing instructions)

- New UI text (the Export dialog's format labels, error messages) through `t()` with translator
  context; `npm run i18n:keys`.
- Tests that run the core go in `build/e2e-tests.ts`'s tiers (`test/ht1080z-hw/` is already there).
- One changeset, with the commit that completes the plan, describing the result as a whole.

## 9. As implemented (2026-10-23)

All five phases, in one change.

- **Phase 1:** `SpectrumModelType.HT1080Z = 7` (`isHt1080zModelType`), in `VALID_MODELS`,
  `defaultModelTypeForMachine` and `modelTypeToMachineType`; Z0206/Z0303 list it. Code with no `.org`
  goes to $7000. Two new warnings, **Z0382** (code below $3C00) and **Z0383** (code in
  $3C00-$42E8), once per segment. `test/z80-assembler/ht1080z-model.test.ts`.
- **Phase 2:** the placement rules are one module, `src/common/ht1080z/codePlacement.ts`, used by
  Run, Inject, the IDE's pre-check and Export: nothing below $3C00, nothing beyond the model's RAM,
  the lowest segment from $42E9 up is the answer to the power-on question and must be at least
  $46E9 (1K for BASIC). The flow (`Ht1080zWasmHost.getCodeInjectionFlow`) is
  `ReachExecPoint 004Eh`, **`TypeText`** (a new flow step: the machine's own typer, the answer
  computed from the code; the controller and the headless player both run it), `Start`,
  `WaitKeyQueue`, `ReachExecPoint 004Eh`, `Inject`, `SetReturn 06CCh` with the new **`always`** flag
  (D-Q3; not for a unit test). Inject sets the USR vector, **408Eh verified**: `X=USR(0)` runs the
  code. `MF_INJECT_SUPPORT` is on. `test/ht1080z-hw/code-injection.test.ts` on every model.
- **Phase 3:** `src/common/ht1080z/cmdFile.ts` writes the `.cmd` (05 header, 01 blocks of up to 256
  bytes, 02 transfer); `.cas` is `cmdToSystemTape` of it. `expc -f cmd|cas` (`cmd` the default for
  HT code), and other machines' formats refused for HT code; the Export dialog offers `.cmd`, `.cas`
  and HEX with no loader options. Exported files load through the tape flow and start.
- **Learned on the way:** `SYSTEM` starts a program with `JP`, so a `RET` from an exported program
  restarts the machine. Run's 06CCh return does not exist there: programs meant for export end with
  `JP $06CC`, as the template does. The ROM also draws its cursor where it will print next; moving
  the cursor by writing $4020h leaves that `_` behind, so the template blanks it first.
- **Phase 4:** `project-templates/ht1080z/default` prints a centred welcome through 0033h, draws a
  block bar and returns with `JP $06CC` (`test/ht1080z-hw/project-templates.test.ts`, run and from
  its `.cmd`, on every model). Spectrum builds (sjasmplus, Klive BASIC) on the HT get the machine's
  model-mismatch refusal; the IDE's placement pre-check runs only for HT builds, so they do not get
  a RAM-size error first; z88dk already refused the HT. `klive run <project>` (fixture
  `test/cli/fixtures/runht1080z`). The unit-test runner takes the HT (D-Q6 held: no more than the
  flow was needed), `test/unit-tests/runner-machines.test.ts`.
- **Phase 5:** docs (`reference/z80-assembler/ht1080z.mdx`, the `.model` lists, the templates page,
  the unit-test machines, a "Writing machine code" section in the HT guide), the screenshot recipe's
  fourth shot `ht1080z-debug.png` (it checks the stop at $7003 and the editor's line mark). In the
  running IDE: `newp ht1080z`, `run` printed the welcome; `debug` with `bp-set [code/code.kz80.asm]:15`
  stopped at $7003 with the line marked, and step-over went to $7006 and $7009.
- Not changed: when the machine stops at a breakpoint on a line that is scrolled out of view, the
  editor does not scroll to it (seen on line 26 of the template). Whether other machines behave the
  same was not checked.

