import classnames from "classnames";
import { useT } from "@common/i18n/useT";
import styles from "./Ht1080zTapeViewer.module.scss";

/*
 * The HT-1080Z's 64K and what a file loads into it (`.plans/HT1080Z_TAPE_VIEWERS_PLAN.md` D5): the
 * ROM, the keyboard and video RAM, the system area, the RAM every model has and the RAM only the 48K
 * models have, with each part that loads drawn where it lands. A block past 7FFFh is visibly in the
 * 48K-only zone, which is what the "Fits" fact says in words.
 *
 * Like the timeline, it is for the eye: hidden from screen readers (the list says the same), not a
 * tab stop, and a click on a block selects its part.
 */

export type MemoryMapBlock = {
  index: number;
  from: number;
  /** Exclusive */
  to: number;
  kind: "code" | "basic";
  title: string;
};

type Zone = { from: number; to: number; tone: "rom" | "io" | "video" | "system" | "ram" | "ram48"; label?: string };

const ADDRESS_SPACE = 0x10000;
const AXIS = [0x0000, 0x3c00, 0x8000, 0x10000];
const hex4 = (value: number) => `$${Math.min(value, 0xffff).toString(16).toUpperCase().padStart(4, "0")}`;
const percent = (address: number) => `${(address / ADDRESS_SPACE) * 100}%`;

type Props = {
  blocks: MemoryMapBlock[];
  selectedIndex?: number;
  onSelect: (index: number) => void;
};

export const MemoryMapStrip = ({ blocks, selectedIndex, onSelect }: Props) => {
  const t = useT();
  const zones: Zone[] = [
    { from: 0x0000, to: 0x3000, tone: "rom", label: t("panels.htTape.map.rom") },
    { from: 0x3000, to: 0x3800, tone: "rom" },
    { from: 0x3800, to: 0x3c00, tone: "io" },
    { from: 0x3c00, to: 0x4000, tone: "video" },
    { from: 0x4000, to: 0x42e9, tone: "system" },
    { from: 0x42e9, to: 0x8000, tone: "ram", label: t("panels.htTape.map.ram") },
    { from: 0x8000, to: 0x10000, tone: "ram48", label: t("panels.htTape.map.ram48") }
  ];
  const hasBasic = blocks.some((b) => b.kind === "basic");
  const hasCode = blocks.some((b) => b.kind === "code");
  return (
    <div className={styles.memoryMap} aria-hidden="true" data-testid="ht-memory-map">
      <div className={styles.mapTrack}>
        {zones.map((zone) => (
          <div
            key={zone.from}
            className={classnames(styles.zone, styles[zone.tone])}
            style={{ flexGrow: zone.to - zone.from }}
            title={`${hex4(zone.from)}–${hex4(zone.to - 1)}`}
          >
            {zone.label}
          </div>
        ))}
        {blocks.map((block) => (
          <div
            key={block.index}
            className={classnames(styles.mapBlock, styles[block.kind], {
              [styles.selected]: block.index === selectedIndex
            })}
            style={{ left: percent(block.from), width: percent(Math.max(0, block.to - block.from)) }}
            title={block.title}
            data-index={block.index}
            onClick={() => onSelect(block.index)}
          />
        ))}
      </div>
      <div className={styles.mapAxis}>
        {AXIS.map((address) => (
          <span key={address} style={{ left: percent(address) }}>
            {hex4(address)}
          </span>
        ))}
      </div>
      <div className={styles.legend}>
        <span><i className={styles.rom} />{t("panels.htTape.legend.rom")}</span>
        <span><i className={styles.video} />{t("panels.htTape.legend.video")}</span>
        <span><i className={styles.ram} />{t("panels.htTape.legend.ram")}</span>
        <span><i className={styles.ram48} />{t("panels.htTape.legend.ram48")}</span>
        {hasCode && <span><i className={styles.code} />{t("panels.htTape.legend.code")}</span>}
        {hasBasic && <span><i className={styles.basic} />{t("panels.htTape.legend.basic")}</span>}
      </div>
    </div>
  );
};
