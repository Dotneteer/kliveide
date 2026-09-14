import type { MemoryPageInfo } from "@emu/machines/zxNext/MemoryDevice";

import { toHexa4 } from "@renderer/appIde/services/ide-commands";

/*
 * Where a 16K bank is in the Z80 address space *right now*.
 *
 * A popped-out NEX bank shows a 16K bank's bytes, and until this existed nothing on screen said
 * whether that bank was paged in at all, let alone where — so a breakpoint set in it appeared to do
 * nothing whenever the bank was not currently visible. That is the paging subtlety behind bank-
 * relative breakpoints (`.plans/NEX_DEBUGGING_PLAN.md` §4.6), and §11.2 is about making it visible
 * instead of surprising.
 *
 * The Next's MMU is eight independent 8K slots, so a 16K bank is **two** 8K pages and the hardware
 * does not require them to be adjacent, in order, or even both present. This module therefore
 * answers with a list of placements rather than an address, and the formatter spells out anything
 * that is not the ordinary contiguous case. A "half paged in" bank is not a hypothetical: it is what
 * `bankRelativeAddresses` arms eight addresses for.
 */

/** Which 8K half of a 16K bank a placement is. */
export type BankHalf = "low" | "high";

/** One 8K page currently holding one half of the bank. */
export type BankPlacement = {
  /** The 8K slot index, 0..7. */
  page: number;
  /** The Z80 address that slot starts at. */
  address: number;
  half: BankHalf;
};

/** The 8K page indices a 16K bank occupies when paged: `2B` is its low half, `2B+1` its high. */
export function bank16kPages(bank: number): [number, number] {
  return [bank * 2, bank * 2 + 1];
}

/**
 * Every 8K slot currently showing a half of `bank`, in slot order.
 *
 * Matched on `bank8k`, which is the MMU register's own value — the authoritative statement of what
 * a slot points at, and the convention Q9 settled on. `bank16k` is **not** usable here: on the
 * WASM Next it is filled from the partition index, which after Q9 is an 8K page, so the field's
 * name and its contents disagree.
 *
 * A slot only counts when it is writable. A ROM'd slot's MMU register still holds whatever was last
 * written to it, so matching on the register alone would report a RAM bank as visible at an address
 * where the ROM is — a worse answer than "not paged in", because the user would go looking there.
 */
export function locateBank16k(
  pageInfo: MemoryPageInfo[] | undefined,
  bank: number | undefined
): BankPlacement[] {
  if (!pageInfo || bank === undefined) return [];

  const [lowPage, highPage] = bank16kPages(bank);
  const placements: BankPlacement[] = [];
  pageInfo.forEach((page, pageIndex) => {
    if (!page || page.writeOffset === null || page.writeOffset === undefined) return;
    const half: BankHalf | undefined =
      page.bank8k === lowPage ? "low" : page.bank8k === highPage ? "high" : undefined;
    if (half === undefined) return;
    placements.push({ page: pageIndex, address: pageIndex * 0x2000, half });
  });
  return placements;
}

/**
 * True when the bank sits as one contiguous 16K block, the way ordinary paging leaves it.
 *
 * Both halves, in order, in an aligned slot pair — which is the only arrangement that can be
 * described by a single address.
 */
export function isContiguousPlacement(placements: BankPlacement[]): boolean {
  if (placements.length !== 2) return false;
  const [first, second] = placements;
  return (
    first.half === "low" &&
    second.half === "high" &&
    second.page === first.page + 1 &&
    first.page % 2 === 0
  );
}

/**
 * What the pop-out header says about the bank's whereabouts.
 *
 * `text` is for a chip in a crowded toolbar, so the common cases are short: an address when the bank
 * is contiguous, and "not paged in" when it is nowhere. Anything unusual is spelled out rather than
 * simplified away — a bank with only its low half visible, or its halves in two distant slots, is
 * exactly when the user needs to be told.
 *
 * `title` always says it in full, including which 8K slots are involved, because the slot numbers
 * are what the Memory Mapping panel and the MMU registers are indexed by.
 *
 * `pcOffset` — the program counter's offset in this bank, when it is in it — adds a `PC` marker and
 * a sentence. It belongs here rather than in a control of its own because "the program is executing
 * in this bank right now" is the most consequential thing the header can say, and because the
 * spotlight it announces is otherwise only discoverable by scrolling to it.
 *
 * @param placements from `locateBank16k`
 * @param pcOffset from `bankOffsetOfAddress`, or `undefined` when the PC is elsewhere or the
 *   machine is not paused
 */
export function formatBankLocation(
  placements: BankPlacement[],
  pcOffset?: number
): { text: string; title: string } {
  const pcText = pcOffset === undefined ? "" : " · PC";
  const pcTitle =
    pcOffset === undefined
      ? ""
      : ` The program counter is in this bank, at offset $${toHexa4(pcOffset)}; that line is ` +
        "highlighted in the disassembly.";

  if (placements.length === 0) {
    return {
      text: "not paged in",
      title:
        "This bank is not in the Z80 address space at the moment. A breakpoint in it stays armed " +
        "and will fire once the bank is paged in."
    };
  }

  if (isContiguousPlacement(placements)) {
    const start = placements[0].address;
    return {
      text: `at $${toHexa4(start)}${pcText}`,
      title:
        `This bank is paged in at $${toHexa4(start)}-$${toHexa4(start + 0x3fff)} ` +
        `(8K slots ${placements[0].page} and ${placements[1].page}).` +
        pcTitle
    };
  }

  const describe = (p: BankPlacement) => `$${toHexa4(p.address)} (${p.half})`;
  const halves = new Set(placements.map((p) => p.half));

  return {
    text: `${placements.map(describe).join(", ")}${pcText}`,
    title:
      (halves.size === 1
        ? `Only this bank's ${[...halves][0]} 8K half is paged in. `
        : "This bank's two 8K halves are not paged in as one contiguous block. ") +
      "Each 8K slot is listed with the address it starts at: " +
      placements
        .map((p) => `slot ${p.page} at $${toHexa4(p.address)} holds the ${p.half} half`)
        .join("; ") +
      "." +
      pcTitle
  };
}

/**
 * Where a Z80 address falls inside this bank, or `undefined` when it does not fall in it at all.
 *
 * The inverse of `locateBank16k`: that says which slots hold the bank, this asks whether one
 * particular address lands in one of them, and turns it into the bank-relative offset the popped-out
 * document is indexed by.
 *
 * The offset within an 8K slot *is* the offset within that half of the bank, so the only thing the
 * half decides is whether `0x2000` is added. That is the same arithmetic
 * `bankRelativeAddresses` inverts to arm a bank-relative breakpoint, from the other direction.
 *
 * @param placements from `locateBank16k`
 * @param address a Z80 address — the program counter, in the one case this exists for
 */
export function bankOffsetOfAddress(
  placements: BankPlacement[] | undefined,
  address: number | undefined
): number | undefined {
  if (!placements?.length || address === undefined) return undefined;

  const page = (address >> 13) & 0x07;
  // --- First match wins. The same half can legally be paged into two slots at once, but the
  // --- address is only in one of them, and that is the one whose page index matches.
  const placement = placements.find((p) => p.page === page);
  if (!placement) return undefined;

  return (placement.half === "high" ? 0x2000 : 0) + (address & 0x1fff);
}

/**
 * The row address a popped-out bank should spotlight, for `DisassemblyRow`'s `pausedPc` prop.
 *
 * Two things it exists to pin down. `disassOffset` is added because the pop-out's rows are numbered
 * by it — the offset dropdown decides whether this bank's byte 0 reads `$0000` or `$C000`, and the
 * row compares its own *displayed* address — so the mark follows the listing's numbering rather than
 * the machine's, and lands correctly even when the chosen offset is not where the bank actually is.
 *
 * And `-1` is the prop's "nowhere" value, which is why this is a function rather than
 * `disassOffset + (pcOffset ?? 0)`: that reads as an equivalent simplification and would spotlight
 * the first row of the listing every time the program counter was somewhere else entirely.
 */
export function pcSpotlightAddress(
  disassOffset: number,
  pcOffset: number | undefined
): number {
  return pcOffset === undefined ? -1 : disassOffset + pcOffset;
}
