import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import classnames from "classnames";

import {
  PARTITION_ROLES,
  type PartitionInfo,
  type PartitionInfoSet,
  type PartitionRole
} from "@common/annotations/partitionInfo";
import { useT } from "@common/i18n/useT";
import {
  matchesPartitionFilter,
  moveInBankMap,
  PARTITION_ROW_MAX_CHIPS,
  pagingUnitOf,
  slotBadge
} from "./memoryMapModel";
import { kindText, partitionNote, roleText, slotCaption } from "./partitionText";
import styles from "./MemoryMap.module.scss";

/*
 * The partition row and the Bank map (`dev/plans/MEMORY_DISASSEMBLY_VIEWS_PLAN.md` §4.3).
 *
 * Up to sixteen partitions are chips beside **64K**. More (the Z88's 256, the Next's 247 or 503) are
 * **64K**, **Paged in**, **Recent** and the **Bank map** button: a grid of every partition laid out by
 * the machine, each cell with its kind, paged-in badge, role bar and changed and annotated dots. A
 * filter fades what does not match; arrows move, Enter opens, Esc closes.
 */

type PartitionRowProps = {
  set: PartitionInfoSet;
  partitions: Map<number, PartitionInfo>;
  /** The partition shown on its own, or undefined for the 64K view */
  current: number | undefined;
  /** The slots each partition is paged into now */
  paged: Map<number, number[]>;
  roles?: Record<number, PartitionRole[]>;
  recent: readonly number[];
  /** Partitions with bytes changed since the previous stop */
  changed?: ReadonlySet<number>;
  /** Partitions with annotations (the Disassembly view) */
  annotated?: ReadonlySet<number>;
  /** The Bank map is open (owned by the view, so Ctrl+B can toggle it) */
  bankMapOpen: boolean;
  onBankMapOpenChange: (open: boolean) => void;
  onSelect: (partition: number | undefined) => void;
};

export const PartitionRow = ({
  set,
  partitions,
  current,
  paged,
  roles,
  recent,
  changed,
  annotated,
  bankMapOpen,
  onBankMapOpenChange,
  onSelect
}: PartitionRowProps) => {
  const t = useT();
  const few = set.partitions.length <= PARTITION_ROW_MAX_CHIPS;
  const unit = pagingUnitOf(set);
  const chip = (id: number, key?: string) => {
    const p = partitions.get(id);
    if (!p) return null;
    const slots = paged.get(id);
    return (
      <button
        key={key ?? id}
        type="button"
        className={classnames(styles.chip, {
          [styles.chipPaged]: !!slots,
          [styles.chipRom]: p.kind === "rom" || p.kind === "divRom"
        })}
        aria-pressed={current === id}
        title={[p.description ?? p.name, kindText(t, p.kind)].join(" · ")}
        onClick={() => onSelect(id)}
      >
        {p.name}
        {slots && <span className={styles.chipBadge}>{slotBadge(slots, unit)}</span>}
      </button>
    );
  };
  // --- The paged-in partitions in slot order, each once
  const pagedIn = useMemo(() => {
    const order: number[] = [];
    for (let slot = 0; slot < 8; slot++) {
      for (const [id, slots] of paged) if (slots[0] === slot && !order.includes(id)) order.push(id);
    }
    return order;
  }, [paged]);
  return (
    <div className={styles.chips}>
      <button
        type="button"
        className={styles.chip}
        aria-pressed={current === undefined}
        title={t("panels.memoryMap.fullViewTitle")}
        onClick={() => onSelect(undefined)}
      >
        {t("panels.memoryMap.fullView")}
      </button>
      {few ? (
        set.partitions.map((p) => chip(p.id))
      ) : (
        <>
          <span className={styles.rowLabel}>{t("panels.memoryMap.pagedIn")}</span>
          {pagedIn.map((id) => chip(id, `p${id}`))}
          {recent.length > 0 && <span className={styles.rowLabel}>{t("panels.memoryMap.recent")}</span>}
          {recent.map((id) => chip(id, `r${id}`))}
          <button
            type="button"
            className={styles.chip}
            aria-pressed={bankMapOpen}
            aria-haspopup="dialog"
            title={t("panels.memoryMap.bankMapTitle")}
            onClick={() => onBankMapOpenChange(!bankMapOpen)}
          >
            {t("panels.memoryMap.bankMap")}
            <span className={styles.chipCount}>{set.partitions.length}</span>
          </button>
        </>
      )}
      {bankMapOpen && (
        <BankMapPopover
          set={set}
          partitions={partitions}
          current={current}
          paged={paged}
          roles={roles}
          changed={changed}
          annotated={annotated}
          onSelect={(id) => {
            onBankMapOpenChange(false);
            onSelect(id);
          }}
          onClose={() => onBankMapOpenChange(false)}
        />
      )}
    </div>
  );
};

type BankMapProps = {
  set: PartitionInfoSet;
  partitions: Map<number, PartitionInfo>;
  current: number | undefined;
  paged: Map<number, number[]>;
  roles?: Record<number, PartitionRole[]>;
  changed?: ReadonlySet<number>;
  annotated?: ReadonlySet<number>;
  onSelect: (partition: number) => void;
  onClose: () => void;
};

const NAV_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"] as const;

export const BankMapPopover = ({
  set,
  partitions,
  current,
  paged,
  roles,
  changed,
  annotated,
  onSelect,
  onClose
}: BankMapProps) => {
  const t = useT();
  const unit = pagingUnitOf(set);
  const [filter, setFilter] = useState("");
  const [focused, setFocused] = useState<number | undefined>(current ?? set.layout[0]?.ids[0]);
  const rootRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);

  useEffect(() => filterRef.current?.focus(), []);

  // --- A click outside closes the map
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  const labelOf = (id: number) => partitions.get(id)?.name;
  const visible = useMemo(() => {
    const words = (p: PartitionInfo) => [
      kindText(t, p.kind),
      ...(roles?.[p.id] ?? []).map((r) => roleText(t, r))
    ];
    const shown = new Set<number>();
    for (const p of set.partitions) {
      if (matchesPartitionFilter(p, filter, { roles: roles?.[p.id], slots: paged.get(p.id), words: words(p) })) {
        shown.add(p.id);
      }
    }
    return shown;
  }, [set, filter, roles, paged, t]);
  const matching = visible.size;

  // --- The focused cell follows the filter to the first match
  useEffect(() => {
    if (focused === undefined || !visible.has(focused)) {
      const first = set.layout.flatMap((b) => b.ids).find((id) => visible.has(id));
      setFocused(first);
    }
  }, [visible, focused, set]);

  // --- The focused cell stays in view
  useEffect(() => {
    if (focused === undefined) return;
    rootRef.current?.querySelector(`[data-part="${focused}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [focused]);

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if ((NAV_KEYS as readonly string[]).includes(e.key)) {
      // --- In the filter, left and right edit the text
      if ((e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "Home" || e.key === "End") && e.target === filterRef.current) {
        return;
      }
      e.preventDefault();
      setFocused((f) => moveInBankMap(set.layout, f, e.key as (typeof NAV_KEYS)[number], (id) => visible.has(id)));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (focused !== undefined && visible.has(focused)) onSelect(focused);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
    e.stopPropagation();
  };

  const presentRoles = useMemo(() => {
    const present = new Set<PartitionRole>();
    for (const list of Object.values(roles ?? {})) list.forEach((r) => present.add(r));
    return PARTITION_ROLES.filter((r) => present.has(r));
  }, [roles]);
  const presentKinds = useMemo(() => Array.from(new Set(set.partitions.map((p) => p.kind))), [set]);

  const cell = (id: number) => {
    const p = partitions.get(id);
    if (!p) return <span key={id} />;
    const slots = paged.get(id);
    const role = roles?.[id]?.[0];
    const note = partitionNote(t, p, labelOf);
    const title = [
      `${p.name}${p.description ? ` · ${p.description}` : ""}`,
      kindText(t, p.kind),
      note,
      slots ? t("panels.memoryMap.pagedInSlots", { slots: slots.join(", ") }) : undefined,
      ...(roles?.[id] ?? []).map((r) => roleText(t, r)),
      changed?.has(id) ? t("panels.memoryMap.changedTitle") : undefined,
      annotated?.has(id) ? t("panels.memoryMap.annotatedTitle") : undefined
    ]
      .filter(Boolean)
      .join("\n");
    return (
      <button
        key={id}
        type="button"
        data-part={id}
        tabIndex={-1}
        className={classnames(styles.mapCell, styles[`kind_${p.kind}`], {
          [styles.mapCellPaged]: !!slots,
          [styles.mapCellCurrent]: focused === id,
          [styles.mapCellFaded]: !visible.has(id),
          [styles.mapCellChanged]: changed?.has(id),
          [styles.mapCellAnnotated]: annotated?.has(id)
        })}
        title={title}
        aria-label={title}
        aria-current={current === id ? "true" : undefined}
        onMouseEnter={() => setFocused(id)}
        onClick={() => onSelect(id)}
      >
        {p.name}
        {slots && <span className={styles.mapCellBadge}>{slotBadge(slots, unit)}</span>}
        {role && <span className={classnames(styles.roleBar, styles[`role_${role}`])} />}
      </button>
    );
  };

  return (
    <div
      ref={rootRef}
      className={styles.bankMap}
      role="dialog"
      aria-label={t("panels.memoryMap.bankMap")}
      onKeyDown={onKeyDown}
    >
      <div className={styles.bankMapHead}>
        <span className={styles.bankMapTitle}>{t("panels.memoryMap.bankMap")}</span>
        <label className={styles.box}>
          <span className={styles.boxLabel}>{t("panels.memoryMap.filter")}</span>
          <input
            ref={filterRef}
            value={filter}
            placeholder={t("panels.memoryMap.filterPlaceholder")}
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => setFilter(e.target.value)}
          />
        </label>
        <div className={styles.legend}>
          {presentKinds.map((kind) => (
            <span key={kind} className={styles.legendItem}>
              <span className={classnames(styles.legendSwatch, styles[`kind_${kind}`])} />
              {kindText(t, kind)}
            </span>
          ))}
          {presentRoles.map((role) => (
            <span key={role} className={styles.legendItem}>
              <span className={classnames(styles.legendBar, styles[`role_${role}`])} />
              {roleText(t, role)}
            </span>
          ))}
        </div>
      </div>
      <div className={styles.bankMapBody}>
        {set.layout.map((block) => (
          <div key={block.key} className={styles.block}>
            {(block.caption || block.slot !== undefined) && (
              <div className={styles.blockCaption}>
                {block.slot !== undefined ? slotCaption(t, block.slot, partitions) : block.caption}
              </div>
            )}
            {block.shape === "chips" ? (
              <div className={styles.blockChips}>{block.ids.map(cell)}</div>
            ) : (
              <div className={styles.grid}>
                <span />
                {Array.from({ length: block.columns ?? 16 }, (_, i) => (
                  <span key={`h${i}`} className={styles.gridHead}>
                    {i.toString(16).toUpperCase()}
                  </span>
                ))}
                {Array.from({ length: Math.ceil(block.ids.length / (block.columns ?? 16)) }, (_, row) => {
                  const ids = block.ids.slice(row * (block.columns ?? 16), (row + 1) * (block.columns ?? 16));
                  const first = partitions.get(ids[0]);
                  return [
                    <span key={`r${row}`} className={styles.gridHead}>
                      {first?.name.length === 2 ? `${first.name[0]}0` : ""}
                    </span>,
                    ...ids.map(cell)
                  ];
                })}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className={styles.bankMapHint}>
        <span>
          <kbd>←↑→↓</kbd> {t("panels.memoryMap.hintMove")}
        </span>
        <span>
          <kbd>Enter</kbd> {t("panels.memoryMap.hintOpen")}
        </span>
        <span>
          <kbd>Esc</kbd> {t("panels.memoryMap.hintClose")}
        </span>
        <span className={styles.spacer} />
        <span>{t("panels.memoryMap.partitionCount", { shown: matching, count: set.partitions.length })}</span>
      </div>
    </div>
  );
};
