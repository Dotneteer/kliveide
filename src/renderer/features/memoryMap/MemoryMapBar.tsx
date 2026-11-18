import classnames from "classnames";

import type { PartitionInfo, PartitionRole } from "@common/annotations/partitionInfo";
import { useT } from "@common/i18n/useT";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";
import type { MapCell } from "./memoryMapModel";
import { kindText, partitionNote, roleText, sizeText } from "./partitionText";
import styles from "./MemoryMap.module.scss";

/*
 * The memory map bar (`dev/plans/MEMORY_DISASSEMBLY_VIEWS_PLAN.md` §4.2): the address space as the
 * CPU sees it now, one cell per paging unit, ROM hatched and an empty slot dashed. A frame along the
 * bottom shows the part in view; ticks mark PC and SP; with Heat on a strip under each cell
 * summarises it. With one partition shown, the bar is that partition.
 */

export type MapBarRange = { start: number; end: number };

const hex = (value: number) => `$${toHexa4(value)}`;

type MemoryMapBarProps = {
  cells: MapCell[];
  /** The addresses in view (64K) */
  viewport?: MapBarRange;
  /** PC and SP, for the ticks */
  ticks?: { name: string; address: number }[];
  /** One flag per 1/64 of the 64K (1K each) with Heat on: the 1K has heat */
  heat?: readonly boolean[];
  onGoTo: (address: number) => void;
};

export const MemoryMapBar = ({ cells, viewport, ticks, heat, onGoTo }: MemoryMapBarProps) => {
  const t = useT();
  const pct = (address: number) => `${(address / 0x10000) * 100}%`;
  return (
    <div className={styles.mapBar} role="group" aria-label={t("panels.memoryMap.mapBar")}>
      {cells.map((cell) => {
        const size = cell.end - cell.start + 1;
        const title = [
          `${hex(cell.start)}–${hex(cell.end)}`,
          cell.name ? `${cell.name}${cell.description ? ` · ${cell.description}` : ""}` : undefined,
          kindText(t, cell.kind),
          cell.partition !== undefined && cell.partitionOffset
            ? t("panels.memoryMap.upperHalf")
            : undefined
        ]
          .filter(Boolean)
          .join("\n");
        return (
          <button
            key={cell.start}
            type="button"
            className={classnames(styles.cell, styles[`kind_${cell.kind}`])}
            style={{ flex: `${size} 1 0` }}
            title={title}
            onClick={() => onGoTo(cell.start)}
          >
            <span className={styles.cellRange}>
              {hex(cell.start)}–{hex(cell.end)}
            </span>
            <span className={styles.cellName}>
              {cell.name ? <b>{cell.name}</b> : <b>{kindText(t, cell.kind)}</b>}
              {cell.description && <span className={styles.cellDescription}>{cell.description}</span>}
            </span>
            {heat && (
              <span className={styles.heatStrip} aria-hidden>
                {Array.from({ length: size / 0x400 }, (_, i) => (
                  <span key={i} style={{ opacity: heat[(cell.start >> 10) + i] ? 1 : 0 }} />
                ))}
              </span>
            )}
          </button>
        );
      })}
      {viewport && (
        <span
          className={styles.viewport}
          style={{
            left: pct(viewport.start),
            width: `max(2px, ${((viewport.end - viewport.start + 1) / 0x10000) * 100}%)`
          }}
        />
      )}
      {ticks?.map((tick) => (
        <span key={tick.name} className={styles.tick} data-reg={tick.name} style={{ left: pct(tick.address) }} />
      ))}
    </div>
  );
};

/** The bar with one partition shown: its name, size, where it is paged in, role; the viewport along its edge */
export const PartitionBar = ({
  partition,
  pagedAt,
  roles,
  viewport,
  labelOf
}: {
  partition: PartitionInfo;
  /** Where the CPU sees its start now, if it is paged in */
  pagedAt?: number;
  roles?: readonly PartitionRole[];
  viewport?: MapBarRange;
  labelOf: (id: number) => string | undefined;
}) => {
  const t = useT();
  const note = partitionNote(t, partition, labelOf);
  const pct = (offset: number) => `${(offset / partition.size) * 100}%`;
  return (
    <div className={classnames(styles.partitionBar, styles[`kind_${partition.kind}`])}>
      <b>{partition.name}</b>
      <span>{partition.description}</span>
      <span className={styles.partitionBarDim}>
        {kindText(t, partition.kind)} · {sizeText(partition.size)}
      </span>
      <span className={styles.partitionBarDim}>
        {pagedAt !== undefined
          ? t("panels.memoryMap.pagedInAt", { address: hex(pagedAt) })
          : t("panels.memoryMap.notPagedIn")}
      </span>
      {note && <span className={styles.partitionBarDim}>{note}</span>}
      {roles?.length ? <span className={styles.partitionBarDim}>{roles.map((r) => roleText(t, r)).join(", ")}</span> : null}
      {viewport && (
        <span
          className={styles.viewport}
          style={{
            left: pct(viewport.start),
            width: `max(2px, ${((viewport.end - viewport.start + 1) / partition.size) * 100}%)`
          }}
        />
      )}
    </div>
  );
};
