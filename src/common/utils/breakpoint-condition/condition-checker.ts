import type {
  CompiledCondition,
  CondNode,
  ConditionDiagnostic,
  ConditionEnvironment,
  ConditionRegister,
  ConditionSymbols
} from "./condition-types";
import { bankLocalSymbolKey } from "./condition-types";
import { ConditionSyntaxError } from "./condition-lexer";
import { parseCondition, type SyntaxNode } from "./condition-parser";
import { MAX_PROGRAM_WORDS, MAX_STACK_DEPTH, emitCondition, stackDepthOf } from "./condition-bytecode";

/*
 * The checker and the compile/bind entry points (plan §3.6-§3.8).
 *
 * The checker turns the syntax tree into the evaluation tree: names become registers, flags,
 * specials or label slots; strings fold into the number their access would read (C9) - byte
 * packing, not evaluation; and the static checks of §3.7 run, the first error stopping compilation.
 * Nothing here evaluates: constants are emitted as bytecode and the C evaluator computes them
 * (`.plans/BREAKPOINT_CONDITIONS_IN_C_PLAN.md` E4). Warnings (unknown
 * labels, reserved names shadowing a symbol) are collected and do not reject the condition.
 */

const REGISTERS: Record<string, ConditionRegister> = {
  a: "A", f: "F", b: "B", c: "C", d: "D", e: "E", h: "H", l: "L", i: "I", r: "R",
  ixh: "XH", ixl: "XL", iyh: "YH", iyl: "YL", xh: "XH", xl: "XL", yh: "YH", yl: "YL",
  af: "AF", bc: "BC", de: "DE", hl: "HL", ix: "IX", iy: "IY", sp: "SP", pc: "PC", wz: "WZ",
  "af'": "AF'", "bc'": "BC'", "de'": "DE'", "hl'": "HL'"
};

const EIGHT_BIT = new Set<ConditionRegister>([
  "A", "F", "B", "C", "D", "E", "H", "L", "I", "R", "XH", "XL", "YH", "YL"
]);

/** Flag names and their bit in F (Q3, §3.5). */
const FLAGS: Record<string, number> = {
  sf: 7, zf: 6, f5f: 5, yf: 5, hf: 4, f3f: 3, xf: 3, pvf: 2, pf: 2, vf: 2, nf: 1, cf: 0
};

/** The largest 16K bank on the ZX Spectrum Next. */
const MAX_NEXT_BANK = 111;

/** A value's static range, and the name an out-of-range message uses for it. */
type StaticRange = { min: number; max: number; name: string };

export type CompileConditionResult = {
  /** Absent when `errors` is not empty. */
  compiled?: CompiledCondition;
  errors: ConditionDiagnostic[];
  warnings: ConditionDiagnostic[];
};

/**
 * Parse and check a condition. When `env.symbols` is given the result is also bound against it.
 */
export function compileCondition(text: string, env: ConditionEnvironment): CompileConditionResult {
  return compileConditionWith(text, env, parseCondition);
}

/**
 * Check and compile an expression with the given parser. The DeZog dialect of a logpoint template
 * (`.plans/LOGPOINTS_PLAN.md` §3.4) is a second *front end* over this one checker: its parser
 * builds the same syntax tree, and from there the expression is checked, emitted and evaluated as
 * any condition is.
 */
export function compileConditionWith(
  text: string,
  env: ConditionEnvironment,
  parse: (text: string) => SyntaxNode
): CompileConditionResult {
  const warnings: ConditionDiagnostic[] = [];
  try {
    if (env.isZ80 === false) {
      throw new ConditionSyntaxError(
        "Breakpoint conditions are supported on Z80 machines only",
        0,
        text.length
      );
    }
    const syntax = parse(text);
    const checker = new Checker(text, env, warnings);
    const tree = checker.convert(syntax, false);
    // --- The evaluator's limits (`z80-condition.c`): checked here, so a condition the cores could
    // --- not run is refused with a message rather than failing safe at every hit
    if (stackDepthOf(tree) > MAX_STACK_DEPTH) {
      throw new ConditionSyntaxError("The condition is nested too deeply", 0, text.length);
    }
    if (emitCondition({ tree, values: checker.labels.map(() => 0) }).length > MAX_PROGRAM_WORDS) {
      throw new ConditionSyntaxError("The condition is too long", 0, text.length);
    }
    const compiled: CompiledCondition = {
      source: text,
      tree,
      labels: checker.labels,
      labelNames: checker.labelNames,
      values: checker.labels.map(() => 0)
    };
    if (env.symbols) bindCondition(compiled, env.symbols);
    return { compiled, errors: [], warnings };
  } catch (err) {
    if (err instanceof ConditionSyntaxError) {
      return { errors: [err.toDiagnostic()], warnings };
    }
    throw err;
  }
}

/**
 * Bind a compiled condition's labels to a symbol table (§3.6). Re-run after every build; a missing
 * label sets `inactiveReason` (C14), and a later table that defines it clears the reason.
 */
export function bindCondition(compiled: CompiledCondition, symbols: ConditionSymbols): void {
  const missing: string[] = [];
  compiled.labels.forEach((key, slot) => {
    const value = symbols[key];
    if (value === undefined) {
      missing.push(compiled.labelNames[slot]);
      compiled.values[slot] = 0;
    } else {
      compiled.values[slot] = value;
    }
  });
  compiled.inactiveReason = missing.length
    ? `unknown label${missing.length > 1 ? "s" : ""} ${missing.join(", ")}`
    : undefined;
}

class Checker {
  readonly labels: string[] = [];
  readonly labelNames: string[] = [];

  constructor(
    private readonly text: string,
    private readonly env: ConditionEnvironment,
    private readonly warnings: ConditionDiagnostic[]
  ) {}

  private fail(message: string, span: { start: number; end: number }): never {
    throw new ConditionSyntaxError(message, span.start, span.end);
  }

  private source(span: { start: number; end: number }): string {
    return this.text.substring(span.start, span.end).trim();
  }

  /**
   * @param ignoredBankPrefix Inside an access whose bank prefix was dropped because the machine has
   *   no banks (C17): a bank-local label there reads as the global label of that name.
   */
  convert(node: SyntaxNode, ignoredBankPrefix: boolean): CondNode {
    switch (node.k) {
      case "num":
        return { k: "num", v: node.v };

      case "str":
        return this.fail(
          "A string can only be compared (==, !=) with an unsigned memory access",
          node
        );

      case "part": {
        if (!this.env.hasPartitions) {
          this.fail(`@${node.label} names a partition, but this machine has none`, node);
        }
        const index = this.env.parsePartitionLabel?.(node.label);
        if (index === undefined) this.fail(`Unknown partition @${node.label}`, node);
        return { k: "num", v: index };
      }

      case "name":
        return this.resolveName(node);

      case "bankLabel": {
        if (!this.env.isNext) {
          if (ignoredBankPrefix) return this.labelSlot(node.name.toLowerCase(), node.name, node);
          this.fail(
            `Bank-local labels (${this.source(node)}) exist only on the ZX Spectrum Next`,
            node
          );
        }
        const bank = this.parseBank(node.bank, node.bankSpan);
        return this.labelSlot(bankLocalSymbolKey(bank, node.name), `${node.bank}:${node.name}`, node);
      }

      case "mem": {
        let part: Extract<CondNode, { k: "mem" }>["part"];
        let ignored = false;
        if (node.part) {
          if (node.part.kind === "bank") {
            if (this.env.isNext) {
              part = { kind: "bank", bank: this.parseBank(node.part.text, node.part.span) };
            } else if (this.env.hasPartitions) {
              this.fail(
                `Bank specs (${node.part.text}:+offset, ${node.part.text}:label) exist only on the ZX Spectrum Next`,
                node.part.span
              );
            } else {
              ignored = true;
            }
          } else if (this.env.hasPartitions) {
            const index = this.env.parsePartitionLabel?.(node.part.text);
            if (index === undefined) {
              this.fail(`Unknown partition '${node.part.text}'`, node.part.span);
            }
            part = { kind: "partition", index };
          }
          // --- No partitions: the prefix is ignored and the CPU address is read (C17)
        }
        return {
          k: "mem",
          width: node.access.width,
          be: node.access.be,
          signed: node.access.signed,
          ...(part ? { part } : {}),
          addr: this.convert(node.addr, ignored)
        };
      }

      case "call": {
        if (node.fn === "page" && !this.env.hasPartitions) {
          this.fail("page() needs a machine with memory partitions", node);
        }
        if (node.fn === "nr" && !this.env.isNext) {
          this.fail("nr() reads a Next register; it exists only on the ZX Spectrum Next", node);
        }
        return { k: "call", fn: node.fn, arg: this.convert(node.arg, ignoredBankPrefix) };
      }

      case "machine":
        if (node.fn === "slots") {
          this.fail(
            "slots() is text; it can only be a whole logpoint placeholder ({slots()})",
            node
          );
        }
        return { k: "machine", fn: node.fn };

      case "un": {
        const e = this.convert(node.e, ignoredBankPrefix);
        return { k: "un", op: node.op, e };
      }

      case "bin": {
        const isEquality = node.op === "==" || node.op === "!=";
        if (node.l.k === "str" || node.r.k === "str") {
          if (!isEquality) {
            this.fail(
              "A string can only be compared (==, !=) with an unsigned memory access",
              node.l.k === "str" ? node.l : node.r
            );
          }
          return this.stringComparison(node, ignoredBankPrefix);
        }
        const l = this.convert(node.l, ignoredBankPrefix);
        const r = this.convert(node.r, ignoredBankPrefix);
        if (isRelational(node.op)) {
          this.checkRange(l, node.l, r, node.r);
          this.checkRange(r, node.r, l, node.l);
        }
        return { k: "bin", op: node.op, l, r };
      }
    }
  }

  private resolveName(node: Extract<SyntaxNode, { k: "name" }>): CondNode {
    const lower = node.name.toLowerCase();
    if (node.quoted) return this.labelSlot(lower, node.name, node);

    let resolved: CondNode | undefined;
    if (REGISTERS[lower]) {
      resolved = { k: "reg", r: REGISTERS[lower] };
    } else if (FLAGS[lower] !== undefined) {
      resolved = { k: "flag", bit: FLAGS[lower] };
    } else if (lower === "val" || lower === "addr") {
      if (this.env.accessKind === "exec") {
        this.fail(
          `${node.name.toUpperCase()} is the accessed ${lower === "val" ? "value" : "address"}; an execution breakpoint has none`,
          node
        );
      }
      resolved = { k: "special", s: lower };
    }

    if (resolved) {
      // --- R5: a reserved name shadows a label of the same name
      if (this.env.symbols?.[lower] !== undefined) {
        this.warnings.push({
          severity: "warning",
          message: `${node.name} is read as the reserved name, not the label; write \`${node.name}\` for the label`,
          start: node.start,
          end: node.end
        });
      }
      return resolved;
    }
    return this.labelSlot(lower, node.name, node);
  }

  private labelSlot(key: string, display: string, span: { start: number; end: number }): CondNode {
    let slot = this.labels.indexOf(key);
    if (slot < 0) {
      slot = this.labels.length;
      this.labels.push(key);
      this.labelNames.push(display);
    }
    if (this.env.symbols && this.env.symbols[key] === undefined) {
      this.warnings.push({
        severity: "warning",
        message: `Unknown label ${display}: the breakpoint is inactive until a build defines it`,
        start: span.start,
        end: span.end
      });
    }
    return { k: "label", slot };
  }

  private parseBank(text: string, span: { start: number; end: number }): number {
    if (!/^[0-9a-f]{1,2}$/i.test(text) || parseInt(text, 16) > MAX_NEXT_BANK) {
      this.fail(`'${text}' is not a 16K bank (00-6F)`, span);
    }
    return parseInt(text, 16);
  }

  /** `access == "text"` (C8, C9): the string folds into the number the access reads for it. */
  private stringComparison(node: Extract<SyntaxNode, { k: "bin" }>, ignoredBankPrefix: boolean): CondNode {
    const [strSide, other] = node.l.k === "str" ? [node.l, node.r] : [node.r, node.l];
    if (strSide.k !== "str") throw new Error("unreachable");
    if (other.k === "str") {
      this.fail("Two strings cannot be compared with each other", node);
    }
    if (other.k !== "mem" || other.access.signed) {
      this.fail("A string can only be compared (==, !=) with an unsigned memory access", strSide);
    }
    const width = other.access.width;
    if (strSide.codes.length !== width) {
      const n = strSide.codes.length;
      this.fail(
        `String ${strSide.text} has ${n} character${n === 1 ? "" : "s"} but ${other.access.name}[…] compares ${width}`,
        strSide
      );
    }
    let value = 0;
    strSide.codes.forEach((code, i) => {
      const position = other.access.be ? width - 1 - i : i;
      value += code * 2 ** (8 * position);
    });
    const access = this.convert(other, ignoredBankPrefix);
    const literal: CondNode = { k: "num", v: value };
    return node.l.k === "str"
      ? { k: "bin", op: node.op, l: literal, r: access }
      : { k: "bin", op: node.op, l: access, r: literal };
  }

  /** §3.7 rule 3: a constant compared with an operand that can never hold it. */
  private checkRange(operand: CondNode, operandSyntax: SyntaxNode, other: CondNode, otherSyntax: SyntaxNode) {
    const constant = literalValue(other);
    if (constant === undefined) return;
    const range = this.rangeOf(operand, operandSyntax);
    if (!range || (constant >= range.min && constant <= range.max)) return;
    this.fail(
      `${this.source(otherSyntax)} is out of range for ${range.name} (${formatRange(range.min, range.max)})`,
      otherSyntax
    );
  }

  private rangeOf(node: CondNode, syntax: SyntaxNode): StaticRange | undefined {
    switch (node.k) {
      case "reg":
        return {
          min: 0,
          max: EIGHT_BIT.has(node.r) ? 0xff : 0xffff,
          name: this.source(syntax).toUpperCase()
        };
      case "flag":
        return { min: 0, max: 1, name: this.source(syntax).toUpperCase() };
      case "special":
        // --- A Copper breakpoint's VAL is the 16-bit instruction word, its ADDR the list index; a
        // --- sprite breakpoint's VAL is the byte written, its ADDR the attribute byte (0-4)
        return node.s === "val"
          ? { min: 0, max: this.env.accessKind === "copper" ? 0xffff : 0xff, name: "VAL" }
          : {
              min: 0,
              max: this.env.accessKind === "copper" ? 0x3ff : this.env.accessKind === "sprite" ? 4 : 0xffff,
              name: "ADDR"
            };
      case "mem": {
        const bits = node.width * 8;
        const name = syntax.k === "mem" ? `${syntax.access.name}[…]` : "the access";
        return node.signed
          ? { min: -(2 ** (bits - 1)), max: 2 ** (bits - 1) - 1, name }
          : { min: 0, max: 2 ** bits - 1, name };
      }
      case "call":
        switch (node.fn) {
          case "nr":
            return { min: 0, max: 0xff, name: "nr(…)" };
          case "s8":
            return { min: -128, max: 127, name: "s8(…)" };
          case "s16":
            return { min: -32768, max: 32767, name: "s16(…)" };
          case "s32":
            return { min: -(2 ** 31), max: 2 ** 31 - 1, name: "s32(…)" };
          case "page":
            return this.env.partitionRange
              ? { ...this.env.partitionRange, name: "page(…)" }
              : undefined;
        }
    }
    return undefined;
  }
}

function isRelational(op: string): boolean {
  return op === "==" || op === "!=" || op === "<" || op === "<=" || op === ">" || op === ">=";
}

/** Signed ranges in decimal; unsigned ones in decimal up to 255 and in hex above. */
function formatRange(min: number, max: number): string {
  if (min < 0 || max <= 0xff) return `${min}…${max}`;
  return `${min}…$${max.toString(16).toUpperCase()}`;
}

/**
 * The value of a **literal** operand - a number, a character, a partition or a folded string, or one
 * of those negated - or `undefined` for anything computed.
 *
 * The front end does not evaluate (`.plans/BREAKPOINT_CONDITIONS_IN_C_PLAN.md` E4): computed
 * constants like `255 + 1` are left to the C evaluator, so only literals are range-checked.
 * Negation is a sign, not evaluation.
 */
function literalValue(node: CondNode): number | undefined {
  if (node.k === "num") return node.v;
  if (node.k === "un" && node.op === "-") {
    const inner = literalValue(node.e);
    return inner === undefined ? undefined : -inner;
  }
  return undefined;
}
