import { useState } from "react";
import { Icon } from "@renderer/controls/Icon";
import { Column } from "./Column";
import styles from "./Layout.module.scss";

type Props = {
  /** Heading text shown in the expandable row trigger. */
  heading: string;
  /** Nested content shown when the row is expanded. */
  children?: React.ReactNode;
  /** Initial expanded state used when the row first mounts. */
  initialExpanded?: boolean;
  /** Receives expansion state changes after user toggles the row. */
  onExpanded?: (expanded: boolean) => void;
};

/**
 * Provides a collapsible row section for optionally visible nested controls.
 */
export const ExpandableRow = ({
  heading,
  children,
  initialExpanded,
  onExpanded
}: Props) => {
  const [isExpanded, setIsExpanded] = useState(initialExpanded ?? false);
  return (
    <div className={styles.expandableRow}>
      <div
        className={styles.expandableRowHeading}
        onClick={() => {
          setIsExpanded(!isExpanded);
          onExpanded?.(!isExpanded);
        }}
      >
        <span className={styles.headingText}>{heading}</span>
        <Icon
          iconName={isExpanded ? "chevron-down" : "chevron-right"}
          width={16}
          height={16}
          fill="--color-command-icon"
        />
      </div>
      {isExpanded && <Column>{children}</Column>}
    </div>
  );
};
