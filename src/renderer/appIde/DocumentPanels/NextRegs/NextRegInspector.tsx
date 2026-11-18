import { useState } from "react";
import classnames from "classnames";

import type { NextRegCategoryId } from "@common/zxnext/nextRegCategories";
import { NEXT_REG_CATEGORIES } from "@common/zxnext/nextRegCategories";
import { isFlagSlice, sliceBits, sliceValue } from "@common/zxnext/nextRegSlices";
import type { NextRegDescriptor, RegValueState } from "@emu/machines/zxNext/nextRegDescriptors";
import { useT } from "@common/i18n/useT";
import { SmallIconButton } from "@controls/IconButton";
import { PanelHeader, PanelHeaderActions } from "@renderer/controls/data";
import { Icon } from "@renderer/controls/Icon";
import ScrollViewer from "@renderer/controls/ScrollViewer";
import {
  bin8,
  bitOwners,
  bitSpans,
  displayedValue,
  hex2,
  nextRegInstruction
} from "@renderer/features/nextRegs/nextRegDocumentModel";
import styles from "./NextRegDocument.module.scss";

/*
 * The Next Registers document's inspector column: the selected register decoded in full — its two
 * values (what reads back, what was last written), its bits with a bracket per field, every field
 * with its named values, the categories it is filed under and the `nextreg` line that writes it.
 */

/** A valueSet longer than this is shown as the current name only, not as chips */
const MAX_VALUE_CHIPS = 16;

type Props = {
  descriptor?: NextRegDescriptor;
  state?: RegValueState;
  /** What the register read back at the baseline stop */
  previous?: number;
  categories: readonly NextRegCategoryId[];
  onShowCategory: (id: NextRegCategoryId) => void;
};

/** One of the two value cards */
const ValueCard = ({
  heading,
  value,
  missing,
  secondary
}: {
  heading: string;
  value?: number;
  missing: string;
  secondary?: boolean;
}) => (
  <div className={styles.valueCard}>
    <span className={styles.valueCardHeading}>{heading}</span>
    {value === undefined ? (
      <span className={styles.valueCardMissing}>{missing}</span>
    ) : (
      <>
        <span className={classnames(styles.valueCardHex, { [styles.valueCardAlt]: secondary })}>
          ${hex2(value)}
        </span>
        <span className={styles.valueCardDetail}>
          {value} · %{bin8(value)}
        </span>
      </>
    )}
  </div>
);

export const NextRegInspector = ({ descriptor, state, previous, categories, onShowCategory }: Props) => {
  const t = useT();
  const [hotField, setHotField] = useState(-1);
  const [copied, setCopied] = useState(false);

  if (!descriptor) {
    return <div className={styles.inspectorEmpty}>{t("panels.doc.nextRegs.selectRegister")}</div>;
  }

  const value = displayedValue(state);
  const owners = bitOwners(descriptor);
  const spans = bitSpans(descriptor);
  const changed = state?.value !== undefined && previous !== undefined && previous !== state.value;
  const differs =
    state?.value !== undefined && state?.lastWrite !== undefined && state.value !== state.lastWrite;
  const access = descriptor.isReadOnly
    ? t("panels.doc.nextRegs.access.roTitle")
    : descriptor.isWriteOnly
      ? t("panels.doc.nextRegs.access.woTitle")
      : t("panels.doc.nextRegs.access.rwTitle");

  const copy = async () => {
    if (value === undefined) return;
    try {
      await navigator.clipboard.writeText(nextRegInstruction(descriptor.id, value));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // --- The clipboard can refuse; the line is still there to select by hand
    }
  };

  return (
    <>
      <PanelHeader>
        <span className={styles.inspectorId}>${hex2(descriptor.id)}</span>
        <span className={styles.inspectorName} title={descriptor.description}>
          {descriptor.description}
        </span>
        <PanelHeaderActions>
          <span className={styles.inspectorAccess}>{access}</span>
        </PanelHeaderActions>
      </PanelHeader>
      <ScrollViewer className={styles.paneScroll} allowHorizontal={false} thinScrollBar={true}>
        <div className={styles.inspectorBody}>
          {/* --- The two values */}
          <section className={styles.section}>
            <span className={styles.sectionLabel}>{t("panels.doc.nextRegs.section.value")}</span>
            <div className={styles.valueCards}>
              <ValueCard
                heading={t("panels.side.nextReg.currentValue")}
                value={state?.value}
                missing={t("panels.doc.nextRegs.notReadable")}
              />
              <ValueCard
                heading={t("panels.side.nextReg.lastWritten")}
                value={state?.lastWrite}
                missing={
                  descriptor.isReadOnly
                    ? t("panels.doc.nextRegs.notWritable")
                    : t("panels.doc.nextRegs.neverWritten")
                }
                secondary={true}
              />
            </div>
            {changed && (
              <span className={styles.note}>
                <span className={styles.noteChanged}>
                  {t("panels.doc.nextRegs.changedNote", {
                    before: `$${hex2(previous!)}`,
                    after: `$${hex2(state!.value!)}`
                  })}
                </span>
              </span>
            )}
            {differs && <span className={styles.note}>{t("panels.doc.nextRegs.differsNote")}</span>}
            {descriptor.isWriteOnly && state?.lastWrite !== undefined && (
              <span className={styles.note}>{t("panels.doc.nextRegs.writeOnlyNote")}</span>
            )}
          </section>

          {/* --- The bits, bracketed by field */}
          <section className={styles.section}>
            <span className={styles.sectionLabel}>{t("panels.doc.nextRegs.section.bits")}</span>
            <div className={styles.diagram} onMouseLeave={() => setHotField(-1)}>
              {[7, 6, 5, 4, 3, 2, 1, 0].map((bit) => (
                <span key={`n${bit}`} className={styles.diagramBitNo}>
                  {bit}
                </span>
              ))}
              {[7, 6, 5, 4, 3, 2, 1, 0].map((bit) => {
                const owner = owners[bit];
                const set = value !== undefined && (value >> bit) & 1;
                return (
                  <span
                    key={`b${bit}`}
                    className={classnames(styles.diagramBit, {
                      [styles.fieldA]: owner >= 0 && owner % 2 === 0,
                      [styles.fieldB]: owner >= 0 && owner % 2 === 1,
                      [styles.bitSet]: set,
                      [styles.diagramHot]: owner >= 0 && owner === hotField
                    })}
                    onMouseEnter={() => setHotField(owner)}
                  >
                    {value === undefined ? "·" : set ? "1" : "0"}
                  </span>
                );
              })}
              {spans.map((span) => {
                const slice = span.owner >= 0 ? descriptor.slices![span.owner] : undefined;
                // --- A flag's bracket stays empty: its one cell already shows its value
                const label = !slice
                  ? t("panels.doc.nextRegs.unusedBits")
                  : isFlagSlice(slice)
                    ? "\u00a0"
                    : `$${hex2(sliceValue(value ?? 0, slice))}`;
                return (
                  <span
                    key={`s${span.high}`}
                    className={classnames(styles.diagramSpan, {
                      [styles.diagramSpanUnused]: !slice,
                      [styles.diagramHot]: !!slice && span.owner === hotField
                    })}
                    style={{ gridColumn: `${8 - span.high} / span ${span.high - span.low + 1}` }}
                    title={slice?.description}
                    onMouseEnter={() => setHotField(span.owner)}
                  >
                    {label}
                  </span>
                );
              })}
            </div>
          </section>

          {/* --- Every field */}
          <section className={styles.section}>
            <span className={styles.sectionLabel}>{t("panels.doc.nextRegs.section.fields")}</span>
            {descriptor.slices?.length ? (
              <div className={styles.fieldList} onMouseLeave={() => setHotField(-1)}>
                {descriptor.slices.map((slice, index) => {
                  const fieldValue = sliceValue(value ?? 0, slice);
                  const options = Object.keys(slice.valueSet ?? {}).map(Number);
                  const chips = options.length > 0 && options.length <= MAX_VALUE_CHIPS;
                  const named = slice.valueSet?.[fieldValue];
                  return (
                    <div
                      key={index}
                      className={classnames(styles.fieldItem, { [styles.fieldItemHot]: index === hotField })}
                      onMouseEnter={() => setHotField(index)}
                    >
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
                        {slice.description}
                        {!chips && named && (
                          <>
                            {slice.description && " — "}
                            <span className={styles.fieldNamed}>{named}</span>
                          </>
                        )}
                        {chips && (
                          <span className={styles.valueChips}>
                            {options.map((option) => (
                              <span
                                key={option}
                                className={classnames(styles.valueChip, {
                                  [styles.valueChipCurrent]: value !== undefined && option === fieldValue
                                })}
                              >
                                <span className={styles.valueChipCode}>
                                  {isFlagSlice(slice) ? option : `$${hex2(option)}`}
                                </span>
                                {slice.valueSet![option]}
                              </span>
                            ))}
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <span className={styles.note}>{t("panels.doc.nextRegs.noFields")}</span>
            )}
          </section>

          {/* --- Where the book files it */}
          <section className={styles.section}>
            <span className={styles.sectionLabel}>{t("panels.doc.nextRegs.section.categories")}</span>
            <span className={styles.categoryChips}>
              {categories.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={styles.categoryChip}
                  title={t("panels.doc.nextRegs.showCategoryTitle")}
                  onClick={() => onShowCategory(id)}
                >
                  {t(NEXT_REG_CATEGORIES.find((c) => c.id === id)!.nameKey)}
                </button>
              ))}
            </span>
          </section>

          {/* --- The instruction that writes the value back */}
          {value !== undefined && !descriptor.isReadOnly && (
            <section className={styles.section}>
              <span className={styles.sectionLabel}>{t("panels.doc.nextRegs.section.code")}</span>
              <span className={styles.codeLine}>
                <code>{nextRegInstruction(descriptor.id, value)}</code>
                <SmallIconButton
                  iconName={copied ? "check" : "copy"}
                  title={copied ? t("panels.doc.nextRegs.copied") : t("panels.doc.nextRegs.copy")}
                  clicked={copy}
                />
              </span>
            </section>
          )}
        </div>
      </ScrollViewer>
    </>
  );
};
