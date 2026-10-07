import type { HistoryRegisters } from "./historyRecord";

/*
 * What an instruction changed: the registers that differ between the state before it and the state
 * before the next record (or the live state, for the newest) - `.plans/EXECUTION_HISTORY_VIEWER_PLAN.md`
 * §4.4. R changes on every M1 and WZ on most instructions, so both are left out of the row summary by
 * default; the detail pane shows every register anyway.
 */

/** The registers a diff compares, in display order */
export const DIFF_REGISTERS = [
  "af",
  "bc",
  "de",
  "hl",
  "ix",
  "iy",
  "sp",
  "af_",
  "bc_",
  "de_",
  "hl_",
  "ir",
  "wz"
] as const;
export type DiffRegister = (typeof DIFF_REGISTERS)[number];

/** The flag bits of F, high to low */
const FLAG_NAMES = ["S", "Z", "5", "H", "3", "PV", "N", "C"] as const;

export type FlagChange = { flag: (typeof FLAG_NAMES)[number]; to: 0 | 1 };

export type RegisterChange = { register: DiffRegister; from: number; to: number };

export type RegisterDiff = {
  changes: RegisterChange[];
  /** F's changed bits, broken out (`Z→1 C→0`) */
  flags: FlagChange[];
  iff1Changed: boolean;
  interruptModeChanged: boolean;
};

type DiffState = Pick<HistoryRegisters, DiffRegister> & Partial<Pick<HistoryRegisters, "iff1" | "interruptMode">>;

/**
 * The registers that changed
 * @param before The state before the instruction
 * @param after The state after it
 * @param options `includeRefresh`: also report R and WZ, which change on almost every instruction
 */
export function registerDiff(
  before: DiffState,
  after: DiffState,
  options: { includeRefresh?: boolean } = {}
): RegisterDiff {
  const changes: RegisterChange[] = [];
  for (const register of DIFF_REGISTERS) {
    if (!options.includeRefresh && (register === "ir" || register === "wz")) continue;
    let from = before[register];
    let to = after[register];
    if (register === "af") {
      // --- A here, F as flags below
      from >>= 8;
      to >>= 8;
      if (from !== to) changes.push({ register, from: before.af, to: after.af });
      continue;
    }
    if (from !== to) changes.push({ register, from, to });
  }
  const flags: FlagChange[] = [];
  const fBefore = before.af & 0xff;
  const fAfter = after.af & 0xff;
  for (let i = 0; i < 8; i++) {
    const mask = 0x80 >> i;
    if ((fBefore & mask) !== (fAfter & mask)) flags.push({ flag: FLAG_NAMES[i], to: fAfter & mask ? 1 : 0 });
  }
  return {
    changes,
    flags,
    iff1Changed: before.iff1 !== undefined && after.iff1 !== undefined && before.iff1 !== after.iff1,
    interruptModeChanged:
      before.interruptMode !== undefined && after.interruptMode !== undefined && before.interruptMode !== after.interruptMode
  };
}

const REGISTER_LABELS: Record<DiffRegister, string> = {
  af: "A",
  bc: "BC",
  de: "DE",
  hl: "HL",
  ix: "IX",
  iy: "IY",
  sp: "SP",
  af_: "AF'",
  bc_: "BC'",
  de_: "DE'",
  hl_: "HL'",
  ir: "IR",
  wz: "WZ"
};

/** The Changes column: `A=3F HL=8001 SP=FFFC Z↑ C↓` */
export function formatRegisterDiff(diff: RegisterDiff): string {
  const parts = diff.changes.map((c) =>
    c.register === "af"
      ? `A=${hex(c.to >> 8, 2)}`
      : `${REGISTER_LABELS[c.register]}=${hex(c.to, 4)}`
  );
  for (const f of diff.flags) parts.push(`${f.flag}${f.to ? "↑" : "↓"}`);
  return parts.join(" ");
}

function hex(value: number, digits: number): string {
  return value.toString(16).toUpperCase().padStart(digits, "0");
}
