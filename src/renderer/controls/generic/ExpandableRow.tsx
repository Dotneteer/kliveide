import styles from "./GeneralControls.module.scss";
import { useState } from "react";
import { Icon } from "../Icon";
import { Column } from "./Column";

type Props = {
  heading: string;
  children?: React.ReactNode;
  expanded?: boolean;
  onExpanded?: (expanded: boolean) => void;
};

export const ExpandableRow = ({
  heading,
  children,
  expanded,
  onExpanded
}: Props) => {
  const [isExpanded, setIsExpanded] = useState(expanded ?? false);
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
          fill='--color-command-icon'
        />
      </div>
      {isExpanded && <Column>{children}</Column>}
    </div>
  );
};
