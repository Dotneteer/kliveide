# ROM Annotation Pipeline Plan

Status: **agreed, not started**. The decisions are in §2; the details still to settle are in §10.

## 1. The idea

Annotating a ROM today is mostly an AI reading long disassembly listings and
writing JSON drafts. Most of that work is mechanical and could be done by deterministic tools:

- **Before the AI:** a **preprocessor** turns the ROM, its profile and what is already known into a
  compact, analysed form. That form has routines with their boundaries, callers, callees, RAM use, tables,
  texts and inline data already worked out, so the AI reads facts, not 11,000-line listings.
- **After the AI:** the AI writes its understanding in a **small, forgiving text format** (names, synopses,
  comments, data kinds), and a **postprocessor** turns it into the sidecar. The
  postprocessor does the canonical formatting, wraps lines, swaps addresses for names, records provenance,
  checks, measures the level and reports problems as a short list to fix.

The goal is that the AI spends its tokens only on what needs understanding: what a routine does, what to call
it, what a table means. Everything else is a program, run as often as needed at no AI cost.

## 2. Decisions

- **D1. TypeScript, usable from Node.js.** The preprocessor and the postprocessor are TypeScript modules in
  the repository, run from Node.js through a CLI. They replace the `.py` and ad hoc `.cjs` helpers in
  `.ai/rom-annotations/tools/` as the pipeline covers their jobs (§3).
- **D2. The CPU is an explicit flag: `cpu: "z80" | "z80n"`.** Every input image carries it, and every stage
  takes it from there; nothing in the pipeline guesses it from a machine or a ROM kind. The ROM adapter
  supplies the default from the ROM kind (`romKindUsesZ80N(kind)`: the Next's ROMs are `z80n`, every other
  ROM `z80`), and the CLI's `--cpu` overrides it. What the flag changes:
  - decoding: the Z80N's extra opcodes (`allowExtendedSet` in `Z80Disassembler`); on a plain Z80 the same
    bytes are `ED` no-ops, so the wrong flag changes instruction lengths and every boundary after them;
  - control flow: `JP (C)` (`ED 98`) is the one branch Z80N adds (`z80-branch-info.ts` already has it);
    its target is not static and goes to the open questions like `JP (HL)`;
  - operands: `NEXTREG reg,n` / `NEXTREG reg,A` name the Next register, `PUSH nn` is big-endian, and
    `NEXTREG $50-$57` / `$8E` writes are paging facts for §4.6 (the NextZXOS ROMs use them);
  - the `.ann` header and the output sidecar record the CPU; the postprocessor refuses `.ann` files whose
    CPU differs from the image's.
- **D3. ROMs first; other binaries later.** The pipeline is built for ROM annotations and proves itself on
  them. Larger Z80/Z80N binaries (`.nex` files first) are a future extension (§13), taken up only after
  that. The design keeps the door open without building for it now: the core works on a small "image"
  (banks, entries, CPU) that the ROM adapter fills, so another adapter can be added later; ROM-specific
  parts (ROM kinds, `.rom.dis` sidecars, the ROM profile recipes) stay in that adapter.
- **D4. The provenance rule applies unchanged.** It is decision D4 of
  `.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md` (§6), stated for authors in
  `.ai/rom-annotations/README.md`: annotations come only from the ROM's bytes, Klive's own runs and
  interface facts from official manuals, never from a commented disassembly, a label file or a skool file
  for that ROM, remembered ones included. The tools analyse only those same sources. A convention plug-in
  (§4.5) is code written from a ROM's code, so it is held to the rule like an annotation and gets a record
  of its own: a header comment naming the ROM routines it was written from, and an entry in
  `.ai/rom-annotations/PROVENANCE.md`. The postprocessor writes each entry's provenance tag (`observed`,
  `manual`, `derived`) itself.
- **D5. `.ann` is a new format** (§5), not SkoolKit's `.ctl`/skool: skool has no place for provenance or
  Klive's region kinds, and the pipeline should not depend on another project's grammar. SkoolKit import and
  export (`src/common/reverse/skool/`) stay as they are.
- **D6. `.ann` files are work files, not committed.** The sidecar stays the only source of truth.
  `export-ann` regenerates `.ann` files from any sidecar, and P1's round trip (sidecar → `.ann` → sidecar,
  byte-identical) proves nothing is lost. Committing them can be reconsidered later if their diffs prove
  useful in review.
- **D7. Cards carry facts only** (for jump targets inside a routine, D14 now lets the tools name them). A card states what the tools can establish: boundaries, callers, callees,
  RAM, ports, coverage, decoded texts and error messages (a decoded string is a fact). It never suggests a
  name, a synopsis or a purpose; that is the AI's understanding, and a guess on a card would be copied as
  if it were a fact.
- **D8. The first ROM is EXDOS 1.3** (`src/public/roms/ep-exdos13.rom`, no sidecar yet). It is new code,
  so it tests the cards and the postprocessor, which carry most of the saving, without needing version
  alignment (P6). IS-BASIC 2.0, a carried ROM, is the test for P6 afterwards.
- **D9. The code lives in `src/common/reverse/pipeline/`** (§3.1), beside the existing reverse-engineering
  tools. The disassemblers stay under `src/renderer/appIde/disassemblers/` for now: they already load from
  Node (the carry script and `reach.ts` use them). Moving them to a non-renderer path is a separate
  refactor, done only if the IDE integration needs it.

- **D10. Every subroutine's synopsis states its contract.** A subroutine is code entered by `CALL`, `RST`
  or a call/dispatch table and left by a return (the preprocessor marks them; a label reached only by
  jumps, such as a loop, is not one). Its synopsis ends with these lines, in this order. `Entry:`, `Exit:`
  and `Changes:` are required and present even when the answer is "none"; `Error:` and `Keeps:` are
  **optional** in the sidecar, written when they say something:
  - `Entry:` the input parameters: registers, flags and memory it reads before writing (`A = segment`,
    `(HL) = the name, length first`); `Entry: none.` when it takes nothing.
  - `Exit:` the outputs on success (`A = 0; C, D, E = the time`).
  - `Error:` how failure is signalled and what comes back with it (`Carry set, A = error code`;
    `Stops with error code n (report X)`); left out when the routine has no failure exit.
  - `Changes:` the registers whose values change, in the order AF, BC, DE, HL, IX, IY, then the alternate
    registers with a prime (`AF'`, `BC'`, `DE'`, `HL'`; `all alternates` when all four change). 8-bit names
    where only one half changes (`A, F, C`). Other state follows after a semicolon (`; page 1`, `; (FLAGS)`).
    **The alternate set appears only here:** an alternate register that is not named is unchanged.
  - `Keeps:` the main registers that hold their values (AF, BC, DE, HL, IX, IY), never the alternates;
    left out when it adds nothing, for example when the routine changes almost everything.

  For example:

  ```
  Changes: AF, BC, DE, AF'.
  Keeps: HL, IX, IY.
  ```
  - `Observed:` stays as today, after these, when probe results are quoted.

  Existing sidecars stay valid as they are: nothing in the format or the level check requires `Error:` or
  `Keeps:`. The preprocessor works out the register facts (§4.3) and the postprocessor checks `Changes:`
  and, when present, `Keeps:` against them (§6.2), so the AI writes the meaning (what A holds on exit) and
  the tools vouch for the register lists. A failure exit the facts show (§4.3, exit paths) with no
  `Error:` line is listed as a question, not a problem. The house-style rule in `.ai/rom-annotations/README.md` (today `Entry:`/`Exit:`/
  `Changes:`/`Observed:`) and the authoring guides are updated to this in P7.

- **D11. The AI-assisted part feeds the preprocessor's improvement.** Every AI pass over the cards is also a
  test of the preprocessor, and the session that runs the pipeline (the AI driving it) collects what that
  test shows and turns it into proposals:
  - **Asked for:** each helper writes `feedback` lines in its `.ann` file (§5) of four kinds: `missing`
    (a fact it needed that no card gave), `wrong` (a card fact the code contradicts), `pattern` (something
    it worked out by hand more than once, which a rule or a plug-in could do) and `listing` (each time it
    had to open the listing, and why). The helper brief (P7) makes this part of the job, with examples.
  - **Measured without asking:** the postprocessor and the CLI record signals the AI does not have to
    report: listing requests made through `rom:pipeline -- listing` (by range); card facts the AI's text
    overrides (an `Exit:` that contradicts the exit-path facts, a region over what the card called code);
    "unknown" register facts the AI settled, and how; problem-list items that recur across helpers or
    rounds; label and region kinds the AI set that a detector could have proposed.
  - **Turned into proposals:** `compile` writes `feedback.md` beside `problems.md`, grouping both sources by
    kind and by preprocessor stage (cards, register facts, detectors, conventions, alignment), each item
    with its count, its addresses and a proposed change ("add a `pager` convention: `CALL $B217` with A =
    segment"). At the end of a ROM, the driving session reviews it with the project author, and the
    accepted items go into a committed backlog, `.ai/rom-annotations/pipeline-backlog.md`, with the ROM and
    the evidence that raised them. The raw feedback stays in the work folder.
  - **Closed when fixed:** a backlog item is done when a test reproduces the case from the ROM's bytes and
    the preprocessor now gives the fact; re-running `prepare` on the same ROM should make that feedback
    disappear. A proposal that would need knowledge from outside the ROM's bytes and Klive's runs is
    rejected under D4, and one that would put a guess on a card under D7.

## 3. Architecture

### 3.1 Where the code lives

```
src/common/reverse/pipeline/
  image/             the image model and the ROM-page adapter
  preprocess/        routine cards, data and table detection, facts, version alignment
  postprocess/       .ann parser, merge, naming, wrapping, provenance, lint, problem list
  conventions/       per-ROM-family plug-ins (hidden entries, inline data, packed texts)
  annFormat.ts       the .ann grammar: parse and write (shared by both sides)
  listing.ts         the bank listing through Klive's disassembler (the `listing` command)
scripts/rom-pipeline.cjs         the Node.js CLI: reads and writes files, calls the API
test/rom-pipeline/               unit tests (unit tier; `test/reverse/` is an e2e glob)
```

- **Beside the existing reverse-engineering tools.** `src/common/reverse/` already has the coverage
  classifier (`classify.ts`), the static reachability walk (`reach.ts`), region proposals (`proposal.ts`),
  SkoolKit import/export (`skool/`) and source export (`sourceExport.ts`). They work per bank, which is what
  the pipeline needs; it calls them instead of re-implementing them.
- **No barrel file.** Callers import from the file that owns a function (`image/romImage.ts`,
  `listing.ts`), as the repository's rules ask; §3.3 lists the API by function, not by entry module.
- **The core is pure.** Every function takes an image, annotation objects, profile data and text, and
  returns data. No `fs`, no `process`, no core instantiation inside the pipeline folder. That keeps it
  testable in the unit tier and lets the IDE use the same code later (cards in a panel, `.ann` round trip).
- **The CLI does the I/O.** `scripts/rom-pipeline.cjs` loads the TypeScript the same way
  `scripts/rom-annotations.cjs` and `rom-annotations-carry.cjs` already do (an esbuild `require` hook plus
  `tsconfig-paths`). That loader is copied in six scripts today; the pipeline moves it into one shared
  `scripts/lib/ts-runtime.cjs` and uses it from there.
- **It builds on what exists.** Disassembly comes from `Z80Disassembler` with the image's CPU flag, plus the
  custom disassemblers a ROM kind selects through `romDecoderFor(kind)` (EXOS calls, IS-BASIC call lists,
  Spectrum calculator literals). Formatting and the level come from `src/common/roms/romAnnotationTools.ts`;
  carrying from the logic in `rom-annotations-carry.cjs`, which moves into the pipeline as a module.
- **The output is the existing annotation model** (`ProgramAnnotations` / `BankAnnotation` in
  `programAnnotations.ts`), written as the ROM's `.rom.dis` sidecar.
- **Profiles run a core, so they stay outside the pure core.** A separate CLI command boots the machine,
  runs the recipe and writes the profile as JSON (§4.2). The preprocessor takes that JSON as an input. Tests
  that run a core go in the e2e tier (`build/e2e-tests.ts`).

### 3.2 Commands

```
npm run rom:pipeline -- profile    <machine> [--recipe <name>]     → work/<rom>/profile.json
npm run rom:pipeline -- prepare    <rom> [--page n] [--cpu z80|z80n] [--from <old sidecar>]
                                                                   → work/<rom>/cards/, facts.json, questions.md
npm run rom:pipeline -- compile    <rom> <ann-dir>                 → the sidecar + problems.md
npm run rom:pipeline -- export-ann <rom> [--page n]                → .ann files from an existing sidecar
npm run rom:pipeline -- listing    <rom> <from>-<to> [--why "..."] → the listing, request recorded (D11)
```

`<rom>` is a sidecar name or path, as `rom:annotations` takes it. All commands are re-runnable and write to
`.rom-annotations/work/<rom>/` (git-ignored), except `compile`, which writes the sidecar in the working copy
(`~/Klive/RomAnnotations/`) under the existing "unchanged since read" rule.

### 3.3 The public API (first sketch)

```ts
type Cpu = "z80" | "z80n";

// image
type BinaryImage = {
  cpu: Cpu;
  name: string;
  banks: ImageBank[];               // a ROM page is one bank
  entries: ImageEntry[];            // known starts: restarts, vectors, the ROM's own tables
  romKind: RomPageKind;             // selects the custom decoders and conventions
};
type ImageBank = { id: string; bytes: Uint8Array; origin: number; size: number };
imageFromRomPage(bytes: Uint8Array, kind: RomPageKind, page?: number): BinaryImage

// preprocess
analyseImage(input: { image: BinaryImage; bank?: string; profile?: ImageProfile;
                      annotations?: ProgramAnnotations; related?: RelatedImage }): ImageAnalysis
renderCards(analysis: ImageAnalysis, options?: CardOptions): CardFile[]      // grouped into ranges
renderQuestions(analysis: ImageAnalysis): string

// .ann format
parseAnn(text: string, fileName: string): { header: AnnHeader; entries: AnnEntry[]; problems: AnnProblem[] }
writeAnn(header: AnnHeader, entries: AnnEntry[]): string
sidecarPageToAnn(sidecar: RawRomSidecar, page: number, options: { cpu: Cpu; rom?: string }): string

// postprocess
compileAnnotations(input: { image: BinaryImage; base?: ProgramAnnotations;
                            ann: { fileName: string; text: string }[] }):
  { annotations: ProgramAnnotations; problems: CompileProblem[]; level: AnnotationLevel }
```

## 4. The preprocessor

### 4.1 The stages, in order

The preprocessor is a fixed sequence of stages. Each one is a pure function that adds to one analysis
object (`RomAnalysis`); nothing is decided by an AI and nothing is read from outside the ROM, its profile,
its sidecar and Klive's own data (D4). **Every fact carries its evidence**: how it is known (`static`: from
the bytes; `profile`: seen in a run; `sidecar`: already annotated; `plugin:<name>`; `carried`) and from
where (the instruction, the table entry, the profile edge). The cards print the evidence, the problem list
and `feedback.md` (D11) point back to it, and a fact with no evidence is a bug.

1. **Load.** Read the ROM page, its kind and the CPU flag (D2); pick the decoder (`romDecoderFor(kind)`,
   with the Z80N set when `cpu` is `z80n`); read the existing sidecar's labels, regions and comments; read
   the profile JSON and map its offsets to the page's offsets through the core's layout
   (`src/common/profile/layouts/`), so every flag and call edge is keyed by page offset. A profile that maps
   to nothing (the empty Enterprise cartridge profile) is an error here, not an empty card later.
2. **Seed the entries.** Collect every place code is known to start, each with its evidence: the CPU's
   fixed addresses on a page that sits at $0000 (`$0000`, the `RST` addresses, `$0066`); the ROM format's
   own entries (an EXOS ROM header, a Next ROM's jump table, as the ROM kind's adapter knows them); the
   sidecar's labels; every instruction start the profile saw executed and every callee of its call edges.
3. **Decode and walk.** Starting from the entries, decode instruction by instruction and follow the flow
   (`reach.ts`): `JP`, `JR`, `CALL`, `RST`, `DJNZ`, the fall-through of conditional branches and calls, and
   the inline data the custom decoders consume after a restart or a call (an EXOS call number, an IS-BASIC
   call list). Each new target becomes an entry (evidence: the instruction that names it). `JP (HL)`,
   `JP (IX)`, `JP (C)` and `RET` into a pushed address add no static target; the profile's executed starts
   cover the ones that ran, and the rest go to the open questions.
4. **Classify code and data.** Combine the walk with the coverage (`classify.ts`): fetched or reached is
   code, only read or written is data, neither is unknown. Then look for **conflicts**: a target that lands
   inside another instruction, a walk that runs into bytes the profile saw read as data, a run of targets
   that are all in the middle of other code (data read as code). Each conflict becomes a **region
   proposal** with its effect ("marking $25D2-$2847 as data removes 37 false targets") (§4.4).
5. **Detect tables, texts and conventions.** Run the table detectors (§4.4) and the ROM kind's convention
   plug-ins (§4.5) over the data and unknown bytes and over the code: dispatch tables (whose words become
   entries, evidence: the table and the code that indexes it), texts and their decoded strings, records,
   hidden entries, inline data after calls. **Stages 3-5 repeat until nothing changes**: a new data region
   removes false targets, a new dispatch table adds entries to walk. The loop is bounded (a fixed number of
   rounds, then the rest is reported as unsettled).
6. **Cut routines.** Partition the code into routines: an entry owns the instructions reachable from it
   before the next entry. Each routine gets a **kind**: *subroutine* (entered by `CALL`, `RST` or a call
   table, and has a return: D10), *jump target* (reached only by jumps: a loop, a shared exit), *entry
   point* (reached only from outside: a vector, a header), or *unreached* (code by coverage or region, but
   no known way in). Shapes that need a human eye are noted, not resolved: a routine that falls through into
   the next one, a jump into the middle of another routine's tail, several entries into one body (the
   `LD DE,$xx2E` hidden-entry runs), code shared by two routines.
7. **Build the call graph.** Callers and callees from the static walk, the tables and the profile's edges
   (evidence on each edge; an edge seen only in the profile is marked so). Calls through a known pager or
   gate (a convention plug-in) are resolved to the page and routine they reach and named with that page's
   sidecar labels. The graph is ordered **bottom-up** (callees before callers); strongly connected parts
   (recursion, mutual calls) are kept together.
8. **Work out register facts and exit paths** (D10), bottom-up over the graph: for each routine a
   data-flow pass over its own paths gives the registers and flags read before written, written, and pushed
   and restored; a call uses the callee's summary (a strongly connected part is iterated to a fixed point);
   `EX AF,AF'`, `EXX` and `EX DE,HL` are tracked. Each exit (`RET`, `RET cc`, a jump out) records the flags
   and registers that are constant there (`SCF`, `XOR A`, `LD A,n`). Anything the pass cannot follow is
   **unknown**, naming the instruction (§4.3).
9. **Collect memory and I/O facts** (§4.6): every absolute RAM address read or written, with the routines
   that do it and the machine's variable name when it has one; `(IX+d)`/`(IY+d)` uses grouped by base
   register; every `IN`/`OUT` with the port's function; every `NEXTREG` with the register's name (Z80N).
10. **Align with a related ROM** (only with `--from`, §4.7): map this ROM's routines to the other's as
    same, shifted or different; build the RAM translation map; carry the annotations of the same and
    shifted ones as `derived`, so their cards say "carried, check only".
11. **Name the operands.** Every operand that is an address or a port gets its known name (a label, a
    system variable, a port's function, another page's label) for the card listing. Numbers with no name
    stay numbers; nothing is named by guess (D7).
12. **List the work left.** Per routine: no label, no synopsis, a synopsis missing the D10 lines, the count
    of instructions with no comment, unknown register facts, a failure exit with no `Error:`. For the page:
    the **open questions** (targets inside instructions, unreached code, unknown bytes, conflicts left after
    stage 5, indirect jumps with no observed target, checksum words).
13. **Group into ranges.** Cut the page into range files sized for one AI pass: routines in bottom-up
    order, a call cluster kept in one range where it fits, the ranges balanced by **work left** (not by
    bytes: a carried, finished stretch weighs almost nothing). The target size is an option, tuned by the
    D11 measurements.
14. **Write the outputs** to `.rom-annotations/work/<rom>/`:
    - `overview.md`: the page at a glance: a map of regions, the routine table (offset, label, kind,
      size, callers, work left), the conventions found, the ranges;
    - `cards/range-NN.txt`: the routine cards (§4.3) of each range, in bottom-up order;
    - `questions.md`: the open questions and the region proposals, each with its evidence and effect;
    - `facts.json`: everything above, machine-readable, for the postprocessor and the tests;
    - `inputs.json`: the hashes of the ROM, sidecar, profile and tool version, so a re-run with the same
      inputs is skipped and a stale bundle is detected.

### 4.2 Inputs

- The ROM page and its kind (`romIdentity.ts`), with its CPU flag (D2); the custom decoders come from
  `romDecoderFor(kind)`.
- A **profile**: one recipe per machine that boots, types a standard script of commands and dumps
  code/read/write flags and call edges (the core already has them). The recipe for each machine is kept in
  the repository. It includes the offset map of the profile buffer (the Enterprise's ROMs are not at
  segment × $4000 there).
- Optionally an **existing sidecar** for the same ROM, or one for a related ROM to carry from (§4.7).

### 4.3 Routine cards (the main output for the AI)

One small text block per routine (a routine is an entry point and the code it owns up to the next entry
point). For example:

```
== $0B40 (run $CB40)  entries from: EXOS 32 table $0028; jp $0B3D, $0B3E, $0B3F (fall-through)
   calls: $B217 (pager, RAM)    jumps: —    returns: ret
   RAM:   reads ($BF79) writes —    ports: —    EXOS calls: —
   registers: reads first A   writes A, F, A' (via $B217: unknown)
              saved and restored: —   alternate set: AF swapped at $CB40
   kind: subroutine (entered by table, returns)
   coverage: ran (12 entries in the profile)
   size: 14 bytes, 6 instructions; inline data after it: none
   ---
   CB40  ex af,af'          ; A' = A
   CB41  ld hl,$C00D        ; another ROM's entry (other segment)
   ...
   known: label SEG1_SERVICE (carried, derived), synopsis exists
```

- Instructions are listed with operands already named where a name is known: labels, RAM variables from a
  machine's variable list, ports by function, and the routine names of other ROMs.
- Callers come from the code itself plus tables and the profile's call edges.
- **Register facts** (D10), by a deterministic data-flow pass over the routine's own paths:
  - *reads first*: registers and flags read on some path before being written (the input candidates);
  - *writes*: registers and flags written on some path, including through callees, whose own summaries are
    used (computed bottom-up, iterated to a fixed point for recursion);
  - *saved and restored*: pushed and popped back into the same register on every path, so not changed;
  - `EX AF,AF'`, `EXX` and `EX DE,HL` tracked, so a value moved to the alternate set is not reported lost;
  - **unknown** where the pass cannot follow: a call into RAM or another page with no summary, `JP (HL)`,
    a stack trick (`POP` into another register, `EX (SP),HL`, a changed return address). The card names the
    instruction, and the AI settles it from the code or a probe.
- **Exit paths**: each `RET`/`RET cc`/jump out, with the flags and registers set just before it when they
  are constants (`SCF; RET` = carry set; `XOR A; RET` = A = 0, Z set), which is where success and error
  exits usually differ.
- **"What is still needed"** at the end of each card: no label, no synopsis, n uncommented lines, targets
  inside an instruction to explain.
- Cards are grouped into range files sized for one AI pass, balanced by the work left.

### 4.4 Data and tables

- **Code or data:** the G7.3 classifier (coverage, reachability), plus one more signal: a run of "targets"
  that land in the middle of other code means data read as code. The preprocessor proposes regions and shows
  what each one removes ("marking $25D2-$2847 as data removes 37 false targets").
- **Table detectors:** word tables whose words point at code (dispatch tables), byte runs that are printable
  (texts: zero-ended, bit-7-ended, length-first), repeated fixed-size records (descriptors, keyword tables),
  BCD numbers. Each candidate comes with the code that reads it and how (`LD HL,table / ADD HL,DE`).

### 4.5 Conventions, as plug-ins

Things a ROM does over and over, written once as small modules next to the custom disassemblers:

- inline bytes after a restart or a call (exists for disassembly; add the "explain" side: "RST 18h: raises
  error 9000 + A");
- hidden entries (`LD DE,$xx2E` runs, `LD A,n` hiding `OR $37`), found and listed with the value each entry
  loads ("$F537: LD L,$48, error 20040");
- packed-text decoders (EXOS/IS-BASIC 4-bit codes, the WP's bit stream, EXOS 2.0's phrase bytes), so the
  card shows the decoded text next to the bytes;
- error-number tables to text (from the ROM's own message table once decoded).

A plug-in is deterministic and testable. It is written from the ROM's code and recorded as D4 says.

### 4.6 Facts and maps

- **RAM map:** every RAM address the page uses, with readers and writers, and whether it is a known system
  variable (names from the machine's own list, `EpSysVars.ts` and others).
- **Ports and I/O:** every `IN`/`OUT` with the port's function from the machine's hardware notes.
- **Next registers (Z80N):** every `NEXTREG` write and every write through ports `$243B`/`$253B`, with the
  register's name; MMU writes (`$50-$57`) and bank-select writes also go to the paging facts.
- **Cross-page and cross-ROM calls:** a call into another page through a pager or gate, named with that
  page's labels.
- **Open questions:** targets inside instructions, never-run code, unreferenced bytes, checksum words: listed
  for the AI to settle, not left for it to discover.

### 4.7 Related ROMs (versions)

Generalise `rom:annotations:carry`:

- Align two ROMs instruction by instruction (with operand wildcards) and report shifted stretches ("2.0
  $1469-$25CF = 2.1 $149E-$2604 - $35").
- Build the **RAM translation map** from differing operands of aligned instructions, and apply it to carried
  text. The carry tool does not do this today.
- Mark every carried routine as same, shifted or different, and send only the different ones to the AI.

## 5. The `.ann` format

A plain text format that is cheap to write and hard to get wrong (as built in P1; the grammar's own
reference is the header comment of `src/common/reverse/pipeline/annFormat.ts`). One file covers part or all
of one ROM page:

```
# A comment line (column 0 only)
rom ep-exos21.rom page 0 cpu z80             # the header: the postprocessor checks all three
default observed                              # the provenance of every entry not listed below

code 0000-0B3C                                # regions: code, bytes, words, text, fill, defc
bytes 0B3D-0B3F rows=1 radix=binary           # bytes take rows=<n> and radix=binary
words 000A-002D

@0B40 SEG1_SERVICE
  EXOS 32 (read time): segment 1 service 0; returns the time (C, D, E) ...
  Entry: A = the service number.
  Exit: A = 0; C, D, E = the time.
  Error: A = error code, Z clear.
  Changes: AF, BC, DE.
  Keeps: HL, IX, IY.
  .0B41 A' = service number
  .0B44 Through the pager at $B217

manual 0B40:label 0B40:line                   # provenance exceptions: observed, manual, derived
delete 0C00:synopsis                          # removes a base entry: label, synopsis, comment, line
question 0C40 Does A come back 0 for a missing drive? Needs a run with no disk
feedback missing 0B40 Card did not say $B217 is the pager; read its code to find out
feedback wrong 0C12 Card lists C as written; the write is on a path that cannot run
feedback pattern 0D00-0D40 Six routines end LD A,n / SCF / RET: an error exit, could be a card fact
feedback listing 0E10-0E60 Opened the listing: the card's operands were unnamed RAM
```

- A block is `@offset` and an optional label; the lines indented by two spaces under it are the synopsis,
  one line per line, kept as written (rewrapping is P7). `.offset text` lines are end-of-line comments,
  inside a block or at the top level.
- Region kinds are the sidecar's: `text`, `fill` and `defc` are `bytes` regions with that `decode`.
- Escapes: a comment's or note's newline is `\n` and its backslash `\\`; a synopsis line that starts with
  `\` or looks like a comment line gets one more `\` in front; `\` alone is an empty synopsis line. Notes
  may also be a JSON string in quotes.
- `question` lines are things to settle with a run (§7, step 7); the postprocessor lists them in
  `problems.md` until an `Observed:` line or a later `.ann` answers them.
- `feedback` lines are about the tools, not the ROM (D11); the postprocessor collects them and never writes
  them into the sidecar.
- Not built yet: free wrapping at 92 columns (keeping numbered steps and the D10 lines), and marking a
  number that must stay a number for the naming pass (both P7).

## 6. The postprocessor

### 6.1 What it does (all deterministic)

As built in P1 (`postprocess/compile.ts`):

- **Overlay:** every `.ann` file is laid over one page of a base sidecar. An entry replaces the base's entry
  at the same place: a label, a synopsis, a comment, the bytes a region covers (the base's regions are cut
  around it). Every replaced or deleted base entry is listed as a change, so a carried sidecar's text is
  never overwritten unseen.
- **Conflicts are errors, not "last one wins":** one offset with two names, one name at two offsets (also
  against the base), overlapping regions, two different texts for one offset, two comments for one offset
  in a file. A header that names another ROM, page or CPU (D2) is an error too.
- **Provenance:** an entry a file sets takes that file's mark for it, else its `default`; a base entry keeps
  its own; a region piece cut from a base region keeps that region's. Keys that name nothing any more are
  dropped; an entry left without one is an error. A mark that names no entry is a warning.
- **Coverage:** the page's regions must cover it from 0 to its last byte (the larger of the ROM page and
  what the base already covers: the ZX81's 8K ROM is listed to $3FFF).
- **Output:** the sidecar through `formatRomSidecar`; the CLI measures the level (with inherited entries, as
  `rom:annotations level` does) and writes `problems.md`: errors, warnings, unlabelled targets, labels
  without a synopsis, misplaced labels, changed base entries, questions and feedback. With any error,
  nothing is written.
- **Base:** `--sidecar`, else the working copy, else the shipped file, else a new all-code sidecar
  (`postprocess/newSidecar.ts`, for a ROM nobody has annotated yet). The working copy is written only when
  it is unchanged since it was read.

Added in P7 (`postprocess/textPass.ts`, `lint.ts`, `report.ts`): the text pass (a changed synopsis's long
lines wrapped at 92; `$0B40!` keeps a number; `--name-numbers` swaps labelled offsets for their names, every
swap listed, off by default because on a page above $0000 an offset can be a RAM address), the lint, the
problem list with a fix for every item, `feedback-page-<n>.md`, and the IDE's readiness check ("Ready to
ship?"). The reassembly check is still `tools/reassemble-test.ts.txt` (backlog).

### 6.2 Lint (deterministic house style)

- comment length under 70 and no full stop;
- no mnemonic restating;
- "probably" and "unclear" counted and listed;
- names at most 16 characters and unique across the file;
- names that clash with another ROM's label for a different job are flagged;
- `manual` keys must exist;
- every subroutine's synopsis has `Entry:`, `Exit:` and `Changes:`; `Error:` and `Keeps:` are optional;
  the lines that are present come in the D10 order;
- `Changes:` and, when present, `Keeps:` agree with the register facts: a register in `Keeps:` that the code
  changes, or one in `Changes:` it never writes, is a problem; a written register missing from `Changes:`,
  or a fact that is unknown, is listed for the AI to settle; an alternate register the code changes must be
  in `Changes:`, and one in `Keeps:` is a problem (D10 keeps alternates out of `Keeps:`). When `Keeps:` is
  present, the two lines together name each of AF, BC, DE, HL, IX and IY exactly once (a pair split into
  halves counts when both halves are named).

## 7. The analysis phase (the AI pass)

This is the part that needs understanding: what a routine does, what to call it, what a table means. The
session that drives the pipeline (the AI, working with the project author) runs it in these steps.

1. **Prepare and read the page as a whole.** Run `profile` (if the machine has no profile yet) and
   `prepare`. Read `overview.md` and `questions.md`, not the cards: what the page is, its conventions, its
   big tables, where the work is.
2. **Settle the page-wide questions first**, because every range depends on them:
   - accept or reject each **region proposal** (data that was read as code), reading the code that uses
     the bytes; accepted ones go into a `regions.ann` file;
   - recognise a **convention the tools do not know yet** (a pager, an inline-argument call, a packed text
     format) from two or three occurrences; record it as a `pattern` feedback line (D11) and, if it blocks
     the cards, write the plug-in now, under D4;
   - then `compile` the regions and re-run `prepare`, so the cards the helpers get are already right.
3. **Brief the helpers, one per range.** The brief names the range file, the rules (D4, D7, D10, the house
   style), the names already given elsewhere in the page and in related sidecars (a routine doing the same
   job as one already named takes that name), and the feedback duty (D11). A small page is done by the
   session itself, range by range.
4. **Each helper works through its cards in order (bottom-up)**, so a routine's callees are already
   understood when it is read. For each routine card:
   - read the facts: entries and callers, callees with their synopses, RAM and ports by name, the register
     facts and exit paths, coverage, the listing with named operands;
   - work out what the routine does **from its instructions** (D4); a fact on the card is evidence, not a
     description to copy;
   - give it a **label** (16 characters at most, named from what the code does) and a **synopsis**: a
     summary line first, numbered steps for a long routine, then the D10 lines. `Entry:`/`Exit:`/`Error:`
     carry the meaning (what A holds); `Changes:`/`Keeps:` follow the register facts, and where a fact is
     unknown the helper settles it from the code;
   - add **end-of-line comments** where an instruction's purpose is not obvious (on the first line of a
     step, values not mnemonics, tests as questions);
   - declare **regions** for data the card marked unknown, with their kind;
   - when something needs a run to settle (what a routine returns for a given input, whether a path ever
     runs), write a `question` line rather than a guess;
   - write `feedback` lines about the tools whenever a card was missing a fact, wrong, or made it open the
     listing (D11).
5. **Each helper compiles its own range** (`compile` takes one `.ann` file against the base sidecar),
   fixes its problem list until it is clean, and hands back the `.ann` file and its `question` lines.
6. **The session merges.** `compile` over all ranges: cross-range problems (a name used twice, a routine
   named by two ranges, a caller's synopsis that disagrees with its callee's `Exit:`) are fixed in the
   `.ann` files.
7. **The session settles the questions** that need a run: a probe through the machine's test harness or
   the profile recipe, its result quoted in an `Observed:` line.
8. **Check and review.** The level check must show level 2, the reassembly check must pass, and the session
   spot-checks a sample of routines against their code: a comment that cannot be traced to the code it sits
   on is removed (D4). Then the sidecar is installed through the working copy and a `PROVENANCE.md` entry
   records what was used.
9. **Review the feedback** (D11): `feedback.md` with the project author; the accepted proposals go to the
   backlog and are fixed before the next ROM.

The `.ann` format gains one more line kind for step 4:

```
question 0C40 "Does A come back 0 for a missing drive? Needs a run with no disk"
```

## 8. Measuring it

Measured on EXDOS 1.3 (D8), the first ROM annotated with the pipeline, and shown in that run's summary (a
decision of the project author):

- **the total time**: from the start of the run (`timings start`) to the installed sidecar;
- **the time of the preprocessor and postprocessor** (and the other tools): every `rom:pipeline` command
  logs its own duration to `.rom-annotations/work/timings.jsonl`, by command;
- **the time used by the AI**: the total less the tools' time (the helpers' own times are recorded too; they
  overlap when helpers run in parallel);
- **the tokens used by the AI**: the CLI cannot see them, so the driving session records them with
  `timings ai <label> --tokens n --ms n --what "..."`: each helper's usage from its result, and the session's
  own from its usage before and after the run.

`npm run rom:pipeline -- timings report <label>` prints all four. The D11 signals are part of it too:
listing requests and `missing`/`wrong` feedback per routine should fall from one ROM to the next.

## 9. Phases (first cut)

| Phase | What | Depends on |
|---|---|---|
| P0 | **Done.** The module layout, the shared TS loader for Node scripts, the `rom:pipeline` CLI shell (with the recorded `listing` command); the image model with the CPU flag and the ROM-page adapter | — |
| P1 | **Done.** The `.ann` format (parse, write, `sidecarPageToAnn`) and the postprocessor's core (merge, provenance, formatting, level); round trip of every shipped sidecar to `.ann` and back as a test | P0 |
| P2 | **Done.** Routine cards from the decoder plus the existing sidecar (entries, callers, callees, RAM, coverage, "still needed"), for both CPUs; a Z80N test that covers every extended opcode; the subroutine marking and the register-facts pass (D10), tested on hand-made routines and on finished sidecars' routines | P0 |
| P3 | **Done.** Profile recipes per machine and the `profile` command; profile offsets known per core | P0 |
| P4 | **Done.** Data and table detectors; region proposals with their effect on false targets | P2 |
| P5 | **Done.** Convention plug-ins: hidden entries, inline texts, packed-text decoders (Enterprise first) | P2 |
| P6 | **Done.** Version alignment with a RAM map; the carry logic moved in, plus "same / shifted / different" | P2 |
| P7 | **Done.** Naming pass, lint (with the D10 contract checks), the problem list and `feedback.md` with the measured signals (D11); the backlog file; retire the replaced `.ai/rom-annotations/tools/` scripts; update the helper brief and the authoring guides | P1 |
| P8 | **Done.** Try it on a ROM; measure §8; review its feedback and fix the backlog before the next ROM | all |
| P9 | The "Under the Hood" article on AI-assisted reverse engineering (§11); written after P14, so it describes the pipeline that cuts the AI's cost | P14 |
| P10-P14 | Cutting the AI's cost: programs do the mechanical work, the AI reads once and writes once (§12) | P8 |

### 9.1 As built: P0

- `scripts/lib/ts-runtime.cjs` is the one TypeScript loader for Node scripts; `rom-annotations.cjs`,
  `rom-annotations-carry.cjs`, `rom-pipeline.cjs`, `build-next-sd-image.cjs` and the debug-loop and Z88
  benchmarks use it. `benchmark-zxnext-wasm.cjs` keeps its own (decorators, JSX, DOM shims).
- `src/common/reverse/pipeline/image/`: `cpu.ts` (the `Cpu` flag, `parseCpu`, the default per ROM kind),
  `binaryImage.ts` (`BinaryImage`, `ImageBank`, `ImageEntry`), `romImage.ts` (16K pages,
  `imageFromRomPage`: kind by CRC unless given, origin from the kind, the CPU's fixed entries on a page
  at $0000). `listing.ts` lists a bank with the image's CPU, the kind's custom decoding and optional
  regions.
- `npm run rom:pipeline -- image|listing` work; `listing` appends each request to
  `.rom-annotations/work/<rom>/listing-requests.jsonl` (`page`, `from`, `to`, `why`, `lines`).
  `prepare`, `compile`, `export-ann` and `profile` exit with "not built yet (phase Pn)".
- Tests: `test/rom-pipeline/` (unit tier). `test/reverse/**` is an e2e glob in `build/e2e-tests.ts`, so
  the pipeline's unit tests do not live there.
- `romDecoderFor` (used by the level check and the carry) still takes the Z80N from the ROM kind; the
  pipeline's own decoding uses the image's CPU. Cards (P2) decode through the pipeline, so D2 holds for
  everything the pipeline produces.

### 9.2 As built: P1

- `annFormat.ts` (parse, write, escapes), `postprocess/sidecarToAnn.ts` (`sidecarPageToAnn`: the page's
  most common provenance becomes the default), `postprocess/compile.ts` (§6.1), `postprocess/regionKinds.ts`,
  `postprocess/newSidecar.ts`.
- `npm run rom:pipeline -- export-ann` and `compile` (§3.2).
- **Every shipped sidecar round-trips byte for byte** (`test/rom-pipeline/compile.test.ts`, all 44 files,
  every page): rebuilt from its `.ann` onto an emptied page, and laid over itself with no changes. That is
  the proof D6 relies on: `.ann` files lose nothing, so they can stay work files.
- The round trip found one gap in the canonical form: 407 line entries in 21 sidecars stored `comment`
  before `synopsis`. `formatRomSidecar` now writes a line entry's keys in one order (synopsis, comment),
  and the 21 files were reformatted (key order only).

### 9.3 As built: P2

- `preprocess/effects.ts`: what each instruction does to registers (8-bit halves), memory (`(nn)`),
  ports, Next registers, the stack and the swaps, read from Klive's disassembler's text and bytes.
  `test/rom-pipeline/effects.test.ts` runs **every opcode of both CPUs** through it (none unknown) and
  checks that the Z80N's own `ED` opcodes decode only for `z80n`.
- `preprocess/decode.ts`: the sidecar's code regions decoded linearly from each region start and label
  (as the level check does), with the image's CPU. **Hidden entries** (a jump into the middle of an
  instruction, EXOS's `LD A,n` error codes inside `LD DE,nn` runs) are decoded too, as their own short
  stream until it meets the main one; this was planned for P5 but is generic, so it moved here.
- `preprocess/routines.ts`: entries with evidence (CPU vectors, labels, region starts, call/jump targets,
  the sidecar's `words` tables, profile callees), routines cut at entries, callers and callees, and the
  D10 kinds.
- `preprocess/registers.ts`: the register facts. A symbolic pass: each register holds the name of the
  entry register whose value it still has, through `PUSH`/`POP`, `EX`, `EXX` and callee summaries
  (bottom-up, iterated over recursion); a `RET` after `LD SP` or a `POP` of the return address is not a
  return; exits record carry, zero and A. Unfollowable steps are listed as unknown with the instruction.
- `preprocess/analyse.ts` and `preprocess/cards.ts`: memory and I/O facts, coverage from a profile, the
  work left, open questions, ranges (bottom-up, balanced by work), and the outputs of `prepare`
  (`overview.md`, `cards/range-NN.txt`, `questions.md`, `facts.json`, `inputs.json`; a re-run with the
  same inputs is skipped). About 0.3 s per 16K page.
- **Measured against finished sidecars:** the computed `Changes:` agree with the authors' lines (by pair)
  on 39 of 42 comparable sp48 routines (`registers.test.ts` holds it above 85 %). The rest are the
  pass's conservative side: a value restored by arithmetic (`SBC HL,DE; ADD HL,DE`) reads as changed, so
  the facts are "may change". **P7's lint must therefore flag only definite contradictions** (a register
  in `Changes:` that no path writes), and list the others as questions.
- Not yet (later phases): naming RAM by system variable and ports by function (stage 11 names only the
  page's labels); finding code and data without a sidecar (P4: a new ROM is decoded as all code for
  now); the EXOS call and other restarts' ABIs (P5: `RST 30h` is a call outside the page, so its
  callers' register facts are unknown after it); version alignment (P6).

### 9.4 As built: P3

- `profile/romPageProfile.ts` cuts a run (the core's flag buffer and call edges) into one ROM page's
  profile, through the core's profile layout; `analyse.ts` takes it (`RomPageProfile`).
- The recipes are `test/rom-annotations/profileRecipes.ts` (they run cores, so they live in the e2e
  tier): `sp48`, `ep128` (EXOS 2.1, IS-BASIC 2.1), `ep64` (EXOS 2.0, IS-BASIC 2.0) and `ep128-exdos`
  (with the card and an empty 720K disk: `:DIR`, `SAVE`, `LOAD`). `profile.test.ts` runs one when
  `npm run rom:pipeline -- profile <recipe>` asks, writing `work/<rom>/profile-page-<n>.json` (which
  `prepare` reads by default) and `work/<recipe>.log.md` with every command and the screen after it, so
  a session can quote what it observed. Without a recipe it checks the 48K run (about 2 s).
- The log paid for itself at once: it showed that IS-BASIC refuses a multi-statement line and that an
  extension's command needs a `:` (`:DIR`), and both were fixed in the script.
- EXDOS: page 0 runs 4,050 instruction starts in `ep128-exdos`; **page 1 is never reached** by it.
- No recipe yet for the ZX80/81, HT-1080Z, TVC, Spectrum 128/+3 or Next ROMs: each is written when one of
  them is next annotated with the pipeline.

### 9.5 As built: P4

- `preprocess/proposals.ts`: the walk (`reach.ts`) from trusted starts only (the CPU vectors, the run's
  executed starts and callees, the sidecar's labels in its code) and the classifier (`classify.ts`) over the
  run's flags give code and data; every part that differs from the page's regions is a **proposal**, with its
  evidence, the false targets it removes, and the rows that load its address (`LD HL,table`).
- **The evidence rules that keep finished sidecars quiet:** only a run turns declared data into code (a walk
  falls through into a table after a call that never returns, as at sp48's $046E); bytes a run only read but a
  flag-free walk reaches as code are a conflict, not data (EXOS reading its own header). Both go to
  `questions.md`. The test holds sp48, EXOS 2.1 (both pages) and the ZX81 at no code/data flips.
- **Detectors** over bytes no run touched and no walk reaches, still listed as code (an author's data region
  is their decision): pointer tables (distinct words that point at reached code, no fill values; two if code
  loads the table's address, else four) and texts (six or more printable characters, mostly letters, ended
  by 0, CR or bit 7). **Inline data after calls** is observed: bytes right after a `CALL`/`RST` that the run
  read and never ran (EXDOS's `CALL $C0F2` takes such bytes).
- Outputs: `proposals.md` and `proposals.ann` (region lines commented out: uncomment to accept, then compile).
  EXDOS 1.3 page 0 gets 57 proposals with its profile; a finished sidecar gets none or a text refinement.
- Not built: fixed-size record and BCD number detectors; repeating stages 3-5 automatically (the session
  accepts proposals and runs `prepare` again, §7 step 2, which does the same with a person in the loop).

### 9.6 As built: P5

- `conventions/`: the plug-in shape (`convention.ts`: a call contract, a row note, packed texts, and the
  `source` every fact is printed with), the registry (`registry.ts`) and the Enterprise plug-in
  (`enterprise.ts`, recorded in `PROVENANCE.md`).
- **The EXOS call contract** (manual §4.1: A, BC, DE in; A = status; HL, IX, IY and the alternate set kept)
  is applied by the register pass to `RST 30h`, so a routine that makes an EXOS call has register facts
  again; the card lists it as `assumed:` with its source, never as the routine's own code.
- **IS-BASIC's restarts** (`RST 08h/10h/18h/20h`) are explained on the rows of the pages that hold IS-BASIC.
- **Packed texts:** TEXT_UNPACK's 4-bit codes (ERR_MESSAGES keyed by ERR_NUMBERS, TEXT_WORDS, ERR_TEXT_PACKED
  keyed by status code) and the WP's phrases (2.1's bit stream, 2.0's byte-and-phrase packing) decode into
  `texts.md`, to exactly the counts and texts the EXOS 2.1 and 2.0 sidecars state. The tables are found
  through the sidecar's labels, so a page nobody has labelled gets none yet.
- **Hidden entries** were built in P2 (generic); the overview now lists each with the instruction found
  there ("$0BEA (from $0B82): ld a,$FB").
- Not built: the chapter 11 exceptions to the EXOS contract; IS-BASIC's restarts' register contracts; the
  WP's own packed texts (only its phrase table is located). Each is a backlog candidate for D11's review.

### 9.7 As built: P6

- The carry's re-anchoring core moved from `scripts/rom-annotations-carry.cjs` to
  `align/carry.ts` (TypeScript, tested by `test/annotations/romCarry.test.ts`; the old command line uses it).
  It now knows where a page runs: on a $C000 page the operands it masks are $C000-$FFFF, not below $4000,
  which is what made the EXOS 2.0 carry translate addresses by hand.
- `align/alignPages.ts`: the two pages matched instruction by instruction between the carry's placed labels
  (16-bit operands as wildcards; a longest common subsequence per gap, greedy over long ones), giving the
  stretches, the **RAM translation map** (operands outside the page that differ; conflicting ones kept out),
  and a status per old routine: same, shifted, different (some instructions unmatched; placed from its first
  matched one), missing.
- `align/carryPage.ts`: carry, align, then place what the signatures lost on a matched instruction, and
  translate RAM addresses ($4000 and up, seen at least twice) in the carried text.
- `rom:pipeline -- carry <from> <to>` writes `work/<to>/carried.rom.dis`, `alignment-page-<n>.md` (stretches,
  RAM map, differing routines, what was not carried, text to check) and `alignment-page-<n>.json`, which
  `prepare` reads: cards say `carried: same|shifted|different from ...`, and the work weight of a same routine
  is 0 and of a shifted one a quarter, so ranges hold the different ones.
- **On EXOS 2.1 to 2.0** (`align.test.ts`): 1,109 of page 0's 1,132 labels carried (579 by signature alone,
  the 2026-11-01 session's figure), 1,039 routines shifted, 34 different, and the stretch that session found by
  hand ($1AC6-$25D1 = $1A91-$259C, -$35); `prepare` on the result gives 9 ranges instead of 27.

### 9.8 As built: P7

- **Text pass** (`postprocess/textPass.ts`): see §6.1.
- **Lint** (`postprocess/lint.ts`), on what the `.ann` files set: label length (16) and clashes with other
  shipped sidecars' labels (a question: the same job?); comments under 70, no full stop, not restating the
  instruction; hedges ("probably", "unclear", ...) as questions; for subroutines, the D10 lines present and in
  order, and `Changes:`/`Keeps:` against the register facts: a register named in `Changes:` that every return
  keeps is a problem, everything the "may change" facts cannot settle is a question.
- **Reports** (`postprocess/report.ts`): `problems.md` per page (errors; problems with their fixes; the
  level's unlabelled targets with their callers and whether they ran; labels without a synopsis; questions;
  numbers named; base entries changed; and the IDE's readiness check). `feedback-page-<n>.md` (D11): the
  `feedback` lines, and the measured signals (listing requests, definite contradictions, unknown register facts
  the AI settled, data regions no detector proposed, problems that recur over compiles from
  `compile-history-page-<n>.jsonl`), grouped by stage, each with a proposed change.
- **The backlog** is `.ai/rom-annotations/pipeline-backlog.md` (its format; the known gaps listed for review).
- **Retired** from `.ai/rom-annotations/tools/`: the six `*-dis.cjs` listings, `listing-range.py`,
  `annotated-view.py`, `merge-drafts.py`, `apply-draft.py`, `apply-comments.py`, `apply-annotations.cjs`,
  `check-annotations.cjs`; `tools/README.md` maps each to its command. Kept: `map-rom.py`/`build-mapped.py`
  (the Spectrum's inline words after `CALL $3E80`), `error-bytes.py`, the reassembly and probe templates,
  `pdf-text.py`.
- **Briefs and guides:** a new helper brief, `helper-briefs/pipeline-range.md` (§7 step 4); the README's tool
  section and house style (with the D10 contract) rewritten for the pipeline; the machine guides and older
  briefs point to the pipeline and to `tools/README.md`.
- **Tried:** a trial `.ann` on EXDOS caught a deliberate `Changes:` contradiction (BC and F, kept by
  `PUSH`/`POP`), the comment rules, the hedge, and wrapped the long synopsis line; its feedback grouped the
  `feedback` line, the listing request and the contradiction by stage.

### 9.9 As built: P8 (EXDOS 1.3)

EXDOS 1.3 (`ep-exdos13.rom`, D8) went from no sidecar to level 2 on both pages, reassembling byte for byte, in
one measured run (`timings report p8-exdos`):

| Measure | Value |
|---|---|
| Total time | 48 min 16 s |
| Preprocessor, postprocessor and other tools | 49.8 s (1.7 %): `prepare` 7 runs 23.8 s, `compile` 35 runs 23.1 s, `listing` 203 runs 2.9 s |
| AI | 47 min 26 s (98.3 %) of wall time; the 13 helpers' own times add up to 159 min 49 s, run six at a time |
| AI tokens | 3,263,968: the regions helper 220,806, the twelve range helpers 143,889-285,713 each (2,926,028), the session 117,174 (its context's growth) |

How the run went: a profile on the 128 with the EXDOS card; `prepare` on both pages; one helper for the regions
(page 1 is two counted message tables and $FF fill; page 0's header, function table, device tables, command
table and the inline byte after every `CALL $00F2`); twelve range helpers in parallel; the merge (33 conflicts
the compiler reported instead of resolving, settled by which range owns the routine); four labels and one fix by
the session; the install. Fixes to the tools made during the run (counted in the AI time): the counted-text and
fill detectors, the unknown-facts weight cap, tool hashing in `inputs.json`, `compile --report`, and the
paragraph reflow in the text pass (130 synopses had a word left alone by the old wrap).

The comparison §7 asked for: the EXOS 2.0 session used 33 helpers of 125-350k tokens for three pages carried
from 2.1; EXDOS, two pages of new code, took 13 helpers of 144-286k. The cards' measured weakness is the D11
review below.

**Feedback (`feedback-page-0.md` of the merge):** 79 `feedback` lines (29 missing, 20 wrong, 15 pattern, 15
listing), 203 listing requests, 135 data regions no detector proposed, 96 routines whose unknown register facts
the AI settled. The proposals for the backlog review are in `pipeline-backlog.md` ("Proposed by EXDOS 1.3").

## 10. Details still to settle

The open questions are decided (§2, D4-D11). What is left is detail, settled while building the phase named:

1. ~~Marking a number that must stay a number~~: settled in P7 as `$0B40!` (§9.8).
2. ~~The measurement~~: fixed in §8 (total time, tool time, AI time, AI tokens; `timings`).
3. **EXDOS page 1**: which commands reach it (the `ep128-exdos` recipe runs page 0 only), before
   EXDOS 1.3 is annotated (P8).

## 11. Documentation: the "Under the Hood" article

Once the toolset is implemented and has annotated its first ROM (P8), the docs site gets an article on how
Klive's AI-assisted reverse engineering works. It is written last on purpose: it describes the pipeline as
built and shows real output from EXDOS 1.3, not this plan's sketches.

- **Where:** a new group in Under the Hood, `docs/content/en/under-the-hood/reverse-engineering/`, with an
  entry in `under-the-hood/_meta.ts` and a card on `under-the-hood/index.mdx`. It is not an emulator
  internal, so it does not go in `emulator-internals/`. One article first
  (`ai-rom-annotations.mdx`, "How Klive's ROM annotations are made with AI"); it can grow into a series if
  the `.nex` extension (§13) comes.
- **What it tells, in order:**
  1. what a ROM annotation is and what the reader gets from it in the IDE (labels, synopses, comments,
     regions in the Disassembly view), linking to the Guides pages that show it rather than repeating them
     (`/en/guides/analysis/annotations/`, and `code-coverage/` and `detecting-code-data/` for the runs and
     the classifier the preprocessor builds on);
  2. why the work is split: what needs understanding (the AI) and what is mechanical (programs), and why
     that split saves effort and makes the result checkable;
  3. the provenance rule (D4) and why it exists: annotations written from the ROM's own bytes and Klive's
     own runs, never from a published commented disassembly, and how the tools and the provenance tags
     enforce it;
  4. the preprocessor, stage by stage (§4.1), with a real routine card from EXDOS 1.3 and what each part of
     it comes from: the walk, the profile run, the register facts;
  5. the AI pass (§7): the ranges, the helpers, what a helper writes (a real `.ann` excerpt), the subroutine
     contract (D10), and the questions settled by running the machine;
  6. the postprocessor (§6): the compile, the lint, the problem list, the level and the reassembly check;
  7. the feedback loop (D11): how each ROM improves the preprocessor, with the measured numbers from P8
     (listing requests, feedback per routine, rounds of fixes);
  8. what the tools deliberately do not do: no suggested names on cards (D7), no knowledge from outside the
     ROM.
- **Figures:** a diagram of the pipeline (ROM, profile and sidecar in; preprocessor; cards; AI; `.ann`;
  postprocessor; sidecar and feedback out), and the card and `.ann` excerpts as code blocks. Real output
  only, generated by the tools, never retyped.
- **Rules it follows:** the site's rules in `AGENTS.md` (absolute links, the wording check
  `doc:check:prose`, Under the Hood's own voice), and the parts of `.ai/hardware-articles-guide.md` that
  apply to a non-hardware article (structure, explaining, figures). English only: Under the Hood is not
  translated. Verified with `npm run doc:build && npm run doc:check`; a new route needs the route golden
  updated.
- **Kept current:** a later change to the pipeline that changes what the article says (a new stage, a new
  `.ann` line kind, the `.nex` extension) updates the article in the same change.

## 12. Cutting the AI's cost (after P8)

P8 reached level 2 on EXDOS 1.3, but the project author judged the cost too high: 3,263,968 AI tokens for 32K
of ROM (§9.9). This part changes how the work is split: **programs do everything that follows from the code's
structure, and the AI only does what needs understanding, reading its material once and writing once.**

### 12.1 Where P8's tokens went (measured)

From the 14 helper transcripts and the written `.ann` files:

| Measure | Value |
|---|---|
| Harness token count | 3,146,794 helpers + 117,174 session; ~243k per range helper |
| Tool calls | 698 (~50 per helper): 391 grep/sed/awk searches, 132 listings, 41 compiles |
| Cached context re-read across the calls | 89.7M (~6.4M per helper): every call re-reads the whole context |
| Output | 911k, of which the `.ann` text is 96k (11%): the rest is reasoning, much of it navigation |
| Material read per helper | documents 14.8k, cards ~21k (read in slices: ~32k), listings ~9k, problem lists ~17k |
| What was written | labels 5k; synopses 54k (285 subroutines 30k, 770 other labels 24k; D10 lines 14.6k); 5,086 comments 37.6k (56% of 9,044 instructions) |

What a program can do instead (page 0):
- **770 of 1,055 labels** (73%) are jump targets inside routines (loops, shared exits, pieces), not subroutines.
- **205 of 285 subroutines** (72%) have fully settled register facts: their `Changes:`/`Keeps:` lines follow.
- **Comments** with a mechanical answer: calls to named routines 564 (11%), `PUSH`/`POP`/`EX` 774 (15%), workspace
  accesses 468 (9%, once the variables have names), error codes, EXOS calls and ports 192 (4%).
- What needs understanding: subroutine names and synopses, the meaning of `Entry:`/`Exit:`/`Error:`, variable
  names, and the comments on tests, arithmetic and jumps whose purpose is not obvious.

### 12.2 Decisions

- **D12. Read once, write once.** A range helper gets its range document in its prompt (or reads it in one
  call), writes its `.ann` in one go, compiles once and fixes once: at most five tool calls. It does not grep
  cards, other ranges or sidecars. The listing stays available for a case the document cannot settle, and every
  use of it is a `feedback listing` line: a gap in the document to close.
- **D13. Programs draft, the AI completes.** `prepare` writes a draft `.ann` per range, already holding every
  entry a program can derive (§12.3). The AI edits the draft: it adds meaning and may correct a drafted entry; a
  correction is a `feedback wrong` line. Drafted entries carry `observed` provenance like any entry from the
  bytes (no schema change); the drafts are kept in the work folder, so a review can see which text a program
  wrote.
- **D14. Jump targets get mechanical names** (*accepted by the project author, 2026-11-01; it changes D7 and the
  house rule that a name comes from what the code does, for jump targets only*). A jump target inside a routine is named from its routine and its
  place (`UNIT_CHK_1`, `UNIT_CHK_2`; the routine's name cut to fit 16 characters) with a one-line synopsis the
  structure gives ("Loop: back from $0C52; leaves to $0C54", "Shared exit of UNIT_CHECK_DISK: restores BC, DE,
  AF"). The AI renames one only where a name says something the structure does not.
- **D15. Comments only where the purpose is not obvious**, as level 2 already says. Programs write the mechanical
  ones: the error text of an error code (from the ROM's own message table), the EXOS function, the port, the
  workspace variable's name, and a stack pair where the `POP` is far from its `PUSH`. A call's operand already
  names its routine: it gets no comment unless its arguments need one. The AI writes the rest.
- **D16. Range helpers on a cheaper model.** The range work runs on Sonnet; the session (Opus) settles the regions,
  names the workspace variables, merges and reviews. Tokens are unchanged by this; cost per token is lower. Kept
  only if the measurement (§12.5) shows the quality holds.

### 12.3 What the programs draft

| Entry | Source |
|---|---|
| Regions | the accepted proposals; the session still judges them (§7 step 2), with the detectors' backlog fixes (pointer-table precision, counted texts) |
| Jump-target labels and synopses | D14: the routine they belong to, back jumps (loops), the shared exits, the fall-throughs |
| `Changes:`/`Keeps:` | the register facts, when they are settled (no unknowns); otherwise left for the AI with the facts in the document |
| `Entry:` registers, exit flags | the inputs and the exits' known carry/zero/A; the AI adds what each value means |
| Comments | D15's mechanical ones |
| Skip tricks, hidden entries | "never taken: its operand hides an entry at $xxxx" (the known flags show the jump cannot be taken), the hidden entry's first instruction |
| Inline-data calls | the flow and the register pass step over a short data region after a `CALL`/`RST` where code resumes (the top unknown of P8: 28 x `CALL $00F2`) |
| Text in carried routines | `carry`'s alignment: a same or shifted routine needs no AI unless its text names something that moved |

### 12.4 Phases

| Phase | What | Depends on |
|---|---|---|
| P10 | **The range document.** One card per routine, its jump targets inline (P8: the targets' headers were ~40% of the card text); callees' names and contracts on the card; ranges that keep a routine's pieces together; the inline-data calls and the never-taken jumps; `compile --own` (only the file's entries, no page-wide "may change" lists); one short brief (~3k tokens) instead of four documents (14.8k) | P8 |
| P11 | **The draft.** `prepare` writes `draft/range-NN.ann` (§12.3) and a `variables` card: every `(IX+d)`/`(IY+d)` use grouped by base and offset, for one naming pass; the variable names then feed the drafted comments | P10 |
| P12 | **The helper.** The read-once brief (D12), a compile-and-fix limit, and the session's merge rules (range ownership: `compile` warns when a file writes inside another range's routine) | P11 |
| P13 | **Measure on one range** (§12.5) | P12 |
| P14 | **The next ROM** with the new split, if P13 meets its target: IS-BASIC 2.0 (a carried ROM: §4.7's alignment also cuts the work) | P13 |

### 12.5 Expected saving and how it is measured

Estimates from P8's measurements (per range helper; the reasoning saving is the least certain part):

| | P8 | P10-P12 (D12, D13, D15) | with D14 |
|---|---|---|---|
| Harness token count | ~243k | ~75-100k | ~50-70k |
| Tool calls | ~50 | ~4 | ~4 |
| Cached re-reads | ~6.4M | ~0.3-0.4M | ~0.2-0.3M |
| Whole ROM (12 ranges, the regions, the session) | 3.26M | ~1.0-1.3M | ~0.6-0.85M |

D16 does not change these counts; it lowers the price per token.

**The baseline** is P8's run, kept in `.ai/rom-annotations/pipeline-baselines/exdos13-p8/` (its measurements,
timing log, token breakdown, the helpers' `.ann` files and the feedback). Not implemented yet: the project author
deferred P10-P14 (2026-11-01).

**P13's measurement:** one EXDOS page 0 range, the same cards, a fresh helper, run with the new document, draft
and brief, and compared with that range's P8 helper (`timings` as in §8): tokens, tool calls, and quality (the
compile's problems, the `feedback wrong` count, and a spot check of five routines against the code by the
session). **Target: at most 40% of the P8 helper's tokens with no loss of quality.** If it is missed, the
feedback says which material the helper still went looking for, and P10 closes that gap before P14.

## 13. Future extension: `.nex` and other binaries

Taken up only once the pipeline has proved itself on ROMs (D3). Notes kept so the ROM design does not close
the door:

- **Adapters.** `imageFromNex(file)` and `imageFromRaw(bytes, origin, cpu)` in `image/`; the image gains
  optional `paging` (where each bank sits in the 64K view), and `romKind` becomes optional. A `.nex` defaults
  to `z80n`. Its annotations go to the program's own annotation file, not a `.rom.dis`.
- **Several banks, one program.** A `.nex` loads 16K banks (bank 5, 2, 0, then others) and has an entry PC
  and SP in its header. `imageFromNex` reads the header and lists the banks; the header's PC is an entry.
  The Next annotation model's banks are already 8K/16K keyed, so the output needs no new shape.
- **Paging is dynamic.** Code in a bank above the default layout runs only once a `NEXTREG $50-$57` (MMU)
  write pages it in. The image carries a **paging assumption** per bank (which slot it sits in), taken from
  the profile when the program ran, else declared by the caller, else the `.nex` default layout
  (`NEX_DEFAULT_MMU` in `src/common/headless/nexLoad.ts`). Cards show the assumption, and a call whose
  target depends on it is marked so.
- **Cross-bank calls.** Calls into another bank go through code that writes an MMU register first; the
  preprocessor lists those writes (bank, slot, value) as facts, and a later convention plug-in can follow a
  program's own banking routine.
- **Profiles.** A `.nex` profile runs the program headless through the existing direct loader (`nexLoad.ts`)
  and records coverage per physical bank, not per 64K address.
- **Later still:** TAP/TZX blocks, `.sna`/`.z80` snapshots, Z88 applications. Each is one more adapter in `image/`.
- **Open questions for then:** must a raw binary name its CPU on the command line? Should the preprocessor
  place `.nex` banks from constant MMU writes (`NEXTREG $52,n`) when there is no profile? Can annotations of
  a third-party program be shipped, or only kept privately (the program's own copyright, a separate matter from D4)?
