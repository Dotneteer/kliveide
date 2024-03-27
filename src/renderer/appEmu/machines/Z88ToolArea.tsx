import { Icon } from "@renderer/controls/Icon";
import styles from "./Z88ToolArea.module.scss";
import classnames from "@renderer/utils/classnames";
import {
  MC_Z88_INTRAM,
  MC_Z88_INTROM,
  MC_Z88_SLOT0,
  MC_Z88_SLOT1,
  MC_Z88_SLOT2,
  MC_Z88_SLOT3,
  MC_Z88_USE_DEFAULT_ROM
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
import { IMachineController } from "@renderer/abstractions/IMachineController";
import { IZ88Machine } from "@renderer/abstractions/IZ88Machine";
import { AppState } from "@common/state/AppState";
import { Store } from "@common/state/redux-light";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { Z88CardsState } from "../dialogs/Z88CardsDialog";
import { CardSlotState } from "@emu/machines/z88/memory/CardSlotState";
import { CardIds } from "@emu/machines/z88/memory/CardIds";
import { CardType } from "@emu/machines/z88/memory/CardType";

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
    value: CardIds.AMIC29F040B,
    label: "AMIC Flash 29F040B*512K",
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
  const { machineService } = useAppServices();
  const machine = machineService.getMachineController().machine as IZ88Machine;
  const currentRomSize =
    machine?.getMachineProperty(MC_Z88_INTROM) ?? "(unknown)";
  const useDefaultRom = machine?.getMachineProperty(MC_Z88_USE_DEFAULT_ROM);
  const slotDetails = (
    slotState: CardSlotState,
    defRom?: string,
    currentRomSize?: number
  ) => {
    const empty = {
      size: currentRomSize
        ? `${Math.floor(currentRomSize / 1024)}K`
        : "(empty)",
      type: defRom ?? "",
      isPristine: false
    };
    if (!slotState || slotState.cardType === "-") return empty;
    const type = cardTypes.find(ct => ct.value === slotState.cardType);
    if (!type) {
      return {
        size: slotState.size.toString() + "K",
        type: "System default",
        isPristine: false
      };
    }
    const parts = type.label.split("*");
    return {
      size: parts?.[1] ?? slotState.size + "K" ?? "(empty)",
      type:
        (parts?.[0] ?? "") === CardIds.ANYROM
          ? `ROM ${slotState.file}`
          : parts?.[0],
      isPristine: slotState.pristine
    };
  };

  const ramSizeMask = config?.[MC_Z88_INTRAM];
  const ramSize =
    ramSizeMask === 0x01 ? "32K" : ramSizeMask === 0x07 ? "128K" : "512K";
  const defROM = config?.[MC_Z88_INTROM];
  const slot0 = slotDetails(
    config?.[MC_Z88_SLOT0] as CardSlotState,
    defROM,
    currentRomSize as number
  );
  const slot1 = slotDetails(config?.[MC_Z88_SLOT1] as CardSlotState);
  const slot2 = slotDetails(config?.[MC_Z88_SLOT2] as CardSlotState);
  const slot3 = slotDetails(config?.[MC_Z88_SLOT3] as CardSlotState);
  return (
    <div className={styles.machineTools}>
      <Slot0Display
        sizeRam={ramSize}
        sizeRom={slot0?.size}
        typeRom={slot0?.type}
        isPristine={slot0?.isPristine}
        useDefaultRom={!!useDefaultRom}
      />
      <SlotDisplay
        slot={1}
        size={slot1?.size}
        type={slot1?.type}
        isPristine={slot1?.isPristine}
      />
      <SlotDisplay
        slot={2}
        size={slot2?.size}
        type={slot2?.type}
        isPristine={slot2?.isPristine}
      />
      <SlotDisplay
        slot={3}
        size={slot3?.size}
        type={slot3?.type}
        isPristine={slot3?.isPristine}
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
  const { machineService } = useAppServices();
  const machine = machineService.getMachineController().machine as IZ88Machine;
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
          onClick={async () => {
            machine.signalFlapOpened();
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
  sizeRam: string;
  sizeRom: string;
  typeRom: string;
  isPristine?: boolean;
  useDefaultRom?: boolean;
};

const Slot0Display = ({
  sizeRom,
  sizeRam,
  typeRom,
  isPristine,
  useDefaultRom
}: Slot0DisplayProps) => {
  const { store } = useRendererContext();
  const isEmpty = !typeRom || typeRom === "-";
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
          onClick={() => {
            store.dispatch(displayDialogAction(Z88_REMOVE_CARD_DIALOG, 0));
          }}
        >
          {!isEmpty && !useDefaultRom && <Icon iconName='@eject' width={14} height={14} />}
        </div>
        <div
          className={styles.button}
          onClick={e => {
            store.dispatch(displayDialogAction(Z88_INSERT_CARD_DIALOG, 0));
          }}
        >
          <Icon
            iconName={isEmpty ? "@upload" : "@replace"}
            width={14}
            height={14}
          />
        </div>
      </div>
    </div>
  );
};

export async function applyCardStateChange (
  store: Store<AppState>,
  controller: IMachineController,
  slot: keyof Z88CardsState,
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
