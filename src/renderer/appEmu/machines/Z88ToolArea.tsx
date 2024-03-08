import { Icon } from "@renderer/controls/Icon";
import styles from "./Z88ToolArea.module.scss";
import classnames from "@renderer/utils/classnames";
import {
  MC_Z88_SLOT1,
  MC_Z88_SLOT2,
  MC_Z88_SLOT3
} from "@common/machines/constants";
import { useRendererContext, useSelector } from "@renderer/core/RendererProvider";
import { SpaceFiller } from "@renderer/controls/SpaceFiller";
import { displayDialogAction } from "@common/state/actions";
import { Z88_INSERT_CARD_DIALOG, Z88_REMOVE_CARD_DIALOG } from "@common/messaging/dialog-ids";

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
  AMDF29F080B = "AMDF29F080B",
}

export const epromTypeFallback = [
  { size: 32, type: CardIds.EPROMUV32 },
  { size: 128, type: CardIds.EPROMUV128 },
  { size: 256, type: CardIds.EPROMUV256 }
]

export const intelFlashTypeFallback = [
  { size: 512, type: CardIds.IF28F004S5 },
  { size: 1024, type: CardIds.IF28F008S5 }
]

export const amdFlashTypeFallback = [
  { size: 512, type: CardIds.AMDF29F040B },
  { size: 1024, type: CardIds.AMDF29F080B }
]

export type CardTypeData = {
  value: CardIds;
  label: string;
  size: number;
  getFile: boolean;
  allowInSlot0?: boolean;
};

export const cardTypes: CardTypeData[] = [
  {
    value: CardIds.RAM32,
    label: "RAM*32K",
    size: 32,
    getFile: false,
    allowInSlot0: true,
  },
  {
    value: CardIds.RAM128,
    label: "RAM*128K",
    size: 128,
    getFile: false,
    allowInSlot0: true,
  },
  {
    value: CardIds.RAM256,
    label: "RAM*256K",
    size: 256,
    getFile: false,
    allowInSlot0: true,
  },
  {
    value: CardIds.RAM512,
    label: "RAM*512K",
    size: 512,
    getFile: false,
  },
  {
    value: CardIds.RAM1024,
    label: "RAM*1M",
    size: 1024,
    getFile: false,
  },
  {
    value: CardIds.EPROMUV32,
    label: "EPROM UV*32K",
    size: 32,
    getFile: true,
    allowInSlot0: true,
  },
  {
    value: CardIds.EPROMUV128,
    label: "EPROM UV*128K",
    size: 128,
    getFile: true,
    allowInSlot0: true,
  },
  {
    value: CardIds.EPROMUV256,
    label: "EPROM UV*256K",
    size: 256,
    getFile: true,
    allowInSlot0: true,
  },
  {
    value: CardIds.IF28F004S5,
    label: "Intel Flash 28F004S5*512K",
    size: 512,
    getFile: true,
    allowInSlot0: true,
  },
  {
    value: CardIds.IF28F008S5,
    label: "Intel Flash 28F008S5*1M",
    size: 1024,
    getFile: true,
  },
  {
    value: CardIds.AMDF29F040B,
    label: "AMD Flash 29F040B*512K",
    size: 512,
    getFile: true,
    allowInSlot0: true,
  },
  {
    value: CardIds.AMDF29F080B,
    label: "AMD Flash 29F080B*1M",
    size: 512,
    getFile: true,
  },
];

export const Z88ToolArea = () => {
  const config = useSelector(s => s.emulatorState.config);
  const slot1 = config?.[MC_Z88_SLOT1];
  const slot2 = config?.[MC_Z88_SLOT2];
  const slot3 = config?.[MC_Z88_SLOT3];

  return (
    <div className={styles.machineTools}>
      <Slot0Display
        sizeRam='512K'
        sizeRom='512K'
        typeRom='AMD Flash 29F040B'
        isPristine={true}
      />
      <SlotDisplay slot={1} size='512K' type='Intel Flash 28F004S5' />
      <SlotDisplay slot={2} size='(empty)' />
      <SlotDisplay slot={3} size='512K' type='EPROM' isPristine={true} />
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
  return (
    <div className={styles.slotHandler}>
      <div className={styles.row}>
        <span>Slot {slot}: </span>
        <span className={styles.slotInfo}>&nbsp;{size}</span>
        <SpaceFiller />
        {isPristine && <Icon iconName='@asterisk' width={12} height={12} />}
        {!isPristine && <div style={{ width: 12, height: 12 }} />}
        <div className={styles.button} onClick={() => {
          store.dispatch(displayDialogAction(Z88_INSERT_CARD_DIALOG, slot))
        }}>
          <Icon
            iconName={slot % 2 ? "@eject" : "@upload"}
            width={16}
            height={16}
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
  sizeRom: string;
  typeRom: string;
  sizeRam: string;
  isPristine?: boolean;
};

const Slot0Display = ({
  sizeRom,
  sizeRam,
  typeRom,
  isPristine
}: Slot0DisplayProps) => {
  const { store } = useRendererContext();
  return (
    <div className={classnames(styles.slotHandler)}>
      <div className={styles.row}>
        <span>Slot 0: </span>
        <span className={styles.slotInfo}>&nbsp;{sizeRam} RAM</span>
        <SpaceFiller />
        {isPristine && <Icon iconName='@asterisk' width={12} height={12} />}
        {!isPristine && <div style={{ width: 12, height: 12 }} />}
        <div className={styles.button} onClick={() => {
          store.dispatch(displayDialogAction(Z88_INSERT_CARD_DIALOG, 0))
        }}>
          <Icon iconName='@eject' width={16} height={16} />
        </div>
      </div>
      <div className={styles.row}>
        <span className={styles.slotInfo}>{sizeRom}</span>
        <span className={styles.slotInfo}>&nbsp;{typeRom}</span>
      </div>
    </div>
  );
};
