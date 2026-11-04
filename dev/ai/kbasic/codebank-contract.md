# CODEBANK — the contract Klive BASIC implements

NextBuild Studio's fork of the ZX BASIC compiler (`zxbasic 1.18.7-nb10`, em00k/NextBuildStudio)
adds banked code for the ZX Spectrum Next. The fork is AGPL-derived and its new runtime files carry
no licence, so **Klive BASIC reimplements CODEBANK from this contract** (plan §9) and copies
nothing. Recorded in Klive's own words. Syntax is also in
`../zxbasic-syntax/zxbasic-syntax.json` → `extensions.codebank`.

## 1. Syntax

```
codebank-block  = "CODEBANK" bank-number NL { item } "END" "CODEBANK" NL ;
bank-number     = whole number >= 0 ;              (* 0 = resident *)
item            = sub-def | function-def | dim-stmt | asm-block | label-line | statement | codebank-block ;
codebank-pragma = "#pragma" ( "codebank" | "codewindow" | "codewindowsize" | "codebankbase"
                             | "codebankpages" | "codebankdepth" ) "=" value ;
farptr          = "FARPTR" identifier | "FARPTR" array-identifier "(" const-subscripts ")" ;
asm-pseudo-op   = "CODEBANK" expr ;                (* inside ASM; zxnext only; 0 = resident *)
```

- `CODEBANK` blocks may nest (an option stack); they may not appear inside SUB/FUNCTION.
- `#pragma codebank = n` is typically placed around `#include` and reset to 0 afterwards.
- `FARPTR x` is a ULong: logical bank in bits 16–23, address in bits 0–15. For an array it yields
  the **data** address. It binds like `@`, so `FARPTR x + 3` adds to the result. Allowed on
  global scalars, global arrays (optionally with constant subscripts) and bank-scope asm labels.
- `#include <farmem.bas>`: `FarPeek(fp) AS UByte`, `FarPeekW(fp) AS UInteger` (FASTCALL),
  `FarPoke(fp, v AS UByte)`, `FarPokeW(fp, v AS UInteger)`, `FarCopy(fp, dest, count)` (bank to
  resident), `FarCopyTo(fp, src, count)` (resident to bank), `FarStr(fp) AS String` (FASTCALL; the
  image is `[length:2][chars…]`; empty string if the heap is full). A count of 0 is a no-op.
- NextBuild's header directives `'!codebank=`, `'!codewindow=`, `'!codewindowsize=`,
  `'!codebankpages=`, `'!codebankdepth=` map to the options (Klive: plan §5.3–§5.4).

## 2. What goes into a bank

Declaration-scoped, not lexically scoped:

- SUB/FUNCTION bodies (a resident trampoline stays at the routine's label). The bank in force
  **at the definition** decides; a forward `DECLARE` does not.
- Global `DIM`s (scalars, arrays, array descriptors) become bank-local. Constant initialisers are
  stored in the bank; String and non-constant initialisers run as a synthesised routine in that
  bank, called at the declaration's position, in source order.
- Module-level `ASM` blocks (not inside a routine or a control structure) and the labels naming
  them. They do not execute; they are data or subroutines.
- `DIM arr(n) AS t AT @label` inside a bank: the descriptor goes into the bank; the label must be
  in the same bank.

Stays resident: ordinary statements between `CODEBANK` and `END CODEBANK`, asm blocks inside
control flow, scalar `DIM x AT addr`, `CONST`, string literals, DATA, jump tables, the heap, the
runtime, local-array bound tables, the shared function-exit code. A bank-local String is a
descriptor in the bank with its characters on the resident heap.

## 3. Rules

**Errors:** a bank larger than the window (8 KB, or 16 KB with a 16K window) — the message lists
the largest routines and data in it (up to 12); the window overlapping the resident program; any
reference (GOTO, GOSUB, jp, call, label, DEFW table entry) from one bank into a *different*
non-zero bank; a reference from outside a bank to its bank-local variables, arrays or asm labels;
FARPTR of a local, a parameter, a routine, a variable subscript or an undeclared array; a banked
routine used as an initialiser; ORG inside a bank; CODEBANK inside a routine; unmatched END
CODEBANK; an invalid bank number; an asm block that leaves the assembler in a different bank than
it started; an invalid window (size not 8192/16384, address not a multiple of 8192, running past
`$FFFF`); `DIM … AT` and its label in different banks; a code page that overlaps a data page.

**Warnings:** W900 — a bank-local variable passed ByRef to a routine in another bank (the callee
gets a 16-bit address that is stale once the bank is paged out). W910 — a bank has data but no
routine, so nothing pages it in automatically. W920 — a bare `@array` (it is the descriptor, not
the data; write `@a(0)`).

**Unchecked hazards** (documented, not enforced): interrupt handlers must not far-call, remap the
window slot, live in the window or touch bank-local data; SP must never be inside the window;
nesting deeper than the configured depth overflows silently; the resident side of FarCopy must not
be in the window; far-memory accessors are not re-entrant; the program origin must clear the whole
window.

## 4. The far-call mechanism (behavioural contract)

- **Trampoline** (resident, at the routine's normal label): a `call` into the far-call entry
  followed by the logical bank number (1 byte) and the body address (2 bytes). Call sites are
  ordinary `call`s, so hand-written asm and `@routine` work unchanged.
- **Same-bank fast path:** if the wanted bank is already current, execution continues in the body
  with the stack exactly as after a direct call. No bank switch, no shadow-stack entry.
- **Cross-bank path:** the caller's return address on the Z80 stack is replaced by the far-return
  entry; a 3-byte record `{previous bank, real return address}` is pushed onto a **resident shadow
  stack** (not the Z80 stack); the current bank becomes the wanted one; the bank's physical page(s)
  are written to the MMU register(s) of the window slot(s) (`$50 + window/8K`, and the next one
  for a 16K window). Nothing is left on the Z80 stack, so argument offsets (`ix+4` …) are
  unchanged.
- **Far return:** reached by the callee's own `ret`. Preserves **every** register (the result may
  be in A, HL, DE:HL or A/E/D/C/B), pops the shadow record, restores the previous bank's page(s),
  and returns to the real caller.
- **Initialisation** (a registered initialiser): reads the page currently in the window slot
  through the NextReg ports (`$243B`/`$253B`) and uses it as "bank 0", so returning to resident
  code restores what the loader mapped; resets the current bank and the shadow stack.
- **Preserved by far calls:** all main and alternate registers, IX, IY, I, R and the interrupt
  state; only the window's MMU register(s) change.
- **State:** current logical bank (1 byte, 0 = resident), shadow-stack pointer, shadow stack of
  `3 × depth` bytes (default depth 16).
- **Page table:** row 0 = the boot page(s) of the window slot; then one row per logical bank (one
  byte for an 8K window, two for 16K). `page(bank) = base + (bank − 1) × slots`, or taken from an
  explicit page list (past its end, allocation continues after the last listed page).
- **Far-memory accessors:** map a bank temporarily without changing the current bank, access,
  unmap; `FarStr` allocates on the resident heap while the bank is mapped.

**Klive BASIC additions** (plan §9.2, §10.2.2): the debugger relies on the stack shape above —
while a banked routine runs, the Z80 stack looks exactly as after a direct call, with the
far-return entry in the return slot on the cross-bank path — and on the shadow stack's location,
current-bank byte and far-return address being published in the debug information.

## 5. Options and outputs

| Option (fork CLI) | Default | Klive header option |
| --- | --- | --- |
| `--code-window` | `$6000` | `codebank-window` |
| `--code-window-size` | 8192 | `codebank-window-size` (`8k`/`16k`) |
| `--code-bank-base` | 30 | `codebank-first-page` |
| `--code-bank-pages` | — | `codebank-pages` |
| `--code-bank-depth` | 16 | `codebank-depth` |

Fork outputs: `<name>.bank<N>.bin` per non-empty bank (assembled at the window address, not
padded); `<name>.banks.json` = `{window, window_size, banks: [{bank, file, org, size, page,
pages}]}` sorted by bank; `.map` lines for banked labels prefixed `B<n>:`, routine bodies labelled
`<name>.__far`, FARPTR aliases `<name>.__faraddr`. A program without banks is byte-identical to one
compiled without the extension. NextBuild's build turns the manifest into NEX page loads and checks
code/data page overlaps.

**Klive BASIC:** banks are assembled into 8K pages through the assembler (plan §4.2) and packed
into the NEX by Klive's writer; a `banks.json`-compatible manifest only with `'@emit-map`.

## 6. Scenarios to test (from NextBuild's CODEBANK examples, re-written for Klive)

Minimal two-bank program; asm-level CODEBANK placing raw data at bank starts with a bank-scope
label and `DIM … AT @label` over it; every DIM shape resident and bank-local (all numeric types,
initialisers, multi-dimensional, subscript forms); Strings into and out of banks, bank-to-bank
string calls, why `DIM s$ AT @label` cannot alias banked text; private data per bank at the same
window addresses and the rejected cross-bank accesses; six banks of 6 KB data each with per-bank
checksums; deep mutual recursion across two banks (needs `DECLARE`) with six-argument frames and
every return type; FARPTR with the far-memory API reading text held only in a bank; `#pragma
codebank` around includes with the same-bank fast path; the interrupt rule (a resident IM2 handler
that only counts); banked code calling Layer 2 routines with explicit page lists next to a data
page; one screen per bank with a resident dispatcher (the replacement for overlay modules);
bank-local String arrays and slicing; bank-local initialiser ordering across banks; far-call
register preservation, stack-offset and shadow-stack unwinding checks; a 16K window with routines
that only work if the second slot is mapped; far-memory accessor edge cases (zero-length copy,
FARPTR of resident symbols = bank 0, calls from inside a bank).
