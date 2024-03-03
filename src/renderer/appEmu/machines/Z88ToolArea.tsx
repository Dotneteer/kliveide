import { Icon } from "@renderer/controls/Icon";
import styles from "./Z88ToolArea.module.scss";
import classnames from "@renderer/utils/classnames";
import { MC_Z88_SLOT1, MC_Z88_SLOT2, MC_Z88_SLOT3 } from "@common/machines/constants";
import { useSelector } from "@renderer/core/RendererProvider";
import { CT_AMD_FLASH, CT_EPROM, CT_INTEL_FLASH, CT_RAM } from "@emu/machines/z88/memory/CardType";

export const cardTypes = [
  { value: CT_EPROM, label: "EPROM", getFile: true, acceptedSizes: ["32K", "128K"] },
  { value: CT_EPROM + "*", label: "EPROM", pristine: true, acceptedSizes: ["32K", "128K"] },
  { value: CT_RAM, label: "Intel FC", acceptedSizes: ["32K", "128K", "512K", "1M"] },
  { value: CT_INTEL_FLASH, label: "Intel FC", getFile: true, acceptedSizes: ["512K", "1M"] },
  { value: CT_INTEL_FLASH + "*", label: "Intel FC", pritstine: true, acceptedSizes: ["512K", "1M"] },
  { value: CT_AMD_FLASH, label: "AMD FC", getFile: true, acceptedSizes: ["512K", "1M"] },
  { value: CT_AMD_FLASH + "*", label: "AMD FC", pritstine: true, acceptedSizes: ["512K", "1M"] },
]

export const Z88ToolArea = () => {
  const config = useSelector(s => s.emulatorState.config);
  const slot1 = config?.[MC_Z88_SLOT1];
  const slot2 = config?.[MC_Z88_SLOT2];
  const slot3 = config?.[MC_Z88_SLOT3];

  return (
    <div className={styles.machineTools}>
      <Slot0Display sizeRam="512K" sizeRom="512K" />
      <SlotDisplay slot={1} size={slot1.size} type={slot1.content} />
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
  return (
    <div className={styles.slotHandler}>
      <span>{slot}:</span>
      <span className={styles.slotInfo}>
        {size} {type}
      </span>
      {isPristine && <Icon iconName='@asterisk' width={12} height={12} />}
      {!isPristine && <div style={{ width: 12, height: 12 }} />}
      <div className={styles.button}>
        <Icon
          iconName={slot % 2 ? "@eject" : "@upload"}
          width={16}
          height={16}
        />
      </div>
    </div>
  );
};

type Slot0DisplayProps = {
  sizeRom?: string;
  sizeRam?: string;
};

const Slot0Display = ({sizeRom, sizeRam }: Slot0DisplayProps) => {
  return (
    <div className={styles.slotHandler}>
      <span>0:</span>
      <span className={classnames(styles.slotInfo, styles.slot0Info)}>
        {sizeRom} ROM | {sizeRam} RAM
      </span>
    </div>
  );
};

