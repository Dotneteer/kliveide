import type { PartitionInfo, PartitionKind, PartitionRole } from "@common/annotations/partitionInfo";
import type { MessageKey } from "@common/i18n/keys.generated";
import type { TFunction } from "@common/i18n/useT";

/*
 * The words the frame shows for a partition's facts, translated at display (D7): the model in
 * `@common/annotations/partitionInfo` carries only ids.
 */

const KIND_KEYS: Record<PartitionKind, MessageKey> = {
  rom: "panels.memoryMap.kind.rom",
  ram: "panels.memoryMap.kind.ram",
  cardRam: "panels.memoryMap.kind.cardRam",
  flash: "panels.memoryMap.kind.flash",
  eprom: "panels.memoryMap.kind.eprom",
  divRom: "panels.memoryMap.kind.divRom",
  divRam: "panels.memoryMap.kind.divRam",
  empty: "panels.memoryMap.kind.empty",
  mirror: "panels.memoryMap.kind.mirror"
};

const ROLE_KEYS: Record<PartitionRole, MessageKey> = {
  ulaScreen: "panels.memoryMap.role.ulaScreen",
  shadowScreen: "panels.memoryMap.role.shadowScreen",
  layer2: "panels.memoryMap.role.layer2",
  layer2Shadow: "panels.memoryMap.role.layer2Shadow",
  tilemap: "panels.memoryMap.role.tilemap"
};

export const kindText = (t: TFunction, kind: PartitionKind) => t(KIND_KEYS[kind]);
export const roleText = (t: TFunction, role: PartitionRole) => t(ROLE_KEYS[role]);

/** A size as `8K` / `16K` / `512K` / `1M` */
export function sizeText(bytes: number): string {
  if (bytes >= 0x100000 && bytes % 0x100000 === 0) return `${bytes / 0x100000}M`;
  return `${Math.round(bytes / 1024)}K`;
}

/** What the partition is, in one line: a card's note, a mirror's source, a page's 16K bank */
export function partitionNote(
  t: TFunction,
  p: PartitionInfo,
  labelOf: (id: number) => string | undefined
): string | undefined {
  if (p.kind === "mirror" && p.mirrorOf !== undefined) {
    return t("panels.memoryMap.note.mirror", { bank: labelOf(p.mirrorOf) ?? String(p.mirrorOf) });
  }
  if (p.card) {
    if (p.card.kind === "empty") return t("panels.memoryMap.note.emptySlot", { slot: p.card.slot });
    if (p.card.internal) {
      return p.id >= 0x20
        ? t("panels.memoryMap.note.internalRam", { size: sizeText(p.card.sizeInBytes) })
        : t("panels.memoryMap.note.slot0Rom", { kind: kindText(t, p.card.kind), size: sizeText(p.card.sizeInBytes) });
    }
    return t("panels.memoryMap.note.card", {
      kind: kindText(t, p.card.kind),
      size: sizeText(p.card.sizeInBytes),
      slot: p.card.slot
    });
  }
  if (p.bank16) {
    return p.bank16.half === 0
      ? t("panels.memoryMap.note.bankLow", { bank: p.bank16.bank })
      : t("panels.memoryMap.note.bankHigh", { bank: p.bank16.bank });
  }
  return undefined;
}

/** The caption of a Z88 slot block */
export function slotCaption(t: TFunction, slot: number, partitions: Map<number, PartitionInfo>): string {
  const first = partitions.get(slot * 0x40) ?? partitions.get(slot * 0x40 + 0x3f);
  const card = first?.card;
  if (slot === 0) return t("panels.memoryMap.slot.zero", { size: card ? sizeText(card.sizeInBytes) : "—" });
  if (!card || card.kind === "empty") return t("panels.memoryMap.slot.empty", { slot });
  return t("panels.memoryMap.slot.card", { slot, kind: kindText(t, card.kind), size: sizeText(card.sizeInBytes) });
}
