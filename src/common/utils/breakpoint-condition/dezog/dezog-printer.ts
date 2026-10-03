import type { SyntaxNode } from "../condition-parser";
import { parseDezogExpression } from "./dezog-parser";

/*
 * The Klive-dialect reading of a DeZog expression (`.plans/ASSERTIONS_WATCHPOINTS_ONE_SHOT_PLAN.md`
 * §4.5): what the Breakpoints panel's tooltip and `bp-list` show beside an `ASSERTION` comment's own
 * text, so a user who reads the comment with Klive's precedence (C3) sees how it is really read.
 *
 * Every binary operation is parenthesised: DeZog uses C precedence, where `A & 0x80 == 0` is
 * `A & (0x80 == 0)`, and Klive's grammar binds `&` tighter than `==` - the parentheses make the C
 * reading survive. Labels (every non-register name in the DeZog dialect) are printed in backticks,
 * which take dots, so a dotted sjasmplus label round-trips through Klive's lexer (R3).
 *
 * Display only: the emulator compiles the DeZog text itself (`conditionDialect: "dezog"`).
 */

/** The Klive text of a parsed DeZog expression. */
export function printDezogTree(node: SyntaxNode): string {
  switch (node.k) {
    case "num":
      return node.v > 9 ? `$${node.v.toString(16).toUpperCase()}` : `${node.v}`;
    case "name":
      return node.quoted ? `\`${node.name}\`` : node.name.toUpperCase();
    case "mem":
      return `${node.access.width === 1 ? "b" : node.access.width === 2 ? "w" : "l"}[${printDezogTree(node.addr)}]`;
    case "machine":
      return `${node.fn}()`;
    case "call":
      return `${node.fn}(${printDezogTree(node.arg)})`;
    case "un":
      return `${node.op}${wrapUnary(node.e)}`;
    case "bin":
      return `(${printDezogTree(node.l)} ${node.op} ${printDezogTree(node.r)})`;
    case "str":
      return JSON.stringify(node.text);
    default:
      return "?";
  }
}

function wrapUnary(node: SyntaxNode): string {
  const text = printDezogTree(node);
  return node.k === "un" ? `(${text})` : text;
}

/**
 * The Klive reading of a DeZog expression text, without the outermost parentheses; the text itself
 * when it does not parse (the build already warned about it).
 */
export function kliveConditionText(dezogText: string): string {
  try {
    const printed = printDezogTree(parseDezogExpression(dezogText));
    return printed.startsWith("(") && matchingClose(printed) === printed.length - 1
      ? printed.substring(1, printed.length - 1)
      : printed;
  } catch {
    return dezogText;
  }
}

function matchingClose(text: string): number {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")" && --depth === 0) return i;
  }
  return -1;
}
