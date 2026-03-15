/**
 * T-states lookup for Z80 instructions.
 *
 * Maps normalized instruction patterns to T-state counts.  Each entry has a
 * primary T-state value and an optional secondary value for conditional
 * instructions (condition met / not met).
 *
 * The data is extracted from the disassembler instruction tables in
 * z80-disassembler.ts and covers standard, CB-prefix, ED-prefix (including
 * ZX Spectrum Next extensions) and IX/IY-indexed instruction sets.
 */

export interface TstatesInfo {
  /** Primary T-state count. */
  t: number;
  /** Secondary T-state count (when condition is NOT met, for conditional ops). */
  t2?: number;
}

/**
 * Look up T-states for a Z80 instruction extracted from a source line.
 *
 * @param lineContent  The full source line (e.g. `"  ld a, (hl)  ; comment"`).
 * @returns T-states info, or null if the instruction is unknown.
 */
export function lookupTstates(lineContent: string): TstatesInfo | null {
  const pattern = normalizeInstruction(lineContent);
  if (!pattern) return null;
  return tstatesMap.get(pattern) ?? null;
}

// ---------------------------------------------------------------------------
// Line→pattern normalizer
// ---------------------------------------------------------------------------

/** Tokens that are Z80 condition codes — they must NOT be replaced by `N`. */
const CONDITIONS = new Set(["nz", "z", "nc", "c", "po", "pe", "p", "m"]);

/**
 * Strips labels, comments, and concrete operand values from a source line
 * to produce a canonical pattern that can be looked up in `tstatesMap`.
 *
 * Examples:
 *   "  ld a, (hl)  ; load"   → "ld a,(hl)"
 *   "loop: jr nz, loop"       → "jr nz,N"
 *   "  ld bc, $1234"          → "ld bc,N"
 *   "  bit 3, b"              → "bit N,b"
 */
function normalizeInstruction(line: string): string | null {
  // Strip trailing comment
  let s = stripComment(line).trim();
  if (!s) return null;

  // Strip leading label  (e.g. "myLabel:" or "myLabel  ld a,b")
  // A label either ends with ':' or is the first token when followed by an instruction mnemonic.
  s = stripLabel(s);
  if (!s) return null;

  // Separate mnemonic from operands
  const firstSpace = s.indexOf(" ");
  if (firstSpace < 0) {
    // No operands (e.g. "nop", "halt")
    return s.toLowerCase();
  }

  const mnemonic = s.substring(0, firstSpace).toLowerCase();
  const operandStr = s.substring(firstSpace + 1).trim();

  // Split operands by comma (respecting parentheses)
  const operands = splitOperands(operandStr);
  const normOps = operands.map((op) => normalizeOperand(op.trim()));

  return mnemonic + " " + normOps.join(",");
}

/** Strip a Z80-asm comment (everything from first ';' that's not inside a string). */
function stripComment(line: string): string {
  let inString = false;
  let stringChar = "";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inString) {
      if (ch === stringChar) inString = false;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
      continue;
    }
    if (ch === ";") return line.substring(0, i);
  }
  return line;
}

/** Strip a leading label from the instruction text. */
function stripLabel(s: string): string {
  // "label: instruction" or "label instruction"
  const colonIdx = s.indexOf(":");
  if (colonIdx >= 0) {
    // Check that the colon is part of a label, not part of e.g. "::"
    const beforeColon = s.substring(0, colonIdx).trim();
    if (/^[A-Za-z_@$.`][A-Za-z0-9_@$.`!?]*$/.test(beforeColon)) {
      const rest = s.substring(colonIdx + 1).trim();
      // Handle :: (global label)
      if (rest.startsWith(":")) {
        return rest.substring(1).trim();
      }
      return rest;
    }
  }

  // No colon — check if first token is a label followed by a mnemonic
  const parts = s.split(/\s+/);
  if (parts.length >= 2 && !MNEMONICS.has(parts[0].toLowerCase())) {
    // The first token is not a known mnemonic, assume it's a label
    return parts.slice(1).join(" ");
  }
  return s;
}

/** Split operand string by top-level commas (not inside parentheses). */
function splitOperands(operandStr: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of operandStr) {
    if (ch === "(" || ch === "[") {
      depth++;
      current += ch;
    } else if (ch === ")" || ch === "]") {
      depth--;
      current += ch;
    } else if (ch === "," && depth === 0) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current) result.push(current);
  return result;
}

/**
 * Normalize a single operand:
 * - Known registers / register pairs → kept as-is (lowercased)
 * - Condition codes → kept as-is
 * - Indirect register like (hl), (bc), (c), (sp) → kept as-is
 * - Indexed indirect like (ix+N) / (iy+N) → "(ix+N)" / "(iy+N)"
 * - Port (N) with a literal → "(N)"
 * - Immediate values / labels / expressions → "N"
 */
function normalizeOperand(op: string): string {
  const lc = op.toLowerCase().replace(/\s+/g, "");

  // Direct register or condition code
  if (REGISTERS.has(lc) || CONDITIONS.has(lc)) return lc;

  // Parenthesized register indirect: (hl), (bc), (de), (sp), (c), (ix), (iy)
  const indirectMatch = lc.match(/^\(([a-z]{1,2}'?)\)$/);
  if (indirectMatch && (REGISTERS.has(indirectMatch[1]) || indirectMatch[1] === "c")) {
    return `(${indirectMatch[1]})`;
  }

  // Indexed indirect: (ix+expr), (iy+expr), (ix-expr), (iy-expr), (ix), (iy)
  if (/^\((ix|iy)([+-].*?)?\)$/.test(lc)) {
    const reg = lc.startsWith("(ix") ? "ix" : "iy";
    return `(${reg}+N)`;
  }

  // Parenthesized immediate/address: (expr)
  if (lc.startsWith("(") && lc.endsWith(")")) {
    return "(N)";
  }

  // Bit number for bit/set/res — must be 0-7 literal
  if (/^[0-7]$/.test(lc)) return "N";

  // RST target — specific values: $00, $08, ... $38, 0, 8, ... 56
  // These are just numeric immediates → "N"

  // Everything else (immediate values, labels, expressions) → "N"
  return "N";
}

// ---------------------------------------------------------------------------
// Known sets
// ---------------------------------------------------------------------------

const REGISTERS = new Set([
  "a", "b", "c", "d", "e", "h", "l", "f",
  "af", "af'", "bc", "de", "hl", "sp",
  "i", "r",
  "ix", "iy", "ixh", "ixl", "iyh", "iyl",
  "xh", "xl", "yh", "yl"
]);

const MNEMONICS = new Set([
  "adc", "add", "and", "bit", "call", "ccf", "cp", "cpd", "cpdr", "cpi", "cpir",
  "cpl", "daa", "dec", "di", "djnz", "ei", "ex", "exx", "halt", "im", "in",
  "inc", "ind", "indr", "ini", "inir", "jp", "jr", "ld", "ldd", "lddr", "ldi",
  "ldir", "neg", "nop", "or", "otdr", "otir", "out", "outd", "outi", "pop",
  "push", "res", "ret", "reti", "retn", "rl", "rla", "rlc", "rlca", "rld",
  "rr", "rra", "rrc", "rrca", "rrd", "rst", "sbc", "scf", "set", "sla", "sll",
  "sra", "srl", "sub", "xor",
  // ZX Spectrum Next
  "brlc", "bsla", "bsra", "bsrf", "bsrl", "lddrx", "lddx", "ldirx", "ldix",
  "ldpirx", "ldws", "mirror", "mul", "nextreg", "outinb", "pixelad", "pixeldn",
  "setae", "swapnib", "test"
]);

// ---------------------------------------------------------------------------
// T-states map – built from the disassembler's instruction tables
// ---------------------------------------------------------------------------

/** Map from normalized pattern to T-states info. */
const tstatesMap = new Map<string, TstatesInfo>();

function t(pattern: string, tstates: number, tstates2?: number) {
  tstatesMap.set(pattern, tstates2 != null ? { t: tstates, t2: tstates2 } : { t: tstates });
}

// ===== Standard instructions (no prefix) =====
t("nop", 4);
t("ld bc,N", 10);
t("ld (bc),a", 7);
t("inc bc", 6);
t("inc b", 4);
t("dec b", 4);
t("ld b,N", 7);
t("rlca", 4);
t("ex af,af'", 4);
t("add hl,bc", 11);
t("ld a,(bc)", 7);
t("dec bc", 6);
t("inc c", 4);
t("dec c", 4);
t("ld c,N", 7);
t("rrca", 4);

t("djnz N", 13, 8);
t("ld de,N", 10);
t("ld (de),a", 7);
t("inc de", 6);
t("inc d", 4);
t("dec d", 4);
t("ld d,N", 7);
t("rla", 4);
t("jr N", 12);
t("add hl,de", 11);
t("ld a,(de)", 7);
t("dec de", 6);
t("inc e", 4);
t("dec e", 4);
t("ld e,N", 7);
t("rra", 4);

t("jr nz,N", 12, 7);
t("ld hl,N", 10);
t("ld (N),hl", 16);
t("inc hl", 6);
t("inc h", 4);
t("dec h", 4);
t("ld h,N", 7);
t("daa", 4);
t("jr z,N", 12, 7);
t("add hl,hl", 11);
t("ld hl,(N)", 16);
t("dec hl", 6);
t("inc l", 4);
t("dec l", 4);
t("ld l,N", 7);
t("cpl", 4);

t("jr nc,N", 12, 7);
t("ld sp,N", 10);
t("ld (N),a", 13);
t("inc sp", 6);
t("inc (hl)", 11);
t("dec (hl)", 11);
t("ld (hl),N", 10);
t("scf", 4);
t("jr c,N", 12, 7);
t("add hl,sp", 11);
t("ld a,(N)", 13);
t("dec sp", 6);
t("inc a", 4);
t("dec a", 4);
t("ld a,N", 7);
t("ccf", 4);

// 0x40–0x7f: LD r,r' and HALT
t("ld b,b", 4);
t("ld b,c", 4);
t("ld b,d", 4);
t("ld b,e", 4);
t("ld b,h", 4);
t("ld b,l", 4);
t("ld b,(hl)", 7);
t("ld b,a", 4);
t("ld c,b", 4);
t("ld c,c", 4);
t("ld c,d", 4);
t("ld c,e", 4);
t("ld c,h", 4);
t("ld c,l", 4);
t("ld c,(hl)", 7);
t("ld c,a", 4);
t("ld d,b", 4);
t("ld d,c", 4);
t("ld d,d", 4);
t("ld d,e", 4);
t("ld d,h", 4);
t("ld d,l", 4);
t("ld d,(hl)", 7);
t("ld d,a", 4);
t("ld e,b", 4);
t("ld e,c", 4);
t("ld e,d", 4);
t("ld e,e", 4);
t("ld e,h", 4);
t("ld e,l", 4);
t("ld e,(hl)", 7);
t("ld e,a", 4);
t("ld h,b", 4);
t("ld h,c", 4);
t("ld h,d", 4);
t("ld h,e", 4);
t("ld h,h", 4);
t("ld h,l", 4);
t("ld h,(hl)", 7);
t("ld h,a", 4);
t("ld l,b", 4);
t("ld l,c", 4);
t("ld l,d", 4);
t("ld l,e", 4);
t("ld l,h", 4);
t("ld l,l", 4);
t("ld l,(hl)", 7);
t("ld l,a", 4);
t("ld (hl),b", 7);
t("ld (hl),c", 7);
t("ld (hl),d", 7);
t("ld (hl),e", 7);
t("ld (hl),h", 7);
t("ld (hl),l", 7);
t("halt", 4);
t("ld (hl),a", 7);
t("ld a,b", 4);
t("ld a,c", 4);
t("ld a,d", 4);
t("ld a,e", 4);
t("ld a,h", 4);
t("ld a,l", 4);
t("ld a,(hl)", 7);
t("ld a,a", 4);

// 0x80–0xbf: ALU ops
t("add a,b", 4);
t("add a,c", 4);
t("add a,d", 4);
t("add a,e", 4);
t("add a,h", 4);
t("add a,l", 4);
t("add a,(hl)", 7);
t("add a,a", 4);
t("adc a,b", 4);
t("adc a,c", 4);
t("adc a,d", 4);
t("adc a,e", 4);
t("adc a,h", 4);
t("adc a,l", 4);
t("adc a,(hl)", 7);
t("adc a,a", 4);
t("sub b", 4);
t("sub c", 4);
t("sub d", 4);
t("sub e", 4);
t("sub h", 4);
t("sub l", 4);
t("sub (hl)", 7);
t("sub a", 4);
t("sbc a,b", 4);
t("sbc a,c", 4);
t("sbc a,d", 4);
t("sbc a,e", 4);
t("sbc a,h", 4);
t("sbc a,l", 4);
t("sbc a,(hl)", 7);
t("sbc a,a", 4);
t("and b", 4);
t("and c", 4);
t("and d", 4);
t("and e", 4);
t("and h", 4);
t("and l", 4);
t("and (hl)", 7);
t("and a", 4);
t("xor b", 4);
t("xor c", 4);
t("xor d", 4);
t("xor e", 4);
t("xor h", 4);
t("xor l", 4);
t("xor (hl)", 7);
t("xor a", 4);
t("or b", 4);
t("or c", 4);
t("or d", 4);
t("or e", 4);
t("or h", 4);
t("or l", 4);
t("or (hl)", 7);
t("or a", 4);
t("cp b", 4);
t("cp c", 4);
t("cp d", 4);
t("cp e", 4);
t("cp h", 4);
t("cp l", 4);
t("cp (hl)", 7);
t("cp a", 4);

// 0xc0–0xff: control flow, push/pop, etc.
t("ret nz", 11, 5);
t("pop bc", 10);
t("jp nz,N", 10);
t("jp N", 10);
t("call nz,N", 17, 10);
t("push bc", 11);
t("add a,N", 7);
t("rst N", 11);
t("ret z", 11, 5);
t("ret", 10);
t("jp z,N", 10);
t("call z,N", 17, 10);
t("call N", 17);
t("adc a,N", 7);
t("ret nc", 11, 5);
t("pop de", 10);
t("jp nc,N", 10);
t("out (N),a", 11);
t("call nc,N", 17, 10);
t("push de", 11);
t("sub N", 7);
t("ret c", 11, 5);
t("exx", 4);
t("jp c,N", 10);
t("in a,(N)", 11);
t("call c,N", 17, 10);
t("sbc a,N", 7);
t("ret po", 11, 5);
t("pop hl", 10);
t("jp po,N", 10);
t("ex (sp),hl", 19);
t("call po,N", 17, 10);
t("push hl", 11);
t("and N", 7);
t("ret pe", 11, 5);
t("jp (hl)", 4);
t("jp pe,N", 10);
t("ex de,hl", 4);
t("call pe,N", 17, 10);
t("xor N", 7);
t("ret p", 11, 5);
t("pop af", 10);
t("jp p,N", 10);
t("di", 4);
t("call p,N", 17, 10);
t("push af", 11);
t("or N", 7);
t("ret m", 11, 5);
t("ld sp,hl", 6);
t("jp m,N", 10);
t("ei", 4);
t("call m,N", 17, 10);
t("cp N", 7);

// ===== CB-prefix: bit operations =====
// rlc/rrc/rl/rr/sla/sra/sll/srl with 8-bit register
for (const [mnemonic] of [
  ["rlc"], ["rrc"], ["rl"], ["rr"], ["sla"], ["sra"], ["sll"], ["srl"]
]) {
  for (const reg of ["b", "c", "d", "e", "h", "l", "a"]) {
    t(`${mnemonic} ${reg}`, 8);
  }
  t(`${mnemonic} (hl)`, 15);
}

// bit N,r / res N,r / set N,r
for (const mnemonic of ["bit", "res", "set"]) {
  for (const reg of ["b", "c", "d", "e", "h", "l", "a"]) {
    t(`${mnemonic} N,${reg}`, mnemonic === "bit" ? 8 : 8);
  }
  t(`${mnemonic} N,(hl)`, mnemonic === "bit" ? 12 : 15);
}

// ===== ED-prefix: extended instructions =====
t("in b,(c)", 12);
t("out (c),b", 12);
t("sbc hl,bc", 15);
t("ld (N),bc", 20);
t("neg", 8);
t("retn", 14);
t("im N", 8);
t("ld i,a", 9);
t("in c,(c)", 12);
t("out (c),c", 12);
t("adc hl,bc", 15);
t("ld bc,(N)", 20);
t("reti", 14);
t("ld r,a", 9);
t("in d,(c)", 12);
t("out (c),d", 12);
t("sbc hl,de", 15);
t("ld (N),de", 20);
t("ld a,i", 9);
t("in e,(c)", 12);
t("out (c),e", 12);
t("adc hl,de", 15);
t("ld de,(N)", 20);
t("ld a,r", 9);
t("in h,(c)", 12);
t("out (c),h", 12);
t("sbc hl,hl", 15);
t("rrd", 18);
t("in l,(c)", 12);
t("out (c),l", 12);
t("adc hl,hl", 15);
t("ld hl,(N)", 16); // Already defined for standard; ED version is 20
t("rld", 18);
t("in (c)", 12);
t("out (c),N", 12);
t("sbc hl,sp", 15);
t("ld (N),sp", 20);
t("in a,(c)", 12);
t("out (c),a", 12);
t("adc hl,sp", 15);
t("ld sp,(N)", 20);
t("push N", 23); // Next: push nn (big-endian)
t("outinb", 16);
t("nextreg N,N", 20);
t("nextreg N,a", 17);
t("pixeldn", 8);
t("pixelad", 8);
t("setae", 8);
t("jp (c)", 13);
t("ldi", 16);
t("cpi", 16);
t("ini", 16);
t("outi", 16);
t("ldix", 16);
t("ldws", 14);
t("ldd", 16);
t("cpd", 16);
t("ind", 16);
t("outd", 16);
t("lddx", 16);
t("ldir", 21, 16);
t("cpir", 21, 16);
t("inir", 21, 16);
t("otir", 21, 16);
t("ldirx", 21, 16);
t("ldpirx", 21, 16);
t("lddr", 21, 16);
t("cpdr", 21, 16);
t("indr", 21, 16);
t("otdr", 21, 16);
t("lddrx", 21, 16);

// Next: no-tstates-suffix instructions (default 8 T-states)
t("swapnib", 8);
t("mirror a", 8);
t("test N", 11);
t("bsla de,b", 8);
t("bsra de,b", 8);
t("bsrl de,b", 8);
t("bsrf de,b", 8);
t("brlc de,b", 8);
t("mul d,e", 8);
t("add hl,a", 8);
t("add de,a", 8);
t("add bc,a", 8);
t("add hl,N", 16); // Next: add hl,nn
t("add de,N", 16); // Next: add de,nn
t("add bc,N", 16); // Next: add bc,nn

// ===== IX/IY-indexed instructions =====
// (registered for both ix and iy)
for (const xr of ["ix", "iy"]) {
  const xh = xr === "ix" ? "xh" : "yh";
  const xl = xr === "ix" ? "xl" : "yl";
  const ixh = xr === "ix" ? "ixh" : "iyh";
  const ixl = xr === "ix" ? "ixl" : "iyl";

  t(`add ${xr},bc`, 15);
  t(`add ${xr},de`, 15);
  t(`ld ${xr},N`, 14);
  t(`ld (N),${xr}`, 20);
  t(`inc ${xr}`, 10);
  t(`inc ${xh}`, 8);
  t(`inc ${ixh}`, 8);
  t(`dec ${xh}`, 8);
  t(`dec ${ixh}`, 8);
  t(`ld ${xh},N`, 11);
  t(`ld ${ixh},N`, 11);
  t(`add ${xr},${xr}`, 15);
  t(`ld ${xr},(N)`, 20);
  t(`dec ${xr}`, 10);
  t(`inc ${xl}`, 8);
  t(`inc ${ixl}`, 8);
  t(`dec ${xl}`, 8);
  t(`dec ${ixl}`, 8);
  t(`ld ${xl},N`, 11);
  t(`ld ${ixl},N`, 11);
  t(`inc (${xr}+N)`, 23);
  t(`dec (${xr}+N)`, 23);
  t(`ld (${xr}+N),N`, 19);
  t(`add ${xr},sp`, 15);

  // ld r,(ix+d) and ld (ix+d),r
  for (const reg of ["b", "c", "d", "e", "h", "l", "a"]) {
    t(`ld ${reg},(${xr}+N)`, 19);
    t(`ld (${xr}+N),${reg}`, 19);
  }

  // ld r,xh/xl (undocumented)
  for (const reg of ["b", "c", "d", "e", "a"]) {
    t(`ld ${reg},${xh}`, 8);
    t(`ld ${reg},${xl}`, 8);
    t(`ld ${reg},${ixh}`, 8);
    t(`ld ${reg},${ixl}`, 8);
  }

  // ld xh/xl,r (undocumented)
  for (const reg of ["b", "c", "d", "e", "a"]) {
    t(`ld ${xh},${reg}`, 8);
    t(`ld ${xl},${reg}`, 8);
    t(`ld ${ixh},${reg}`, 8);
    t(`ld ${ixl},${reg}`, 8);
  }

  // xh↔xl, xh→xh, xl→xl
  t(`ld ${xh},${xh}`, 8);
  t(`ld ${xh},${xl}`, 8);
  t(`ld ${xl},${xh}`, 8);
  t(`ld ${xl},${xl}`, 8);
  t(`ld ${ixh},${ixh}`, 8);
  t(`ld ${ixh},${ixl}`, 8);
  t(`ld ${ixl},${ixh}`, 8);
  t(`ld ${ixl},${ixl}`, 8);

  // ALU with xh/xl and (ix+d)
  for (const [, prefix] of [
    ["add a,", "add a,"], ["adc a,", "adc a,"], ["sub ", "sub "],
    ["sbc a,", "sbc a,"], ["and ", "and "], ["xor ", "xor "],
    ["or ", "or "], ["cp ", "cp "]
  ] as [string, string][]) {
    t(`${prefix}${xh}`, 8);
    t(`${prefix}${xl}`, 8);
    t(`${prefix}${ixh}`, 8);
    t(`${prefix}${ixl}`, 8);
    t(`${prefix}(${xr}+N)`, 19);
  }

  // pop/push/ex (sp)/jp/ld sp
  t(`pop ${xr}`, 14);
  t(`ex (sp),${xr}`, 23);
  t(`push ${xr}`, 15);
  t(`jp (${xr})`, 8);
  t(`ld sp,${xr}`, 10);
}

// ===== DDCB/FDCB: indexed bit operations =====
for (const xr of ["ix", "iy"]) {
  for (const [mnemonic] of [
    ["rlc"], ["rrc"], ["rl"], ["rr"], ["sla"], ["sra"], ["sll"], ["srl"]
  ]) {
    t(`${mnemonic} (${xr}+N)`, 23);
  }
  for (const mnemonic of ["bit", "res", "set"]) {
    t(`${mnemonic} N,(${xr}+N)`, mnemonic === "bit" ? 20 : 23);
  }
}
