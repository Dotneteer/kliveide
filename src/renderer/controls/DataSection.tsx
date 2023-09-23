import { ReactNode } from "react";
import styles from "./DataSection.module.scss";
import { Icon } from "./Icon";

type DataSectionProps = {
  title: string;
  expanded: boolean;
  children?: ReactNode;
  changed?: (expanded: boolean) => void;
};

export const DataSection = ({
  title,
  expanded,
  children,
  changed
}: DataSectionProps) => {
  return (
    <div className={styles.dataSectionPanel}>
      <div
        className={styles.sectionHeader}
        onClick={() => {
          changed?.(!expanded);
        }}
      >
        <Icon
          iconName='chevron-right'
          width={16}
          height={16}
          fill='--color-chevron'
          rotate={expanded ? 90 : 0}
        />
        <span className={styles.headerText}>{title}</span>
      </div>
      {expanded && children}
    </div>
  );
};
