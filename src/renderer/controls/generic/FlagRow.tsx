import styles from "./GeneralControls.module.scss";
import { BitValue } from "../valuedisplay/Values";

type Props = {
  flagDescriptions: string[];
  value: number;
};

export const FlagRow = ({ value, flagDescriptions }: Props) => {
  return (
    <div className={styles.dumpSection}>
      <BitValue value={value & 0x80} tooltip={`Bit 7: ${flagDescriptions?.[7] ?? ""}`} />
      <BitValue value={value & 0x40} tooltip={`Bit 6: ${flagDescriptions?.[6] ?? ""}`} />
      <BitValue value={value & 0x20} tooltip={`Bit 5: ${flagDescriptions?.[5] ?? ""}`} />
      <BitValue value={value & 0x10} tooltip={`Bit 4: ${flagDescriptions?.[4] ?? ""}`} />
      <BitValue value={value & 0x08} tooltip={`Bit 3: ${flagDescriptions?.[3] ?? ""}`} />
      <BitValue value={value & 0x04} tooltip={`Bit 2: ${flagDescriptions?.[2] ?? ""}`} />
      <BitValue value={value & 0x02} tooltip={`Bit 1: ${flagDescriptions?.[1] ?? ""}`} />
      <BitValue value={value & 0x01} tooltip={`Bit 0: ${flagDescriptions?.[0] ?? ""}`} />
    </div>
  );
};
