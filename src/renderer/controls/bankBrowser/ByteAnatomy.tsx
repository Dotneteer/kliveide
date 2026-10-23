import { useState } from "react";
import classnames from "classnames";
import { BankDetailsSection } from "./BankBrowser";
import { useT } from "@common/i18n/useT";
import styles from "./ByteAnatomy.module.scss";

/*
 * A run of bytes, explained field by field: the bytes as a strip, grouped by field, above a list of
 * the fields with their decoded values. Pointing at a byte or a field highlights both, and explains
 * the field underneath when it has a meaning to tell.
 *
 * The TAP viewer's header bytes (`TapeHeaderBytes`) and the HT-1080Z tape viewer's parts and lines
 * both draw with it. The field list is made of buttons, so the keyboard reaches every field; the
 * strip repeats the list for the eye and is hidden from screen readers.
 */

export type ByteAnatomyField = {
  /** Stable within one anatomy */
  key: string;
  /** The field's first and last byte offset */
  first: number;
  last: number;
  name: string;
  /** The decoded value, short */
  value: string;
  /** What the field means, in a sentence or two */
  meaning?: string;
  /**
   * A keyword token (its byte in the token colour), a long run (abbreviated in the strip), or text
   * (its value quoted, so spaces at its ends show)
   */
  kind?: "token" | "data" | "text";
};

/** A data run longer than this shows its first bytes and an ellipsis */
const RUN_SHOWN = 8;

const hex2 = (value: number) => value.toString(16).toUpperCase().padStart(2, "0");

type Props = {
  title: string;
  bytes: Uint8Array;
  fields: ByteAnatomyField[];
  /** The field explained before anyone points at one */
  initialKey?: string;
  /** Prefix of the strip's and the meaning's test ids */
  testId?: string;
};

export const ByteAnatomy = ({ title, bytes, fields, initialKey, testId = "byte-anatomy" }: Props) => {
  const t = useT();
  const [active, setActive] = useState(initialKey ?? fields[0]?.key);
  const current = fields.find((f) => f.key === active) ?? fields[0];
  if (!current) return null;
  const hasMeaning = fields.some((f) => f.meaning);

  return (
    <BankDetailsSection title={title}>
      <div className={styles.strip} aria-hidden="true" data-testid={`${testId}-strip`}>
        {fields.map((field, index) => {
          const shortened = field.kind === "data" && field.last - field.first + 1 > RUN_SHOWN;
          const last = shortened ? field.first + RUN_SHOWN - 1 : field.last;
          return (
            <span
              key={field.key}
              className={classnames(styles.group, {
                [styles.alt]: index % 2 === 1,
                [styles.token]: field.kind === "token",
                [styles.active]: field.key === current.key
              })}
              data-field={field.key}
              onMouseEnter={() => setActive(field.key)}
            >
              {Array.from(bytes.subarray(field.first, last + 1)).map((b, i) => (
                <span key={i} className={styles.cell} title={t("panels.tape.headerOffset", { offset: field.first + i })}>
                  {hex2(b)}
                </span>
              ))}
              {shortened && <span className={classnames(styles.cell, styles.more)}>…</span>}
            </span>
          );
        })}
      </div>

      <div className={styles.fields}>
        {fields.map((field) => (
          <button
            key={field.key}
            type="button"
            className={classnames(styles.field, { [styles.active]: field.key === current.key })}
            aria-pressed={field.key === current.key}
            onMouseEnter={() => setActive(field.key)}
            onFocus={() => setActive(field.key)}
            onClick={() => setActive(field.key)}
          >
            <span className={styles.offset}>
              {field.first === field.last ? field.first : `${field.first}–${field.last}`}
            </span>
            <span className={styles.name}>{field.name}</span>
            <span className={classnames(styles.value, { [styles.text]: field.kind === "text" })}>{field.value}</span>
          </button>
        ))}
      </div>

      {hasMeaning && (
        <div className={styles.meaning} aria-live="polite" data-testid={`${testId}-meaning`}>
          {current.meaning}
        </div>
      )}
    </BankDetailsSection>
  );
};
