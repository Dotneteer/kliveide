import { CardIds } from "@emu/machines/z88/CardIds";
import type { CardSlotState } from "@emu/machines/z88/CardSlotState";
import type { IMachineController } from "@renderer/abstractions/IMachineController";
import type { IZ88Machine } from "@renderer/abstractions/IZ88Machine";
import type { AppState } from "@common/state/AppState";
import type { Store } from "@common/state/redux-light";
import { setMachineConfigAction } from "@common/state/actions";
import { t } from "@common/i18n/i18n";
import type { MessageKey } from "@common/i18n/keys.generated";

/**
 * The key a card slot is stored under in the machine configuration.
 *
 * The old code wrote `keyof Z88CardsState` against a module that no longer
 * exists, so the constraint had silently degraded to `any`.
 */
export type Z88SlotKey = "slot0" | "slot1" | "slot2" | "slot3";

/**
 * The Z88 card catalogue and the one operation that writes a card into a
 * running machine.
 *
 * Split out of `Z88ToolArea.tsx` so the card dialogs' model layer — which is
 * plain data and pure rules, and runs in the headless test project — does not
 * have to import a React component to learn what a card is.
 */

const epromTypeFallback = [
  { size: 32, type: CardIds.EPROMUV32 },
  { size: 128, type: CardIds.EPROMUV128 },
  { size: 256, type: CardIds.EPROMUV256 }
];

const intelFlashTypeFallback = [
  { size: 512, type: CardIds.IF28F004S5 },
  { size: 1024, type: CardIds.IF28F008S5 }
];

const amdFlashTypeFallback = [
  { size: 512, type: CardIds.AMDF29F040B },
  { size: 1024, type: CardIds.AMDF29F080B }
];

export type CardTypeData = {
  value: CardIds;
  /** The card type's name, translated on each read (e.g. "RAM", "Intel Flash 28F004S5") */
  readonly typeName: string;
  /** The capacity as the tool area shows it ("32K", "1M"); units are invariant. None for ROM. */
  sizeLabel?: string;
  /**
   * The name and capacity joined by a "*" ("RAM*32K"), which the insert-card dialog reads as prose
   * by replacing the "*". Translated on each read, like `typeName`.
   */
  readonly label: string;
  size: number;
  getFile: boolean;
  allowInSlot0?: boolean;
  fallback?: { size: number; type: CardIds }[];
  noUi?: boolean;
};

/** The text-free description of a card type; `card()` adds the translating `typeName`/`label` */
type CardTypeSpec = Omit<CardTypeData, "typeName" | "label"> & {
  typeKey: MessageKey;
  /** Hardware part numbers that go into the name, never translated */
  typeArgs?: Record<string, string>;
};

function card(spec: CardTypeSpec): CardTypeData {
  const { typeKey, typeArgs, ...data } = spec;
  const result = { ...data } as CardTypeData;
  Object.defineProperty(result, "typeName", { enumerable: true, get: () => t(typeKey, typeArgs) });
  Object.defineProperty(result, "label", {
    enumerable: true,
    get: () => (data.sizeLabel ? `${t(typeKey, typeArgs)}*${data.sizeLabel}` : t(typeKey, typeArgs))
  });
  return result;
}

export const cardTypes: CardTypeData[] = [
  card({
    value: CardIds.ANYROM,
    typeKey: "emu.z88.card.rom",
    size: 1024,
    getFile: false,
    allowInSlot0: false,
    noUi: true
  }),
  card({
    value: CardIds.RAM32,
    typeKey: "emu.z88.card.ram",
    sizeLabel: "32K",
    size: 32,
    getFile: false,
    allowInSlot0: false
  }),
  card({
    value: CardIds.RAM128,
    typeKey: "emu.z88.card.ram",
    sizeLabel: "128K",
    size: 128,
    getFile: false,
    allowInSlot0: false
  }),
  card({
    value: CardIds.RAM256,
    typeKey: "emu.z88.card.ram",
    sizeLabel: "256K",
    size: 256,
    getFile: false,
    allowInSlot0: false
  }),
  card({
    value: CardIds.RAM512,
    typeKey: "emu.z88.card.ram",
    sizeLabel: "512K",
    size: 512,
    getFile: false,
    allowInSlot0: false
  }),
  card({
    value: CardIds.RAM1024,
    typeKey: "emu.z88.card.ram",
    sizeLabel: "1M",
    size: 1024,
    getFile: false,
    allowInSlot0: false
  }),
  card({
    value: CardIds.EPROMUV32,
    typeKey: "emu.z88.card.epromUv",
    sizeLabel: "32K",
    size: 32,
    getFile: true,
    allowInSlot0: true,
    fallback: epromTypeFallback
  }),
  card({
    value: CardIds.EPROMUV128,
    typeKey: "emu.z88.card.epromUv",
    sizeLabel: "128K",
    size: 128,
    getFile: true,
    allowInSlot0: true,
    fallback: epromTypeFallback
  }),
  card({
    value: CardIds.EPROMUV256,
    typeKey: "emu.z88.card.epromUv",
    sizeLabel: "256K",
    size: 256,
    getFile: true,
    allowInSlot0: true,
    fallback: epromTypeFallback
  }),
  card({
    value: CardIds.IF28F004S5,
    typeKey: "emu.z88.card.intelFlash",
    typeArgs: { chip: "28F004S5" },
    sizeLabel: "512K",
    size: 512,
    getFile: true,
    allowInSlot0: true,
    fallback: intelFlashTypeFallback
  }),
  card({
    value: CardIds.IF28F008S5,
    typeKey: "emu.z88.card.intelFlash",
    typeArgs: { chip: "28F008S5" },
    sizeLabel: "1M",
    size: 1024,
    getFile: true,
    fallback: intelFlashTypeFallback
  }),
  card({
    value: CardIds.AMDF29F040B,
    typeKey: "emu.z88.card.amdFlash",
    typeArgs: { chip: "29F040B" },
    sizeLabel: "512K",
    size: 512,
    getFile: true,
    allowInSlot0: true,
    fallback: amdFlashTypeFallback
  }),
  card({
    value: CardIds.AMDF29F080B,
    typeKey: "emu.z88.card.amdFlash",
    typeArgs: { chip: "29F080B" },
    sizeLabel: "1M",
    size: 512,
    getFile: true,
    fallback: amdFlashTypeFallback
  })
];

export async function applyCardStateChange (
  store: Store<AppState>,
  controller: IMachineController,
  slot: Z88SlotKey,
  cardState: CardSlotState
): Promise<void> {
  // --- Save the new change
  const machineConfig = store.getState().emulatorState.config ?? {};
  const newConfig = { ...machineConfig, [slot]: cardState };
  store.dispatch(setMachineConfigAction(newConfig), "emu");

  // --- A card change acts on the present: in the past the muted journal would drop it
  // --- (REVERSE_DEBUGGING_PLAN D12)
  controller.clearHistoryCursor?.();
  const machine = controller.machine as IZ88Machine;
  machine.dynamicConfig = newConfig;
  await machine.configure();
}
