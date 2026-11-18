import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import classnames from "classnames";

import { MI_ZXNEXT } from "@common/machines/constants";
import { NEXT_REG_CATEGORIES, type NextRegCategoryId } from "@common/zxnext/nextRegCategories";
import { isFlagSlice, sliceBits, sliceValue } from "@common/zxnext/nextRegSlices";
import type { NextRegDescriptor, RegValueState } from "@emu/machines/zxNext/nextRegDescriptors";
import { useT, type TFunction } from "@common/i18n/useT";
import type { MessageKey } from "@common/i18n/keys.generated";
import { LabeledSwitch } from "@controls/LabeledSwitch";
import {
  DataPanel,
  EmptyState,
  PanelFilter,
  PanelHeader,
  PanelHeaderActions,
  PanelHeaderGroup
} from "@renderer/controls/data";
import { Icon } from "@renderer/controls/Icon";
import ScrollViewer from "@renderer/controls/ScrollViewer";
import { useSelector } from "@renderer/core/RendererProvider";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import type { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import {
  DEFAULT_NEXT_REG_DOCUMENT_VIEW_STATE,
  bitOwners,
  buildGroups,
  categoriesByRegister,
  displayedValue,
  formatRegValue,
  hex2,
  isChanged,
  visibleIds,
  type NextRegDocumentViewState,
  type NextRegGroup,
  type NextRegGrouping,
  type NextRegValueFormat
} from "@renderer/features/nextRegs/nextRegDocumentModel";
import { useNextRegDescriptors, useNextRegState } from "@renderer/features/nextRegs/useNextRegState";
import { onNextRegReveal } from "@renderer/features/nextRegs/nextRegReveal";
import { HistoryPresentBanner } from "../../debugger/history/HistoryPresentBanner";
import { NextRegInspector } from "./NextRegInspector";
import styles from "./NextRegDocument.module.scss";

/*
 * The Next Registers document (`$nextRegs`): the Debug sidebar's Next Registers panel with the room
 * of a document. Every documented register, grouped by index (sixteen to a block) or by the book's
 * categories (Appendix B's quick-reference table), each row with its bits drawn field by field,
 * and an inspector column that decodes the selected register in full.
 *
 * The data is the panel's: `getNextRegState()` and the descriptor table, read through the hooks the
 * panel uses too (`features/nextRegs/useNextRegState`). Nothing here writes to the machine.
 */

/** The access badge's text and tooltip */
const ACCESS_TEXTS = {
  rw: { label: "panels.doc.nextRegs.access.rw", title: "panels.doc.nextRegs.access.rwTitle" },
  ro: { label: "panels.doc.nextRegs.access.ro", title: "panels.doc.nextRegs.access.roTitle" },
  wo: { label: "panels.doc.nextRegs.access.wo", title: "panels.doc.nextRegs.access.woTitle" }
} as const satisfies Record<string, { label: MessageKey; title: MessageKey }>;

const categoryName = (t: TFunction, id: NextRegCategoryId) =>
  t(NEXT_REG_CATEGORIES.find((c) => c.id === id)!.nameKey);

/** A run of buttons of which one is pressed */
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: T;
  options: { value: T; text: string; title?: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <span className={styles.segmented} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={styles.segment}
          aria-pressed={value === option.value}
          title={option.title}
          onClick={() => onChange(option.value)}
        >
          {option.text}
        </button>
      ))}
    </span>
  );
}

/** The eight bits of a row, tinted field by field */
const BitStrip = ({
  descriptor,
  value
}: {
  descriptor: NextRegDescriptor;
  value: number | undefined;
}) => {
  const owners = bitOwners(descriptor);
  const cells: ReactNode[] = [];
  for (let bit = 7; bit >= 0; bit--) {
    const owner = owners[bit];
    const slice = owner >= 0 ? descriptor.slices![owner] : undefined;
    const set = value !== undefined && (value >> bit) & 1;
    cells.push(
      <span
        key={bit}
        className={classnames(styles.bit, {
          [styles.bitUnknown]: value === undefined,
          [styles.fieldA]: slice && owner % 2 === 0,
          [styles.fieldB]: slice && owner % 2 === 1,
          [styles.bitSet]: set,
          [styles.flagSet]: set && slice && isFlagSlice(slice),
          [styles.joinLeft]: owner >= 0 && bit < 7 && owners[bit + 1] === owner,
          [styles.joinRight]: owner >= 0 && bit > 0 && owners[bit - 1] === owner
        })}
      >
        {value === undefined ? "·" : set ? "1" : "0"}
      </span>
    );
  }
  return <span className={styles.bits}>{cells}</span>;
};

type RowProps = {
  descriptor: NextRegDescriptor;
  state?: RegValueState;
  changed: boolean;
  selected: boolean;
  expanded: boolean;
  format: NextRegValueFormat;
  alsoIn?: string;
  onSelect: () => void;
  onToggle: () => void;
};

const RegisterRow = ({
  descriptor,
  state,
  changed,
  selected,
  expanded,
  format,
  alsoIn,
  onSelect,
  onToggle
}: RowProps) => {
  const t = useT();
  const hasFields = !!descriptor.slices?.length;
  const value = displayedValue(state);
  const access = descriptor.isReadOnly ? "ro" : descriptor.isWriteOnly ? "wo" : "rw";
  return (
    <>
      <div
        className={classnames(styles.grid, styles.row, { [styles.rowSelected]: selected })}
        data-reg={descriptor.id}
        role="row"
        aria-selected={selected}
        onClick={onSelect}
        onDoubleClick={hasFields ? onToggle : undefined}
      >
        <span
          className={styles.chevron}
          onClick={(e) => {
            if (!hasFields) return;
            e.stopPropagation();
            onToggle();
          }}
        >
          {hasFields && (
            <Icon
              iconName={expanded ? "chevron-down" : "chevron-right"}
              width={16}
              height={16}
              fill="--color-chevron"
            />
          )}
        </span>
        <span className={classnames(styles.regId, { [styles.changed]: changed })}>
          ${hex2(descriptor.id)}
        </span>
        <span className={styles.regName} title={descriptor.description}>
          {descriptor.description}
          {alsoIn && <span className={styles.alsoIn}>{alsoIn}</span>}
        </span>
        <span
          className={classnames(styles.access, styles[`access_${access}`])}
          title={t(ACCESS_TEXTS[access].title)}
        >
          {t(ACCESS_TEXTS[access].label)}
        </span>
        <BitStrip descriptor={descriptor} value={value} />
        <span className={styles.lastWrite}>
          {state?.lastWrite !== undefined && `${formatRegValue(state.lastWrite, format)} →`}
        </span>
        <span className={classnames(styles.value, { [styles.noValue]: state?.value === undefined })}>
          {state?.value !== undefined ? formatRegValue(state.value, format) : "—"}
        </span>
      </div>
      {expanded && hasFields && (
        <div className={styles.fields}>
          {descriptor.slices!.map((slice, index) => {
            const fieldValue = sliceValue(value ?? 0, slice);
            const named = slice.valueSet?.[fieldValue];
            return (
              <div key={index} className={styles.fieldRow}>
                <span className={styles.fieldBits}>{sliceBits(slice)}</span>
                <span className={styles.fieldValue}>
                  {value === undefined ? (
                    "·"
                  ) : isFlagSlice(slice) ? (
                    <Icon
                      iconName={fieldValue ? "circle-filled" : "circle-outline"}
                      width={14}
                      height={14}
                      fill="--color-state-value"
                    />
                  ) : (
                    `$${hex2(fieldValue)}`
                  )}
                </span>
                <span className={styles.fieldText}>
                  {named && <span className={styles.fieldNamed}>{named}</span>}
                  {named && slice.description && " — "}
                  {slice.description}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};

const NextRegDocumentPanel = ({
  document,
  viewState
}: DocumentProps<Partial<NextRegDocumentViewState>>) => {
  const t = useT();
  const machineId = useSelector((s) => s.emulatorState?.machineId);
  const documentHubService = useDocumentHubService();
  const descriptorTable = useNextRegDescriptors();
  const { regs, lastRegisterIndex, baseline } = useNextRegState();

  const [look, setLook] = useState<NextRegDocumentViewState>({
    ...DEFAULT_NEXT_REG_DOCUMENT_VIEW_STATE,
    ...(viewState ?? {})
  });
  const updateLook = useCallback(
    (patch: Partial<NextRegDocumentViewState>) => {
      setLook((current) => {
        const next = { ...current, ...patch };
        if (document) documentHubService?.setDocumentViewState(document.id, next);
        return next;
      });
    },
    [document, documentHubService]
  );
  const [filter, setFilter] = useState("");
  // --- Expanded rows are not kept: a reopened document starts tidy
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(() => new Set());
  const listRef = useRef<HTMLDivElement>(null);

  // --- Derived tables
  const descriptors = useMemo(
    () => (descriptorTable ? Object.values(descriptorTable).sort((a, b) => a.id - b.id) : []),
    [descriptorTable]
  );
  const descriptorMap = useMemo(() => new Map(descriptors.map((d) => [d.id, d])), [descriptors]);
  const stateMap = useMemo(() => new Map((regs ?? []).map((r) => [r.id, r])), [regs]);
  const categoriesOf = useMemo(() => categoriesByRegister(descriptors), [descriptors]);
  const groups = useMemo(() => buildGroups(look.grouping, descriptors), [look.grouping, descriptors]);
  const categoryNamesOf = useCallback(
    (id: number) => (categoriesOf.get(id) ?? []).map((c) => categoryName(t, c)),
    [categoriesOf, t]
  );
  const shown = useMemo(
    () =>
      groups.map((group) => ({
        group,
        ids: visibleIds(group, {
          descriptors: descriptorMap,
          states: stateMap,
          baseline,
          filter,
          changedOnly: look.changedOnly,
          writtenOnly: look.writtenOnly,
          categoryNamesOf
        })
      })),
    [groups, descriptorMap, stateMap, baseline, filter, look.changedOnly, look.writtenOnly, categoryNamesOf]
  );
  const shownCount = useMemo(() => new Set(shown.flatMap((s) => s.ids)).size, [shown]);
  const filtering = !!filter.trim() || look.changedOnly || look.writtenOnly;

  // --- Selection and expansion
  const isExpanded = (id: number) => look.expandAll || expanded.has(id);
  const toggleExpanded = useCallback((id: number) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);
  const toggleGroup = (key: string) =>
    updateLook({
      collapsed: look.collapsed.includes(key)
        ? look.collapsed.filter((k) => k !== key)
        : [...look.collapsed, key]
    });
  const groupOpen = (group: NextRegGroup) => filtering || !look.collapsed.includes(group.key);

  const revealRow = useCallback((id: number) => {
    requestAnimationFrame(() =>
      listRef.current
        ?.querySelector(`[data-reg="${id}"]`)
        ?.scrollIntoView({ block: "nearest" })
    );
  }, []);
  const select = useCallback(
    (id: number, reveal = false) => {
      updateLook({ selected: id });
      if (reveal) {
        // --- A register in a collapsed group is opened to, not selected out of sight
        setLook((current) => {
          const keys = buildGroups(current.grouping, descriptors)
            .filter((g) => g.ids.includes(id))
            .map((g) => g.key);
          if (!keys.some((k) => current.collapsed.includes(k))) return current;
          const next = { ...current, collapsed: current.collapsed.filter((k) => !keys.includes(k)) };
          if (document) documentHubService?.setDocumentViewState(document.id, next);
          return next;
        });
        revealRow(id);
      }
    },
    [updateLook, descriptors, document, documentHubService, revealRow]
  );

  // --- `show-nextregs <reg>` reveals a register
  useEffect(() => onNextRegReveal((id) => select(id, true)), [select]);
  // --- The selected row is in view when the document opens
  useEffect(() => {
    if (descriptors.length) revealRow(look.selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descriptors.length]);

  const showCategory = (id: NextRegCategoryId) => {
    const key = `c-${id}`;
    updateLook({ grouping: "category", collapsed: look.collapsed.filter((k) => k !== key) });
    requestAnimationFrame(() =>
      listRef.current?.querySelector(`[data-group="${key}"]`)?.scrollIntoView({ block: "start" })
    );
  };

  // --- Keyboard: up and down move the selection, right and left open and close the fields
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    const order = shown.filter((s) => groupOpen(s.group)).flatMap((s) => s.ids);
    const at = order.indexOf(look.selected);
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp": {
        e.preventDefault();
        const next = order[Math.max(0, Math.min(order.length - 1, at + (e.key === "ArrowDown" ? 1 : -1)))];
        if (next !== undefined) select(next, true);
        break;
      }
      case "ArrowRight":
      case "ArrowLeft":
      case "Enter": {
        if (!descriptorMap.get(look.selected)?.slices?.length) break;
        e.preventDefault();
        setExpanded((current) => {
          const next = new Set(current);
          if (e.key === "ArrowRight") next.add(look.selected);
          else if (e.key === "ArrowLeft") next.delete(look.selected);
          else if (!next.delete(look.selected)) next.add(look.selected);
          return next;
        });
        break;
      }
    }
  };

  if (machineId !== MI_ZXNEXT) {
    return (
      <DataPanel xclass={styles.panel}>
        <EmptyState message={t("panels.doc.nextRegs.notAvailable")} />
      </DataPanel>
    );
  }

  const selectedDescriptor = descriptorMap.get(look.selected);
  const selectedName = lastRegisterIndex !== undefined ? descriptorMap.get(lastRegisterIndex)?.description : undefined;

  return (
    <DataPanel xclass={styles.panel}>
      <HistoryPresentBanner subject="nextRegisters" />
      <PanelHeader>
        <PanelHeaderGroup>
          <span className={styles.toolLabel}>{t("panels.doc.nextRegs.groupBy")}</span>
          <Segmented<NextRegGrouping>
            label={t("panels.doc.nextRegs.groupBy")}
            value={look.grouping}
            options={[
              { value: "index", text: t("panels.doc.nextRegs.byIndex"), title: t("panels.doc.nextRegs.byIndexTitle") },
              { value: "category", text: t("panels.doc.nextRegs.byCategory"), title: t("panels.doc.nextRegs.byCategoryTitle") }
            ]}
            onChange={(grouping) => updateLook({ grouping })}
          />
        </PanelHeaderGroup>
        <PanelHeaderGroup>
          <span className={styles.toolLabel}>{t("panels.doc.nextRegs.values")}</span>
          <Segmented<NextRegValueFormat>
            label={t("panels.doc.nextRegs.values")}
            value={look.format}
            options={[
              { value: "hex", text: t("panels.doc.nextRegs.hex") },
              { value: "dec", text: t("panels.doc.nextRegs.dec") },
              { value: "bin", text: t("panels.doc.nextRegs.bin") }
            ]}
            onChange={(format) => updateLook({ format })}
          />
        </PanelHeaderGroup>
        <PanelHeaderGroup>
          <LabeledSwitch
            value={look.changedOnly}
            label={t("panels.doc.nextRegs.changedOnly")}
            title={t("panels.doc.nextRegs.changedOnlyTitle")}
            clicked={(changedOnly) => updateLook({ changedOnly })}
          />
        </PanelHeaderGroup>
        <PanelHeaderGroup>
          <LabeledSwitch
            value={look.writtenOnly}
            label={t("panels.doc.nextRegs.writtenOnly")}
            title={t("panels.doc.nextRegs.writtenOnlyTitle")}
            clicked={(writtenOnly) => updateLook({ writtenOnly })}
          />
        </PanelHeaderGroup>
        <PanelHeaderGroup>
          <LabeledSwitch
            value={look.expandAll}
            label={t("panels.doc.nextRegs.expandAll")}
            title={t("panels.doc.nextRegs.expandAllTitle")}
            clicked={(expandAll) => updateLook({ expandAll })}
          />
        </PanelHeaderGroup>
        <PanelHeaderActions>
          {lastRegisterIndex !== undefined && (
            <button
              type="button"
              className={styles.selectedChip}
              title={t("panels.doc.nextRegs.portSelectsTitle")}
              onClick={() => select(lastRegisterIndex, true)}
            >
              <span className={styles.selectedChipLabel}>{t("panels.doc.nextRegs.portSelects")}</span>
              <span className={styles.selectedChipValue}>${hex2(lastRegisterIndex)}</span>
              {selectedName && <span className={styles.selectedChipName}>{selectedName}</span>}
            </button>
          )}
        </PanelHeaderActions>
      </PanelHeader>

      <div className={styles.layout}>
        <div className={styles.listPane}>
          <PanelFilter
            value={filter}
            onChange={setFilter}
            placeholder={t("panels.doc.nextRegs.filterPlaceholder")}
            status={
              filtering
                ? t("panels.doc.nextRegs.shownCount", { shown: shownCount, total: descriptors.length })
                : undefined
            }
          />
          <div className={classnames(styles.grid, styles.columnHeads)} role="row">
            <span />
            <span>{t("panels.doc.nextRegs.col.reg")}</span>
            <span>{t("panels.doc.nextRegs.col.name")}</span>
            <span>{t("panels.doc.nextRegs.col.access")}</span>
            <span>{t("panels.doc.nextRegs.col.bits")}</span>
            <span className={styles.alignEnd}>{t("panels.doc.nextRegs.col.lastWritten")}</span>
            <span className={styles.alignEnd}>{t("panels.doc.nextRegs.col.value")}</span>
          </div>
          <ScrollViewer className={styles.paneScroll} thinScrollBar={true}>
            <div
              ref={listRef}
              className={styles.list}
              tabIndex={0}
              role="grid"
              aria-label={t("panels.document.nextRegisters")}
              onKeyDown={onKeyDown}
            >
              {shownCount === 0 && descriptors.length > 0 && (
                <div className={styles.noMatch}>{t("panels.doc.nextRegs.noMatch")}</div>
              )}
              {shown.map(({ group, ids }) => {
                if (!ids.length) return null;
                const open = groupOpen(group);
                const changedCount = ids.filter((id) => isChanged(stateMap.get(id), baseline)).length;
                return (
                  <section key={group.key} className={styles.group}>
                    <div
                      className={styles.groupHead}
                      data-group={group.key}
                      onClick={() => toggleGroup(group.key)}
                    >
                      <Icon
                        iconName={open ? "chevron-down" : "chevron-right"}
                        width={16}
                        height={16}
                        fill="--color-chevron"
                      />
                      {group.range ? (
                        <span className={styles.groupRange}>
                          ${hex2(group.range.from)}–${hex2(group.range.to)}
                        </span>
                      ) : (
                        <span className={styles.groupTitle}>{t(group.category!.nameKey)}</span>
                      )}
                      {group.category && (
                        <span className={styles.groupDescription}>{t(group.category.descriptionKey)}</span>
                      )}
                      <span className={styles.groupFill} />
                      {changedCount > 0 && (
                        <span className={styles.groupChanged}>
                          {t("panels.doc.nextRegs.changedCount", { count: changedCount })}
                        </span>
                      )}
                      <span className={styles.groupCount}>{ids.length}</span>
                    </div>
                    {open &&
                      ids.map((id) => {
                        const others =
                          group.category !== undefined
                            ? (categoriesOf.get(id) ?? []).filter((c) => c !== group.category!.id)
                            : [];
                        return (
                          <RegisterRow
                            key={id}
                            descriptor={descriptorMap.get(id)!}
                            state={stateMap.get(id)}
                            changed={isChanged(stateMap.get(id), baseline)}
                            selected={look.selected === id}
                            expanded={isExpanded(id)}
                            format={look.format}
                            alsoIn={
                              others.length
                                ? t("panels.doc.nextRegs.alsoIn", {
                                    categories: others.map((c) => categoryName(t, c)).join(", ")
                                  })
                                : undefined
                            }
                            onSelect={() => select(id)}
                            onToggle={() => toggleExpanded(id)}
                          />
                        );
                      })}
                  </section>
                );
              })}
            </div>
          </ScrollViewer>
        </div>

        <div className={styles.inspector}>
          <NextRegInspector
            descriptor={selectedDescriptor}
            state={selectedDescriptor ? stateMap.get(selectedDescriptor.id) : undefined}
            previous={selectedDescriptor ? baseline?.get(selectedDescriptor.id) : undefined}
            categories={selectedDescriptor ? categoriesOf.get(selectedDescriptor.id) ?? [] : []}
            onShowCategory={showCategory}
          />
        </div>
      </div>
    </DataPanel>
  );
};

export const createNextRegDocumentPanel = ({ document, viewState }: DocumentProps) => (
  <NextRegDocumentPanel document={document} viewState={viewState} />
);
