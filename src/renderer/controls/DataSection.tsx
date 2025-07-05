import React, { ReactNode, useCallback, useMemo, KeyboardEvent } from "react";
import styles from "./DataSection.module.scss";
import { Icon } from "./Icon";
import classnames from "classnames";

/**
 * Props for the DataSection component
 */
export interface DataSectionProps {
  /** Title displayed in the section header */
  title: string;
  /** Controls whether the section content is visible */
  expanded: boolean;
  /** When true, allows the section to be expanded/collapsed */
  expandable?: boolean;
  /** Content to display when section is expanded */
  children?: ReactNode;
  /** Callback fired when expanded state changes */
  changed?: (expanded: boolean) => void;
}

/**
 * A collapsible section component with a header and expandable content area.
 * Can be controlled by the parent component through the expanded prop.
 */
export const DataSection = React.memo(({
  title,
  expanded,
  expandable = true,
  children,
  changed
}: DataSectionProps): JSX.Element => {
  // Memoize classnames calculation
  const panelClasses = useMemo(() => 
    classnames(styles.dataSectionPanel, {
      [styles.expandable]: expandable
    }),
    [expandable]
  );
  
  // Handle click event with useCallback
  const handleToggle = useCallback(() => {
    if (expandable) {
      changed?.(!expanded);
    }
  }, [expandable, expanded, changed]);
  
  // Handle keyboard events for accessibility
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLButtonElement>) => {
    if (expandable && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      changed?.(!expanded);
    }
  }, [expandable, expanded, changed]);

  return (
    <div className={panelClasses}>
      {expandable ? (
        <button
          type="button"
          className={styles.sectionHeader}
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
          aria-expanded={expanded}
          aria-controls={`section-content-${title.replace(/\s+/g, '-').toLowerCase()}`}
        >
          <Icon
            iconName="chevron-right"
            width={16}
            height={16}
            fill='--color-chevron'
            rotate={expanded ? 90 : 0}
          />
          <span className={styles.headerText}>{title}</span>
        </button>
      ) : (
        <div className={styles.sectionHeader}>
          <Icon
            iconName="circle-outline"
            width={16}
            height={16}
            fill='--color-chevron'
          />
          <span className={styles.headerText}>{title}</span>
        </div>
      )}
      <div 
        className={styles.sectionBody}
        id={`section-content-${title.replace(/\s+/g, '-').toLowerCase()}`}
      >
        {expanded && children}
      </div>
    </div>
  );
});
