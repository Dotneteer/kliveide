/**
 * Sizing for the bank-label column that `PartitionPrefix` draws.
 *
 * Shared by the disassembly and memory panels, which both list rows whose bank label varies from
 * row to row and which both draw a background — a zebra stripe and a hover highlight — across the
 * whole row.
 *
 * The column used to be sized per row: `PartitionPrefix` was rendered only where a row *had* a
 * label, at a width taken from that row's own label. Two ways for a list to come out ragged:
 *
 *   - In a full 64K view the label is `mem64kLabels[address >> 13]`, so a bank with no label
 *     dropped the cell entirely. That shortens the row *and* shifts every column after it, so the
 *     addresses and hex bytes stop lining up between rows.
 *   - In a decimal view a hex label is rewritten to a 3-character decimal while a non-hex one
 *     ("R0") keeps its 2 characters, so one list could carry both widths.
 *
 * Deriving one width for the whole list fixes both. It costs nothing to compute: the candidate
 * labels are known up front — the eight `mem64kLabels` in a full view, or the single label of the
 * current segment otherwise — so unlike a comment column there is no pass over the rows.
 */

/**
 * Whether a bank label renders as a 3-character decimal rather than a 2-character hex one.
 *
 * The rule lives here so a row (which formats its label) and its panel (which sizes the column they
 * all share) cannot disagree about it.
 *
 * Note that this is narrower than "decimal view": `parseInt` must actually accept the label as hex.
 * A ROM label such as `"R0"` yields `NaN`, keeps its raw form, and stays 2 characters wide.
 * @param label The raw bank label
 * @param decimalView Whether the panel is showing decimal values
 * @param showBanks Whether the machine exposes banks at all
 */
export function isWidePartitionLabel(
  label: string | undefined,
  decimalView: boolean,
  showBanks: boolean
): boolean {
  return !!(showBanks && label && decimalView && !isNaN(parseInt(label, 16)));
}

/**
 * Characters the bank-label column occupies, shared by every row, or 0 when there is no column.
 *
 * 0 is not merely "narrow": the caller omits the cell entirely, so a listing with no banks renders
 * exactly as it did before the column was shared.
 * @param candidateLabels Every label any row in the list can show
 * @param decimalView Whether the panel is showing decimal values
 * @param enabled Whether the panel shows bank labels at all
 */
export function derivePartitionWidthCh({
  candidateLabels,
  decimalView,
  enabled
}: {
  candidateLabels: readonly (string | undefined)[];
  decimalView: boolean;
  enabled: boolean;
}): number {
  if (!enabled) return 0;
  // --- Nothing anywhere in the list to label, so there is no column to hold open.
  if (!candidateLabels.some((label) => !!label)) return 0;
  return candidateLabels.some((label) => isWidePartitionLabel(label, decimalView, true)) ? 3 : 2;
}
