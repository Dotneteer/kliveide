import type { SysVar } from "@abstractions/SysVar";

import type {
  DisassemblyOperandLabelResolver,
  DisassemblyOperandPragma
} from "./common-types";

/*
 * The machine's own system variables, as names in the disassembly.
 *
 * Every supported machine already ships a table of its system variables — the one the System
 * Variables panel lists — and those tables are the single best source of names for the addresses a
 * program touches most. `ld (LAST_K),a` says what `ld ($5C08),a` only implies, and the reader no
 * longer has to keep the ROM manual's address list in their head.
 *
 * Pure and machine-agnostic: it takes a `SysVar[]` and gives back a resolver. That keeps the
 * decision testable without an emulator, and lets the live Disassembly view and the `.NEX` bank
 * listing share one implementation instead of growing two that drift apart.
 *
 * Z80 and Z80N only, for now. `DisassemblyOperandLabelResolver` is the hook the Z80 disassembler
 * offers; `m6510-disassembler.ts` renders its absolute operands (`^A`, `^U`, `^V`, `^P`) directly
 * and calls nothing, so the Commodore 64's table — 80 of whose 244 variables are 16-bit addresses,
 * the rest zero page — reaches no listing yet. Giving the 6510 the same hook is what would change
 * that; nothing here needs to.
 */

/**
 * Which operands are named.
 *
 * Only the **data** operands: `^W` (`ld hl,nn`, `ld (nn),a`, `ld sp,nn`, `ld (nn),hl`, …) and `^w`
 * (Z80N's big-endian `push nn`). Not `^L` — the jump and call targets. A system variable is data,
 * and the sysvar area is not code, so a `jp $5C3A` matching a variable's address is a coincidence
 * far more often than it is a fact worth printing; the branch targets keep their `L5C3A` labels,
 * which is what the listing's own label column is keyed on.
 */
const DATA_OPERAND_PRAGMAS: ReadonlySet<DisassemblyOperandPragma> = new Set<DisassemblyOperandPragma>([
  "W",
  "w"
]);

/**
 * A system variable's name, spelled so an assembler would accept it.
 *
 * The tables carry the names as the ROM manuals print them, which includes spaces (`ATTR P`) and
 * hyphens (`CH-ADD`) — neither is a legal identifier character, and a hyphen would read as
 * subtraction. Every character outside `[0-9A-Za-z_]` becomes `_`, so `CH-ADD` is `CH_ADD` and
 * `ATTR P` is `ATTR_P`.
 */
export function sanitizeSysVarName(name: string): string {
  return name.replace(/[^0-9A-Za-z_]/g, "_");
}

/**
 * The name to print for each system variable address.
 *
 * **First declaration wins.** Two variables can share an address — `K-DATA` and `TVDATA` are both
 * at `$5C0D`, and the 128K/+3 tables are concatenated in front of the 48K one — and a listing has
 * room for exactly one name. Taking the first keeps the choice aligned with the machine's own
 * ordering, which puts the more specific table first.
 *
 * Addresses are masked to 16 bits so a lookup keyed on a decoded operand always compares like
 * with like.
 */
export function buildSysVarNameMap(sysVars: SysVar[] | undefined): Map<number, string> {
  const names = new Map<number, string>();
  for (const sysVar of sysVars ?? []) {
    const address = sysVar.address & 0xffff;
    if (names.has(address)) continue;
    const name = sanitizeSysVarName(sysVar.name ?? "");
    if (!name) continue;
    names.set(address, name);
  }
  return names;
}

/**
 * An operand resolver that names the machine's system variables.
 *
 * `undefined` when the machine declares none, so the caller can pass the result straight through:
 * an absent resolver leaves the disassembler's rendering byte-for-byte as it was, which is cheaper
 * than one that always declines.
 */
export function createSysVarOperandLabelResolver(
  sysVars: SysVar[] | undefined
): DisassemblyOperandLabelResolver | undefined {
  const names = buildSysVarNameMap(sysVars);
  if (names.size === 0) return undefined;

  return ({ pragma, operandValue }) =>
    operandValue === undefined || !DATA_OPERAND_PRAGMAS.has(pragma)
      ? undefined
      : names.get(operandValue & 0xffff);
}

/**
 * Ask each resolver in turn, and take the first name offered.
 *
 * Order is precedence, and the callers put the hand-authored names first: a label the user wrote
 * into a `.NEX` annotation is a statement about *this* program, while a system variable name is a
 * fact about the machine, so the specific claim wins over the general one.
 *
 * `undefined` when nothing is left after the absent resolvers are dropped, and the single resolver
 * itself when only one remains — both so a caller that chains an unused source pays nothing, and
 * so resolver identity stays stable for the memoized call sites that re-disassemble on change.
 */
export function chainOperandLabelResolvers(
  ...resolvers: (DisassemblyOperandLabelResolver | undefined)[]
): DisassemblyOperandLabelResolver | undefined {
  const active = resolvers.filter((resolver): resolver is DisassemblyOperandLabelResolver => !!resolver);
  if (active.length === 0) return undefined;
  if (active.length === 1) return active[0];

  return (operand) => {
    for (const resolve of active) {
      const label = resolve(operand);
      if (label) return label;
    }
    return undefined;
  };
}
