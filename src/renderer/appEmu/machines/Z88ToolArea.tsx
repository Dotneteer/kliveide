import { Icon } from "@renderer/controls/Icon";
import styles from "./Z88ToolArea.module.scss";
import classnames from "classnames";
import {
  MC_Z88_INTRAM,
  MC_Z88_INTROM,
  MC_Z88_SLOT0,
  MC_Z88_SLOT1,
  MC_Z88_SLOT2,
  MC_Z88_SLOT3,
  MC_Z88_USE_DEFAULT_ROM
} from "@common/machines/constants";
import { useSelector } from "@renderer/core/RendererProvider";
import { SpaceFiller } from "@renderer/controls/SpaceFiller";
import {
  Z88_CHANGE_RAM_DIALOG,
  Z88_EXPORT_CARD_DIALOG,
  Z88_INSERT_CARD_DIALOG,
  Z88_REMOVE_CARD_DIALOG
} from "@common/messaging/dialog-ids";
import { IZ88Machine } from "@renderer/abstractions/IZ88Machine";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { CardSlotState } from "@emu/machines/z88/CardSlotState";
import { CardIds } from "@emu/machines/z88/CardIds";
import { useDialogs } from "@renderer/controls/overlay/DialogProvider";
import {
  emuDialogRegistry,
  EmuDialogResult
} from "../dialogs/emuDialogRegistry";
import { cardTypes } from "./z88Cards";
import { useT } from "@common/i18n/useT";

export const Z88ToolArea = () => {
  const t = useT();
  const config = useSelector(s => s.emulatorState.config);
  const { machineService } = useAppServices();
  const dialogs = useDialogs();
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
        : t("emu.z88.slot.empty"),
      type: defRom ?? "",
      isPristine: false
    };
    if (!slotState || slotState.cardType === "-") return empty;
    const type = cardTypes.find(ct => ct.value === slotState.cardType);
    if (!type) {
      return {
        size: slotState.size.toString() + "K",
        type: t("emu.z88.slot.systemDefault"),
        isPristine: false
      };
    }
    return {
      size: type.sizeLabel ?? `${slotState.size}K`,
      type: type.value === CardIds.ANYROM ? t("emu.z88.slot.romFile", { file: slotState.file }) : type.typeName,
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

  const openEmuDialog = (dialogId: number, dialogData?: any): void => {
    const dialogRenderer = emuDialogRegistry[dialogId];
    if (!dialogRenderer) return;
    void dialogs.open<EmuDialogResult>((controls) => dialogRenderer(dialogData, controls));
  };

  return (
    <div className={styles.machineTools}>
      <Slot0Display
        sizeRam={ramSize}
        sizeRom={slot0?.size}
        typeRom={slot0?.type}
        isPristine={slot0?.isPristine}
        useDefaultRom={!!useDefaultRom}
        openDialog={openEmuDialog}
      />
      <SlotDisplay
        slot={1}
        size={slot1?.size}
        type={slot1?.type}
        isPristine={slot1?.isPristine}
        openDialog={openEmuDialog}
      />
      <SlotDisplay
        slot={2}
        size={slot2?.size}
        type={slot2?.type}
        isPristine={slot2?.isPristine}
        openDialog={openEmuDialog}
      />
      <SlotDisplay
        slot={3}
        size={slot3?.size}
        type={slot3?.type}
        isPristine={slot3?.isPristine}
        openDialog={openEmuDialog}
      />
    </div>
  );
};

type SlotDisplayProps = {
  slot: number;
  size?: string;
  type?: string;
  isPristine?: boolean;
  openDialog: (dialogId: number, dialogData?: any) => void;
};

const SlotDisplay = ({ slot, size, type, isPristine, openDialog }: SlotDisplayProps) => {
  const t = useT();
  const { machineService } = useAppServices();
  const machine = machineService.getMachineController().machine as IZ88Machine;
  const isEmpty = !type;
  return (
    <div className={styles.slotHandler}>
      <div className={styles.row}>
        <span>{t("emu.z88.slot.title", { slot })} </span>
        <span className={styles.slotInfo}>&nbsp;{size}</span>
        <SpaceFiller />
        {isPristine && <Icon iconName='@asterisk' width={12} height={12} />}
        {!isEmpty && (
          <div
            className={styles.button}
            onClick={() => {
              openDialog(Z88_EXPORT_CARD_DIALOG, slot);
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
              openDialog(Z88_INSERT_CARD_DIALOG, slot);
            } else {
              openDialog(Z88_REMOVE_CARD_DIALOG, slot);
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
  openDialog: (dialogId: number, dialogData?: any) => void;
};

const Slot0Display = ({
  sizeRom,
  sizeRam,
  typeRom,
  isPristine,
  useDefaultRom,
  openDialog
}: Slot0DisplayProps) => {
  const t = useT();
  const isEmpty = !typeRom || typeRom === "-";
  return (
    <div className={classnames(styles.slotHandler, styles.slot0)}>
      <div className={styles.row}>
        <span>{t("emu.z88.slot.title", { slot: 0 })} </span>
        <span className={styles.slotInfo}>&nbsp;{t("emu.z88.slot.ram", { size: sizeRam })}</span>
        <SpaceFiller />
        <div
          className={styles.button}
          onClick={() => {
            openDialog(Z88_CHANGE_RAM_DIALOG);
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
            openDialog(Z88_REMOVE_CARD_DIALOG, 0);
          }}
        >
          {!isEmpty && !useDefaultRom && <Icon iconName='@eject' width={14} height={14} />}
        </div>
        <div
          className={styles.button}
          onClick={() => {
            openDialog(Z88_INSERT_CARD_DIALOG, 0);
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
