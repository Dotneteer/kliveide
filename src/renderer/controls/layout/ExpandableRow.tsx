import { useState } from "react";
import { Icon } from "@renderer/controls/Icon";
import { Column } from "./Column";
import styles from "./Layout.module.scss";

type Props = {
  /**
   * Heading shown in the expandable row trigger.
   *
   * A node rather than a string, so a heading made of several kinds of fact can render as several
   * elements. The `.NEX` viewer's bank headers were the case that forced it: `Bank $05 (5) | PC:
   * $C004` was one baked string with pipes doing the work of layout, which left the bank number,
   * its decimal echo and the program-counter mark sharing one run of colourless text.
   */
  heading: React.ReactNode;
  /**
   * Optional command rendered immediately after the heading.
   *
   * Beside the heading, not at the far edge: the action acts *on* what the heading names, and the
   * row's disclosure already owns the leading edge. It used to be pushed to the opposite end of the
   * row by `.headingText`'s `flex: 1 1 auto`, where it sat on top of the chevron.
   */
  headingAction?: React.ReactNode;
  /** Optional right-aligned detail — a size, a count. Never a control. */
  meta?: React.ReactNode;
  /** Nested content shown when the row is expanded. */
  children?: React.ReactNode;
  /** Initial expanded state used when the row first mounts. */
  initialExpanded?: boolean;
  /** Receives expansion state changes after user toggles the row. */
  onExpanded?: (expanded: boolean) => void;
};

/**
 * Provides a collapsible row section for optionally visible nested controls.
 *
 * The disclosure chevron leads. It is the control the row exists for, reading starts at the left,
 * and a stack of these is scanned down its leading edge — a chevron at the far right means the
 * affordance sits at the opposite end of the row from the name it opens.
 */
export const ExpandableRow = ({
  heading,
  headingAction,
  meta,
  children,
  initialExpanded,
  onExpanded
}: Props) => {
  const [isExpanded, setIsExpanded] = useState(initialExpanded ?? false);
  const toggle = () => {
    setIsExpanded(!isExpanded);
    onExpanded?.(!isExpanded);
  };

  return (
    <div className={styles.expandableRow}>
      <div
        className={styles.expandableRowHeading}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggle();
          }
        }}
      >
        <Icon
          iconName={isExpanded ? "chevron-down" : "chevron-right"}
          width={16}
          height={16}
          fill="--color-command-icon"
        />
        <span className={styles.headingText}>{heading}</span>
        {headingAction && (
          <span className={styles.headingAction} onClick={(event) => event.stopPropagation()}>
            {headingAction}
          </span>
        )}
        {meta && <span className={styles.headingMeta}>{meta}</span>}
      </div>
      {isExpanded && <Column>{children}</Column>}
    </div>
  );
};
