import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import classnames from "classnames";

import { Icon } from "@renderer/controls/Icon";
import { SectionHeader } from "./index";
import styles from "./FileFacts.module.scss";

/*
 * The facts a file viewer shows about a file: a state file, a debug recording, a snapshot, an RZX
 * recording. Collapsible sections under a `SectionHeader` ("A Heading Inside Panel Content Is
 * `SectionHeader`, Not `PanelHeader`"), each a grid of label/value facts in `ch` columns, the data
 * hierarchy's colours, notes in the status tones, and the file's picture framed beside its summary.
 * It replaces the pre-modernization `ExpandableRow` / `LabeledText` / `LabeledFlag` rows these viewers
 * were built from. The viewers scroll in their shell (`GenericFilePanel`, a `ScrollViewer`).
 */

/** A collapsible section: a chevron and a title, an optional count or action, then its facts */
export const FactSection = ({
  title,
  meta,
  actions,
  expanded,
  onExpandedChange,
  children
}: {
  title: ReactNode;
  /** A quiet detail after the title: a count, a size */
  meta?: ReactNode;
  /** Commands on what the section names, after the title (never inside the clickable heading) */
  actions?: ReactNode;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  children?: ReactNode;
}) => (
  <section className={styles.section}>
    <div className={styles.head}>
      <SectionHeader xclass={styles.heading} clicked={() => onExpandedChange(!expanded)}>
        <span
          className={styles.toggle}
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onExpandedChange(!expanded);
            }
          }}
        >
          <Icon iconName={expanded ? "chevron-down" : "chevron-right"} width={16} height={16} fill="--color-command-icon" />
          <span className={styles.title}>{title}</span>
        </span>
        {meta !== undefined && <span className={styles.meta}>{meta}</span>}
      </SectionHeader>
      {actions && <span className={styles.actions}>{actions}</span>}
    </div>
    {expanded && <div className={styles.body}>{children}</div>}
  </section>
);

/**
 * Label/value facts in two columns. The label column is at least `labelWidth` (a `ch` width, so the
 * sections line up) and grows to the longest label, so a long or translated label never runs into
 * its value.
 */
export const Facts = ({ children, labelWidth = "18ch" }: { children?: ReactNode; labelWidth?: string }) => (
  <dl className={styles.facts} style={{ gridTemplateColumns: `minmax(${labelWidth}, max-content) minmax(0, 1fr)` }}>
    {children}
  </dl>
);

/** Short facts side by side, as many to a line as fit: registers, ports */
export const FactCells = ({
  children,
  cellWidth = "20ch",
  labelWidth
}: {
  children?: ReactNode;
  cellWidth?: string;
  /** The labels' width, so the values line up from cell to cell (`AF:` and `AF':`) */
  labelWidth?: string;
}) => (
  <dl className={styles.cells} style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${cellWidth}, 1fr))` }}>
    <CellLabelWidth.Provider value={labelWidth}>{children}</CellLabelWidth.Provider>
  </dl>
);

/** The label width of the `FactCells` a fact sits in, if any */
const CellLabelWidth = createContext<string | undefined>(undefined);

const FactLabel = ({ children }: { children: ReactNode }) => {
  const width = useContext(CellLabelWidth);
  return <dt style={width ? { flex: `0 0 ${width}` } : undefined}>{children}</dt>;
};

/**
 * One fact. `tone="state"` paints the value as the register panels paint live state
 * (`--color-state-value`): a snapshot's registers are a machine's state; a file's facts stay neutral.
 */
export const Fact = ({
  label,
  children,
  tone = "neutral",
  title
}: {
  label: ReactNode;
  children?: ReactNode;
  tone?: "neutral" | "state";
  title?: string;
}) => (
  <div className={styles.fact}>
    <FactLabel>{label}</FactLabel>
    <dd className={classnames({ [styles.state]: tone === "state" })} title={title}>
      {children}
    </dd>
  </div>
);

/** A yes/no fact: the Next Registers' flag, a filled dot for yes and a hollow one for no */
export const FactFlag = ({ label, value, title }: { label: ReactNode; value: boolean; title?: string }) => (
  <div className={styles.fact}>
    <FactLabel>{label}</FactLabel>
    <dd className={styles.flag} title={title}>
      <Icon
        iconName={value ? "circle-filled" : "circle-outline"}
        width={14}
        height={14}
        fill={value ? "--color-state-value" : "--data-secondary"}
      />
    </dd>
  </div>
);

/** A sentence about the file: plain, a warning or an error */
export const FactNote = ({ children, tone = "info" }: { children?: ReactNode; tone?: "info" | "warning" | "error" }) => (
  <p className={classnames(styles.note, styles[`note_${tone}`])}>{children}</p>
);

/** The summary's facts with the file's picture beside them; the picture wraps under them when narrow */
export const FactsWithPicture = ({ picture, children }: { picture?: ReactNode; children?: ReactNode }) => (
  <div className={styles.withPicture}>
    <div className={styles.withPictureFacts}>{children}</div>
    {picture && <figure className={styles.picture}>{picture}</figure>}
  </div>
);
