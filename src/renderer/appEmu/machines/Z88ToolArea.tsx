import { Icon } from "@renderer/controls/Icon";
import styles from "./Z88ToolArea.module.scss";
import classnames from "@renderer/utils/classnames";
import {
  MC_Z88_INTRAM,
  MC_Z88_SLOT1,
  MC_Z88_SLOT2,
  MC_Z88_SLOT3
} from "@common/machines/constants";
import {
  useRendererContext,
  useSelector
} from "@renderer/core/RendererProvider";
import { SpaceFiller } from "@renderer/controls/SpaceFiller";
import {
  displayDialogAction,
  setMachineConfigAction
} from "@common/state/actions";
import {
  Z88_CHANGE_RAM_DIALOG,
  Z88_EXPORT_CARD_DIALOG,
  Z88_INSERT_CARD_DIALOG,
  Z88_REMOVE_CARD_DIALOG
} from "@common/messaging/dialog-ids";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { IMachineController } from "@renderer/abstractions/IMachineController";
import { IZ88Machine } from "@renderer/abstractions/IZ88Machine";
import { AppState } from "@common/state/AppState";
import { Store } from "@common/state/redux-light";
import { delay } from "@renderer/utils/timing";

export enum CardIds {
  RAM32 = "RAM32",
  RAM128 = "RAM128",
  RAM256 = "RAM256",
  RAM512 = "RAM512",
  RAM1024 = "RAM1024",
  EPROMUV32 = "EPROMUV32",
  EPROMUV128 = "EPROMUV128",
  EPROMUV256 = "EPROMUV256",
  IF28F004S5 = "IF28F004S5",
  IF28F008S5 = "IF28F008S5",
  AMDF29F040B = "AMDF29F040B",
  AMDF29F080B = "AMDF29F080B"
}

export const epromTypeFallback = [
  { size: 32, type: CardIds.EPROMUV32 },
  { size: 128, type: CardIds.EPROMUV128 },
  { size: 256, type: CardIds.EPROMUV256 }
];

export const intelFlashTypeFallback = [
  { size: 512, type: CardIds.IF28F004S5 },
  { size: 1024, type: CardIds.IF28F008S5 }
];

export const amdFlashTypeFallback = [
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
};

export const cardTypes: CardTypeData[] = [
  {
    value: CardIds.RAM32,
    label: "RAM*32K",
    size: 32,
    getFile: false,
    allowInSlot0: true
  },
  {
    value: CardIds.RAM128,
    label: "RAM*128K",
    size: 128,
    getFile: false,
    allowInSlot0: true
  },
  {
    value: CardIds.RAM256,
    label: "RAM*256K",
    size: 256,
    getFile: false,
    allowInSlot0: true
  },
  {
    value: CardIds.RAM512,
    label: "RAM*512K",
    size: 512,
    getFile: false
  },
  {
    value: CardIds.RAM1024,
    label: "RAM*1M",
    size: 1024,
    getFile: false
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

export const Z88ToolArea = () => {
  const config = useSelector(s => s.emulatorState.config);

  const slotDetails = (slotState: CardSlotState) => {
    const empty = {
      size: "(empty)",
      type: "",
      isPristine: false
    };
    if (!slotState || slotState.cardType === "-") return empty;
    const type = cardTypes.find(ct => ct.value === slotState.cardType);
    if (!type) return empty;
    const parts = type.label.split("*");
    return {
      size: parts?.[1] ?? "(empty)",
      type: parts?.[0] ?? "",
      isPristine: slotState.pristine
    };
  };

  const ramSizeMask = config?.[MC_Z88_INTRAM];
  console.log("RAM size mask: ", ramSizeMask);
  const ramSize = ramSizeMask === 0x01 ? "32K" : ramSizeMask === 0x07 ? "128K" : "512K";
  const slot1 = slotDetails(config?.[MC_Z88_SLOT1] as CardSlotState);
  const slot2 = slotDetails(config?.[MC_Z88_SLOT2] as CardSlotState);
  const slot3 = slotDetails(config?.[MC_Z88_SLOT3] as CardSlotState);

  return (
    <div className={styles.machineTools}>
      <Slot0Display
        ramSize={ramSize}
        romSize='512K'
        romType='AMD Flash 29F040B'
        isPristine={true}
      />
      <SlotDisplay
        slot={1}
        size={slot1.size}
        type={slot1.type}
        isPristine={slot1.isPristine}
      />
      <SlotDisplay
        slot={2}
        size={slot2.size}
        type={slot2.type}
        isPristine={slot2.isPristine}
      />
      <SlotDisplay
        slot={3}
        size={slot3.size}
        type={slot3.type}
        isPristine={slot3.isPristine}
      />
    </div>
  );
};

type SlotDisplayProps = {
  slot: number;
  size?: string;
  type?: string;
  isPristine?: boolean;
};

const SlotDisplay = ({ slot, size, type, isPristine }: SlotDisplayProps) => {
  const { store } = useRendererContext();
  const isEmpty = !type;
  return (
    <div className={styles.slotHandler}>
      <div className={styles.row}>
        <span>Slot {slot}: </span>
        <span className={styles.slotInfo}>&nbsp;{size}</span>
        <SpaceFiller />
        {isPristine && <Icon iconName='@asterisk' width={12} height={12} />}
        {!isEmpty && (
          <div
            className={styles.button}
            onClick={() => {
              store.dispatch(displayDialogAction(Z88_EXPORT_CARD_DIALOG, slot));
            }}
          >
            <Icon iconName={"@export"} width={14} height={14} />
          </div>
        )}
        <div
          className={styles.button}
          onClick={() => {
            if (isEmpty) {
              store.dispatch(displayDialogAction(Z88_INSERT_CARD_DIALOG, slot));
            } else {
              store.dispatch(displayDialogAction(Z88_REMOVE_CARD_DIALOG, slot));
            }
          }}
        >
          <Icon
            iconName={isEmpty ? "@upload" : "@eject"}
            width={14}
            height={14}
          />
        </div>
      </div>
      <div className={styles.row}>
        <span className={styles.slotInfo}>{type}</span>
      </div>
    </div>
  );
};

type Slot0DisplayProps = {
  ramSize: string;
  romSize: string;
  romType: string;
  isPristine?: boolean;
};

const Slot0Display = ({
  romSize: sizeRom,
  ramSize: sizeRam,
  romType: typeRom,
  isPristine
}: Slot0DisplayProps) => {
  const { store } = useRendererContext();
  return (
    <div className={classnames(styles.slotHandler, styles.slot0)}>
      <div className={styles.row}>
        <span>Slot 0: </span>
        <span className={styles.slotInfo}>&nbsp;{sizeRam} RAM</span>
        <SpaceFiller />
        <div
          className={styles.button}
          onClick={() => {
            store.dispatch(displayDialogAction(Z88_CHANGE_RAM_DIALOG));
          }}
        >
          <Icon iconName='@replace' width={14} height={14} />
        </div>
      </div>
      <div className={styles.row}>
        <span className={styles.slotInfo}>{sizeRom}</span>
        <span className={styles.slotInfo}>&nbsp;{typeRom}</span>
        <SpaceFiller />
        {isPristine && <Icon iconName='@asterisk' width={12} height={12} />}
        <div
          className={styles.button}
          onMouseDown={e => {
            if (e.button === 0) {
              store.dispatch(displayDialogAction(Z88_INSERT_CARD_DIALOG, 0));
            } else {
              store.dispatch(displayDialogAction(Z88_REMOVE_CARD_DIALOG, 0));
            }
          }}
        >
          <Icon iconName='@export' width={14} height={14} />
        </div>
        <div
          className={styles.button}
          onMouseDown={e => {
            if (e.button === 0) {
              store.dispatch(displayDialogAction(Z88_INSERT_CARD_DIALOG, 0));
            } else {
              store.dispatch(displayDialogAction(Z88_REMOVE_CARD_DIALOG, 0));
            }
          }}
        >
          <Icon iconName='@eject' width={14} height={14} />
        </div>
      </div>
    </div>
  );
};

/**
 * State of a particular slot
 */
export type CardSlotState = {
  size?: number;
  cardType: string;
  file?: string;
  pristine?: boolean;
};

/**
 * Represents the Z88 card states
 */
export type Z88CardsState = {
  slot1: CardSlotState;
  slot2: CardSlotState;
  slot3: CardSlotState;
};

export async function applyCardStateChange (
  store: Store<AppState>,
  controller: IMachineController,
  slot: keyof Z88CardsState,
  cardState: CardSlotState
): Promise<void> {
  // --- Save the new change
  const machineConfig = store.getState().emulatorState.config ?? {};
  store.dispatch(
    setMachineConfigAction({ ...machineConfig, [slot]: cardState }),
    "emu"
  );

  const machine = controller.machine as IZ88Machine;
  machine.dynamicConfig = cardState;
  if (controller.state === MachineControllerState.Running) {
    machine.signalFlapOpened();
    await delay(1000);
    await machine.configure();
    machine.signalFlapClosed();
  }
}
