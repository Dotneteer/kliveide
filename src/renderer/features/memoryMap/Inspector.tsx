import type { ReactNode } from "react";
import classnames from "classnames";

import ScrollViewer from "@renderer/controls/ScrollViewer";
import styles from "./MemoryMap.module.scss";

/*
 * The inspector column (`dev/plans/MEMORY_DISASSEMBLY_VIEWS_PLAN.md` §4.5): a `46ch` column beside
 * the listing (stacked under it below `120ch` of the document's width) with a header - the address,
 * `PART:offset` and a kind badge - and the view's sections in one `ScrollViewer`. "A File And Its
 * Parts: An Inspector Column Beside The List" is the pattern.
 */

export const InspectorColumn = ({
  address,
  sub,
  badge,
  readOnly,
  children
}: {
  address: ReactNode;
  sub?: ReactNode;
  badge?: string;
  /** The badge takes the warning hue: the thing inspected cannot be written */
  readOnly?: boolean;
  children: ReactNode;
}) => (
  <aside className={styles.inspector}>
    <div className={styles.inspectorHead}>
      <span className={styles.inspectorAddress}>{address}</span>
      {sub && <span className={styles.inspectorSub}>{sub}</span>}
      {badge && (
        <span className={classnames(styles.kindBadge, { [styles.kindBadgeReadOnly]: readOnly })}>{badge}</span>
      )}
    </div>
    <ScrollViewer className={styles.inspectorScroll} thinScrollBar>
      {children}
    </ScrollViewer>
  </aside>
);

/** The column with nothing to inspect yet: one hint where the sections would be */
export const InspectorEmpty = ({ message }: { message: string }) => (
  <aside className={styles.inspector}>
    <div className={styles.inspectorEmpty}>{message}</div>
  </aside>
);

export const InspectorSection = ({
  title,
  aside,
  children
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) => (
  <section className={styles.section}>
    <div className={styles.sectionHead}>
      <span className={styles.sectionTitle}>{title}</span>
      {aside && <span className={styles.sectionAside}>{aside}</span>}
    </div>
    {children}
  </section>
);

/** Label/value pairs in two `ch` columns */
export const Fields = ({ children }: { children: ReactNode }) => <div className={styles.fields}>{children}</div>;

export const Field = ({
  label,
  children,
  plain,
  title
}: {
  label: string;
  children: ReactNode;
  /** Text rather than a value: no accent */
  plain?: boolean;
  title?: string;
}) => (
  <>
    <span className={styles.fieldLabel}>{label}</span>
    <span className={plain ? styles.fieldPlain : styles.fieldValue} title={title}>
      {children}
    </span>
  </>
);

/** A link-styled button inside the inspector */
export const InspectorLink = ({
  children,
  title,
  onClick
}: {
  children: ReactNode;
  title?: string;
  onClick: () => void;
}) => (
  <button type="button" className={styles.link} title={title} onClick={onClick}>
    {children}
  </button>
);

export const InspectorButton = ({
  children,
  title,
  disabled,
  onClick
}: {
  children: ReactNode;
  title?: string;
  disabled?: boolean;
  onClick: () => void;
}) => (
  <button type="button" className={styles.button} title={title} disabled={disabled} onClick={onClick}>
    {children}
  </button>
);
