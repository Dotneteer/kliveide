# CPU-neutral assembler core

Goal: the Klive assembler's language machinery (lexer, parser, expressions, symbols, modules, macros,
structs, loops, conditionals, fixups, segments, list file, source map) lives in `src/main/compiler-common/`
and knows no CPU and no machine. A CPU (the Z80 today, the 6502/6510 next, see
`dev/plans/commodore/IDE_INTEGRATION.md` §3) plugs in its tokens, operands, instructions and machine
pragmas through a small set of documented hooks.

Constraint from the project author: the existing `test/z80-assembler/` tests are not changed and pass after
every step; new tests may be added.

## 1. Where the core leaked (as found, 2026-11-28)

| Leak | Where |
| --- | --- |
| Z80 operand kinds (`Reg8`, `Reg16Idx`, `CPort`, `IndexedIndirect`...) and `offsetSign` | `tree-nodes.ts` `OperandType`, `Operand` |
| Z80 register traits (`reg8`, `reg16Idx`, `relCondition`, `next`) | `common-tokens.ts` `TokenTraits` |
| Z80 macro-time functions (`isreg8`, `isregix`, `hreg`, `lreg`, `isindexedaddr`...) | `expressions.ts` |
| Macro arguments formatted from Z80 operands (`(ix+3)`, `(c)`) | `common-assembler.ts` macro invocation |
| `textof((hl))` accepting a 16-bit register | `common-asm-parser.ts` |
| ZX Spectrum models: default start address, code-range warnings (ZX80/81, HT-1080Z, TVC, Enterprise, Next) | `common-assembler.ts` |
| ZX Spectrum memory banking (`.bank`, `.page`) and Next auto mode | `common-assembler.ts` |
| ZX Spectrum Next pragmas `.savenex`, `.dma`, `.copper` (tokens, nodes, parsing, emission, checks) | all core files |
| ZX80/ZX81 `.defzx` | all core files |
| ZX Spectrum string escapes (`\i`, `\p`, ...) in `.defm` and `.tracehex` | `common-assembler.ts` (`convertSpectrumString`) |

## 2. Layers after the change

```
compiler-common/          CPU-neutral core (CommonTokenStream, CommonAsmParser, CommonAssembler, ...)
z80-compiler/
  z80-machine-parser.ts     Z80MachineAsmParser  extends CommonAsmParser      .savenex .dma .copper .defzx
  z80-asm-parser.ts         Z80AsmParser         extends Z80MachineAsmParser  Z80 instructions, operands
  z80-machine-assembler.ts  Z80MachineAssembler  extends CommonAssembler      models, banks, pages, NEX, DMA, Copper, ZX80/81
  z80-assembler.ts          Z80Assembler         extends Z80MachineAssembler  Z80 encoding, macro-time functions
```

A 6502 assembler extends `CommonAsmParser`/`CommonAssembler` directly (plus its own machine layer).

## 3. The hooks (CommonAsmParser / CommonAssembler)

Parser: `getTokenTraits`, `parseInstruction`, `parseOperand`, `convertEscapedString` (existed);
`parseCpuPragma(parsePoint)` for pragma tokens the core does not know; `isCpuByteEmittingPragma(token)` for
`->` field assignments; `isTextOfIndirectArgument(traits)` for `textof((reg))`.

Assembler: `createTokenStream`, `createAsmParser`, `emitAssemblyOperationCode`, `validateModelType`,
`getModelNameById` (existed); `getModelIdByName`, `onModelSelected`, `getDefaultStartAddress`,
`onSegmentCreated`, `checkEmitAddress`, `applyCpuPragma`, `isCpuByteEmittingPragma`,
`convertStringToBytes`, `operandToMacroArgument`, `evalCpuMacroTimeFunction`, `resetCpuCompilationState`,
`completeAssembly`, and overridable `processBankPragma`/`processPagePragma` (the core reports them as not
supported).

Operands: the core knows only `CommonOperandType.Expression` and `CommonOperandType.NoneArg`; a CPU's
`OperandType` enum reuses these two values and adds its own.

## 4. Steps

1. Tokens and traits: neutral `TokenTraits`; `Z80TokenTraits`; the machine pragma tokens and
   `isindexedaddr` move to `Z80Tokens`.
2. Tree nodes: the machine pragma nodes move to `z80-compiler/assembler-tree-nodes.ts` (part of
   `Z80Node`); `OperandType` splits into `CommonOperandType` and the Z80 `OperandType`.
3. Parser: the hooks; `Z80MachineAsmParser` takes the machine pragma parsers.
4. Assembler: the hooks; `Z80MachineAssembler` takes the machine code; the Z80 macro-time functions and
   macro-argument formatting move to the Z80 side.
5. Code review fixes (bugs and redundancies), each with a test.
6. New tests: an import-boundary test for `compiler-common`, and a toy CPU assembled on the core
   (`test/asm-core/`) that proves labels, macros, structs, loops and fixups work for a CPU that is not the Z80.

## 5. Left as is (deliberately)

- `AssemblerOutput` still carries `nexConfig`, `copperBlocks`, `dmaPrograms`, `isNextAutoMode` and
  `unbankedSegments` (type-only imports): many consumers and tests read them there. A later step can move
  them into a per-CPU output extension.
- Error codes stay in one table (`assembler-errors.ts`, `Z` prefix); a new CPU adds its own range there.

## 6. As built (2026-11-28)

All six steps are done; the 95 `test/z80-assembler/` files (3408 tests) pass unchanged.

- **Hooks as implemented.** Parser: `parseCpuPragma`, `isCpuByteEmittingPragma`, `isTextOfIndirectArgument`.
  Assembler: `getModelIdByName`, `getDefaultStartAddress` (abstract); `modelSupportsBankPragma`,
  `convertStringToBytes`, `resetCpuCompilationState`, `onModelSelected`, `onSegmentStarted`,
  `checkEmitAddress`, `applyCpuPragma`, `isCpuByteEmittingPragma`, `resolveCpuFixup`,
  `operandToMacroArgument`, `completeAssembly`, `processBankPragma`, `processPagePragma` (virtual);
  `evalCpuMacroTimeFunction` on the evaluation context. A lexer for a CPU whose `#` is the immediate
  prefix passes `supportsHashedHexadecimal = false` to `CommonTokenStream`.
- **Fixups.** The core resolves `Bit8`, `Bit16`, `Bit16Be`, `Equ`, `Ent`, `Xent`, `Struct`, `FieldBit8/16`;
  every other `FixupType` goes to `resolveCpuFixup` (the Z80's `Jr`, `BitIndex`, `IndexDisplacement`; the
  machine layer's `NexStackAddr`, `NexEntryAddr`, `CopperWait`, `CopperMove`). The enum stays one list; a
  new CPU appends its own members.
- **New files.** `z80-compiler/z80-machine-tree-nodes.ts`, `z80-machine-parser.ts`,
  `z80-machine-assembler.ts`, `z80-macro-functions.ts`. Removed: the empty `z80-compiler/token-traits.ts`
  and the unused `nex-examples.ts`.
- **Tests.** `test/architecture/assembler-boundaries.test.ts` (the core imports no CPU or machine and names
  no Z80 operand kind); `test/asm-core/` (a toy 6502-like CPU on the core alone: instructions, its own
  operand kind as a macro argument, its own relative-branch fixup, models, labels, macros, loops, structures,
  `textof`); `test/z80-assembler/review-fixes.test.ts` (one test per review fix).

### Review fixes (step 5)

Bugs: a forward-referenced `(ix-d)` lost its sign; `(ix+d)` was never range-checked (new error Z0415);
`adc`/`sbc rr,a` and `rr,nn` assembled as the Z80N `add` opcodes; `.while` and `.repeat` left scopes on the
stack (labels after them were not global, `.ent` failed); `.if`/`.elif` took the last true branch and
skipped its end label when no branch was taken; a struct fixup was re-applied by outer scopes over patched
field values; a forward `jr` with a negative `.disp` was out of range (relative distances now wrap at 64K);
a string used as a number (`.org "a"`) threw out of `compile()` (now Z0601); `ExpressionValue.NonEvaluated`
was the integer 5; an empty string emitted a byte; absolute paths in `#include`, `.includebin`,
`.comparebin` were joined to the source folder; `.includebin` refused a file that exactly fills the segment;
the NEX writer ignored `.bank N noexport`; macro arguments with `$$` were mangled and `{{toString}}`
crashed; a second `compile()` on one instance inherited the first one's state; Next auto mode left stale
segments in `unbankedSegments`; `.defh` with a number went on after its error; `.skip`'s fill check could
never fire; an unknown simple mnemonic emitted `00`; the orphan `.endm` message named `.if`; `.tracehex`
printed $10000 with four digits; a BOM check stripped any character from U+BF00 up; an unbound struct
emitter crashed `.defm 65` in a field in flexible mode.

Redundancies removed: the ten struct-emitter branches of `applyPragma`; the four copies of the
unbanked-segment tracking (`onSegmentStarted`); `locationCounter` (same as `getCurrentAssemblyAddress`); the
duplicate `IsIndexedAddr` token; `hreg`/`lreg` macro-time cases that no token reached (and that fell
through every `case`); the magic `4` for the Next model (`isNextModel()`); the Z80 macro-time function
switch (tables in `z80-macro-functions.ts`).

### Open

- The six loop/proc/macro bodies still share copied scope scaffolding; only `.while`/`.repeat` were fixed
  (they restore the scope depth on every exit). One helper with try/finally would remove the copies.
- `hreg(BC)`/`lreg(BC)` are case-sensitive while register names are not elsewhere.
- `processXorgPragma` accepts two `.xorg`s with no code between them although Z0314 says one per segment.
- `AssemblerOutput`'s Next fields and the shared error table (§5).
