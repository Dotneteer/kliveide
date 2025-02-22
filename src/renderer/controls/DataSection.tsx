import { ReactNode } from "react";
import styles from "./DataSection.module.scss";
import { Icon } from "./Icon";
import classnames from "classnames";

type DataSectionProps = {
  title: string;
  expanded: boolean;
  expandable?: boolean;
  children?: ReactNode;
  changed?: (expanded: boolean) => void;
};

export const DataSection = ({
  title,
  expanded,
  expandable = true,
  children,
  changed
}: DataSectionProps) => {
  return (
    <div className={classnames(styles.dataSectionPanel, {[styles.expandable]: expandable} )}>
      <div
        className={styles.sectionHeader}
        onClick={() => {
          if (expandable) {
            changed?.(!expanded);
          }
        }}
      >
        <Icon
          iconName={(expandable) ? "chevron-right" : "circle-outline"}
          width={16}
          height={16}
          fill='--color-chevron'
          rotate={expanded ? 90 : 0}
        />
        <span className={styles.headerText}>{title}</span>
      </div>
      <div className={styles.sectionBody}>
        {expanded && children}
      </div>
    </div>
  );
};
