import { useCallback, useEffect, memo, useState } from "react";
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
 * Represents the statusbar of the emulator
 */
export const IconButton = memo(({
  iconName,
  iconSize: size = 24,
  buttonWidth = 36,
  buttonHeight = 34,
  title,
  fill,
  enable = true,
  selected,
  clicked,
  noPadding
}: Props) => {
  const ref = useTooltipRef();
  const [keyDown, setKeyDown] = useState(null);
  const [hover, setHover] = useState(false);
  const isActive = enable;

  useEffect(() => {
    setKeyDown(false);
  }, []);

  const handleMouseEnter = useCallback(() => setHover(true), []);
  const handleMouseDown = useCallback(() => setKeyDown(true), []);
  const handleMouseLeave = useCallback(() => { setKeyDown(false); setHover(false); }, []);
  const handleClick = useCallback(() => {
    if (isActive) clicked?.();
    setKeyDown(false);
  }, [isActive, clicked]);

  return (
    <div
      ref={ref}
      className={classnames(styles.iconButton, {
        [styles.enabled]: isActive,
        [styles.noPadding]: noPadding
      })}
      style={{
        width: buttonWidth + (noPadding ? 0 : 4),
        height: buttonHeight,
        backgroundColor: hover && enable ? "var(--bgcolor-toolbarbutton-hover)" : "transparent"
      }}
      onMouseEnter={handleMouseEnter}
      onMouseDown={handleMouseDown}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <div
        className={classnames(styles.iconWrapper, {
          [styles.keyDown]: keyDown && isActive,
          [styles.selected]: selected
        })}
      >
        <TooltipFactory
          refElement={ref.current}
          placement="right"
          offsetX={-12}
          offsetY={28}
          content={title}
        />
        <Icon
          iconName={iconName}
          fill={isActive ?? true ? fill : "--bgcolor-toolbarbutton-disabled"}
          width={size}
          height={size}
          opacity={isActive ? 1.0 : 0.5}
        />
      </div>
    </div>
  );
});

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
