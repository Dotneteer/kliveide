import type { DisassemblyItem } from "../disassemblers/common-types";

/*
 * The live Disassembly view's reference counts (`dev/plans/MEMORY_DISASSEMBLY_VIEWS_PLAN.md` §6.1):
 * the rows of the listing whose operands print a label's name, by name.
 *
 * The rule is "Go to References"'s (`annotations/labelReferences.ts`): a reference is found the way
 * the listing printed it, so the count is exactly the rows on which the reader sees the name. That
 * module asks one bank's annotations which label an operand names; the 64K listing spans banks,
 * ROM pages and the build's symbols, so here the printed name itself is the key - the same rows,
 * for every kind of label the shared resolver prints.
 */

/** The name a row's label column prints, without its colon */
export function rowLabelName(item: DisassemblyItem): string | undefined {
  const label = item.formattedLabel;
  return label ? label.replace(/:$/, "") : undefined;
}

/**
 * Every printed label name and the rows naming it, in listing order, each row once per name.
 * Rule rows (separators) and synopsis lines name nothing.
 */
export function printedReferences(items: readonly DisassemblyItem[]): Map<string, number[]> {
  const result = new Map<string, number[]>();
  items.forEach((item, index) => {
    if (item.separator || item.prefixComment !== undefined) return;
    const seen = new Set<string>();
    for (const operand of item.operandCandidates ?? []) {
      const name = operand.resolvedText;
      if (!name || seen.has(name)) continue;
      seen.add(name);
      const rows = result.get(name);
      if (rows) rows.push(index);
      else result.set(name, [index]);
    }
  });
  return result;
}
