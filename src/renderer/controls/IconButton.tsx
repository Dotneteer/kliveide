import { memo } from "react";
import { Icon } from "./Icon";
import { TooltipFactory, useTooltipRef } from "./Tooltip";
import classnames from "classnames";
import styles from "./IconButton.module.scss";

type Props = {
  iconName: string;
  iconSize?: number;
  buttonWidth?: number;
  buttonHeight?: number;
  title?: string;
  fill?: string;
  enable?: boolean;
  selected?: boolean;
  clicked?: () => void;
  noPadding?: boolean;
};

/**
 * An icon-only toolbar button.
 *
 * This is a real `<button>`: hover, press, disabled and focus are CSS states rather than React
 * state. The previous implementation tracked hover in `useState` and wrote an inline
 * `backgroundColor`, which meant it could not transition, could not be restyled from a stylesheet,
 * and drifted from `ToolbarSplitButton` — a genuine `<button>` — sitting beside it in the same
 * toolbar. Using the element's own semantics also gets keyboard activation and `:focus-visible`
 * for free, where the old `<div>` had neither.
 */
export const IconButton = memo(
  ({
    iconName,
    iconSize: size = 24,
    buttonWidth = 30,
    buttonHeight = 30,
    title,
    fill,
    enable = true,
    selected,
    clicked,
    noPadding
  }: Props) => {
    const ref = useTooltipRef<HTMLButtonElement>();

    return (
      <button
        ref={ref}
        type="button"
        disabled={!enable}
        aria-label={title}
        aria-pressed={selected}
        className={classnames(styles.iconButton, { [styles.noPadding]: noPadding })}
        style={{
          // Totals including the 1px padding, which border-box counts inside the box.
          width: buttonWidth + (noPadding ? 0 : 4),
          height: buttonHeight + (noPadding ? 0 : 2)
        }}
        onClick={() => clicked?.()}
      >
        <div className={classnames(styles.iconWrapper, { [styles.selected]: selected })}>
          <TooltipFactory
            refElement={ref.current}
            placement="right"
            offsetX={-12}
            offsetY={28}
            content={title}
          />
          <Icon
            iconName={iconName}
            fill={enable ? fill : "--text-disabled"}
            width={size}
            height={size}
          />
        </div>
      </button>
    );
  }
);

type SmallProps = {
  iconName: string;
  title?: string;
  enable?: boolean;
  selected?: boolean;
  fill?: string;
  clicked?: () => void;
};

export const SmallIconButton = ({
  iconName,
  title,
  enable,
  selected,
  fill = "--color-command-icon",
  clicked
}: SmallProps) => {
  return (
    <IconButton
      iconName={iconName}
      iconSize={18}
      buttonHeight={24}
      buttonWidth={24}
      title={title}
      enable={enable}
      selected={selected}
      clicked={clicked}
      fill={fill}
    />
  );
};
