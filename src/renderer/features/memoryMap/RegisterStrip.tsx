import { useState } from "react";

import { useT } from "@common/i18n/useT";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";
import { flagsText, PRIMARY_REGISTERS, SECONDARY_REGISTERS } from "./memoryMapModel";
import styles from "./MemoryMap.module.scss";

/*
 * The register strip (`dev/plans/MEMORY_DISASSEMBLY_VIEWS_PLAN.md` §4.4): a chip for each register
 * that holds an address, its value and the partition it points into; a click goes there. The
 * alternate set, IR and WZ sit behind `⋯`. The Disassembly view adds the flags chip, since its
 * verdicts are judged against it.
 */

type RegisterStripProps = {
  registers: Record<string, number> | undefined;
  /** The partition label an address is in now */
  partitionLabelAt: (address: number) => string | undefined;
  /** The register the view follows, drawn pressed */
  followed?: string;
  /** F, for the flags chip */
  flags?: number;
  decimal?: boolean;
  onGoTo: (register: string, address: number) => void;
};

export const RegisterStrip = ({
  registers,
  partitionLabelAt,
  followed,
  flags,
  decimal,
  onGoTo
}: RegisterStripProps) => {
  const t = useT();
  const [more, setMore] = useState(false);
  if (!registers) return null;
  const names = more ? [...PRIMARY_REGISTERS, ...SECONDARY_REGISTERS] : PRIMARY_REGISTERS;
  return (
    <div className={styles.chips} role="group" aria-label={t("panels.memoryMap.registers")}>
      {names.map((name) => {
        const value = registers[name];
        if (value === undefined) return null;
        const part = partitionLabelAt(value);
        return (
          <button
            key={name}
            type="button"
            className={styles.regChip}
            aria-pressed={followed === name}
            title={t("panels.memoryMap.registerGoTo", { register: name })}
            onClick={() => onGoTo(name, value)}
          >
            <span className={styles.regName}>{name}</span>
            <span className={styles.regValue}>{decimal ? value : `$${toHexa4(value)}`}</span>
            {part && <span className={styles.regPart}>{part}</span>}
          </button>
        );
      })}
      {flags !== undefined && (
        <span className={styles.regChip} title={t("panels.memoryMap.flagsTitle")}>
          <span className={styles.regName}>F</span>
          <span className={styles.regValue}>{flagsText(flags)}</span>
        </span>
      )}
      <button
        type="button"
        className={styles.chip}
        title={more ? t("panels.memoryMap.fewerRegisters") : t("panels.memoryMap.moreRegisters")}
        aria-expanded={more}
        onClick={() => setMore((m) => !m)}
      >
        {more ? "‹" : "⋯"}
      </button>
    </div>
  );
};
