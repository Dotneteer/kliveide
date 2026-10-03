import type {
  CompiledCondition,
  CondNode,
  ConditionBinaryOp,
  ConditionContext,
  ConditionUnaryOp
} from "./condition-types";

/*
 * Evaluating a compiled condition (plan §3.8): a recursive walk over the tree.
 *
 * Arithmetic and comparison are mathematical on exact integers (C4); `& | ^ ~` give an unsigned
 * 32-bit result (C6); the shifts are exactly JavaScript's (C5). Truthiness is "non-zero", and the
 * logical and comparison operators yield 0 or 1.
 */

/** Apply a unary operator. Shared with the checker's constant folder. */
export function applyUnary(op: ConditionUnaryOp, value: number): number {
  switch (op) {
    case "!":
      return value === 0 ? 1 : 0;
    case "~":
      return ~value >>> 0;
    case "-":
      return -value;
  }
}

/** Apply a binary operator to two evaluated operands. Shared with the checker's constant folder. */
export function applyBinary(op: ConditionBinaryOp, l: number, r: number): number {
  switch (op) {
    case "||":
      return l !== 0 || r !== 0 ? 1 : 0;
    case "&&":
      return l !== 0 && r !== 0 ? 1 : 0;
    case "==":
      return l === r ? 1 : 0;
    case "!=":
      return l !== r ? 1 : 0;
    case "<":
      return l < r ? 1 : 0;
    case "<=":
      return l <= r ? 1 : 0;
    case ">":
      return l > r ? 1 : 0;
    case ">=":
      return l >= r ? 1 : 0;
    case "|":
      return (l | r) >>> 0;
    case "^":
      return (l ^ r) >>> 0;
    case "&":
      return (l & r) >>> 0;
    case "<<":
      return l << r;
    case ">>":
      return l >> r;
    case ">>>":
      return l >>> r;
    case "+":
      return l + r;
    case "-":
      return l - r;
  }
}

/** Read the low `bits` of a value as two's complement. */
export function toSigned(value: number, bits: 8 | 16 | 32): number {
  if (bits === 32) return value | 0;
  const mask = bits === 8 ? 0xff : 0xffff;
  const sign = bits === 8 ? 0x80 : 0x8000;
  return ((value & mask) ^ sign) - sign;
}

/** Evaluate a node. `values` are the bound label values, by slot. */
export function evaluateNode(node: CondNode, ctx: ConditionContext, values: number[]): number {
  switch (node.k) {
    case "num":
      return node.v;
    case "reg":
      return ctx.reg(node.r);
    case "flag":
      return (ctx.reg("F") >> node.bit) & 1;
    case "special":
      return (node.s === "val" ? ctx.accessValue : ctx.accessAddress) ?? 0;
    case "label":
      return values[node.slot] ?? 0;
    case "mem":
      return readAccess(node, evaluateNode(node.addr, ctx, values), ctx);
    case "call": {
      const arg = evaluateNode(node.arg, ctx, values);
      switch (node.fn) {
        case "page":
          // --- No partition at all compares unequal to every partition literal
          return ctx.partitionOf(arg & 0xffff) ?? Number.NaN;
        case "nr":
          return ctx.nextReg ? ctx.nextReg(arg & 0xff) & 0xff : 0;
        case "s8":
          return toSigned(arg, 8);
        case "s16":
          return toSigned(arg, 16);
        case "s32":
          return toSigned(arg, 32);
      }
      return 0;
    }
    case "un":
      return applyUnary(node.op, evaluateNode(node.e, ctx, values));
    case "bin": {
      // --- Short-circuit, so a guard like `HL < $FFFF && w[HL] == 0` reads no more than it must
      if (node.op === "&&") {
        return evaluateNode(node.l, ctx, values) !== 0 && evaluateNode(node.r, ctx, values) !== 0
          ? 1
          : 0;
      }
      if (node.op === "||") {
        return evaluateNode(node.l, ctx, values) !== 0 || evaluateNode(node.r, ctx, values) !== 0
          ? 1
          : 0;
      }
      return applyBinary(node.op, evaluateNode(node.l, ctx, values), evaluateNode(node.r, ctx, values));
    }
  }
}

/** A 1, 2 or 4 byte read, wrapping inside its address space (64K, the partition, the bank). */
function readAccess(node: Extract<CondNode, { k: "mem" }>, address: number, ctx: ConditionContext): number {
  const part = node.part;
  const byteAt = (i: number): number => {
    if (!part) return ctx.readMemory((address + i) & 0xffff) & 0xff;
    if (part.kind === "bank") return ctx.readBank(part.bank, (address + i) & 0x3fff) & 0xff;
    return ctx.readPartition(part.index, (address + i) >>> 0) & 0xff;
  };

  let value = 0;
  for (let i = 0; i < node.width; i++) {
    const byte = byteAt(i);
    // --- Multiplication, not shifts: a 4-byte value must stay unsigned
    const position = node.be ? node.width - 1 - i : i;
    value += byte * 2 ** (8 * position);
  }
  if (!node.signed) return value;
  return toSigned(value, (node.width * 8) as 8 | 16 | 32);
}

/**
 * Is the condition true? A condition with an `inactiveReason` is never evaluated here — the caller
 * decides what inactive means (C14) — so this only answers for an active one.
 */
export function evaluateCondition(compiled: CompiledCondition, ctx: ConditionContext): boolean {
  return evaluateNode(compiled.tree, ctx, compiled.values) !== 0;
}
