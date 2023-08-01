import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { TooltipFactory } from "./Tooltip";
import classnames from "@renderer/utils/classnames";
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
export const IconButton = ({
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
  const ref = useRef<HTMLDivElement>(null);
  const [keyDown, setKeyDown] = useState(null);
  const isActive = enable;

  useEffect(() => {
    setKeyDown(false);
  }, [ref.current]);
  return (
    <div
      ref={ref}
      className={classnames(styles.iconButton, {
        [styles.enabled]: isActive,
        [styles.noPadding]: noPadding
      })}
      style={{ width: buttonWidth, height: buttonHeight }}
      onMouseDown={() => setKeyDown(true)}
      onMouseLeave={() => setKeyDown(false)}
      onClick={() => {
        if (isActive) clicked?.();
        setKeyDown(false);
      }}
    >
      <div
        className={classnames(styles.iconWrapper, {
          [styles.keyDown]: keyDown && isActive,
          [styles.selected]: selected
        })}
      >
        <TooltipFactory
          refElement={ref.current}
          placement='right'
          offsetX={-16}
          offsetY={28}
        >
          {title}
        </TooltipFactory>
        <Icon
          iconName={iconName}
          fill={isActive ?? true ? fill : "--bgcolor-toolbarbutton-disabled"}
          width={size}
          height={size}
        />
      </div>
    </div>
  );
};

type SmallProps = {
  iconName: string;
  title?: string;
  enable?: boolean;
  selected?: boolean;
  clicked?: () => void;
};

export const SmallIconButton = ({
  iconName,
  title,
  enable,
  selected,
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
      fill='--color-command-icon'
      noPadding={true}
    />
  );
};