# Reverse-Engineering a NEX with AI Assistance

Everything an AI conversation needs to disassemble Z80 code out of a `.nex` file and record what it
learns in the annotation sidecar. Written against `ScrollNutter.nex`, but nothing here is specific to
it except the facts in [ScrollNutter, verified](#scrollnutternex--verified-facts).

Read `../AGENTS.md` first. For the product-level description of what annotations *are*, see
`../.docs/nex-annotations.md`; this file is the operational companion to it.

---

## The one-minute model

Get this right and everything else follows. Get it wrong and every offset you write is garbage.

**A NEX is a bag of 16K banks, not a memory image.** Bank numbers are the file's own; they are not
addresses. Inside a bank, everything is a **bank-relative offset**, `$0000..$3FFF`.

**A bank's Z80 address depends on where it is paged.** The sidecar records that per bank as
`offsetIndex`, one of `0 | 1 | 2 | 3`, and the display base is simply:

```
base = offsetIndex * 0x4000      // 0 -> $0000, 1 -> $4000, 2 -> $8000, 3 -> $C000
```

So the two conversions you will use constantly:

```
z80Address  = base + bankOffset          // bankOffset = z80Address - base
bankOffset  = z80Address - offsetIndex * 0x4000
```

**Worked example, checked against the real file.** In `ScrollNutter.nex.dis`, bank `2` has
`offsetIndex: 2` → base `$8000`. A `lineAnnotations` key of `9728` is decimal for `$2600`, so it
annotates `$8000 + $2600 = $A600` — which is where the `InitPalettes` global label (`42496` = `$A600`)
points. All three agree, and the bytes at that offset disassemble to the routine the label names.

**Every number in the sidecar JSON is decimal.** `42496`, not `$A600`, not `0xA600`. Convert when you
read and when you write. This is the single most common way to corrupt a sidecar.

---

## Artifacts and paths

| What | Where |
|---|---|
| The NEX | `_experiments/testprojects/disann/ScrollNutter.nex` |
| Its sidecar | `_experiments/testprojects/disann/ScrollNutter.nex.dis` |
| Next register reference | `_input/next-fpga/nextreg.txt` |
| I/O port reference | `_input/next-fpga/ports.txt` |

The sidecar path is always the NEX path with `.dis` appended — `Game.nex` → `Game.nex.dis`
(`getNexAnnotationPath`). It is JSON.

---

## The NEX container

Enough to pull a bank's 16K out of the file yourself. Source of truth:
`src/renderer/appIde/DocumentPanels/Next/nexFileLoader.ts`.

**Header — 512 bytes, little-endian.**

| Offset | Size | Field |
|---|---|---|
| 0 | 4 | `"Next"` magic |
| 4..7 | 4 | `"V"`, major digit, `"."`, minor digit (ASCII) |
| 8 | 1 | full RAM required |
| 9 | 1 | number of 16K banks |
| 10 | 1 | screen block flags |
| 11 | 1 | border colour |
| 12 | 2 | SP |
| 14 | 2 | **PC (entry point)** |
| 16 | 2 | extra byte count |
| 18 | 112 | **bank flags** — one byte per bank, non-zero = present |
| 130..141 | 12 | loading-bar / delay / core-version / `entryBank` (139) / file handle |
| 142 | 370 | unused padding |

**Screen block flags** (`ScreenBlockFlags`): `NoPalette 0x80`, `HiColor 0x10`, `HiRes 0x08`,
`LoRes 0x04`, `Ula 0x02`, `Layer2 0x01`.

**What follows the header, in order** — each present only if its flag says so:

1. Palette — 512 bytes (256 × uint16), present when `!(flags & NoPalette) && (flags & (Layer2|LoRes))`
2. Layer 2 loading screen — `0xC000`
3. ULA loading screen — `0x1B00`
4. LoRes loading screen — `0x3000`
5. Timex HiRes loading screen — `0x3000`
6. Timex HiColor loading screen — `0x3000`
7. **Bank data** — 16K per present bank

**Bank order in the file is not numeric.** It is `NEX_BANK_FILE_ORDER`:

```
5, 2, 0, 1, 3, 4, 6, 7, 8, ... 111
```

Banks absent from the flags are skipped entirely — they occupy no bytes. So to find bank *N*, walk
that order, counting only present banks, and add `0x4000` for each one you pass.

---

## ScrollNutter.nex — verified facts

Parsed from the file; the layout accounts for all 410,624 bytes with zero remainder.

- **Version** V1.1, **full RAM** no, **16K banks** 22, **border** 0
- **SP** `$BF2D`, **PC** `$5C50`, **entryBank** 0, **extra bytes** 0
- **Screen block flags** `0x01` (Layer 2) → palette present, Layer 2 loading screen present
- **First bank at file offset** `0xC400` (512 header + 512 palette + `0xC000` Layer 2 screen)
- **Banks present:** 0, 2, 5, 12–30

**Bank → file offset**

| Bank | Offset | Bank | Offset | Bank | Offset |
|---|---|---|---|---|---|
| 5 | `0xC400` | 17 | `0x2C400` | 24 | `0x48400` |
| 2 | `0x10400` | 18 | `0x30400` | 25 | `0x4C400` |
| 0 | `0x14400` | 19 | `0x34400` | 26 | `0x50400` |
| 12 | `0x18400` | 20 | `0x38400` | 27 | `0x54400` |
| 13 | `0x1C400` | 21 | `0x3C400` | 28 | `0x58400` |
| 14 | `0x20400` | 22 | `0x40400` | 29 | `0x5C400` |
| 15 | `0x24400` | 23 | `0x44400` | 30 | `0x60400` |
| 16 | `0x28400` | | | | |

**Where the program starts.** PC `$5C50` lives in **bank 5**, which the sidecar gives
`offsetIndex: 1` (base `$4000`), so `$5C50` is bank offset `$1C50`. It runs:

```
5C50  F3            di
5C51  31 80 7A      ld sp,$7A80        ; "Set the top of the stack in the current bank"
5C54  C3 24 A6      jp $A624           ; -> Start
```

The `jp` lands in **bank 2** (`offsetIndex: 2`, base `$8000`), which holds the annotated palette code
at `$A600`–`$A623`.

---

## The annotation sidecar (`.nex.dis`)

Source of truth: `src/renderer/appIde/DocumentPanels/Next/nexAnnotations.ts`.

### Shape

```jsonc
{
  "schemaVersion": 2,                    // current; readable: 1 and 2
  "source": { "fileName": "ScrollNutter.nex", "sha256": "..." },  // both optional
  "globalLabels": [ { "name": "Start", "value": 42532 } ],
  "banks": {
    "2": {                               // key is the bank number AS A STRING
      "offsetIndex": 2,                  // 0..3 -> base $0000/$4000/$8000/$C000
      "regions": [ { "start": 0, "end": 16383, "type": "disassemble" } ],
      "localLabels": [ { "name": "Loop", "value": 9752 } ],
      "lineAnnotations": {
        "9728": { "comment": "Use Layer 2 first palette" },
        "9750": { "synopsis": "Fills every palette entry with its own index." }
      },
      "operandReferences": {
        "9736": [ { "operandIndex": 0, "scope": "global", "name": "InitPaletteRamp" } ]
      },
      "lastView": "disassembly",         // UI state; harmless to omit
      "decimalView": false
    }
  },
  "debug": {                             // NOT YOURS — see "Writing annotations safely"
    "breakpoints": [ { "bank": 2, "offset": 9728, "kind": "exec" } ],
    "labelBreakpoints": [ { "label": "Start", "kind": "exec" } ]
  }
}
```

### Field reference

**`globalLabels` / `localLabels`** — `{ name, value }`.

- Global values are Z80 addresses, `$0000..$FFFF` (`0..65535`).
- Local values are **bank-relative**, `$0000..$3FFF` (`0..16383`), scoped to their bank.
- Names match `/^[A-Za-z_][A-Za-z0-9_]*$/`, max **16** characters (`NEX_LABEL_MAX_LENGTH`).
- ScrollNutter uses global labels throughout, even for bank-local code. That is legal and fine.

**`regions`** — `{ start, end, type }`, bank-relative, **inclusive** on both ends. Types:

| Type | Renders as |
|---|---|
| `disassemble` | Z80 instructions |
| `bytes` | `.defb`, up to four per line |
| `words` | `.defw`, up to two per line |
| `skip` | a single `.skip` line |

**`lineAnnotations`** — keyed by **bank-relative offset as a decimal string**. Each value may carry:

- `synopsis` — a block comment rendered *above* the instruction. `\n` splits it into multiple lines.
- `comment` — an end-of-line comment. It **replaces** the disassembler's generated comment on that
  row rather than appending to it (the generated text is kept as `generatedHardComment` so the editor
  can show what is being replaced). Clearing yours brings the generated one back.

**`operandReferences`** — keyed by bank-relative offset; value is an array of
`{ operandIndex, scope, name }` pinning a decoded 16-bit operand to a named label.

**`offsetIndex` / `lastView` / `decimalView`** — per-bank view state. `offsetIndex` is semantically
load-bearing (it defines the address base); the other two are only UI memory.

### Rules the loader enforces

Learn these and the sidecar will never be rejected:

1. **Regions must not overlap.** An overlap is a hard error and the bank's regions are returned
   unnormalized.
2. **Gaps are filled for you, as `disassemble`.** You only need to declare the regions that are *not*
   ordinary code; everything between them, and any tail up to `$3FFF`, becomes `disassemble`
   automatically. Adjacent same-type regions are then merged.
3. **No regions at all** → the whole bank becomes one `disassemble` region (`DEFAULT_REGION`).
4. **`words` regions must span an even number of bytes.**
5. **Offsets must be `0..16383`**; out-of-range line-annotation keys are dropped with a warning.
6. **`schemaVersion` must be 1 or 2**, or the entire file is rejected — annotations *and* debug state.
7. Bank numbers run `0..111` (`NEX_MAX_BANK`).

Anything invalid produces `diagnostics` (`error` / `warning` with a JSON path). When writing a
sidecar by hand, parse it back with `parseNexAnnotations` and assert `diagnostics` is empty.

---

## Producing a listing

The repo's own disassembler is TypeScript with path aliases, and there is no `tsx`. The reliable way
to run it is a throwaway **vitest** file. This recipe is verified — it produced the listings quoted in
this document.

Create `test/emu/_scratch-disasm.test.ts`, run it, delete it when done.

```ts
import { describe, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

import { MemorySection } from "@renderer/appIde/disassemblers/common-types";
import { Z80Disassembler } from "@renderer/appIde/disassemblers/z80-disassembler/z80-disassembler";
import { loadNexFileContents } from "@renderer/appIde/DocumentPanels/Next/nexFileLoader";
import { createAnnotatedNexDisassemblyItems } from "@renderer/appIde/DocumentPanels/Next/nexAnnotatedDisassembly";
import { parseNexAnnotations } from "@renderer/appIde/DocumentPanels/Next/nexAnnotations";

const NEX = resolve(__dirname, "../../_experiments/testprojects/disann/ScrollNutter.nex");
const BANK = 2;
const BASE = 0x8000;   // offsetIndex * 0x4000 for this bank
const FROM = 0x2600;   // bank-relative
const TO = 0x2630;

describe("scratch", () => {
  it("disassembles", async () => {
    const { fileInfo, error } = loadNexFileContents(new Uint8Array(readFileSync(NEX)));
    if (error) throw new Error(error);
    const bytes = fileInfo!.bankData.find(([b]) => b === BANK)![1];

    // --- Raw: no labels, generated comments only
    const dis = new Z80Disassembler([new MemorySection(FROM, TO)], bytes, undefined, {
      allowExtendedSet: true          // REQUIRED for Z80N (nextreg, mul, etc.)
    });
    dis.setAddressOffset(BASE);
    const out = await dis.disassemble(FROM, TO);
    console.log(
      (out?.outputItems ?? [])
        .map(
          (i) =>
            `${i.address.toString(16).toUpperCase().padStart(4, "0")}  ` +
            `${(i.opCodes ?? []).map((b) => b.toString(16).toUpperCase().padStart(2, "0")).join(" ").padEnd(12)}  ` +
            `${i.instruction ?? ""}${i.hardComment ? "    ; " + i.hardComment : ""}`
        )
        .join("\n")
    );

    // --- Annotated: labels and your comments, exactly as the IDE renders them
    const parsed = parseNexAnnotations(readFileSync(NEX + ".dis", "utf8"), {
      loadedBanks: fileInfo!.bankData.map(([b]) => b)
    });
    if (!parsed.annotations) throw new Error(JSON.stringify(parsed.diagnostics, null, 2));
    const items = await createAnnotatedNexDisassemblyItems({
      annotations: parsed.annotations,
      bank: BANK,
      contents: bytes,
      disassOffset: BASE
    });
    console.log(
      (items ?? [])
        .filter((i) => i.address >= BASE + FROM && i.address <= BASE + TO)
        .map((i) => `${i.address.toString(16).toUpperCase().padStart(4, "0")}  ${i.instruction ?? ""}` +
                    `${i.hardComment ? "    ; " + i.hardComment : ""}`)
        .join("\n")
    );
  });
});
```

Run it:

```bash
npx vitest run --config build/vitest.config.ts --project node test/emu/_scratch-disasm.test.ts --disable-console-intercept
```

**`--disable-console-intercept` is the difference between seeing your listing and seeing nothing.**
Vitest swallows `console.log` from a *passing* test, so without the flag a successful run prints only
"1 passed" and the work appears to have vanished. (It does show on failure, which is a confusing way
to discover this.) Writing to a file with `writeFileSync` instead works too, and is better for long
listings you want to read in chunks.

Notes that matter:

- **`allowExtendedSet: true` is not optional** for a Next program. Without it `nextreg` and the other
  Z80N opcodes decode as garbage.
- `disassemble(start, end)` takes **bank-relative offsets**, i.e. indices into the byte array.
  `setAddressOffset(base)` only changes the addresses that are *displayed*.
- `parseNexAnnotations` takes the **raw text**, not a parsed object.
- The annotated path emits synopsis lines as separate items with `isPrefixItem` set and no
  `instruction`; filter them out if you only want code.
- `.test.ts` files run under the `node` project; `.test.tsx` under `jsdom`.

**Sanity check for any new bank:** disassemble a few instructions at a known label and confirm the
bytes decode to something plausible. If you see a wall of `nop`/`rst`/garbage, the offset or the bank
is wrong — go back to the conversion formulas.

---

## Decoding ports and Next registers

Two files in the repo are the **primary sources** for what a `nextreg` write or an `out` actually
does. They are the official TBBlue / ZX Spectrum Next FPGA documentation, tracked in git:

| File | Covers |
|---|---|
| `_input/next-fpga/nextreg.txt` | The Next register space — 138 registers, `0x00`–`0xFF`, bit by bit |
| `_input/next-fpga/ports.txt` | Peripheral I/O ports — address decoding, then per-port bit detail |

**Use them.** The disassembler's generated comment gives you the register's *name* only — `nextreg
$43,$10` renders as `; Palette Control`. That tells you which register, never what the value means.
The bit breakdown is what turns it into a sentence.

### `nextreg.txt`

Entries are separated by blank lines and start with `0xNN (dd) => Name`, followed by `(R)`, `(W)` or
`(R/W)` blocks listing bits, with reset values noted inline.

Look one up — prints the whole entry, and works regardless of which register number comes next:

```bash
awk '/^0x43 /{f=1;print;next} /^0x[0-9A-Fa-f][0-9A-Fa-f] /{f=0} f' _input/next-fpga/nextreg.txt
```

**Worked example — this validates annotations already in ScrollNutter's sidecar.** The palette
routine at `$A600` opens with `nextreg $43,$10` and later `nextreg $43,$20`. Register `0x43` is
Palette Control, whose **bits 6-4 select the palette for reading or writing**:

```
$10 = 0001 0000  ->  bits 6:4 = 001  ->  Layer 2 first palette
$20 = 0010 0000  ->  bits 6:4 = 010  ->  Sprites first palette
```

Which is exactly what the sidecar comments say — "Use Layer 2 first palette" and "Use Sprites first
palette". Two minutes with this file is the difference between copying a name and understanding the
code.

The same routine's `ld a,$85` / `nextreg $15,a` decodes against register `0x15` (Sprite and Layers
System) as: bit 7 enable lores, bits 4:2 = `001` = layer priority `L S U`, bit 0 enable sprites.

### `ports.txt`

Two halves, and the first is easy to miss:

1. **A decode table** at the top — for each port, the 16 address bits as `0`/`1`/`X`, whether it is
   readable and/or writable, the hex port, and a description. This is the half you want when you see
   `out (c),a` and need to work out *which* device `BC` selects, since Next ports decode on scattered
   bits rather than the low byte.
2. **Per-port detail**, grouped under banner headings: `ULA / SCLD`, `STANDARD 128K SPECTRUM`,
   `NEXTREG`, `LAYER 2`, `AUDIO`, `DMA`, `CTC`, `SERIAL`, `ULA+`, `SPRITES`, `Multiface`, `DIVMMC`,
   `INPUT DEVICES`, `MEMORY MAPPING MODES`.

Look up one port's detail:

```bash
awk '/^0x123B /{f=1;print;next} /^0x[0-9A-Fa-f]+ /{f=0} /^==/{f=0} f' _input/next-fpga/ports.txt
```

Grep the decode table instead when you have a value rather than a name:

```bash
grep -i "0x243b" _input/next-fpga/ports.txt
```

Worth knowing: `0x243B` selects a Next register and `0x253B` reads/writes it, so `out ($243B),a` /
`out ($253B),a` pairs are the long-hand form of `nextreg` — decode them against `nextreg.txt`, not
`ports.txt`. Most devices can also be switched off via nextreg `0x82`–`0x85`, which is worth
remembering when a port seems inert.

### Turning this into annotations

When a register write is the point of a routine, put the *meaning* in the annotation, not the
register name — the generated comment already carries the name and your `comment` **replaces** it:

- Good: `Select Layer 2 first palette for writing`
- Redundant: `Palette Control` (that is what it already said)

`_input/next-fpga/src/` also holds the core's VHDL. Read it only when the text files are genuinely
ambiguous; it is the last word, but it is a slow one.

---

## The reverse-engineering loop

1. **Locate.** Turn the user's Z80 address into `(bank, bankOffset)` using `offsetIndex`. If they name
   a label, look it up in `globalLabels` / the bank's `localLabels` first.
2. **Listing.** Run the recipe over a generous window around the target. Read it before theorising.
3. **Understand.** Follow `call`/`jp` targets. Decode every `nextreg` write and `out` against
   `_input/next-fpga/nextreg.txt` and `ports.txt` — the generated comment names the register but
   never says what the value means (see
   [Decoding ports and Next registers](#decoding-ports-and-next-registers)). Watch for tail calls
   (`jp` into a routine) — they are common here and they change what `ret` means.
4. **Name.** Add labels for every entry point you identified. Names are ≤16 chars.
5. **Annotate.** `synopsis` for what a routine *does* and why; `comment` for a single surprising line.
   Do not restate the opcode — the generated comment already does that, and yours replaces it.
6. **Classify.** Mark data as `bytes` / `words` / `skip`. This is what stops the disassembler decoding
   a sprite as instructions and desynchronising everything below it.
7. **Verify.** Re-run the annotated listing and read it back. Then parse the sidecar and assert no
   diagnostics.

---

## Writing annotations safely

**Prefer editing the JSON directly** when the IDE is not open on that file. It is the fastest path and
the format is stable.

**Three rules that prevent data loss:**

1. **Never drop `debug`.** The sidecar has *two independent writers*: annotations and the `debug`
   subtree (bank breakpoints and label-anchored breakpoints). Each reads, replaces only its own keys,
   and writes back. If you rewrite the file wholesale, carry `debug` across verbatim. Breakpoints
   live *only* here — `.kliveproject` deliberately excludes them, so losing `debug` loses them for
   good.
2. **Do not edit while a bank viewer is open on that NEX.** Open bank documents share one annotation
   session, it writes immediately on every edit (**there is no Save**), and it will overwrite your
   file from its in-memory model. Close the viewer, or make the edit through the IDE.
3. **Preserve unknown keys.** A newer build may have written something this guide does not list.
   Read-modify-write; do not reconstruct from scratch.

**Round-trip check** after any hand edit:

```ts
const parsed = parseNexAnnotations(readFileSync(path, "utf8"), { loadedBanks });
console.log(parsed.diagnostics);      // must be empty
```

**From the debugger.** With the machine paused, `nex-label <name> [<address>]` adds a bank-local label
at the current PC (or the given address) — it routes into the open session if there is one and writes
through to the file if there is not. `nex-run <file> [-d] [-e]` launches a NEX, `-d` with the
debugger, `-e` stopping at the entry point.

---

## Pitfalls

| Trap | Reality |
|---|---|
| Writing `$A600` into the JSON | Every sidecar number is **decimal** (`42496`) |
| Using a Z80 address as a `lineAnnotations` key | Keys are **bank-relative offsets**, decimal strings |
| Assuming bank *N* is at file offset *N* × 16K | File order is `5, 2, 0, 1, 3, 4, 6, 7, …`, absent banks skipped |
| Assuming `offsetIndex` is cosmetic | It defines the address base; a wrong one moves every label |
| Forgetting `allowExtendedSet` | Z80N opcodes (`nextreg`, `mul`) decode as nonsense |
| Declaring a `disassemble` region for every gap | Gaps are auto-filled as `disassemble`; declare only the exceptions |
| Odd-length `words` region | Hard-rejected |
| Appending to a generated comment | `comment` **replaces** it |
| Bumping `schemaVersion` to 3 | Builds reading `[1, 2]` would reject the whole file, `debug` included |
| Editing the file with a viewer open | The session overwrites it without asking |
| Treating a `jp` into a routine as a plain jump | It is a tail call — that routine's `ret` returns past its caller |
| Taking `; Palette Control` as the explanation | It names the register only; the meaning is in `nextreg.txt` |
| Decoding `out ($243B),a` as an ordinary port write | `$243B`/`$253B` are `nextreg` long-hand — look the *register* up |
| Reading only the top table of `ports.txt` | Per-port bit detail is in the sections below it |

---

## Sources of truth

Read these rather than trusting this summary when precision matters:

| Topic | File |
|---|---|
| **Next register bit meanings** | `_input/next-fpga/nextreg.txt` |
| **I/O port decoding and bit meanings** | `_input/next-fpga/ports.txt` |
| Next core VHDL (last resort) | `_input/next-fpga/src/` |
| Schema, validation, normalization, label rules | `src/renderer/appIde/DocumentPanels/Next/nexAnnotations.ts` |
| NEX container parsing, bank order, flags | `src/renderer/appIde/DocumentPanels/Next/nexFileLoader.ts` |
| Annotated listing generation | `src/renderer/appIde/DocumentPanels/Next/nexAnnotatedDisassembly.ts` |
| Z80 disassembler API and options | `src/renderer/appIde/disassemblers/z80-disassembler/z80-disassembler.ts` |
| Bank ↔ address ↔ paging helpers | `src/renderer/appIde/DocumentPanels/Next/nextBankLocation.ts` |
| Sidecar read/merge/write | `src/renderer/appIde/DocumentPanels/Next/nexAnnotationSidecar.ts` |
| Product behaviour of annotations | `../.docs/nex-annotations.md` |
| Design history and rationale | `../.plans/NEX_DEBUGGING_PLAN.md`, `../.plans/NEX_FILE_ANNOTATIONS_PLAN.md` |
| Commands (`nex-run`, `nex-label`) | `docs/content/commands-reference.mdx` |
