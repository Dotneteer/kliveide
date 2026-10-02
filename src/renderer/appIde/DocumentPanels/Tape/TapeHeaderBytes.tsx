import { useMemo, useState } from "react";
import classnames from "classnames";
import { BankDetailsSection } from "@renderer/controls/bankBrowser/BankBrowser";
import { initialHeaderField, tapeHeaderFields } from "./tapeHeaderFields";
import styles from "./TapeHeaderBytes.module.scss";

/*
 * A header block's 19 bytes, explained (option C of the header mockups): the bytes as a strip,
 * grouped by field, above a list of the fields with their decoded values. Pointing at a byte or a
 * field highlights both and explains the field underneath.
 *
 * One field is explained from the start - the autostart line or the load address, what a header is
 * mostly for - so the panel teaches something before anyone hovers. The field list is made of
 * buttons, so the keyboard reaches every explanation too; the strip repeats the list for the eye
 * and is hidden from screen readers.
 */

const hex2 = (value: number) => value.toString(16).toUpperCase().padStart(2, "0");

type Props = {
  bytes: Uint8Array;
  /** The block index of the data block the header describes */
  dataIndex?: number;
};

export const TapeHeaderBytes = ({ bytes, dataIndex }: Props) => {
  const fields = useMemo(() => tapeHeaderFields(bytes, dataIndex), [bytes, dataIndex]);
  const [active, setActive] = useState(() => initialHeaderField(fields));
  const current = fields.find((f) => f.key === active) ?? fields[0];

  return (
    <BankDetailsSection title="Header bytes">
      <div className={styles.strip} aria-hidden="true" data-testid="tape-header-strip">
        {fields.map((field, index) => (
          <span
            key={field.key}
            className={classnames(styles.group, {
              [styles.alt]: index % 2 === 1,
              [styles.active]: field.key === current.key
            })}
            data-field={field.key}
            onMouseEnter={() => setActive(field.key)}
          >
            {Array.from(bytes.subarray(field.first, field.last + 1)).map((b, i) => (
              <span key={i} className={styles.cell} title={`Offset ${field.first + i}`}>
                {hex2(b)}
              </span>
            ))}
          </span>
        ))}
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
            <span className={styles.value}>{field.value}</span>
          </button>
        ))}
      </div>

      <div className={styles.meaning} aria-live="polite" data-testid="tape-header-meaning">
        {current.meaning}
      </div>
    </BankDetailsSection>
  );
};
