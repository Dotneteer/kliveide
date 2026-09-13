import { Icon } from "./Icon";
import classnames from "classnames";
import styles from "./TabButton.module.scss";
import { TooltipFactory, useTooltipRef } from "./Tooltip";

type Props = {
  hide?: boolean;
  /** Extra class on the button, so a parent can drive visibility from CSS. */
  xclass?: string;
  fill?: string;
  rotate?: number;
  iconName: string;
  useSpace?: boolean;
  title?: string;
  disabled?: boolean;
  clicked?: () => void;
};

export function TabButton ({
  hide,
  xclass,
  fill = "--color-command-icon",
  rotate = 0,
  iconName,
  useSpace = false,
  title,
  disabled,
  clicked
}: Props) {
  const ref = useTooltipRef<HTMLButtonElement>();

  return (
    <>
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        aria-label={title}
        className={classnames(styles.tabButton, xclass)}
        onClick={(e) => {
          if (!disabled) {
            e.stopPropagation();
            clicked?.();
          }
        }}
      >
        {title && (
          <TooltipFactory
            refElement={ref.current}
            placement='right'
            offsetX={8}
            offsetY={32}
            content={title}
          />
        )}

        {hide && <div className={styles.placeholder}></div>}
        {!hide && (
          <Icon
            iconName={iconName}
            fill={disabled ? "--color-command-icon-disabled" : fill}
            width={20}
            height={20}
            rotate={rotate}
          />
        )}
      </button>
      {useSpace && <TabButtonSpace />}
    </>
  );
}


export const TabButtonSpace = () => <div style={{ paddingRight: 8 }} />;

export const TabButtonSeparator = () => <div className={styles.separator}></div>
