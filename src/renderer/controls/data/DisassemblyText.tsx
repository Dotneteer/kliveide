import classnames from "classnames";
import type { DisassemblyOperandInfo } from "@renderer/appIde/disassemblers/common-types";
import styles from "./DisassemblyText.module.scss";

/*
 * One colour set for every disassembly Klive shows (`--color-disassembly-*` in `componentAliases.ts`):
 * the live Disassembly view and every file viewer and ROM page draw rows with `DisassemblyRow`, and
 * every other place that shows an instruction — the execution history, the breakpoints panel, the
 * annotation dialogs, the Copper list — draws it with these. Address and opcodes in the accent pair,
 * the instruction in bold primary text, a label in the label hue, a name in an operand in the operand
 * hue, data in the directive hue, a comment green and italic.
 */

/** The role classes, for a caller that lays out its own cells (an address column, a label cell). */
export const disassemblyText = {
  address: styles.address,
  opcodes: styles.opcodes,
  label: styles.label,
  romLabel: styles.romLabel,
  instruction: styles.instruction,
  directive: styles.directive,
  operand: styles.operand,
  comment: styles.comment
};

/**
 * Splits an instruction so the operand labels a resolver substituted can be tinted separately.
 *
 * The disassembler puts a resolved label into the instruction as plain text, so by the time a row
 * sees `"ld hl,SpriteTable"` nothing marks where the name starts. `resolvedText` on each operand
 * candidate is what went in, so the name can be found again — matched left to right and each
 * candidate consumed once, which is what keeps two operands resolving to the same name from both
 * landing on the first occurrence.
 *
 * Returns plain strings and `{ label }` markers rather than elements, so the rule stays testable
 * without rendering.
 */
export type InstructionPart = string | { label: string };

export function splitInstructionOperands(
  instruction: string,
  operands: readonly DisassemblyOperandInfo[] | undefined
): InstructionPart[] {
  return splitInstructionNames(
    instruction,
    (operands ?? []).map((operand) => operand.resolvedText).filter((name): name is string => !!name)
  );
}

/** The same split, for a caller that knows the names but has no operand candidates. */
export function splitInstructionNames(instruction: string, names: readonly string[]): InstructionPart[] {
  if (names.length === 0 || !instruction) return [instruction];

  const parts: InstructionPart[] = [];
  let rest = instruction;
  for (const name of names) {
    const at = rest.indexOf(name);
    // --- The resolver ran but the name is not in the finished text: a custom disassembler rewrote
    // --- the instruction afterwards. Leave what is left alone rather than guessing.
    if (at < 0) continue;
    if (at > 0) parts.push(rest.slice(0, at));
    parts.push({ label: name });
    rest = rest.slice(at + name.length);
  }
  if (rest) parts.push(rest);
  return parts;
}

/**
 * Whether an instruction is a data pragma (`.defb`, `.defw`, ...) rather than something the CPU runs.
 *
 * A machine's custom disassembler lists the bytes after a ROM restart that takes inline data - the
 * report code after the ZX81's and Spectrum's `RST $08`, the calculator codes after `RST $28` - as
 * `.defb` rows *inside a code region*, so the region type alone would paint them as instructions.
 * No Z80 mnemonic starts with a dot, so the text says which it is.
 */
export function isDataPragma(instruction: string | undefined): boolean {
  return !!instruction && instruction.trimStart().startsWith(".");
}


type InstructionTextProps = {
  /** The instruction as the disassembler wrote it, names already substituted */
  text: string;
  /** The row's operand candidates: their `resolvedText` names are tinted */
  operands?: readonly DisassemblyOperandInfo[];
  /** Or the names to tint, for a caller without operand candidates */
  names?: readonly string[];
  className?: string;
};

/**
 * An instruction in the disassembly colours: the directive hue for data (`.defb` ...), bold primary
 * text otherwise, and each substituted name in the operand hue. One inline run, so the spaces
 * between the parts survive in a flex cell (see `.instructionRun` in `DisassemblyPanel.module.scss`).
 */
export const InstructionText = ({ text, operands, names, className }: InstructionTextProps) => {
  const parts = operands ? splitInstructionOperands(text, operands) : splitInstructionNames(text, names ?? []);
  return (
    <span className={classnames(isDataPragma(text) ? styles.directive : styles.instruction, className)}>
      {parts.map((part, index) =>
        typeof part === "string" ? (
          part
        ) : (
          <span key={index} className={styles.operand}>
            {part.label}
          </span>
        )
      )}
    </span>
  );
};

/** A comment in the disassembly colours (`; ` and the text). */
export const DisassemblyComment = ({ text, className }: { text: string; className?: string }) => (
  <span className={classnames(styles.comment, className)}>; {text}</span>
);
