import { symText, vregText, type Block, type Instr, type MFunction, type MModule, type Slot, type Terminator } from "./mir";

/**
 * The MIR's text form (`.docs/z80-backend-mir.md` §9): what `'@emit-ir` writes and tests compare.
 * An operation's stated meaning is shown after it in braces (`div %1, %2 {trunc}`).
 */
export function mirText(mir: MModule): string {
  const out: string[] = [];
  for (const fn of mir.functions) out.push(...functionText(fn), "");
  return out.join("\n");
}

function functionText(fn: MFunction): string[] {
  const params = fn.params.map((p) => `${p.name}: ${p.type} @ix${p.offset >= 0 ? "+" : ""}${p.offset}`).join(", ");
  const lines = [
    `${fn.kind} ${fn.label}(${params})${fn.returnType ? `: ${fn.returnType}` : ""}  ; ${fn.convention}, frame ${fn.frameSize}, args ${fn.argBytes}${fn.bank ? `, CODEBANK ${fn.bank}` : ""}`
  ];
  for (const l of fn.locals) lines.push(`  local ${l.name}: ${l.type} @ix${l.offset}`);
  for (const b of fn.blocks) lines.push(...blockText(b));
  return lines;
}

function blockText(b: Block): string[] {
  const lines = [`${b.label}:`];
  for (const i of b.instrs) lines.push(`    ${instrText(i)}`);
  if (b.term) lines.push(`    ${termText(b.term)}`);
  return lines;
}

function slotText(s: Slot): string {
  switch (s.kind) {
    case "global":
      return `[${s.name}]`;
    case "frame":
      return `[ix${s.offset >= 0 ? "+" : ""}${s.offset}]`;
    case "deref":
      return `[${vregText(s.ptr)}]`;
  }
}

/** The meanings an operation states, as ` {trunc, wrap}`; empty when it states none. */
function meaningText(i: Extract<Instr, { op: "bin" | "neg" | "not" | "lnot" | "conv" }>): string {
  const parts: string[] = [];
  if ("rounding" in i && i.rounding) parts.push(i.rounding);
  if ("toInt" in i && i.toInt) parts.push(`toInt ${i.toInt}`);
  if ("shift" in i && i.shift) parts.push(i.shift);
  if (i.overflow) parts.push(i.overflow);
  if ("truth" in i && i.truth) parts.push(`truth ${i.truth}`);
  return parts.length ? ` {${parts.join(", ")}}` : "";
}

function instrText(i: Instr): string {
  const at = `  ; s${i.sid}`;
  switch (i.op) {
    case "stmt":
      return `; --- statement ${i.sid}`;
    case "prologue.end":
    case "epilogue.begin":
      return `; ${i.op}`;
    case "const":
      return `${vregText(i.dst)}:${i.dst.type} = ${i.value.kind === "sym" ? `@${symText(i.value)}` : i.value.value}${at}`;
    case "load":
      return `${vregText(i.dst)}:${i.dst.type} = load ${slotText(i.slot)}${at}`;
    case "store":
      return `store.${i.type} ${slotText(i.slot)}, ${vregText(i.src)}${at}`;
    case "addr":
      return `${vregText(i.dst)} = addr ${slotText(i.slot)}${at}`;
    case "bin":
      return `${vregText(i.dst)}:${i.dst.type} = ${i.bop} ${vregText(i.a)}, ${vregText(i.b)}${meaningText(i)}${at}`;
    case "neg":
    case "not":
    case "lnot":
    case "conv":
      return `${vregText(i.dst)}:${i.dst.type} = ${i.op} ${vregText(i.a)}${meaningText(i)}${at}`;
    case "call":
      return `${i.dst ? `${vregText(i.dst)}:${i.dst.type} = ` : ""}call.${i.convention} ${i.target}(${i.args.map(vregText).join(", ")})${at}`;
    case "rtcall":
      return `${i.dst ? `${vregText(i.dst)}:${i.dst.type} = ` : ""}rtcall ${i.name}(${i.args.map(vregText).join(", ")})${at}`;
    case "asm":
      return `asm {${i.lines.length} lines}${at}`;
  }
}

function termText(t: Terminator): string {
  const at = `  ; s${t.sid}`;
  switch (t.op) {
    case "jmp":
      return `jmp ${t.target}${at}`;
    case "br":
      return `br ${vregText(t.cond)}, ${t.ifTrue}, ${t.ifFalse}${at}`;
    case "switch":
      return `switch${t.call ? ".call" : ""} ${vregText(t.sel)}, [${t.targets.join(", ")}], ${t.otherwise}${at}`;
    case "localcall":
      return `localcall ${t.target}, ${t.next}${at}`;
    case "ret":
      return `ret${t.value ? ` ${vregText(t.value)}` : ""}${at}`;
    case "exit":
      return `exit ${t.routine}, ${vregText(t.value)} (${t.width}-bit)${at}`;
  }
}
