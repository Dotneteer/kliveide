import { CardIds } from "@emu/machines/z88/memory/CardIds";
import type { CardSlotState } from "@emu/machines/z88/memory/CardSlotState";
import type { IMachineController } from "@renderer/abstractions/IMachineController";
import type { IZ88Machine } from "@renderer/abstractions/IZ88Machine";
import type { AppState } from "@common/state/AppState";
import type { Store } from "@common/state/redux-light";
import { setMachineConfigAction } from "@common/state/actions";

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
  label: string;
  size: number;
  getFile: boolean;
  allowInSlot0?: boolean;
  fallback?: { size: number; type: CardIds }[];
  noUi?: boolean;
};

export const cardTypes: CardTypeData[] = [
  {
    value: CardIds.ANYROM,
    label: "ROM",
    size: 1024,
    getFile: false,
    allowInSlot0: false,
    noUi: true
  },
  {
    value: CardIds.RAM32,
    label: "RAM*32K",
    size: 32,
    getFile: false,
    allowInSlot0: false
  },
  {
    value: CardIds.RAM128,
    label: "RAM*128K",
    size: 128,
    getFile: false,
    allowInSlot0: false
  },
  {
    value: CardIds.RAM256,
    label: "RAM*256K",
    size: 256,
    getFile: false,
    allowInSlot0: false
  },
  {
    value: CardIds.RAM512,
    label: "RAM*512K",
    size: 512,
    getFile: false,
    allowInSlot0: false
  },
  {
    value: CardIds.RAM1024,
    label: "RAM*1M",
    size: 1024,
    getFile: false,
    allowInSlot0: false
  },
  {
    value: CardIds.EPROMUV32,
    label: "EPROM UV*32K",
    size: 32,
    getFile: true,
    allowInSlot0: true,
    fallback: epromTypeFallback
  },
  {
    value: CardIds.EPROMUV128,
    label: "EPROM UV*128K",
    size: 128,
    getFile: true,
    allowInSlot0: true,
    fallback: epromTypeFallback
  },
  {
    value: CardIds.EPROMUV256,
    label: "EPROM UV*256K",
    size: 256,
    getFile: true,
    allowInSlot0: true,
    fallback: epromTypeFallback
  },
  {
    value: CardIds.IF28F004S5,
    label: "Intel Flash 28F004S5*512K",
    size: 512,
    getFile: true,
    allowInSlot0: true,
    fallback: intelFlashTypeFallback
  },
  {
    value: CardIds.IF28F008S5,
    label: "Intel Flash 28F008S5*1M",
    size: 1024,
    getFile: true,
    fallback: intelFlashTypeFallback
  },
  {
    value: CardIds.AMDF29F040B,
    label: "AMD Flash 29F040B*512K",
    size: 512,
    getFile: true,
    allowInSlot0: true,
    fallback: amdFlashTypeFallback
  },
  {
    value: CardIds.AMDF29F080B,
    label: "AMD Flash 29F080B*1M",
    size: 512,
    getFile: true,
    fallback: amdFlashTypeFallback
  }
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

  const machine = controller.machine as IZ88Machine;
  machine.dynamicConfig = newConfig;
  await machine.configure();
}
